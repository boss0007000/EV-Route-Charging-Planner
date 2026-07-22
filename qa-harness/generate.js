// Plain-Node test-case generator (no TS/RN deps needed here — those are only
// needed for the execution phase, run.test.ts, which runs through Jest).
'use strict';
const fs = require('fs');
const path = require('path');

const VEHICLES = require('./vehicles.json').map(v => ({
  ...v,
  nominalRangeKm: (v.usableCapacityKwh * 1000) / v.efficiencyMixedWhPerKm * 0.9,
}));
const LOCATIONS = require('./locations.json');

// ─── Seeded PRNG (mulberry32) for reproducibility ──────────────────────────
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260719);
const rand = () => rng();
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = arr => arr[randInt(0, arr.length - 1)];
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Ground-truth constants (mirrors src/types/index.ts + RoutePlannerScreen.tsx) ──
const DEFAULTS = {
  batteryPercent: 80,
  reserveBatteryPercent: 15, // "Arrival Battery Target" (trigger)
  maxChargeTargetPercent: 80, // "Charge To Target" — this is the field the
  // original spec calls "Arrival charge % at stops, applied to every stop":
  // ground truth confirmed chargeToPercent is what's applied uniformly to
  // every stop's departure charge (routeCalculation.ts:251,271).
};
const CLAMPS = {
  battery: {min: 0, max: 100},
  reserve: {min: 5, max: 30},
  chargeTo: {min: 50, max: 100},
};
const BASELINE_VEHICLE_ID = 1; // "default" vehicle for the Range (R) factor

const baselineVehicle = VEHICLES.find(v => v.id === BASELINE_VEHICLE_ID);

// ─── Ground-truth math (mirrors src/utils/rangeCalculations.ts exactly) ────
function findChargeNeededPointKm(startBattery, capKwh, effWhKm, remainingKm, reservePct) {
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
function batteryAfterDriving(currentBattery, capKwh, effWhKm, distanceKm) {
  const usedWh = distanceKm * effWhKm;
  const totalWh = capKwh * 1000;
  const remainingWh = (currentBattery / 100) * totalWh - usedWh;
  return Math.max(0, (remainingWh / totalWh) * 100);
}
const MAX_CHARGING_STOPS = 5;

/** Independent re-simulation of calculateRoute()'s loop, assuming a charger
 * is always found exactly at the point it's needed (chargerAvailable=true
 * case). Used to pick distances that hit a target outcome, and later as the
 * ground-truth oracle for assertion (b). */
function simulate(startBattery, capKwh, effWhKm, totalKm, reservePct, chargeToPct) {
  let battery = startBattery;
  let covered = 0;
  let stops = 0;
  while (stops < MAX_CHARGING_STOPS) {
    const remaining = totalKm - covered;
    const neededAt = findChargeNeededPointKm(battery, capKwh, effWhKm, remaining, reservePct);
    if (neededAt === null) {
      return {
        outcome: 'SUCCESS',
        stops,
        arrivalBattery: batteryAfterDriving(battery, capKwh, effWhKm, remaining),
      };
    }
    covered += neededAt;
    battery = chargeToPct;
    stops++;
  }
  return {outcome: 'TOO_LONG', stops, coveredKm: covered};
}

function clamp(v, {min, max}) {
  return Math.min(max, Math.max(min, v));
}

// ─── Distance search: sample many log-spaced candidates, bucket by simulate() outcome ──
function sampleDistancesForPredicate(vehicle, reservePct, chargeToPct, startBattery, predicate, lo = 5, hi = 2000, n = 400) {
  const matches = [];
  const logLo = Math.log(lo);
  const logHi = Math.log(hi);
  for (let i = 0; i < n; i++) {
    const d = Math.exp(logLo + (i / (n - 1)) * (logHi - logLo));
    const sim = simulate(startBattery, vehicle.usableCapacityKwh, vehicle.efficiencyMixedWhPerKm, d, reservePct, chargeToPct);
    if (predicate(sim)) matches.push(d);
  }
  return matches;
}
function pickDistanceForPredicate(vehicle, reservePct, chargeToPct, startBattery, predicate, lo, hi, fallback) {
  const matches = sampleDistancesForPredicate(vehicle, reservePct, chargeToPct, startBattery, predicate, lo, hi);
  if (matches.length === 0) return fallback;
  return pick(matches);
}

// ─── Scenario-class value generators ───────────────────────────────────────
// Each returns a partial "recipe": {distanceKm, startBattery, reserve, chargeTo,
// vehicle, efficiency, startMethod, destSameAsStart, destEmpty, noVehicle,
// invalidBatteryText, invalidReserveText, invalidChargeToText, invalidEfficiencyText}

function randomVehicle() {
  return pick(VEHICLES);
}
function randomEfficiency() {
  return randInt(100, 400);
}
function randomLocPair() {
  const [a, b] = shuffle(LOCATIONS).slice(0, 2);
  return {start: a, dest: b};
}

// Each scenario independently coin-flips battery/chargeTo/efficiency between
// the true UI default and a custom value, so the 5-factor (S,B,A,E,R) config
// code actually spans all 32 combinations roughly evenly instead of
// collapsing to "always default" for fields a scenario doesn't specifically need.
function pickVehicleFactor() {
  return rand() < 0.5 ? baselineVehicle : randomVehicle();
}
function pickBatteryFactor(customPool) {
  return rand() < 0.5 ? DEFAULTS.batteryPercent : pick(customPool);
}
function pickChargeToFactor() {
  return rand() < 0.5
    ? DEFAULTS.maxChargeTargetPercent
    : randInt(CLAMPS.chargeTo.min, CLAMPS.chargeTo.max);
}
function pickEfficiencyFactor(vehicle) {
  return rand() < 0.5 ? vehicle.efficiencyMixedWhPerKm : randInt(100, 400);
}

function genNoChargeNeeded() {
  const vehicle = pickVehicleFactor();
  const startBattery = pickBatteryFactor([40, 50, 60, 70, 80, 90, 100]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const d = pickDistanceForPredicate(
    vehicle, reserve, chargeTo, startBattery,
    sim => sim.outcome === 'SUCCESS' && sim.stops === 0,
    5, 2000,
    Math.max(5, vehicle.nominalRangeKm * (startBattery / 100) * 0.4),
  );
  return {distanceKm: d, startBattery, reserve, chargeTo, vehicle, efficiency};
}
function genSingleStop() {
  const vehicle = pickVehicleFactor();
  const startBattery = pickBatteryFactor([50, 60, 70, 80, 90, 100]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const d = pickDistanceForPredicate(
    vehicle, reserve, chargeTo, startBattery,
    sim => sim.outcome === 'SUCCESS' && sim.stops === 1,
    5, 2000,
    vehicle.nominalRangeKm * 1.3,
  );
  return {distanceKm: d, startBattery, reserve, chargeTo, vehicle, efficiency};
}
function genMultiStop() {
  const vehicle = pickVehicleFactor();
  const startBattery = pickBatteryFactor([50, 60, 70, 80, 90, 100]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const targetStops = randInt(2, 4);
  const d = pickDistanceForPredicate(
    vehicle, reserve, chargeTo, startBattery,
    sim => sim.outcome === 'SUCCESS' && sim.stops === targetStops,
    5, 2000,
    vehicle.nominalRangeKm * (1 + targetStops * 0.8),
  );
  return {distanceKm: d, startBattery, reserve, chargeTo, vehicle, efficiency};
}
function genEdgeLowBattery() {
  const vehicle = pickVehicleFactor();
  const startBattery = pick([0, 1, 2, 5, 8, 10]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const d = randInt(20, 400);
  return {distanceKm: d, startBattery: Math.max(startBattery, 1), reserve, chargeTo, vehicle, efficiency};
}
function genEdgeLongTrip() {
  const vehicle = pickVehicleFactor();
  const startBattery = pickBatteryFactor([60, 80, 100]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const d = randInt(1200, 2000);
  return {distanceKm: d, startBattery, reserve, chargeTo, vehicle, efficiency};
}
function genEdgeShortTrip() {
  const vehicle = pickVehicleFactor();
  const startBattery = pickBatteryFactor([20, 40, 60, 80]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const d = randInt(5, 20);
  return {distanceKm: d, startBattery, reserve, chargeTo, vehicle, efficiency};
}

const sortedByRange = VEHICLES.slice().sort((a, b) => a.nominalRangeKm - b.nominalRangeKm);
const minRangeVehicle = sortedByRange[0];
const maxRangeVehicle = sortedByRange[sortedByRange.length - 1];

const BOUNDARY_RECIPES = [
  () => ({kind: 'battery-0', startBattery: 0, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(50, 300)}),
  () => ({kind: 'battery-1', startBattery: 1, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(50, 300)}),
  () => ({kind: 'battery-100', startBattery: 100, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(50, 300)}),
  () => ({kind: 'efficiency-min100', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: 100, distanceKm: randInt(50, 400)}),
  () => ({kind: 'efficiency-max400', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: 400, distanceKm: randInt(50, 400)}),
  () => ({kind: 'range-min-vehicle', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: minRangeVehicle, efficiency: minRangeVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(20, 150)}),
  () => ({kind: 'range-max-vehicle', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: maxRangeVehicle, efficiency: maxRangeVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(200, 800)}),
  () => ({kind: 'chargeTo-le-start', startBattery: 80, reserve: 15, chargeTo: 50, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(150, 400)}),
  () => ({kind: 'chargeTo-100', startBattery: 60, reserve: 15, chargeTo: 100, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(150, 400)}),
  () => ({kind: 'reserve-min5', startBattery: 80, reserve: 5, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(150, 400)}),
  () => ({kind: 'reserve-max30', startBattery: 80, reserve: 30, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: randInt(150, 400)}),
  () => ({kind: 'distance-min5', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 5}),
  () => ({kind: 'distance-max2000', startBattery: 100, reserve: 15, chargeTo: 80, vehicle: maxRangeVehicle, efficiency: maxRangeVehicle.efficiencyMixedWhPerKm, distanceKm: 2000}),
];

const INVALID_RECIPES = [
  () => ({kind: 'empty-destination', destEmpty: true, startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
  () => ({kind: 'destination-eq-start', destSameAsStart: true, startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 0}),
  () => ({kind: 'battery-negative', invalidBatteryText: '-10', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
  () => ({kind: 'battery-over100', invalidBatteryText: '150', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
  () => ({kind: 'battery-nonnumeric', invalidBatteryText: 'abc', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
  () => ({kind: 'efficiency-zero', efficiencyText: '0', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, distanceKm: 100}),
  () => ({kind: 'efficiency-negative', efficiencyText: '-50', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, distanceKm: 100}),
  () => ({kind: 'efficiency-nonnumeric', efficiencyText: 'xyz', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, distanceKm: 100}),
  () => ({kind: 'no-vehicle', noVehicle: true, startBattery: 80, reserve: 15, chargeTo: 80, efficiency: 180, distanceKm: 100}),
  () => ({kind: 'chargeTo-over100', invalidChargeToText: '150', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
  () => ({kind: 'chargeTo-under50', invalidChargeToText: '20', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
  () => ({kind: 'reserve-over30', invalidReserveText: '90', startBattery: 80, reserve: 15, chargeTo: 80, vehicle: baselineVehicle, efficiency: baselineVehicle.efficiencyMixedWhPerKm, distanceKm: 100}),
];

function genUnreachable() {
  const vehicle = pickVehicleFactor();
  const startBattery = pickBatteryFactor([30, 50, 70]);
  const reserve = DEFAULTS.reserveBatteryPercent;
  const chargeTo = pickChargeToFactor();
  const efficiency = pickEfficiencyFactor(vehicle);
  const d = pickDistanceForPredicate(
    vehicle, reserve, chargeTo, startBattery,
    sim => sim.outcome !== 'SUCCESS' || sim.stops >= 1,
    5, 2000,
    vehicle.nominalRangeKm * 1.5,
  );
  return {distanceKm: d, startBattery, reserve, chargeTo, vehicle, efficiency, chargerAvailable: false};
}

// ─── Scenario distribution: ~1000 total ────────────────────────────────────
const SCENARIO_PLAN = [
  {cls: 'NO_CHARGE_NEEDED', count: 140, gen: genNoChargeNeeded},
  {cls: 'SINGLE_STOP', count: 140, gen: genSingleStop},
  {cls: 'MULTI_STOP', count: 120, gen: genMultiStop},
  {cls: 'EDGE_LOW_BATTERY', count: 120, gen: genEdgeLowBattery},
  {cls: 'EDGE_LONG_TRIP', count: 115, gen: genEdgeLongTrip},
  {cls: 'EDGE_SHORT_TRIP', count: 115, gen: genEdgeShortTrip},
  {cls: 'BOUNDARY_VALUE', count: 150, gen: null}, // cycles BOUNDARY_RECIPES
  {cls: 'INVALID_INPUT', count: 60, gen: null}, // cycles INVALID_RECIPES
  {cls: 'UNREACHABLE', count: 40, gen: genUnreachable},
];
const TOTAL = SCENARIO_PLAN.reduce((s, p) => s + p.count, 0);
if (TOTAL !== 1000) throw new Error('plan does not sum to 1000: ' + TOTAL);

// ─── Build raw scenario rows ────────────────────────────────────────────────
let rawRows = [];
for (const plan of SCENARIO_PLAN) {
  if (plan.cls === 'BOUNDARY_VALUE') {
    for (let i = 0; i < plan.count; i++) {
      const recipe = BOUNDARY_RECIPES[i % BOUNDARY_RECIPES.length]();
      rawRows.push({scenarioClass: plan.cls, ...recipe});
    }
  } else if (plan.cls === 'INVALID_INPUT') {
    for (let i = 0; i < plan.count; i++) {
      const recipe = INVALID_RECIPES[i % INVALID_RECIPES.length]();
      rawRows.push({scenarioClass: plan.cls, ...recipe});
    }
  } else {
    for (let i = 0; i < plan.count; i++) {
      rawRows.push({scenarioClass: plan.cls, ...plan.gen()});
    }
  }
}
rawRows = shuffle(rawRows);

// ─── Attach start method, locations, chargerAvailable default, dedupe tuple ──
const seenTuples = new Set();
const finalRows = [];
let dupSkips = 0;

for (const row of rawRows) {
  const startMethod = rand() < 0.5 ? 'manual' : 'automatic';
  let startLoc, destLoc;
  if (row.destEmpty) {
    startLoc = pick(LOCATIONS);
    destLoc = null;
  } else if (row.destSameAsStart) {
    startLoc = pick(LOCATIONS);
    destLoc = startLoc;
  } else {
    const pair = randomLocPair();
    startLoc = pair.start;
    destLoc = pair.dest;
  }
  if (startMethod === 'automatic') {
    // GPS pickup resolves to a fixed mocked coordinate (matches
    // __mocks__/react-native-geolocation-service.js: 51.5074,-0.1278/"London").
    startLoc = {name: 'Current Location (GPS)', lat: 51.5074, lng: -0.1278};
  }

  const vehicle = row.noVehicle ? null : row.vehicle || baselineVehicle;
  const efficiencyText = row.efficiencyText !== undefined
    ? row.efficiencyText
    : String(row.efficiency);

  // Dedup key: (start, destination, start battery, arrival%, efficiency, range/vehicle)
  const tupleKey = JSON.stringify([
    startLoc.name, destLoc ? destLoc.name : '(empty)', row.startBattery,
    row.chargeTo, efficiencyText, vehicle ? vehicle.id : 'none',
    Math.round(row.distanceKm * 10),
    row.invalidBatteryText || '', row.invalidChargeToText || '', row.invalidReserveText || '',
  ]);
  if (seenTuples.has(tupleKey)) {
    dupSkips++;
    // Nudge distance slightly to break the tie rather than dropping the case.
    row.distanceKm = row.distanceKm * (1 + (rand() - 0.5) * 0.02) + rand();
  }
  seenTuples.add(tupleKey);

  finalRows.push({
    ...row,
    startMethod,
    startLoc,
    destLoc,
    vehicle,
    efficiencyText,
  });
}

// ─── Config-code labeling (derived post-hoc from actual values) ───────────
function labelConfigCode(row) {
  const S = row.startMethod === 'manual' ? 'S-M' : 'S-A';
  const B = row.invalidBatteryText !== undefined
    ? 'B-U' // an attempted override, even if rejected, counts as user-entered intent
    : (row.startBattery === DEFAULTS.batteryPercent ? 'B-D' : 'B-U');
  const A = row.invalidChargeToText !== undefined
    ? 'A-U'
    : (row.chargeTo === DEFAULTS.maxChargeTargetPercent ? 'A-D' : 'A-U');
  const E = row.efficiencyText === 'xyz' || row.efficiencyText === '0' || row.efficiencyText === '-50'
    ? 'E-U'
    : (row.vehicle && Number(row.efficiencyText) === row.vehicle.efficiencyMixedWhPerKm ? 'E-D' : 'E-U');
  const R = row.vehicle && row.vehicle.id === BASELINE_VEHICLE_ID ? 'R-D' : 'R-U';
  return {code: `${S}_${B}_${A}_${E}_${R}`, S, B, A, E, R};
}

// ─── Expected-result text + internal oracle ────────────────────────────────
function computeExpected(row) {
  if (row.noVehicle) return 'Rejected: Select your vehicle to continue.';
  if (row.destEmpty) return 'Rejected: Choose a destination from the suggestions list.';
  if (row.efficiencyText !== undefined && (row.efficiencyText === '0' || row.efficiencyText === '-50' || row.efficiencyText === 'xyz')) {
    return 'Rejected: Enter a valid efficiency (Wh/km) above 0.';
  }
  if (row.startBattery === 0) return 'Rejected: Current battery must be above 0%.';
  if (row.invalidBatteryText !== undefined) return `Invalid battery keystroke ("${row.invalidBatteryText}") rejected; default 80% retained, route proceeds at 80%.`;
  if (row.invalidChargeToText !== undefined) return `Invalid Charge-To-Target keystroke ("${row.invalidChargeToText}") rejected; default 80% retained.`;
  if (row.invalidReserveText !== undefined) return `Invalid Arrival-Battery-Target keystroke ("${row.invalidReserveText}") rejected; default 15% retained.`;
  if (row.destSameAsStart) return 'Route succeeds with 0 charging stops (distance ~0 km) — not rejected by validation (ground-truth gap, not a bug per se).';
  if (row.chargerAvailable === false) {
    return 'RouteInfeasibleError expected (no compatible charger found).';
  }
  const sim = simulate(row.startBattery, row.vehicle.usableCapacityKwh, row.vehicle.efficiencyMixedWhPerKm, row.distanceKm, row.reserve, row.chargeTo);
  if (sim.outcome === 'TOO_LONG') {
    return `RouteTooLongError expected (needs >${MAX_CHARGING_STOPS} stops).`;
  }
  return `Route succeeds with ${sim.stops} charging stop${sim.stops === 1 ? '' : 's'}.`;
}

// ─── Emit CSV + internal JSON ───────────────────────────────────────────────
const csvHeader = [
  'Test ID', 'Config code', 'Start method', 'Start location', 'Destination',
  'Route distance (km, approx)', 'Start battery', 'Arrival charge (Charge To Target)',
  'Efficiency', 'Range (vehicle)', 'Scenario class', 'Expected result',
];
function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvRows = [csvHeader.join(',')];
const internalRows = [];

finalRows.forEach((row, idx) => {
  const testId = idx + 1;
  const {code} = labelConfigCode(row);
  const expected = computeExpected(row);
  const rangeLabel = row.vehicle ? `${row.vehicle.brand} ${row.vehicle.model} (${Math.round(row.vehicle.nominalRangeKm)} km)` : 'N/A (no vehicle)';

  csvRows.push([
    testId, code, row.startMethod, row.startLoc.name,
    row.destLoc ? row.destLoc.name : '', row.distanceKm.toFixed(1),
    row.startBattery, row.chargeTo, row.efficiencyText, rangeLabel,
    row.scenarioClass, expected,
  ].map(csvEscape).join(','));

  internalRows.push({testId, configCode: code, ...row, expected});
});

fs.writeFileSync(path.join(__dirname, 'ev_test_suite.csv'), csvRows.join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'suite_internal.json'), JSON.stringify(internalRows));

// ─── Sanity summary ─────────────────────────────────────────────────────────
console.log('Generated', finalRows.length, 'rows. Duplicate nudges applied:', dupSkips);
const byScenario = {};
const byConfig = {};
for (const r of internalRows) {
  byScenario[r.scenarioClass] = (byScenario[r.scenarioClass] || 0) + 1;
  byConfig[r.configCode] = (byConfig[r.configCode] || 0) + 1;
}
console.log('By scenario:', byScenario);
console.log('Distinct config codes used:', Object.keys(byConfig).length);
const counts = Object.values(byConfig);
console.log('Config code count range:', Math.min(...counts), '-', Math.max(...counts));
