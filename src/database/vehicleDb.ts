/**
 * Vehicle database operations — CRUD against the SQLite vehicles table.
 */

import {getDb} from './schema';
import {Vehicle, ConnectorType, ChargingCurvePoint} from '../types';

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function rowToVehicle(row: any): Vehicle {
  return {
    id: row.id,
    manufacturer: row.manufacturer,
    brand: row.brand,
    model: row.model,
    trim: row.trim ?? '',
    modelYear: row.model_year,

    usableCapacityKwh: row.usable_capacity_kwh,

    wltpRangeKm: row.wltp_range_km ?? null,
    epaRangeKm: row.epa_range_km ?? null,
    cltcRangeKm: row.cltc_range_km ?? null,
    manufacturerRangeKm: row.manufacturer_range_km ?? null,

    realWorldMixedRangeKm: row.real_world_mixed_range_km,
    realWorldHighwayRangeKm: row.real_world_highway_range_km ?? null,
    realWorldCityRangeKm: row.real_world_city_range_km ?? null,

    efficiencyMixedWhPerKm: row.efficiency_mixed_wh_per_km,
    efficiencyHighwayWhPerKm: row.efficiency_highway_wh_per_km ?? null,
    efficiencyCityWhPerKm: row.efficiency_city_wh_per_km ?? null,

    maxAcChargingKw: row.max_ac_charging_kw,
    acConnectorType: row.ac_connector_type as ConnectorType,

    maxDcChargingKw: row.max_dc_charging_kw,
    dcConnectorType: row.dc_connector_type as ConnectorType,

    chargingTime10To80Min: row.charging_time_10_80_min ?? null,
    chargingTime20To80Min: row.charging_time_20_80_min ?? null,
    chargingTime0To100Min: row.charging_time_0_100_min ?? null,
    acFullChargeTimeMin: row.ac_full_charge_time_min ?? null,

    supportedConnectors: row.supported_connectors
      ? (row.supported_connectors.split(',') as ConnectorType[])
      : [],

    imageUrl: row.image_url ?? null,
    logoUrl: row.logo_url ?? null,

    driveType: row.drive_type ?? null,
    bodyStyle: row.body_style ?? null,
    vinPrefix: row.vin_prefix ?? null,
    generation: row.generation ?? null,

    grossCapacityKwh: row.gross_capacity_kwh ?? null,
    batteryChemistry: row.battery_chemistry ?? null,
    nominalVoltageV: row.nominal_voltage_v ?? null,
    moduleCount: row.module_count ?? null,
    cellCount: row.cell_count ?? null,

    peakDcChargingKw: row.peak_dc_charging_kw ?? null,
    chargingCurve: row.charging_curve_json
      ? (JSON.parse(row.charging_curve_json) as ChargingCurvePoint[])
      : null,

    lengthMm: row.length_mm ?? null,
    widthMm: row.width_mm ?? null,
    heightMm: row.height_mm ?? null,
    wheelbaseMm: row.wheelbase_mm ?? null,
    groundClearanceMm: row.ground_clearance_mm ?? null,

    topSpeedKmh: row.top_speed_kmh ?? null,
    powerKw: row.power_kw ?? null,
    torqueNm: row.torque_nm ?? null,
    zeroTo100Sec: row.zero_to_100_sec ?? null,

    curbWeightKg: row.curb_weight_kg ?? null,
    gvwrKg: row.gvwr_kg ?? null,

    coldWeatherEfficiencyMultiplier: row.cold_weather_efficiency_mult ?? null,
    hotWeatherEfficiencyMultiplier: row.hot_weather_efficiency_mult ?? null,

    lastUpdated: row.last_updated ?? null,
    dataSource: row.data_source ?? null,
    notes: row.notes ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Return all vehicles, ordered by manufacturer + model + year */
export async function getAllVehicles(): Promise<Vehicle[]> {
  const db = await getDb();
  const [results] = await db.executeSql(
    'SELECT * FROM vehicles ORDER BY manufacturer, model, model_year DESC',
  );
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    vehicles.push(rowToVehicle(results.rows.item(i)));
  }
  return vehicles;
}

/** Full-text search by manufacturer or model (case-insensitive) */
export async function searchVehicles(query: string): Promise<Vehicle[]> {
  const db = await getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const [results] = await db.executeSql(
    `SELECT * FROM vehicles
     WHERE LOWER(manufacturer) LIKE ? OR LOWER(model) LIKE ? OR LOWER(brand) LIKE ?
     ORDER BY manufacturer, model, model_year DESC`,
    [pattern, pattern, pattern],
  );
  const vehicles: Vehicle[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    vehicles.push(rowToVehicle(results.rows.item(i)));
  }
  return vehicles;
}

/** Get a single vehicle by id */
export async function getVehicleById(id: number): Promise<Vehicle | null> {
  const db = await getDb();
  const [results] = await db.executeSql(
    'SELECT * FROM vehicles WHERE id = ?',
    [id],
  );
  if (results.rows.length === 0) return null;
  return rowToVehicle(results.rows.item(0));
}

/** Insert a new vehicle. Returns the new row id. */
export async function insertVehicle(
  v: Omit<Vehicle, 'id'>,
): Promise<number> {
  const db = await getDb();
  const [result] = await db.executeSql(
    `INSERT INTO vehicles (
      manufacturer, brand, model, trim, model_year,
      usable_capacity_kwh,
      wltp_range_km, epa_range_km, cltc_range_km, manufacturer_range_km,
      real_world_mixed_range_km, real_world_highway_range_km, real_world_city_range_km,
      efficiency_mixed_wh_per_km, efficiency_highway_wh_per_km, efficiency_city_wh_per_km,
      max_ac_charging_kw, ac_connector_type,
      max_dc_charging_kw, dc_connector_type,
      charging_time_10_80_min, charging_time_20_80_min, charging_time_0_100_min, ac_full_charge_time_min,
      supported_connectors, image_url, logo_url,
      drive_type, body_style, vin_prefix, generation,
      gross_capacity_kwh, battery_chemistry, nominal_voltage_v, module_count, cell_count,
      peak_dc_charging_kw, charging_curve_json,
      length_mm, width_mm, height_mm, wheelbase_mm, ground_clearance_mm,
      top_speed_kmh, power_kw, torque_nm, zero_to_100_sec,
      curb_weight_kg, gvwr_kg,
      cold_weather_efficiency_mult, hot_weather_efficiency_mult,
      last_updated, data_source, notes
    ) VALUES (
      ?,?,?,?,?,  ?,  ?,?,?,?,  ?,?,?,  ?,?,?,  ?,?,  ?,?,  ?,?,?,?,  ?,?,?,
      ?,?,?,?,  ?,?,?,?,?,  ?,?,  ?,?,?,?,?,  ?,?,?,?,  ?,?,  ?,?,  ?,?,?
    )`,
    [
      v.manufacturer, v.brand, v.model, v.trim, v.modelYear,
      v.usableCapacityKwh,
      v.wltpRangeKm, v.epaRangeKm, v.cltcRangeKm, v.manufacturerRangeKm,
      v.realWorldMixedRangeKm, v.realWorldHighwayRangeKm, v.realWorldCityRangeKm,
      v.efficiencyMixedWhPerKm, v.efficiencyHighwayWhPerKm, v.efficiencyCityWhPerKm,
      v.maxAcChargingKw, v.acConnectorType,
      v.maxDcChargingKw, v.dcConnectorType,
      v.chargingTime10To80Min, v.chargingTime20To80Min, v.chargingTime0To100Min, v.acFullChargeTimeMin,
      v.supportedConnectors.join(','), v.imageUrl, v.logoUrl,
      v.driveType, v.bodyStyle, v.vinPrefix, v.generation,
      v.grossCapacityKwh, v.batteryChemistry, v.nominalVoltageV, v.moduleCount, v.cellCount,
      v.peakDcChargingKw, v.chargingCurve ? JSON.stringify(v.chargingCurve) : null,
      v.lengthMm, v.widthMm, v.heightMm, v.wheelbaseMm, v.groundClearanceMm,
      v.topSpeedKmh, v.powerKw, v.torqueNm, v.zeroTo100Sec,
      v.curbWeightKg, v.gvwrKg,
      v.coldWeatherEfficiencyMultiplier, v.hotWeatherEfficiencyMultiplier,
      v.lastUpdated, v.dataSource, v.notes,
    ],
  );
  return result.insertId;
}

/** Update an existing vehicle */
export async function updateVehicle(v: Vehicle): Promise<void> {
  const db = await getDb();
  await db.executeSql(
    `UPDATE vehicles SET
      manufacturer=?, brand=?, model=?, trim=?, model_year=?,
      usable_capacity_kwh=?,
      wltp_range_km=?, epa_range_km=?, cltc_range_km=?, manufacturer_range_km=?,
      real_world_mixed_range_km=?, real_world_highway_range_km=?, real_world_city_range_km=?,
      efficiency_mixed_wh_per_km=?, efficiency_highway_wh_per_km=?, efficiency_city_wh_per_km=?,
      max_ac_charging_kw=?, ac_connector_type=?,
      max_dc_charging_kw=?, dc_connector_type=?,
      charging_time_10_80_min=?, charging_time_20_80_min=?, charging_time_0_100_min=?, ac_full_charge_time_min=?,
      supported_connectors=?, image_url=?, logo_url=?,
      last_updated=?, notes=?
    WHERE id=?`,
    [
      v.manufacturer, v.brand, v.model, v.trim, v.modelYear,
      v.usableCapacityKwh,
      v.wltpRangeKm, v.epaRangeKm, v.cltcRangeKm, v.manufacturerRangeKm,
      v.realWorldMixedRangeKm, v.realWorldHighwayRangeKm, v.realWorldCityRangeKm,
      v.efficiencyMixedWhPerKm, v.efficiencyHighwayWhPerKm, v.efficiencyCityWhPerKm,
      v.maxAcChargingKw, v.acConnectorType,
      v.maxDcChargingKw, v.dcConnectorType,
      v.chargingTime10To80Min, v.chargingTime20To80Min, v.chargingTime0To100Min, v.acFullChargeTimeMin,
      v.supportedConnectors.join(','), v.imageUrl, v.logoUrl,
      new Date().toISOString(), v.notes,
      v.id,
    ],
  );
}

/** Delete a vehicle by id */
export async function deleteVehicle(id: number): Promise<void> {
  const db = await getDb();
  await db.executeSql('DELETE FROM vehicles WHERE id = ?', [id]);
}

/** Check whether the vehicles table is populated; seed if empty */
export async function seedVehiclesIfEmpty(
  seedData: Omit<Vehicle, 'id'>[],
): Promise<void> {
  const db = await getDb();
  const [result] = await db.executeSql('SELECT COUNT(*) as cnt FROM vehicles');
  const count = result.rows.item(0).cnt as number;
  if (count === 0) {
    for (const v of seedData) {
      await insertVehicle(v);
    }
  }
}
