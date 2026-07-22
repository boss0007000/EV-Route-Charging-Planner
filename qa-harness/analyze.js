'use strict';
const fs = require('fs');
const path = require('path');

const suite = JSON.parse(fs.readFileSync(path.join(__dirname, 'suite_internal_full.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'results_internal.json'), 'utf8'));
const byId = {};
suite.forEach(s => (byId[s.testId] = s));
const rows = results.map(r => ({...r, case: byId[r.testId]}));

// ─── Oracle (duplicated once more, intentionally — independent of harness/generator) ──
function findChargeNeededPointKm(startBattery, capKwh, effWhKm, remainingKm, reservePct) {
  const totalWh = capKwh * 1000;
  const reserveWh = (reservePct / 100) * totalWh;
  const startWh = (startBattery / 100) * totalWh;
  const usableWh = startWh - reserveWh;
  if (usableWh <= 0) return 0;
  const maxRangeKm = usableWh / effWhKm;
  const buffered = maxRangeKm * 0.9;
  if (buffered >= remainingKm) return null;
  return buffered;
}
function oracleStops(c) {
  if (c.vehicle == null) return null;
  let battery = c.startBattery, covered = 0, stops = 0;
  while (stops < 5) {
    const remaining = c.distanceKm - covered;
    const neededAt = findChargeNeededPointKm(battery, c.vehicle.usableCapacityKwh, Number(c.efficiencyText) || c.efficiency, remaining, c.reserve);
    if (neededAt === null) return stops;
    covered += neededAt;
    battery = c.chargeTo;
    stops++;
  }
  return null; // too long
}

const summary = {};

// 1. Overall donut
summary.overall = {pass: 0, fail: 0, error: 0, total: rows.length};
for (const r of rows) {
  if (r.status === 'PASS') summary.overall.pass++;
  else if (r.status === 'FAIL') summary.overall.fail++;
  else summary.overall.error++;
}

// 2. Pass rate by scenario class
const byScenario = {};
for (const r of rows) {
  const cls = r.case.scenarioClass;
  byScenario[cls] = byScenario[cls] || {total: 0, pass: 0};
  byScenario[cls].total++;
  if (r.status === 'PASS') byScenario[cls].pass++;
}
summary.byScenario = Object.entries(byScenario)
  .map(([cls, v]) => ({cls, n: v.total, pass: v.pass, passRate: v.pass / v.total}))
  .sort((a, b) => a.passRate - b.passRate);

// 3. Pass rate by config code
const byConfig = {};
for (const r of rows) {
  const code = r.case.configCode;
  byConfig[code] = byConfig[code] || {total: 0, pass: 0};
  byConfig[code].total++;
  if (r.status === 'PASS') byConfig[code].pass++;
}
summary.byConfig = Object.entries(byConfig)
  .map(([code, v]) => ({code, n: v.total, pass: v.pass, passRate: v.pass / v.total}))
  .sort((a, b) => a.passRate - b.passRate);

// 4. Failing-assertion frequency
const assertionCounts = {a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0};
for (const r of rows) {
  if (!r.failingAssertions) continue;
  for (const letter of r.failingAssertions.split(';')) {
    if (assertionCounts[letter] !== undefined) assertionCounts[letter]++;
  }
}
summary.assertionCounts = assertionCounts;

// 5. Failure heatmap: scenario x config
const heatmapKey = (cls, code) => `${cls}|||${code}`;
const heatmapCells = {};
for (const r of rows) {
  const key = heatmapKey(r.case.scenarioClass, r.case.configCode);
  heatmapCells[key] = heatmapCells[key] || {total: 0, fail: 0};
  heatmapCells[key].total++;
  if (r.status !== 'PASS') heatmapCells[key].fail++;
}
const scenarioClasses = [...new Set(rows.map(r => r.case.scenarioClass))].sort();
const configCodes = [...new Set(rows.map(r => r.case.configCode))].sort();
summary.heatmap = {
  scenarioClasses, configCodes,
  cells: scenarioClasses.map(cls =>
    configCodes.map(code => {
      const c = heatmapCells[heatmapKey(cls, code)];
      return c ? {total: c.total, fail: c.fail, failRate: c.fail / c.total} : {total: 0, fail: 0, failRate: 0};
    }),
  ),
};

// 6. Failure rate vs distance (log bins)
const distBinEdges = [5, 10, 25, 50, 100, 250, 500, 1000, 2000];
function distBinLabel(km) {
  for (let i = 0; i < distBinEdges.length - 1; i++) {
    if (km >= distBinEdges[i] && km < distBinEdges[i + 1]) return `${distBinEdges[i]}-${distBinEdges[i + 1]}`;
  }
  return `${distBinEdges[distBinEdges.length - 1]}+`;
}
const byDistBin = {};
for (const r of rows) {
  const label = distBinLabel(r.case.distanceKm);
  byDistBin[label] = byDistBin[label] || {total: 0, fail: 0};
  byDistBin[label].total++;
  if (r.status !== 'PASS') byDistBin[label].fail++;
}
const distLabelOrder = distBinEdges.slice(0, -1).map((e, i) => `${e}-${distBinEdges[i + 1]}`);
summary.byDistanceBin = distLabelOrder
  .filter(l => byDistBin[l])
  .map(l => ({label: l, n: byDistBin[l].total, fail: byDistBin[l].fail, failRate: byDistBin[l].fail / byDistBin[l].total}));

// 7. Failure rate vs battery% and vs chargeTo%
function bucketize(rows, keyFn, edges) {
  const buckets = {};
  for (const r of rows) {
    const v = keyFn(r);
    let label = `${edges[edges.length - 1]}+`;
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && v < edges[i + 1]) { label = `${edges[i]}-${edges[i + 1]}`; break; }
    }
    buckets[label] = buckets[label] || {total: 0, fail: 0};
    buckets[label].total++;
    if (r.status !== 'PASS') buckets[label].fail++;
  }
  const order = edges.slice(0, -1).map((e, i) => `${e}-${edges[i + 1]}`);
  return order.filter(l => buckets[l]).map(l => ({label: l, n: buckets[l].total, fail: buckets[l].fail, failRate: buckets[l].fail / buckets[l].total}));
}
summary.byBattery = bucketize(rows, r => r.case.startBattery, [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101]);
summary.byChargeTo = bucketize(rows, r => r.case.chargeTo, [10, 30, 50, 60, 70, 80, 90, 101]);

// 8. Expected vs actual stop count scatter
summary.stopScatter = rows
  .filter(r => r.case.vehicle && !r.case.noVehicle && r.stopsReturned !== '')
  .map(r => ({
    expected: oracleStops(r.case),
    actual: r.stopsReturned,
    status: r.status,
    testId: r.testId,
  }))
  .filter(p => p.expected !== null);

// 9. Response time distribution + vs distance
summary.responseTimes = rows.map(r => ({
  ms: parseFloat(r.responseTimeMs) || 0,
  distanceKm: r.case.distanceKm,
  status: r.status,
}));

// 10. Defect Pareto
const failureModeCounts = {};
for (const r of rows) {
  if (r.status === 'PASS' || !r.failureMode) continue;
  failureModeCounts[r.failureMode] = (failureModeCounts[r.failureMode] || 0) + 1;
}
const paretoSorted = Object.entries(failureModeCounts).sort((a, b) => b[1] - a[1]);
let cumulative = 0;
const totalFailures = paretoSorted.reduce((s, [, c]) => s + c, 0);
summary.pareto = paretoSorted.map(([mode, count]) => {
  cumulative += count;
  return {mode, count, cumulativePct: totalFailures ? cumulative / totalFailures : 0};
});

// ─── Tables ──────────────────────────────────────────────────────────────────
summary.topFailureModes = paretoSorted.slice(0, 10).map(([mode, count]) => {
  const examples = rows.filter(r => r.failureMode === mode).slice(0, 3);
  return {
    mode,
    count,
    pctOfFailures: totalFailures ? count / totalFailures : 0,
    exampleTestIds: examples.map(e => e.testId),
    exampleNotes: examples[0] ? examples[0].notes : '',
  };
});

summary.configTable = Object.entries(byConfig)
  .map(([code, v]) => ({code, n: v.total, pass: v.pass, fail: v.total - v.pass, passRate: v.pass / v.total}))
  .sort((a, b) => a.passRate - b.passRate || a.code.localeCompare(b.code));

summary.scenarioTable = Object.entries(byScenario)
  .map(([cls, v]) => ({cls, n: v.total, pass: v.pass, fail: v.total - v.pass, passRate: v.pass / v.total}))
  .sort((a, b) => a.passRate - b.passRate);

summary.boundaryRuns = rows
  .filter(r => r.case.scenarioClass === 'BOUNDARY_VALUE')
  .map(r => ({
    testId: r.testId,
    kind: r.case.kind || '',
    status: r.status,
    stops: r.stopsReturned,
    distanceKm: Math.round(r.case.distanceKm * 10) / 10,
    startBattery: r.case.startBattery,
    chargeTo: r.case.chargeTo,
    efficiency: r.case.efficiencyText,
    vehicle: r.case.vehicle ? r.case.vehicle.model : 'N/A',
    failureMode: r.failureMode,
    errorMessage: r.actualErrorMessage,
  }))
  .sort((a, b) => a.testId - b.testId);

// ─── All failing runs (for the filterable table) ───────────────────────────
summary.failingRuns = rows
  .filter(r => r.status !== 'PASS')
  .map(r => ({
    testId: r.testId,
    status: r.status,
    scenarioClass: r.case.scenarioClass,
    configCode: r.case.configCode,
    distanceKm: Math.round(r.case.distanceKm * 10) / 10,
    startBattery: r.case.startBattery,
    chargeTo: r.case.chargeTo,
    stopsReturned: r.stopsReturned,
    failingAssertions: r.failingAssertions,
    failureMode: r.failureMode,
    notes: r.notes,
    errorMessage: r.actualErrorMessage,
  }));

fs.writeFileSync(path.join(__dirname, 'analysis.json'), JSON.stringify(summary, null, 1));
console.log('Analysis written. Overall:', summary.overall);
console.log('Failure modes:', failureModeCounts);
