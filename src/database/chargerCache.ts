/**
 * Charger data cache operations.
 * Tile-based persistent SQLite cache with TTL support.
 */

import {getDb} from './schema';
import {ChargerStation, GeoTile, ChargerConnector} from '../types';
import {ROUTE_CONSTANTS} from '../constants/config';

const {geoTileDegrees, chargerCacheTtlMs} = ROUTE_CONSTANTS;

// ─── Tile key helpers ─────────────────────────────────────────────────────────

/** Convert lat/lng to tile indices */
export function latLngToTileKey(lat: number, lng: number): string {
  const latIdx = Math.floor(lat / geoTileDegrees);
  const lngIdx = Math.floor(lng / geoTileDegrees);
  return `${latIdx}_${lngIdx}`;
}

/** Get the tile bounds for a given tile key */
export function tileKeyToBounds(key: string): GeoTile {
  const [latIdxStr, lngIdxStr] = key.split('_');
  const latIdx = parseInt(latIdxStr, 10);
  const lngIdx = parseInt(lngIdxStr, 10);
  return {
    tileKey: key,
    minLat: latIdx * geoTileDegrees,
    maxLat: (latIdx + 1) * geoTileDegrees,
    minLng: lngIdx * geoTileDegrees,
    maxLng: (lngIdx + 1) * geoTileDegrees,
    fetchedAt: 0,
  };
}

/** Return all tile keys that cover the given bounding box */
export function getBoundingBoxTileKeys(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): string[] {
  const keys: string[] = [];
  const startLatIdx = Math.floor(minLat / geoTileDegrees);
  const endLatIdx = Math.floor(maxLat / geoTileDegrees);
  const startLngIdx = Math.floor(minLng / geoTileDegrees);
  const endLngIdx = Math.floor(maxLng / geoTileDegrees);
  for (let lat = startLatIdx; lat <= endLatIdx; lat++) {
    for (let lng = startLngIdx; lng <= endLngIdx; lng++) {
      keys.push(`${lat}_${lng}`);
    }
  }
  return keys;
}

// ─── Cache status ─────────────────────────────────────────────────────────────

/** Return which of the supplied tile keys are missing or expired */
export async function getMissingOrExpiredTileKeys(
  tileKeys: string[],
  ttlMs: number = chargerCacheTtlMs,
): Promise<string[]> {
  if (tileKeys.length === 0) return [];
  const db = await getDb();
  const placeholders = tileKeys.map(() => '?').join(',');
  const [results] = await db.executeSql(
    `SELECT tile_key, fetched_at FROM charger_tile_cache WHERE tile_key IN (${placeholders})`,
    tileKeys,
  );

  const cached = new Map<string, number>();
  for (let i = 0; i < results.rows.length; i++) {
    const row = results.rows.item(i);
    cached.set(row.tile_key as string, row.fetched_at as number);
  }

  const now = Date.now();
  return tileKeys.filter(key => {
    const fetchedAt = cached.get(key);
    if (fetchedAt === undefined) return true; // missing
    return now - fetchedAt > ttlMs; // expired
  });
}

// ─── Write operations ─────────────────────────────────────────────────────────

/** Persist charger stations for a tile, replacing any existing data */
export async function cacheChargersForTile(
  tileKey: string,
  stations: ChargerStation[],
): Promise<void> {
  const db = await getDb();
  const bounds = tileKeyToBounds(tileKey);
  const now = Date.now();

  await db.transaction(async tx => {
    // Upsert tile record
    await tx.executeSql(
      `INSERT OR REPLACE INTO charger_tile_cache (tile_key, min_lat, max_lat, min_lng, max_lng, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tileKey, bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng, now],
    );

    // Delete stale stations for this tile
    await tx.executeSql(
      'DELETE FROM charger_stations WHERE tile_key = ?',
      [tileKey],
    );

    // Insert new stations
    for (const station of stations) {
      await tx.executeSql(
        `INSERT OR REPLACE INTO charger_stations
         (id, tile_key, network_name, address, latitude, longitude,
          connectors_json, max_power_kw, pricing_info, is_live_status_avail, last_updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          station.id,
          tileKey,
          station.networkName,
          station.address,
          station.coordinate.latitude,
          station.coordinate.longitude,
          JSON.stringify(station.connectors),
          station.maxPowerKw,
          station.pricingInfo ?? null,
          station.isLiveStatusAvailable ? 1 : 0,
          station.lastUpdated ?? null,
        ],
      );
    }
  });
}

// ─── Read operations ──────────────────────────────────────────────────────────

function rowToStation(row: any): ChargerStation {
  return {
    id: row.id,
    networkName: row.network_name,
    address: row.address,
    coordinate: {latitude: row.latitude, longitude: row.longitude},
    connectors: JSON.parse(row.connectors_json ?? '[]') as ChargerConnector[],
    maxPowerKw: row.max_power_kw,
    pricingInfo: row.pricing_info ?? null,
    isLiveStatusAvailable: row.is_live_status_avail === 1,
    lastUpdated: row.last_updated ?? null,
  };
}

/** Get all cached charger stations within the given bounding box */
export async function getCachedChargersByBounds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): Promise<ChargerStation[]> {
  const db = await getDb();
  const [results] = await db.executeSql(
    `SELECT cs.* FROM charger_stations cs
     WHERE cs.latitude BETWEEN ? AND ?
       AND cs.longitude BETWEEN ? AND ?`,
    [minLat, maxLat, minLng, maxLng],
  );
  const stations: ChargerStation[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    stations.push(rowToStation(results.rows.item(i)));
  }
  return stations;
}

/** Get cached chargers within radius (km) of a point, using bounding-box approximation */
export async function getCachedChargersNear(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<ChargerStation[]> {
  // Approx 1° lat ≈ 111 km
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return getCachedChargersByBounds(
    lat - latDelta,
    lat + latDelta,
    lng - lngDelta,
    lng + lngDelta,
  );
}

/** Purge all tiles and stations whose TTL has expired */
export async function purgeExpiredCache(
  ttlMs: number = chargerCacheTtlMs,
): Promise<void> {
  const db = await getDb();
  const expiryCutoff = Date.now() - ttlMs;
  // Delete stations for expired tiles first (FK)
  await db.executeSql(
    `DELETE FROM charger_stations WHERE tile_key IN (
       SELECT tile_key FROM charger_tile_cache WHERE fetched_at < ?
     )`,
    [expiryCutoff],
  );
  await db.executeSql(
    'DELETE FROM charger_tile_cache WHERE fetched_at < ?',
    [expiryCutoff],
  );
}
