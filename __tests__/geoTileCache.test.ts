/**
 * Unit tests for geo-tile cache utilities.
 */

import {
  latLngToTileKey,
  tileKeyToBounds,
  getBoundingBoxTileKeys,
} from '../src/database/chargerCache';
import {
  haversineDistanceKm as geoHaversine,
  getBoundsForRadius,
} from '../src/utils/geoTileCache';

describe('latLngToTileKey', () => {
  it('generates correct tile key for known coordinate', () => {
    // lat=51.5, lng=-0.1 → lat floor(51.5/0.1) = 515, lng floor(-0.1/0.1) = -1
    const key = latLngToTileKey(51.5, -0.1);
    expect(key).toBe('515_-1');
  });

  it('generates the same key for two coordinates in the same tile', () => {
    const key1 = latLngToTileKey(51.50, -0.05);
    const key2 = latLngToTileKey(51.59, -0.01);
    expect(key1).toBe(key2);
  });

  it('generates different keys for adjacent tiles', () => {
    const key1 = latLngToTileKey(51.0, 0.0);
    const key2 = latLngToTileKey(51.1, 0.0);
    expect(key1).not.toBe(key2);
  });
});

describe('tileKeyToBounds', () => {
  it('returns correct bounds for a key', () => {
    const tile = tileKeyToBounds('515_-1');
    expect(tile.minLat).toBeCloseTo(51.5, 5);
    expect(tile.maxLat).toBeCloseTo(51.6, 5);
    expect(tile.minLng).toBeCloseTo(-0.1, 5);
    expect(tile.maxLng).toBeCloseTo(0.0, 5);
  });

  it('is reversible with latLngToTileKey', () => {
    const key = latLngToTileKey(48.8, 2.3);
    const bounds = tileKeyToBounds(key);
    expect(bounds.minLat).toBeLessThanOrEqual(48.8);
    expect(bounds.maxLat).toBeGreaterThan(48.8);
    expect(bounds.minLng).toBeLessThanOrEqual(2.3);
    expect(bounds.maxLng).toBeGreaterThan(2.3);
  });
});

describe('getBoundingBoxTileKeys', () => {
  it('returns all tiles covering a bounding box', () => {
    // A 0.2° × 0.2° box should have 4 tiles (2×2)
    const keys = getBoundingBoxTileKeys(51.0, 51.2, 0.0, 0.2);
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });

  it('returns one tile for a point', () => {
    const keys = getBoundingBoxTileKeys(51.5, 51.5, -0.1, -0.1);
    expect(keys.length).toBe(1);
  });

  it('returns no duplicate keys', () => {
    const keys = getBoundingBoxTileKeys(51.0, 51.5, 0.0, 0.5);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

describe('haversineDistanceKm', () => {
  it('returns ~0 for identical points', () => {
    expect(
      geoHaversine({latitude: 51.5, longitude: -0.1}, {latitude: 51.5, longitude: -0.1}),
    ).toBeCloseTo(0);
  });

  it('London to Paris is approximately 340 km', () => {
    const london = {latitude: 51.5074, longitude: -0.1278};
    const paris = {latitude: 48.8566, longitude: 2.3522};
    const dist = geoHaversine(london, paris);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(360);
  });

  it('is commutative', () => {
    const a = {latitude: 48.0, longitude: 11.0};
    const b = {latitude: 52.0, longitude: 13.0};
    expect(geoHaversine(a, b)).toBeCloseTo(geoHaversine(b, a));
  });
});

describe('getBoundsForRadius', () => {
  it('returns bounds containing the center', () => {
    const center = {latitude: 51.5, longitude: -0.1};
    const bounds = getBoundsForRadius(center, 10);
    expect(bounds.minLat).toBeLessThan(center.latitude);
    expect(bounds.maxLat).toBeGreaterThan(center.latitude);
    expect(bounds.minLng).toBeLessThan(center.longitude);
    expect(bounds.maxLng).toBeGreaterThan(center.longitude);
  });

  it('larger radius → larger bounds', () => {
    const center = {latitude: 51.5, longitude: -0.1};
    const small = getBoundsForRadius(center, 5);
    const large = getBoundsForRadius(center, 50);
    expect(large.maxLat - large.minLat).toBeGreaterThan(
      small.maxLat - small.minLat,
    );
  });
});
