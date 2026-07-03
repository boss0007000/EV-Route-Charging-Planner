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
      // No compatible charger found — go as far as possible and warn
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
      break;
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

async function findBestCharger(
  nearPoint: LatLng,
  supportedConnectors: ConnectorType[],
  minPowerKw: number,
  cacheTtlHours: number,
): Promise<ChargerStation | null> {
  const radiusKm = ROUTE_CONSTANTS.chargerSearchRadiusKm;
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
