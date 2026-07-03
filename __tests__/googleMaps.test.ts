/**
 * Unit tests for Google Maps polyline decoder and route helpers.
 */

import {decodePolyline, pointAtDistanceKm} from '../src/services/googleMaps';
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
