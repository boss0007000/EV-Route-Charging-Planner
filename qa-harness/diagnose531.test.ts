/**
 * One-off diagnostic: replay calculateRoute()'s exact internal bookkeeping
 * for Test #531, step by step, using the REAL production pointAtDistanceKm
 * and haversineDistanceKm functions (not reimplementations), to find exactly
 * where the app's real accounting diverges from the closed-form oracle.
 */
import {pointAtDistanceKm} from '../src/services/googleMaps';
import {haversineDistanceKm} from '../src/utils/geoTileCache';
import type {LatLng} from '../src/types';

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function buildPolyline(distanceKm: number): LatLng[] {
  const n = Math.max(2, Math.min(4000, Math.round(distanceKm * 2) + 2));
  const baseLat = 25;
  const kmPerDegLng = 111.32 * Math.cos((baseLat * Math.PI) / 180);
  const totalDegLng = distanceKm / kmPerDegLng;
  const points: LatLng[] = [];
  for (let i = 0; i <= n; i++) points.push({latitude: baseLat, longitude: -80 + (i / n) * totalDegLng});
  return points;
}
function measurePolylineKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}
function findChargeNeededPointKm(startBattery: number, capKwh: number, effWhKm: number, remainingKm: number, reservePct: number): number | null {
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
function batteryAfterDriving(currentBattery: number, capKwh: number, effWhKm: number, distanceKm: number): number {
  const usedWh = distanceKm * effWhKm;
  const totalWh = capKwh * 1000;
  const remainingWh = (currentBattery / 100) * totalWh - usedWh;
  return Math.max(0, (remainingWh / totalWh) * 100);
}

test('diagnose test 531', () => {
  const nominalDistanceKm = 413.3113830244107;
  const capKwh = 40, effWhKm = 267, reserve = 15, chargeTo = 92;
  let battery = 90;

  const polyline = buildPolyline(nominalDistanceKm);
  const fullRouteDistanceKm = measurePolylineKm(polyline); // = fullRoute.distanceKm in the real app
  console.error('nominal requested distance:', nominalDistanceKm);
  console.error('measured polyline distance (fullRoute.distanceKm):', fullRouteDistanceKm);
  console.error('polyline points:', polyline.length);

  // ── Oracle (closed-form, continuous) ──
  console.error('\n=== ORACLE (closed-form) ===');
  {
    let b = 90, covered = 0, stops = 0;
    while (stops < 6) {
      const remaining = fullRouteDistanceKm - covered;
      const neededAt = findChargeNeededPointKm(b, capKwh, effWhKm, remaining, reserve);
      if (neededAt === null) { console.error(`  reached destination after ${stops} stops, remaining=${remaining.toFixed(4)}km`); break; }
      console.error(`  stop ${stops + 1}: remaining=${remaining.toFixed(4)}, chargeNeededAtKm=${neededAt.toFixed(4)}, margin=${(remaining - neededAt).toFixed(4)}`);
      covered += neededAt;
      b = chargeTo;
      stops++;
    }
  }

  // ── Real app bookkeeping, replayed step by step with REAL production functions ──
  console.error('\n=== REAL calculateRoute() bookkeeping (using real pointAtDistanceKm + haversineDistanceKm) ===');
  let startCoord: LatLng = polyline[0];
  let coveredKm = 0;
  let remainingPolyline = polyline;
  let stopCount = 0;
  while (stopCount < 6) {
    const remainingDistanceKm = fullRouteDistanceKm - coveredKm;
    const chargeNeededAtKm = findChargeNeededPointKm(battery, capKwh, effWhKm, remainingDistanceKm, reserve);
    if (chargeNeededAtKm === null) {
      console.error(`  REACHED DESTINATION after ${stopCount} stops. remainingDistanceKm=${remainingDistanceKm.toFixed(4)}`);
      break;
    }
    const chargePointCoord = pointAtDistanceKm(remainingPolyline, chargeNeededAtKm) ?? remainingPolyline[remainingPolyline.length - 1];
    // In the real app the "charger" is placed AT chargePointCoord (our mock does this exactly).
    const distToChargerKm = haversineDistanceKm(startCoord, chargePointCoord);
    console.error(`  stop ${stopCount + 1}: analytic chargeNeededAtKm=${chargeNeededAtKm.toFixed(4)}  |  REAL distToChargerKm (haversine chord)=${distToChargerKm.toFixed(4)}  |  delta=${(distToChargerKm - chargeNeededAtKm).toFixed(4)}`);

    const legPolyline = remainingPolyline.slice(0, Math.ceil(remainingPolyline.length * (distToChargerKm / remainingDistanceKm)));
    coveredKm += distToChargerKm; // real app uses distToChargerKm, NOT chargeNeededAtKm, for bookkeeping
    battery = chargeTo;
    startCoord = chargePointCoord;
    remainingPolyline = remainingPolyline.slice(legPolyline.length);
    stopCount++;
    console.error(`     -> coveredKm now ${coveredKm.toFixed(4)}, remainingPolyline points left: ${remainingPolyline.length}`);
  }

  expect(true).toBe(true);
});
