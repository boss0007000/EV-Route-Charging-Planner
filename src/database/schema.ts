/**
 * SQLite schema initialisation.
 * Tables:
 *   vehicles         — vehicle database (bundled + admin-added)
 *   charger_cache    — Open Charge Map tile cache
 *   charger_stations — individual stations cached per tile
 */

import SQLite from 'react-native-sqlite-storage';
import {DB_NAME, DB_VERSION} from '../constants/config';

SQLite.enablePromise(true);

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabase({
    name: DB_NAME,
    location: 'default',
  });
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = await getDb();

  await database.executeSql(`PRAGMA journal_mode=WAL;`);

  // ── Vehicles ────────────────────────────────────────────────────────────────
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id                              INTEGER PRIMARY KEY AUTOINCREMENT,
      manufacturer                    TEXT NOT NULL,
      brand                           TEXT NOT NULL,
      model                           TEXT NOT NULL,
      trim                            TEXT NOT NULL DEFAULT '',
      model_year                      INTEGER NOT NULL,

      -- Battery (required)
      usable_capacity_kwh             REAL NOT NULL,

      -- Range (nullable — at least one should be set)
      wltp_range_km                   REAL,
      epa_range_km                    REAL,
      cltc_range_km                   REAL,
      manufacturer_range_km           REAL,

      -- Real-world range estimates (km)
      real_world_mixed_range_km       REAL NOT NULL,
      real_world_highway_range_km     REAL,
      real_world_city_range_km        REAL,

      -- Efficiency (Wh/km — required: mixed)
      efficiency_mixed_wh_per_km      REAL NOT NULL,
      efficiency_highway_wh_per_km    REAL,
      efficiency_city_wh_per_km       REAL,

      -- AC charging
      max_ac_charging_kw              REAL NOT NULL,
      ac_connector_type               TEXT NOT NULL,

      -- DC charging
      max_dc_charging_kw              REAL NOT NULL,
      dc_connector_type               TEXT NOT NULL,

      -- Charging times (minutes)
      charging_time_10_80_min         REAL,
      charging_time_20_80_min         REAL,
      charging_time_0_100_min         REAL,
      ac_full_charge_time_min         REAL,

      -- Supported connectors (comma-separated)
      supported_connectors            TEXT NOT NULL DEFAULT '',

      -- Assets
      image_url                       TEXT,
      logo_url                        TEXT,

      -- Optional — identity
      drive_type                      TEXT,
      body_style                      TEXT,
      vin_prefix                      TEXT,
      generation                      TEXT,

      -- Optional — battery details
      gross_capacity_kwh              REAL,
      battery_chemistry               TEXT,
      nominal_voltage_v               REAL,
      module_count                    INTEGER,
      cell_count                      INTEGER,

      -- Optional — advanced charging
      peak_dc_charging_kw             REAL,
      charging_curve_json             TEXT,   -- JSON array of {batteryPercent, powerKw}

      -- Optional — dimensions (mm)
      length_mm                       REAL,
      width_mm                        REAL,
      height_mm                       REAL,
      wheelbase_mm                    REAL,
      ground_clearance_mm             REAL,

      -- Optional — performance
      top_speed_kmh                   REAL,
      power_kw                        REAL,
      torque_nm                       REAL,
      zero_to_100_sec                 REAL,

      -- Optional — weight
      curb_weight_kg                  REAL,
      gvwr_kg                         REAL,

      -- Optional — weather efficiency multipliers
      cold_weather_efficiency_mult    REAL,
      hot_weather_efficiency_mult     REAL,

      -- Metadata
      last_updated                    TEXT,
      data_source                     TEXT,
      notes                           TEXT
    );
  `);

  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_vehicles_manufacturer ON vehicles (manufacturer);',
  );
  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_vehicles_model ON vehicles (model);',
  );
  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_vehicles_year ON vehicles (model_year);',
  );

  // ── Geo-tile cache ───────────────────────────────────────────────────────────
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS charger_tile_cache (
      tile_key    TEXT PRIMARY KEY,
      min_lat     REAL NOT NULL,
      max_lat     REAL NOT NULL,
      min_lng     REAL NOT NULL,
      max_lng     REAL NOT NULL,
      fetched_at  INTEGER NOT NULL   -- unix ms
    );
  `);

  // ── Charger stations ─────────────────────────────────────────────────────────
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS charger_stations (
      id                     TEXT PRIMARY KEY,
      tile_key               TEXT NOT NULL,
      network_name           TEXT NOT NULL DEFAULT '',
      address                TEXT NOT NULL DEFAULT '',
      latitude               REAL NOT NULL,
      longitude              REAL NOT NULL,
      connectors_json        TEXT NOT NULL DEFAULT '[]',  -- JSON: ChargerConnector[]
      max_power_kw           REAL NOT NULL DEFAULT 0,
      pricing_info           TEXT,
      is_live_status_avail   INTEGER NOT NULL DEFAULT 0,  -- 0/1
      last_updated           TEXT,
      FOREIGN KEY (tile_key) REFERENCES charger_tile_cache(tile_key)
    );
  `);

  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_charger_tile ON charger_stations (tile_key);',
  );
  await database.executeSql(
    'CREATE INDEX IF NOT EXISTS idx_charger_lat_lng ON charger_stations (latitude, longitude);',
  );
}
