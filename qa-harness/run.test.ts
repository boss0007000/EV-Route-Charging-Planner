/**
 * QA execution harness — runs all 1,000 generated cases through the app's
 * REAL calculateRoute() and validation logic, with only the network/SQLite
 * boundary mocked (getDirections, fetchChargersNearPoint, chargerCache).
 * Not a conventional unit test — a single long-running batch job that
 * writes ev_test_results.csv. See qa-harness/generate.js for case design.
 */
import * as fs from 'fs';
import * as path from 'path';
import type {LatLng, PlaceResult, Vehicle, ChargerStation} from '../src/types';

// ─── Shared mock context, set per-case before calling calculateRoute ──────
let mockCtx: {
  distanceKm: number;
  polyline: LatLng[];
  chargerAvailable: boolean;
};

jest.mock('../src/services/googleMaps', () => {
  const actual = jest.requireActual('../src/services/googleMaps');
  return {
    ...actual,
    getDirections: jest.fn(async () => ({
      polylinePoints: mockCtx.polyline,
      distanceKm: mockCtx.distanceKm,
      durationMin: (mockCtx.distanceKm / 80) * 60,
      waypointsOrder: [],
    })),
  };
});

jest.mock('../src/services/openChargeMap', () => {
  const actual = jest.requireActual('../src/services/openChargeMap');
  return {
    ...actual,
    fetchChargersNearPoint: jest.fn(async (lat: number, lng: number) => {
      if (!mockCtx.chargerAvailable) return [];
      const station: ChargerStation = {
        id: `synthetic-${lat.toFixed(4)}-${lng.toFixed(4)}`,
        networkName: 'EV charging point',
        address: `EV charging point (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
        coordinate: {latitude: lat, longitude: lng},
        connectors: [
          {type: 'CCS2', powerKw: 100, isOperational: true},
          {type: 'CCS1', powerKw: 100, isOperational: true},
          {type: 'Type2', powerKw: 100, isOperational: true},
          {type: 'CHAdeMO', powerKw: 100, isOperational: true},
          {type: 'NACS', powerKw: 100, isOperational: true},
          {type: 'GB/T', powerKw: 100, isOperational: true},
          {type: 'Type1', powerKw: 100, isOperational: true},
        ],
        maxPowerKw: 100,
        pricingInfo: null,
        isLiveStatusAvailable: true,
        lastUpdated: null,
      };
      return [station];
    }),
  };
});

jest.mock('../src/database/chargerCache', () => ({
  getCachedChargersNear: jest.fn(async () => []),
}));

import {calculateRoute, RouteInfeasibleError, RouteTooLongError} from '../src/services/routeCalculation';

// ─── Real validation logic, copied verbatim from RoutePlannerScreen.tsx:130-137 ──
function validationMessage(
  vehicle: Vehicle | null,
  startPlace: PlaceResult | null,
  destPlace: PlaceResult | null,
  batteryPercent: number,
  efficiencyWhPerKm: number,
): string | null {
  if (!vehicle) return 'Select your vehicle to continue.';
  if (!startPlace) return 'Choose a starting location from the suggestions list.';
  if (!destPlace) return 'Choose a destination from the suggestions list.';
  if (!(batteryPercent > 0)) return 'Current battery must be above 0%.';
  if (!(efficiencyWhPerKm > 0)) return 'Enter a valid efficiency (Wh/km) above 0.';
  return null;
}

function parseEfficiencyInput(text: string): number {
  const n = parseFloat(text);
  return isNaN(n) || n <= 0 ? 0 : n;
}

// ─── Geometry: synthetic polyline whose real haversine length ≈ distanceKm ──
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function buildPolyline(distanceKm: number): LatLng[] {
  const n = Math.max(2, Math.min(4000, Math.round(distanceKm * 2) + 2));
  const baseLat = 25;
  const kmPerDegLng = 111.32 * Math.cos((baseLat * Math.PI) / 180);
  const totalDegLng = distanceKm / kmPerDegLng;
  const points: LatLng[] = [];
  for (let i = 0; i <= n; i++) {
    const frac = i / n;
    points.push({latitude: baseLat, longitude: -80 + frac * totalDegLng});
  }
  return points;
}
function measurePolylineKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

// ─── Vehicle object builder (fills the full Vehicle interface) ────────────
function buildVehicle(v: any): Vehicle {
  return {
    id: v.id,
    manufacturer: v.manufacturer,
    brand: v.brand,
    model: v.model,
    trim: v.trim,
    modelYear: 2026,
    usableCapacityKwh: v.usableCapacityKwh,
    wltpRangeKm: null,
    epaRangeKm: null,
    cltcRangeKm: null,
    manufacturerRangeKm: null,
    realWorldMixedRangeKm: v.usableCapacityKwh * 1000 / v.efficiencyMixedWhPerKm,
    realWorldHighwayRangeKm: null,
    realWorldCityRangeKm: null,
    efficiencyMixedWhPerKm: v.efficiencyMixedWhPerKm,
    efficiencyHighwayWhPerKm: null,
    efficiencyCityWhPerKm: null,
    maxAcChargingKw: 11,
    acConnectorType: 'Type2',
    maxDcChargingKw: v.maxDcChargingKw || 50,
    dcConnectorType: 'CCS2',
    chargingTime10To80Min: v.chargingTime10To80Min,
    chargingTime20To80Min: v.chargingTime20To80Min,
    chargingTime0To100Min: v.chargingTime0To100Min,
    acFullChargeTimeMin: null,
    supportedConnectors: v.supportedConnectors && v.supportedConnectors.length > 0
      ? v.supportedConnectors
      : ['CCS2'],
    imageUrl: null,
    logoUrl: null,
    driveType: null,
    bodyStyle: null,
    vinPrefix: null,
    generation: null,
    grossCapacityKwh: null,
    batteryChemistry: null,
    nominalVoltageV: null,
    moduleCount: null,
    cellCount: null,
    peakDcChargingKw: null,
    chargingCurve: v.chargingCurve,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    wheelbaseMm: null,
    groundClearanceMm: null,
    topSpeedKmh: null,
    powerKw: null,
    torqueNm: null,
    zeroTo100Sec: null,
    curbWeightKg: null,
    gvwrKg: null,
    coldWeatherEfficiencyMultiplier: null,
    hotWeatherEfficiencyMultiplier: null,
    lastUpdated: null,
    dataSource: null,
    notes: null,
  };
}

// ─── Ground-truth oracle (mirrors src/utils/rangeCalculations.ts + the
// calculateRoute loop) — same logic as generate.js's simulate(), duplicated
// here (not imported) so the harness's expectation is independent of the
// generator's own math, per assertion (b). ──
function findChargeNeededPointKm(startBattery: number, capKwh: number, effWhKm: number, remainingKm: number, reservePct: number): number | null {
  const totalWh = capKwh * 1000;
  const reserveWh = (reservePct / 100) * totalWh;
  const startWh = (startBattery / 100) * totalWh;
  const usableWh = startWh - reserveWh;
  if (usableWh <= 0) return 0;
  const maxRangeKm = usableWh / effWhKm;
  const bufferedMaxRangeKm = maxRangeKm * 0.9;
  if (bufferedMaxRangeKm >= remainingKm) return null;
  return bufferedMaxRangeKm;
}
function batteryAfterDrivingOracle(currentBattery: number, capKwh: number, effWhKm: number, distanceKm: number): number {
  const usedWh = distanceKm * effWhKm;
  const totalWh = capKwh * 1000;
  const remainingWh = (currentBattery / 100) * totalWh - usedWh;
  return Math.max(0, (remainingWh / totalWh) * 100);
}
function oracleSimulate(startBattery: number, capKwh: number, effWhKm: number, totalKm: number, reservePct: number, chargeToPct: number) {
  let battery = startBattery;
  let covered = 0;
  let stops = 0;
  const MAX = 5;
  while (stops < MAX) {
    const remaining = totalKm - covered;
    const neededAt = findChargeNeededPointKm(battery, capKwh, effWhKm, remaining, reservePct);
    if (neededAt === null) {
      return {outcome: 'SUCCESS' as const, stops};
    }
    covered += neededAt;
    battery = chargeToPct;
    stops++;
  }
  return {outcome: 'TOO_LONG' as const, stops};
}

// ─── Result row shape ──────────────────────────────────────────────────────
interface ResultRow {
  testId: number;
  status: 'PASS' | 'FAIL' | 'ERROR';
  stopsReturned: number | '';
  stopDetails: string;
  totalDistanceKm: number | '';
  responseTimeMs: string;
  actualErrorMessage: string;
  failingAssertions: string;
  failureMode: string;
  notes: string;
}

function csvEscape(v: unknown): string {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

test('execute all 1000 QA cases', async () => {
  const cases: any[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'suite_internal.json'), 'utf8'),
  );

  const results: ResultRow[] = [];

  for (const c of cases) {
    const start = Date.now();
    const failing: string[] = [];
    let status: 'PASS' | 'FAIL' | 'ERROR' = 'PASS';
    let stopsReturned: number | '' = '';
    let stopDetails = '';
    let totalDistanceKm: number | '' = '';
    let actualErrorMessage = '';
    let failureMode = '';
    let notes = '';

    try {
      const vehicle = c.vehicle ? buildVehicle(c.vehicle) : null;
      // Coordinates MUST live in the same space as the synthetic polyline
      // getDirections() will return (calculateRoute uses startPlace.coordinate
      // as its initial position, and finds chargers by walking the polyline —
      // if the two disagree, the first "distance to charger" haversine spans
      // real-world city-to-city distance instead of the intended route
      // distance, blowing the battery arithmetic sky-high on leg 1 and
      // corrupting every stop count for the rest of the run). Real city
      // lat/lng from the location pool are display-only (description/mainText).
      const polyline = buildPolyline(Math.max(c.distanceKm, 0.05));
      const startPlace: PlaceResult | null = {
        placeId: '',
        description: c.startLoc.name,
        mainText: c.startLoc.name,
        secondaryText: '',
        coordinate: polyline[0],
      };
      const destPlace: PlaceResult | null = c.destLoc
        ? {
            placeId: '',
            description: c.destLoc.name,
            mainText: c.destLoc.name,
            secondaryText: '',
            coordinate: polyline[polyline.length - 1],
          }
        : null;

      // ── Resolve the efficiency text field exactly as the UI would ──────
      const efficiencyWhPerKm = ['xyz', '0', '-50'].includes(c.efficiencyText)
        ? parseEfficiencyInput(c.efficiencyText)
        : Number(c.efficiencyText);

      // ── Step 1: form validation (mirrors isFormValid) ───────────────────
      const msg = validationMessage(vehicle, startPlace, destPlace, c.startBattery, efficiencyWhPerKm);
      const shouldBeRejected = msg !== null;
      const expectedRejection =
        c.noVehicle || c.destEmpty || c.startBattery === 0 ||
        ['xyz', '0', '-50'].includes(c.efficiencyText || '');

      if (shouldBeRejected) {
        // Real app: Calculate button disabled, no calculateRoute() call.
        actualErrorMessage = msg!;
        if (!expectedRejection) {
          failing.push('f');
          failureMode = 'UNEXPECTED_VALIDATION_REJECTION';
        } else if (c.expected && !c.expected.includes(msg!)) {
          failing.push('f');
          failureMode = 'VALIDATION_MESSAGE_MISMATCH';
        }
        totalDistanceKm = 0;
        stopsReturned = 0;
      } else {
        if (expectedRejection) {
          failing.push('f');
          failureMode = 'INVALID_INPUT_NOT_REJECTED';
        }

        // ── Step 2: run the real calculateRoute() ─────────────────────────
        mockCtx = {
          distanceKm: measurePolylineKm(polyline),
          polyline,
          chargerAvailable: c.chargerAvailable !== false,
        };

        try {
          const result = await calculateRoute(
            vehicle!,
            startPlace!,
            destPlace!,
            c.startBattery,
            efficiencyWhPerKm,
            {
              reserveBatteryPercent: c.reserve,
              minArrivalBatteryPercent: 10,
              maxChargeTargetPercent: c.chargeTo,
              minChargerPowerKw: 22,
              chargerCacheTtlHours: 24,
            },
          );

          stopsReturned = result.chargingStops.length;
          totalDistanceKm = result.totalDistanceKm;
          stopDetails = result.chargingStops
            .map(s => `${s.charger.address}@${Math.round(s.charger.maxPowerKw)}kW(arr${Math.round(s.arrivalBatteryPercent)}%->${Math.round(s.chargeToPercent)}%)`)
            .join(' | ');

          // Assertion a: route rendered without error — trivially true here.
          // Assertion (g): no NaN/Infinity anywhere in the result.
          const allNums = [
            result.totalDistanceKm, result.totalDurationMin,
            ...result.legs.flatMap(l => [l.distanceKm, l.durationMin, l.arrivalBatteryPercent]),
            ...result.chargingStops.flatMap(s => [s.arrivalBatteryPercent, s.chargeFromPercent, s.chargeToPercent, s.estimatedChargeTimeMin]),
          ];
          if (allNums.some(n => !isFinite(n))) {
            failing.push('g');
            failureMode = failureMode || 'NAN_OR_INFINITE_VALUE';
          }

          // Assertion b: stop count matches the independent oracle.
          const oracle = oracleSimulate(c.startBattery, vehicle!.usableCapacityKwh, efficiencyWhPerKm, mockCtx.distanceKm, c.reserve, c.chargeTo);
          if (oracle.outcome === 'TOO_LONG') {
            failing.push('a');
            failureMode = failureMode || 'SILENT_INCOMPLETE_ROUTE';
            notes = `Oracle expected RouteTooLongError (needs ${oracle.stops}+ stops) but got a success result.`;
          } else if (oracle.stops !== stopsReturned) {
            failing.push('b');
            failureMode = failureMode || 'STOP_COUNT_MISMATCH';
            notes = `Oracle expected ${oracle.stops} stops, got ${stopsReturned}.`;
          }
          if (c.chargerAvailable === false) {
            failing.push('a');
            failureMode = failureMode || 'MISSING_ROUTE_INFEASIBLE_ERROR';
            notes = 'Expected RouteInfeasibleError (no charger available) but got a success result.';
          }

          // Assertion c: every stop's chargeToPercent equals the requested Charge-To-Target.
          if (result.chargingStops.some(s => s.chargeToPercent !== c.chargeTo)) {
            failing.push('c');
            failureMode = failureMode || 'ARRIVAL_TARGET_MISMATCH';
          }

          // Assertion d: no leg's raw (unclamped) arrival battery goes meaningfully
          // negative. Each leg after a charging stop starts from that stop's
          // POST-charge departureBatteryPercent, not its pre-charge arrival% —
          // using arrival% here would flag every multi-stop route as a false
          // positive, since the car obviously charged before continuing.
          let cursorBattery = c.startBattery;
          let legRangeViolation = false;
          for (let legIdx = 0; legIdx < result.legs.length; legIdx++) {
            const leg = result.legs[legIdx];
            const rawRemaining = batteryAfterDrivingRaw(cursorBattery, vehicle!.usableCapacityKwh, efficiencyWhPerKm, leg.distanceKm);
            if (rawRemaining < -0.5) legRangeViolation = true;
            if (legIdx < result.chargingStops.length) {
              cursorBattery = result.chargingStops[legIdx].departureBatteryPercent;
            }
          }
          if (legRangeViolation) {
            failing.push('d');
            failureMode = failureMode || 'LEG_EXCEEDS_RANGE';
          }

          // Assertion e: DEFAULT-tagged fields actually used the recorded default.
          if (c.configCode.includes('B-D') && c.startBattery !== 80) {
            failing.push('e'); failureMode = failureMode || 'DEFAULT_NOT_APPLIED_BATTERY';
          }
          if (c.configCode.includes('A-D') && c.chargeTo !== 80) {
            failing.push('e'); failureMode = failureMode || 'DEFAULT_NOT_APPLIED_CHARGETO';
          }
          if (c.configCode.includes('E-D') && Number(c.efficiencyText) !== c.vehicle.efficiencyMixedWhPerKm) {
            failing.push('e'); failureMode = failureMode || 'DEFAULT_NOT_APPLIED_EFFICIENCY';
          }
        } catch (err: any) {
          const respMs = Date.now() - start;
          if (err instanceof RouteInfeasibleError) {
            actualErrorMessage = err.message;
            stopsReturned = 0;
            if (c.chargerAvailable !== false) {
              failing.push('a');
              failureMode = 'UNEXPECTED_ROUTE_INFEASIBLE';
              notes = 'RouteInfeasibleError thrown even though a charger should have been available.';
            }
          } else if (err instanceof RouteTooLongError) {
            actualErrorMessage = err.message;
            stopsReturned = err.stopsPlanned;
            totalDistanceKm = err.totalDistanceKm;
            const oracle = oracleSimulate(c.startBattery, vehicle!.usableCapacityKwh, efficiencyWhPerKm, mockCtx.distanceKm, c.reserve, c.chargeTo);
            if (oracle.outcome !== 'TOO_LONG') {
              failing.push('a');
              failureMode = 'UNEXPECTED_ROUTE_TOO_LONG';
              notes = 'RouteTooLongError thrown but the oracle expected a successful route.';
            }
          } else {
            // Genuine crash — TypeError, undefined access, etc.
            status = 'ERROR';
            actualErrorMessage = String(err?.message || err);
            failing.push('g');
            failureMode = 'UNEXPECTED_EXCEPTION: ' + (err?.constructor?.name || 'Error');
            notes = err?.stack ? String(err.stack).split('\n').slice(0, 2).join(' | ') : '';
          }
        }
      }
    } catch (outerErr: any) {
      status = 'ERROR';
      actualErrorMessage = String(outerErr?.message || outerErr);
      failing.push('g');
      failureMode = 'HARNESS_LEVEL_CRASH';
    }

    if (status !== 'ERROR') {
      status = failing.length === 0 ? 'PASS' : 'FAIL';
    }

    results.push({
      testId: c.testId,
      status,
      stopsReturned,
      stopDetails,
      totalDistanceKm,
      responseTimeMs: (Date.now() - start).toFixed(3),
      actualErrorMessage,
      failingAssertions: failing.join(';'),
      failureMode,
      notes,
    });
  }

  const header = [
    'Test ID', 'Status', 'Stops returned', 'Stop details', 'Total distance (km)',
    'Response time (ms)', 'Actual error message', 'Failing assertion(s)',
    'Failure mode', 'Notes',
  ];
  const lines = [header.join(',')];
  for (const r of results) {
    lines.push([
      r.testId, r.status, r.stopsReturned, r.stopDetails, r.totalDistanceKm,
      r.responseTimeMs, r.actualErrorMessage, r.failingAssertions, r.failureMode, r.notes,
    ].map(csvEscape).join(','));
  }
  fs.writeFileSync(path.join(__dirname, 'ev_test_results.csv'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(__dirname, 'results_internal.json'), JSON.stringify(results));

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  // eslint-disable-next-line no-console
  console.log(`PASS=${passCount} FAIL=${failCount} ERROR=${errorCount}`);

  expect(results.length).toBe(1000);
}, 300000);

function batteryAfterDrivingRaw(currentBattery: number, capKwh: number, effWhKm: number, distanceKm: number): number {
  const usedWh = distanceKm * effWhKm;
  const totalWh = capKwh * 1000;
  const remainingWh = (currentBattery / 100) * totalWh - usedWh;
  return (remainingWh / totalWh) * 100;
}
