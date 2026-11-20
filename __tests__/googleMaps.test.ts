/**
 * Unit tests for Google Maps polyline decoder and route helpers.
 */

import {
  decodePolyline,
  pointAtDistanceKm,
  splitPolylineAtDistanceKm,
} from '../src/services/googleMaps';
import {LatLng} from '../src/types';

describe('decodePolyline', () => {
  it('decodes a known encoded polyline correctly', () => {
    // Google's example: encode of (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const decoded = decodePolyline(encoded);
    expect(decoded.length).toBe(3);
    expect(decoded[0].latitude).toBeCloseTo(38.5, 1);
    expect(decoded[0].longitude).toBeCloseTo(-120.2, 1);
    expect(decoded[1].latitude).toBeCloseTo(40.7, 1);
    expect(decoded[2].latitude).toBeCloseTo(43.252, 1);
  });

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('pointAtDistanceKm', () => {
  // A simple horizontal polyline along equator
  const horizontalLine: LatLng[] = [
    {latitude: 0, longitude: 0},
    {latitude: 0, longitude: 1},   // ~111 km
    {latitude: 0, longitude: 2},   // ~222 km
  ];

  it('returns first point for distance 0', () => {
    const pt = pointAtDistanceKm(horizontalLine, 0);
    expect(pt?.latitude).toBeCloseTo(0);
    expect(pt?.longitude).toBeCloseTo(0);
  });

  it('returns last point when target exceeds total length', () => {
    const pt = pointAtDistanceKm(horizontalLine, 999);
    expect(pt?.latitude).toBeCloseTo(0);
    expect(pt?.longitude).toBeCloseTo(2);
  });

  it('returns null for empty polyline', () => {
    expect(pointAtDistanceKm([], 50)).toBeNull();
  });

  it('interpolates correctly within a segment', () => {
    // At ~55.5 km (midpoint of first segment ~111 km), longitude should be ≈0.5
    const pt = pointAtDistanceKm(horizontalLine, 55.5);
    expect(pt).not.toBeNull();
    expect(pt!.longitude).toBeGreaterThan(0);
    expect(pt!.longitude).toBeLessThan(1);
  });
});

describe('splitPolylineAtDistanceKm', () => {
  const horizontalLine: LatLng[] = [
    {latitude: 0, longitude: 0},
    {latitude: 0, longitude: 1}, // ~111 km
    {latitude: 0, longitude: 2}, // ~222 km
  ];

  it('splits at the exact interpolated point, matching pointAtDistanceKm', () => {
    const target = 55.5;
    const expectedPoint = pointAtDistanceKm(horizontalLine, target);
    const {leg, remaining} = splitPolylineAtDistanceKm(horizontalLine, target);

    expect(leg[leg.length - 1].longitude).toBeCloseTo(expectedPoint!.longitude);
    expect(remaining[0].longitude).toBeCloseTo(expectedPoint!.longitude);
    // leg and remaining each get their own copy of the shared split point,
    // so together they have exactly 2 more points than the original.
    expect(leg.length + remaining.length).toBe(horizontalLine.length + 2);
  });

  it('handles target beyond the whole polyline', () => {
    const {leg, remaining} = splitPolylineAtDistanceKm(horizontalLine, 9999);
    expect(leg).toEqual(horizontalLine);
    expect(remaining).toEqual([horizontalLine[horizontalLine.length - 1]]);
  });

  it('handles target of 0', () => {
    const {leg, remaining} = splitPolylineAtDistanceKm(horizontalLine, 0);
    expect(leg).toEqual([horizontalLine[0]]);
    expect(remaining).toEqual(horizontalLine);
  });

  it('returns empty leg/remaining for an empty polyline', () => {
    expect(splitPolylineAtDistanceKm([], 50)).toEqual({leg: [], remaining: []});
  });

  it('stays accurate across repeated splits on a polyline with wildly uneven point density (regression for route-planning stalling)', () => {
    // Mimic a real Google Directions polyline: hundreds of points packed
    // into the first few km (dense city streets), then only a handful of
    // points for the remaining hundreds of km (sparse highway). A
    // point-count-proportion split badly misjudges distance here — that
    // was the root cause of route planning stalling after a few km on
    // real long-distance trips.
    const kmPerDeg = 111.32; // at the equator, matching this test's latitude=0 points
    const densePoints: LatLng[] = [];
    for (let i = 0; i <= 500; i++) {
      densePoints.push({latitude: 0, longitude: (i / 500) * (5 / kmPerDeg)}); // ~5 km, 501 points
    }
    const sparsePoints: LatLng[] = [];
    for (let i = 1; i <= 5; i++) {
      sparsePoints.push({
        latitude: 0,
        longitude: 5 / kmPerDeg + (i / 5) * (260 / kmPerDeg),
      }); // next ~260 km, 5 points
    }
    const polyline = [...densePoints, ...sparsePoints];
    const totalDistanceKm = polyline[polyline.length - 1].longitude * kmPerDeg;

    let remaining = polyline;
    let covered = 0;
    const perStopKm = 60;
    for (let stop = 0; stop < 5; stop++) {
      const {leg, remaining: next} = splitPolylineAtDistanceKm(remaining, perStopKm);
      const legKm = (leg[leg.length - 1].longitude - leg[0].longitude) * kmPerDeg;
      covered += legKm;
      remaining = next;
    }
    // Old point-count-proportion logic stalled near 0 km covered on a
    // polyline shaped like this; distance-based splitting should cover
    // the full trip (5 stops × 60 km ≈ exceeds the 265 km total).
    expect(covered).toBeCloseTo(totalDistanceKm, 0);
  });
});
