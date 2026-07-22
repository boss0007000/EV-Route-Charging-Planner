#!/usr/bin/env python3
"""One-off analysis script: joins ev_test_suite.csv + ev_test_results.csv,
computes every aggregate the dashboard needs, and writes dashboard_data.json.
Not a permanent project script — part of the qa-report deliverable set.
"""
import csv
import json
import math
from collections import Counter, defaultdict

SUITE = list(csv.DictReader(open('ev_test_suite.csv')))
RESULTS = list(csv.DictReader(open('ev_test_results.csv')))

suite_by_id = {r['Test ID']: r for r in SUITE}
rows = []
for res in RESULTS:
    s = suite_by_id[res['Test ID']]
    rows.append({**s, **res})

TOTAL = len(rows)

def to_float(v, default=None):
    try:
        return float(v)
    except (ValueError, TypeError):
        return default

def parse_battery(v):
    if v.startswith('DEFAULT'):
        return 80.0
    return to_float(v)

def parse_arrival(v):
    if v.startswith('DEFAULT'):
        return 15.0
    return to_float(v)

# ── 1. Overall outcome donut ──────────────────────────────────────────────
status_counts = Counter(r['Status'] for r in rows)
donut = [{'label': k, 'count': v, 'pct': round(100 * v / TOTAL, 1)} for k, v in status_counts.most_common()]

# ── 2. Pass rate by scenario class ────────────────────────────────────────
def is_pass(r):
    return r['Status'] in ('PASS',)

by_scenario = defaultdict(list)
for r in rows:
    by_scenario[r['Scenario class']].append(r)
scenario_rates = []
for cls, rs in by_scenario.items():
    n = len(rs)
    p = sum(1 for r in rs if is_pass(r))
    scenario_rates.append({'scenario': cls, 'n': n, 'passes': p, 'passRate': round(100 * p / n, 1)})
scenario_rates.sort(key=lambda x: x['passRate'])

# ── 3. Pass rate by config code ───────────────────────────────────────────
by_config = defaultdict(list)
for r in rows:
    by_config[r['Config code']].append(r)
config_rates = []
for code, rs in by_config.items():
    n = len(rs)
    p = sum(1 for r in rs if is_pass(r))
    config_rates.append({'config': code, 'n': n, 'passes': p, 'passRate': round(100 * p / n, 1)})
config_rates.sort(key=lambda x: x['passRate'])

# ── 4. Failing-assertion frequency ────────────────────────────────────────
assertion_freq = Counter()
for r in rows:
    for a in r['Failing assertion(s)'].split(';'):
        if a:
            assertion_freq[a] += 1
ASSERTION_LABELS = {
    'a': 'a: route renders / defined error (incl. silent-incomplete check)',
    'b': 'b: stop count plausible for distance/range/battery',
    'c': 'c: every stop charge-to % equals specified arrival %',
    'd': 'd: no leg exceeds usable range',
    'e': 'e: DEFAULT fields apply the Phase-1 default',
    'f': 'f: invalid input rejected with a message',
    'g': 'g: no crash / hang / silent failure',
}
assertion_chart = [
    {'assertion': k, 'label': ASSERTION_LABELS[k], 'count': assertion_freq.get(k, 0)}
    for k in ['a', 'b', 'c', 'd', 'e', 'f', 'g']
]
assertion_chart.sort(key=lambda x: -x['count'])

# ── 5. Heatmap: scenario class x config code failure rate ────────────────
heat_cell = defaultdict(list)
for r in rows:
    heat_cell[(r['Scenario class'], r['Config code'])].append(r)
scenarios_sorted = [x['scenario'] for x in scenario_rates]
configs_sorted = sorted(by_config.keys())
heatmap = {
    'scenarios': scenarios_sorted,
    'configs': configs_sorted,
    'cells': [],
}
for sc in scenarios_sorted:
    for cfg in configs_sorted:
        rs = heat_cell.get((sc, cfg), [])
        if rs:
            n = len(rs)
            fails = sum(1 for r in rs if not is_pass(r))
            rate = round(100 * fails / n, 1)
        else:
            n = 0
            rate = None
        heatmap['cells'].append({'scenario': sc, 'config': cfg, 'n': n, 'failRate': rate})

# ── 6. Failure rate vs route distance (binned, log-spaced) ───────────────
dist_bins = [(0, 25), (25, 75), (75, 200), (200, 400), (400, 700), (700, 1200), (1200, 2000), (2000, 100000)]
dist_bin_labels = ['0-25', '25-75', '75-200', '200-400', '400-700', '700-1200', '1200-2000', '2000+']
dist_buckets = [[] for _ in dist_bins]
for r in rows:
    d = to_float(r['Route distance (km, approx)'])
    if d is None:
        continue
    for i, (lo, hi) in enumerate(dist_bins):
        if lo <= d < hi:
            dist_buckets[i].append(r)
            break
distance_chart = []
for label, rs in zip(dist_bin_labels, dist_buckets):
    n = len(rs)
    if n == 0:
        continue
    fails = sum(1 for r in rs if not is_pass(r))
    distance_chart.append({'bin': label, 'n': n, 'failRate': round(100 * fails / n, 1)})

# ── 7. Failure rate vs starting battery % and vs arrival charge % ────────
batt_bins = [0, 1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 101]
def bucket_battery(v):
    for i in range(len(batt_bins) - 1):
        if batt_bins[i] <= v < batt_bins[i + 1]:
            return f'{batt_bins[i]}'
    return None

batt_groups = defaultdict(list)
for r in rows:
    v = parse_battery(r['Start battery'])
    if v is None or v < 0 or v > 100:
        continue  # out-of-domain values (e.g. invalid-input probes of -10, 150) belong to the invalid-input analysis, not this threshold chart
    b = bucket_battery(v)
    if b is None:
        continue
    batt_groups[b].append(r)
battery_chart = []
for k in sorted(batt_groups.keys(), key=lambda x: int(x)):
    rs = batt_groups[k]
    n = len(rs)
    fails = sum(1 for r in rs if not is_pass(r))
    battery_chart.append({'bucket': k, 'n': n, 'failRate': round(100 * fails / n, 1)})

arrival_groups = defaultdict(list)
for r in rows:
    v = parse_arrival(r['Arrival charge'])
    if v is None or v < 0 or v > 100:
        continue
    bucket = int(v // 5) * 5
    arrival_groups[bucket].append(r)
arrival_chart = []
for k in sorted(arrival_groups.keys()):
    rs = arrival_groups[k]
    n = len(rs)
    fails = sum(1 for r in rs if not is_pass(r))
    arrival_chart.append({'bucket': str(k), 'n': n, 'failRate': round(100 * fails / n, 1)})

# ── 8. Stop count expected vs actual ──────────────────────────────────────
CAPACITY_KWH = 58.0
def expected_stops(start_battery, reserve_pct, efficiency, distance_km):
    if distance_km is None or efficiency is None or efficiency <= 0:
        return None
    battery = start_battery
    remaining = distance_km
    stops = 0
    for _ in range(6):
        usable_wh = ((battery - reserve_pct) / 100.0) * CAPACITY_KWH * 1000.0
        max_range = (usable_wh / efficiency) * 0.9 if usable_wh > 0 else 0
        if max_range >= remaining:
            return stops
        remaining -= max_range
        battery = 80.0
        stops += 1
    return stops

scatter = []
for r in rows:
    if r['Status'] not in ('PASS', 'FAIL'):
        continue
    dist = to_float(r['Total distance (km)'])
    if dist is None:
        dist = to_float(r['Route distance (km, approx)'])
    if dist is None:
        continue
    battery = parse_battery(r['Start battery'])
    arrival = parse_arrival(r['Arrival charge'])
    eff_raw = r['Efficiency']
    efficiency = 138.0 if eff_raw.startswith('DEFAULT') else to_float(eff_raw)
    exp = expected_stops(battery, arrival, efficiency, dist)
    actual = int(r['Stops returned'])
    if exp is None:
        continue
    scatter.append({'testId': r['Test ID'], 'expected': exp, 'actual': actual, 'scenario': r['Scenario class']})

# ── 9. Response time distribution + vs distance ───────────────────────────
resp_times = [to_float(r['Response time (ms)'], 0.0) for r in rows]
hist_bins = list(range(0, 16, 1))
resp_hist = [0] * (len(hist_bins))
for t in resp_times:
    idx = min(int(t), len(hist_bins) - 1)
    resp_hist[idx] += 1
resp_histogram = [{'bin': f'{b}', 'count': c} for b, c in zip(hist_bins, resp_hist)]

resp_vs_dist = []
for r in rows:
    dist = to_float(r['Total distance (km)']) or to_float(r['Route distance (km, approx)'])
    t = to_float(r['Response time (ms)'])
    if dist is None or t is None:
        continue
    resp_vs_dist.append({'distance': round(dist, 1), 'responseMs': t, 'stops': int(r['Stops returned'])})

# ── 10. Defect Pareto ──────────────────────────────────────────────────────
failure_modes = Counter(r['Failure mode'] for r in rows if r['Failure mode'] not in ('NONE', 'n/a (correctly rejected)'))
pareto_items = failure_modes.most_common()
total_defects = sum(c for _, c in pareto_items)
cum = 0
pareto = []
for mode, count in pareto_items:
    cum += count
    pareto.append({
        'mode': mode,
        'count': count,
        'pct': round(100 * count / total_defects, 1) if total_defects else 0,
        'cumPct': round(100 * cum / total_defects, 1) if total_defects else 0,
    })

# ── Top 10 failure modes table (description, count, %, severity, examples) ─
SEVERITY = {
    'ARRIVAL_TARGET_MISMATCH': 'High',
    'SILENT_INCOMPLETE_ROUTE': 'Critical',
    'NO_VALIDATION_MESSAGE_SHOWN': 'Low',
    'INVALID_INPUT_NOT_REJECTED': 'Medium',
    'STOP_COUNT_IMPLAUSIBLE': 'Medium',
    'LEG_RANGE_OVERRUN': 'Critical',
    'UNEXPECTED_ROUTE_INFEASIBLE': 'Medium',
    'SLOW_RESPONSE': 'Low',
    'UNHANDLED_EXCEPTION': 'Critical',
}
DESCRIPTIONS = {
    'ARRIVAL_TARGET_MISMATCH': "The 'Arrival Battery Target' UI field is wired to reserveBatteryPercent (the trigger threshold for starting a charge), not to the % you charge back up to. The charge-to target is hard-coded at 80% (DEFAULT_ROUTE_SETTINGS.maxChargeTargetPercent) and is never exposed in the UI, so every charging stop's actual target permanently disagrees with what the user set.",
    'SILENT_INCOMPLETE_ROUTE': 'MAX_CHARGING_STOPS is hard-capped at 5 inside calculateRoute(). If a trip needs a 6th stop, the loop exits and the function returns a route object that stops short of the destination with needsCharging=true and no error, exception, or warning of any kind.',
    'NO_VALIDATION_MESSAGE_SHOWN': 'When the Calculate button is correctly disabled (invalid battery/efficiency/missing location), the UI shows no explanatory text anywhere — just a greyed-out button, with no indication of which field is the problem.',
    'INVALID_INPUT_NOT_REJECTED': 'Typing an out-of-range value into the battery-% field (negative, >100, or non-numeric) is silently ignored by BatterySlider — the field keeps its last valid value and the form stays enabled, so Calculate proceeds using a stale value instead of surfacing any feedback.',
}
mode_examples = defaultdict(list)
for r in rows:
    if r['Failure mode'] not in ('NONE', 'n/a (correctly rejected)'):
        mode_examples[r['Failure mode']].append(r['Test ID'])

top_failure_modes = []
for mode, count in pareto_items[:10]:
    base_mode = mode.split(' (')[0]
    top_failure_modes.append({
        'mode': mode,
        'count': count,
        'pctOfFailures': round(100 * count / total_defects, 1) if total_defects else 0,
        'severity': SEVERITY.get(base_mode, 'Medium'),
        'examples': mode_examples[mode][:5],
        'description': DESCRIPTIONS.get(base_mode, ''),
    })

# ── Per-config-code / per-scenario-class summary tables ───────────────────
config_summary = []
for code, rs in sorted(by_config.items()):
    n = len(rs)
    p = sum(1 for r in rs if is_pass(r))
    config_summary.append({'config': code, 'runs': n, 'passes': p, 'fails': n - p, 'passRate': round(100 * p / n, 1)})

scenario_summary = []
for cls, rs in sorted(by_scenario.items()):
    n = len(rs)
    p = sum(1 for r in rs if is_pass(r))
    scenario_summary.append({'scenario': cls, 'runs': n, 'passes': p, 'fails': n - p, 'passRate': round(100 * p / n, 1)})

# ── Boundary-value runs table (full detail) ────────────────────────────────
boundary_rows = []
for r in rows:
    if r['Scenario class'] == 'BOUNDARY_VALUE':
        boundary_rows.append({
            'testId': r['Test ID'],
            'config': r['Config code'],
            'start': r['Start location'],
            'dest': r['Destination'],
            'battery': r['Start battery'],
            'arrival': r['Arrival charge'],
            'efficiency': r['Efficiency'],
            'range': r['Range'],
            'expected': r['Expected result'],
            'status': r['Status'],
            'stops': r['Stops returned'],
            'failureMode': r['Failure mode'],
            'notes': r['Notes'],
        })

# ── Failing runs table (for the filterable dashboard table) ───────────────
failing_rows = []
for r in rows:
    if not is_pass(r):
        failing_rows.append({
            'testId': r['Test ID'],
            'config': r['Config code'],
            'scenario': r['Scenario class'],
            'status': r['Status'],
            'start': r['Start location'],
            'dest': r['Destination'],
            'distance': r['Route distance (km, approx)'],
            'battery': r['Start battery'],
            'arrival': r['Arrival charge'],
            'efficiency': r['Efficiency'],
            'range': r['Range'],
            'stops': r['Stops returned'],
            'failingAssertions': r['Failing assertion(s)'],
            'failureMode': r['Failure mode'],
            'errorMessage': r['Actual error message'],
            'notes': r['Notes'],
        })

output = {
    'total': TOTAL,
    'donut': donut,
    'scenarioRates': scenario_rates,
    'configRates': config_rates,
    'assertionChart': assertion_chart,
    'heatmap': heatmap,
    'distanceChart': distance_chart,
    'batteryChart': battery_chart,
    'arrivalChart': arrival_chart,
    'scatter': scatter,
    'respHistogram': resp_histogram,
    'respVsDist': resp_vs_dist,
    'pareto': pareto,
    'topFailureModes': top_failure_modes,
    'configSummary': config_summary,
    'scenarioSummary': scenario_summary,
    'boundaryRows': boundary_rows,
    'failingRows': failing_rows,
}

with open('dashboard_data.json', 'w') as f:
    json.dump(output, f)

print('total rows', TOTAL)
print('donut', donut)
print('scenario worst 3:', scenario_rates[:3])
print('config worst 3:', config_rates[:3])
print('assertion freq:', assertion_chart)
print('pareto top:', pareto[:5])
print('scatter n=', len(scatter))
print('boundary rows n=', len(boundary_rows))
print('failing rows n=', len(failing_rows))
