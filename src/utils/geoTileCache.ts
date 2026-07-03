/**
 * Geo-tile caching utilities for the Charger Map screen.
 * Map divided into TILE_DEGREES × TILE_DEGREES grid cells.
 */

import {
  latLngToTileKey,
  getBoundingBoxTileKeys,
  getMissingOrExpiredTileKeys,
  cacheChargersForTile,
  getCachedChargersByBounds,
  purgeExpiredCache,
} from '../database/chargerCache';
import {fetchChargersByBoundingBox} from '../services/openChargeMap';
import {ChargerStation, LatLng} from '../types';
import {ROUTE_CONSTANTS} from '../constants/config';

const {chargerCacheTtlMs} = ROUTE_CONSTANTS;

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Given a map bounding box, return all charger stations.
 * Fetches and caches only tiles that are missing or expired (TTL-based).
 * Returns cached data for valid tiles immediately.
 *
 * @param onThrottled - called if OCM API returns a rate-limit error
 */
export async function getChargersForBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  ttlMs: number = chargerCacheTtlMs,
  onThrottled?: () => void,
): Promise<ChargerStation[]> {
  // 1. Determine which tiles cover the bounding box
  const allTileKeys = getBoundingBoxTileKeys(minLat, maxLat, minLng, maxLng);

  // 2. Find which tiles need to be fetched
  const missingOrExpired = await getMissingOrExpiredTileKeys(allTileKeys, ttlMs);

  // 3. Fetch missing tiles from OCM API
  if (missingOrExpired.length > 0) {
    try {
      // Compute the union bounding box for the missing tiles to make a single API call
      const {unionMinLat, unionMaxLat, unionMinLng, unionMaxLng} =
        getUnionBounds(missingOrExpired);

      const stations = await fetchChargersByBoundingBox(
        unionMinLat,
        unionMaxLat,
        unionMinLng,
        unionMaxLng,
      );

      // Group stations by tile and cache each tile
      const tileStations = groupStationsByTile(stations, missingOrExpired);
      for (const [tileKey, tileStationList] of Object.entries(tileStations)) {
        await cacheChargersForTile(tileKey, tileStationList);
      }

      // Also cache tiles that returned no stations (so we don't refetch them)
      for (const key of missingOrExpired) {
        if (!tileStations[key]) {
          await cacheChargersForTile(key, []);
        }
      }
    } catch (error: any) {
      if (error?.isRateLimit) {
        onThrottled?.();
      } else {
        console.warn('OCM fetch error, falling back to cache:', error);
      }
      // Fall through — serve whatever is cached
    }
  }

  // 4. Return all cached stations for the requested bounding box
  return getCachedChargersByBounds(minLat, maxLat, minLng, maxLng);
}

/**
 * Single tile key for a given coordinate.
 */
export {latLngToTileKey};

/**
 * Purge expired cache entries to reclaim space.
 */
export async function cleanExpiredCache(ttlMs?: number): Promise<void> {
  await purgeExpiredCache(ttlMs);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the union bounding box of all given tile keys.
 */
function getUnionBounds(tileKeys: string[]): {
  unionMinLat: number;
  unionMaxLat: number;
  unionMinLng: number;
  unionMaxLng: number;
} {
  const {geoTileDegrees} = ROUTE_CONSTANTS;
  let unionMinLat = Infinity,
    unionMaxLat = -Infinity,
    unionMinLng = Infinity,
    unionMaxLng = -Infinity;

  for (const key of tileKeys) {
    const [latStr, lngStr] = key.split('_');
    const latIdx = parseInt(latStr, 10);
    const lngIdx = parseInt(lngStr, 10);
    unionMinLat = Math.min(unionMinLat, latIdx * geoTileDegrees);
    unionMaxLat = Math.max(unionMaxLat, (latIdx + 1) * geoTileDegrees);
    unionMinLng = Math.min(unionMinLng, lngIdx * geoTileDegrees);
    unionMaxLng = Math.max(unionMaxLng, (lngIdx + 1) * geoTileDegrees);
  }

  return {unionMinLat, unionMaxLat, unionMinLng, unionMaxLng};
}

/**
 * Group an array of stations by which tile key they belong to.
 * A station can fall in multiple tiles (if on a tile border) — assign to primary tile.
 */
function groupStationsByTile(
  stations: ChargerStation[],
  tileKeys: string[],
): Record<string, ChargerStation[]> {
  const tileSet = new Set(tileKeys);
  const result: Record<string, ChargerStation[]> = {};

  for (const station of stations) {
    const key = latLngToTileKey(
      station.coordinate.latitude,
      station.coordinate.longitude,
    );
    if (tileSet.has(key)) {
      if (!result[key]) result[key] = [];
      result[key].push(station);
    }
  }

  return result;
}

/**
 * Get the bounding box for a map region centered at a point with a radius.
 */
export function getBoundsForRadius(
  center: LatLng,
  radiusKm: number,
): {minLat: number; maxLat: number; minLng: number; maxLng: number} {
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.cos((center.latitude * Math.PI) / 180));
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}

/**
 * Calculate distance between two LatLng points using the Haversine formula (km).
 */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth radius km
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const haversine =
    sinDLat * sinDLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
