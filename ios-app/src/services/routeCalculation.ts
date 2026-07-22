/**
 * Route calculation service — orchestrates the full route planning flow.
 *
 * Steps:
 * 1. Get directions from Google Maps
 * 2. Calculate if charging is needed (with safety buffer)
 * 3. If needed: find charging point, query OCM, select best charger
 * 4. Estimate charge time, calculate remaining range to destination
 * 5. Repeat until destination is reachable
 * 6. Return complete RouteResult
 */

import {
  getDirections,
  pointAtDistanceKm,
  decodePolyline,
} from './googleMaps';
import {fetchChargersNearPoint} from './openChargeMap';
import {getCachedChargersNear} from '../database/chargerCache';
import {estimateChargeTimeMin} from './chargingCalculation';
import {
  findChargeNeededPointKm,
  batteryAfterDriving,
} from '../utils/rangeCalculations';
import {haversineDistanceKm} from '../utils/geoTileCache';
import {
  Vehicle,
  LatLng,
  PlaceResult,
  RouteResult,
  RouteLeg,
  ChargingStop,
  ChargerStation,
  ConnectorType,
  RouteSettings,
  DEFAULT_ROUTE_SETTINGS,
} from '../types';
import {ROUTE_CONSTANTS} from '../constants/config';

const MAX_CHARGING_STOPS = 5;

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * Thrown when the route needs a charging stop but no compatible charger
 * could be found nearby (even after expanding the search radius). Carries
 * enough detail for the UI to suggest a fix rather than silently pretending
 * the trip is completable.
 */
export class RouteInfeasibleError extends Error {
  isRouteInfeasible = true;
  /** Distance (km) from the original start to the point that couldn't be reached. */
  distanceToFailureKm: number;
  /** Human-readable description of where the trip breaks down. */
  strandedNear: string;
  /**
   * Starting battery % that would have been needed to reach `strandedNear`
   * with the reserve buffer intact — null if that would require >100%
   * (i.e. no realistic starting charge fixes it).
   */
  suggestedMinStartBatteryPercent: number | null;

  constructor(
    message: string,
    distanceToFailureKm: number,
    strandedNear: string,
    suggestedMinStartBatteryPercent: number | null,
  ) {
    super(message);
    this.distanceToFailureKm = distanceToFailureKm;
    this.strandedNear = strandedNear;
    this.suggestedMinStartBatteryPercent = suggestedMinStartBatteryPercent;
  }
}

/**
 * Thrown when a trip needs more charging stops than MAX_CHARGING_STOPS
 * supports. Every candidate charger along the way was reachable — the
 * planner just ran out of stops before running out of road. Previously this
 * case fell through silently and returned a RouteResult whose legs stopped
 * short of the real destination, which the UI then rendered as a completed,
 * successful plan.
 */
export class RouteTooLongError extends Error {
  isRouteTooLong = true;
  /** How many charging stops the planner scheduled before giving up. */
  stopsPlanned: number;
  /** How much of the trip (km) was actually planned before hitting the cap. */
  distanceCoveredKm: number;
  /** The full trip distance (km), for context. */
  totalDistanceKm: number;

  constructor(
    message: string,
    stopsPlanned: number,
    distanceCoveredKm: number,
    totalDistanceKm: number,
  ) {
    super(message);
    this.stopsPlanned = stopsPlanned;
    this.distanceCoveredKm = distanceCoveredKm;
    this.totalDistanceKm = totalDistanceKm;
  }
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

export async function calculateRoute(
  vehicle: Vehicle,
  startPlace: PlaceResult,
  destinationPlace: PlaceResult,
  batteryPercent: number,
  efficiencyWhPerKm: number,
  settings: RouteSettings = DEFAULT_ROUTE_SETTINGS,
): Promise<RouteResult> {
  const originStr = startPlace.placeId
    ? `place_id:${startPlace.placeId}`
    : startPlace.description;
  const destStr = destinationPlace.placeId
    ? `place_id:${destinationPlace.placeId}`
    : destinationPlace.description;

  // Get full route polyline and total distance
  const fullRoute = await getDirections(originStr, destStr);

  const legs: RouteLeg[] = [];
  const chargingStops: ChargingStop[] = [];

  let currentBattery = batteryPercent;
  let startCoord: LatLng =
    startPlace.coordinate ?? fullRoute.polylinePoints[0];
  let coveredKm = 0;
  let stopCount = 0;

  // Remaining polyline slice (we consume it as we add legs)
  let remainingPolyline = fullRoute.polylinePoints;
  let reachedDestination = false;

  while (stopCount < MAX_CHARGING_STOPS) {
    const remainingDistanceKm = fullRoute.distanceKm - coveredKm;

    // Check if we can make it to the destination from here
    const chargeNeededAtKm = findChargeNeededPointKm(
      currentBattery,
      vehicle.usableCapacityKwh,
      efficiencyWhPerKm,
      remainingDistanceKm,
      settings.reserveBatteryPercent,
    );

    if (chargeNeededAtKm === null) {
      // No charging needed for the remaining leg
      const arrivalBattery = batteryAfterDriving(
        currentBattery,
        vehicle.usableCapacityKwh,
        efficiencyWhPerKm,
        remainingDistanceKm,
      );

      legs.push({
        from: stopCount === 0 ? startPlace.description : `Charging Stop ${stopCount}`,
        to: destinationPlace.description,
        distanceKm: remainingDistanceKm,
        durationMin: fullRoute.durationMin * (remainingDistanceKm / fullRoute.distanceKm),
        arrivalBatteryPercent: arrivalBattery,
        polylinePoints: remainingPolyline,
      });

      reachedDestination = true;
      break;
    }

    // Find the geographic point where we need to start looking for a charger
    const chargePointCoord = pointAtDistanceKm(
      remainingPolyline,
      chargeNeededAtKm,
    ) ?? remainingPolyline[remainingPolyline.length - 1];

    // Query for compatible chargers near that point
    const charger = await findBestCharger(
      chargePointCoord,
      vehicle.supportedConnectors,
      settings.minChargerPowerKw,
      settings.chargerCacheTtlHours,
    );

    if (!charger) {
      // No compatible charger found near the point where charging is needed,
      // even after expanding the search radius — the route is not feasible
      // as planned. Surface this clearly instead of silently reporting
      // success with an unrealistic (near-zero) arrival battery.
      const distanceToFailureKm = coveredKm + chargeNeededAtKm;

      // Suggest the starting battery % that would let the ORIGINAL starting
      // point reach the destination in one shot, avoiding this charger-less
      // stop entirely. (Using the distance to the failure point itself would
      // be circular here — that's exactly the distance the current battery
      // was already just barely able to cover.)
      const totalEnergyWh = vehicle.usableCapacityKwh * 1000;
      const neededEnergyWh =
        (settings.reserveBatteryPercent / 100) * totalEnergyWh +
        (fullRoute.distanceKm * efficiencyWhPerKm) / ROUTE_CONSTANTS.safetyBufferFactor;
      const rawSuggestedPercent = (neededEnergyWh / totalEnergyWh) * 100;
      const suggestedMinStartBatteryPercent =
        rawSuggestedPercent <= 100 && rawSuggestedPercent > batteryPercent
          ? Math.ceil(rawSuggestedPercent)
          : null;

      throw new RouteInfeasibleError(
        `No compatible charger found near ~${Math.round(distanceToFailureKm)} km into the trip ` +
          `(after ${stopCount === 0 ? startPlace.description : `Charging Stop ${stopCount}`}, ` +
          `heading to ${destinationPlace.description}). Try a higher starting battery percentage.`,
        distanceToFailureKm,
        `~${Math.round(distanceToFailureKm)} km from ${startPlace.description}`,
        suggestedMinStartBatteryPercent,
      );
    }

    // Distance from current position to the charger
    const distToChargerKm = haversineDistanceKm(startCoord, charger.coordinate);

    // Battery at arrival to the charger
    const arrivalBatteryAtCharger = batteryAfterDriving(
      currentBattery,
      vehicle.usableCapacityKwh,
      efficiencyWhPerKm,
      distToChargerKm,
    );

    // Leg from current position to charger
    const legPolyline = remainingPolyline.slice(
      0,
      Math.ceil(remainingPolyline.length * (distToChargerKm / remainingDistanceKm)),
    );

    legs.push({
      from:
        stopCount === 0 ? startPlace.description : `Charging Stop ${stopCount}`,
      to: charger.address || charger.networkName,
      distanceKm: distToChargerKm,
      durationMin: fullRoute.durationMin * (distToChargerKm / fullRoute.distanceKm),
      arrivalBatteryPercent: arrivalBatteryAtCharger,
      polylinePoints: legPolyline,
    });

    // Charge to target %
    const chargeFromPercent = Math.max(
      arrivalBatteryAtCharger,
      settings.reserveBatteryPercent,
    );
    const chargeToPercent = settings.maxChargeTargetPercent;

    const chargeTimeMin = estimateChargeTimeMin(
      vehicle,
      chargeFromPercent,
      chargeToPercent,
    );

    const distanceFromRoute = haversineDistanceKm(
      chargePointCoord,
      charger.coordinate,
    );

    chargingStops.push({
      charger,
      distanceFromRouteKm: distanceFromRoute,
      arrivalBatteryPercent: arrivalBatteryAtCharger,
      chargeFromPercent,
      chargeToPercent,
      estimatedChargeTimeMin: chargeTimeMin,
      departureBatteryPercent: chargeToPercent,
    });

    // Update state for next iteration
    currentBattery = chargeToPercent;
    coveredKm += distToChargerKm;
    startCoord = charger.coordinate;
    remainingPolyline = remainingPolyline.slice(legPolyline.length);
    stopCount++;
  }

  if (!reachedDestination) {
    // Every one of the MAX_CHARGING_STOPS stops found a charger and
    // succeeded — the trip is physically reachable, it just needs more
    // waypoints than this planner supports in one pass. Surfacing this as
    // an error (rather than returning the partial route) matches how
    // RouteInfeasibleError is already handled by the UI.
    throw new RouteTooLongError(
      `This trip needs more than ${MAX_CHARGING_STOPS} charging stops to complete — ` +
        `only reached ${Math.round(coveredKm)} km of ${Math.round(fullRoute.distanceKm)} km ` +
        `before running out of planning steps. Try a higher starting battery percentage, ` +
        `a higher arrival battery target, or split this into multiple trips.`,
      stopCount,
      coveredKm,
      fullRoute.distanceKm,
    );
  }

  const totalDist = legs.reduce((s, l) => s + l.distanceKm, 0);
  const totalDuration =
    legs.reduce((s, l) => s + l.durationMin, 0) +
    chargingStops.reduce((s, stop) => s + stop.estimatedChargeTimeMin, 0);

  return {
    legs,
    chargingStops,
    totalDistanceKm: fullRoute.distanceKm,
    totalDurationMin: totalDuration,
    needsCharging: chargingStops.length > 0,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Search for a compatible charger near a point, starting at the base
 * search radius and progressively widening if nothing is found — chargers
 * in sparsely-mapped areas are often just outside the base radius rather
 * than genuinely absent.
 */
async function findBestCharger(
  nearPoint: LatLng,
  supportedConnectors: ConnectorType[],
  minPowerKw: number,
  cacheTtlHours: number,
): Promise<ChargerStation | null> {
  const radii = [
    ROUTE_CONSTANTS.chargerSearchRadiusKm,
    ...ROUTE_CONSTANTS.chargerSearchRadiusExpansionsKm,
  ];

  for (const radiusKm of radii) {
    const best = await findBestChargerAtRadius(
      nearPoint,
      supportedConnectors,
      minPowerKw,
      cacheTtlHours,
      radiusKm,
    );
    if (best) return best;
  }

  return null;
}

async function findBestChargerAtRadius(
  nearPoint: LatLng,
  supportedConnectors: ConnectorType[],
  minPowerKw: number,
  cacheTtlHours: number,
  radiusKm: number,
): Promise<ChargerStation | null> {
  const cacheTtlMs = cacheTtlHours * 60 * 60 * 1000;

  // First try the local cache
  let candidates = await getCachedChargersNear(
    nearPoint.latitude,
    nearPoint.longitude,
    radiusKm,
  );

  // If cache is sparse, fetch from API
  if (candidates.length === 0) {
    try {
      candidates = await fetchChargersNearPoint(
        nearPoint.latitude,
        nearPoint.longitude,
        radiusKm,
        supportedConnectors,
        minPowerKw,
      );
    } catch {
      // API unavailable — continue with empty list
    }
  }

  // Filter by connector compatibility and minimum power
  const compatible = candidates.filter(
    station =>
      station.maxPowerKw >= minPowerKw &&
      station.connectors.some(c => supportedConnectors.includes(c.type)),
  );

  if (compatible.length === 0) return null;

  // Sort by distance to the charge-needed point
  compatible.sort((a, b) => {
    const da = haversineDistanceKm(nearPoint, a.coordinate);
    const db = haversineDistanceKm(nearPoint, b.coordinate);
    return da - db;
  });

  return compatible[0];
}
