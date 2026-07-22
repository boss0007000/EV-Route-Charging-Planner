/**
 * All shared TypeScript interfaces and types for the ChargeRoute app.
 * Efficiency units: Wh/km throughout.
 */

// ─── Connector Types ─────────────────────────────────────────────────────────

export type ConnectorType =
  | 'CCS2'
  | 'CCS1'
  | 'GB/T'
  | 'NACS'
  | 'CHAdeMO'
  | 'Type2'
  | 'Type1';

export type DriveType = 'RWD' | 'FWD' | 'AWD' | '4WD';
export type BodyStyle =
  | 'Sedan'
  | 'SUV'
  | 'Hatchback'
  | 'Crossover'
  | 'Pickup'
  | 'Van'
  | 'Wagon'
  | 'Coupe';

// ─── Vehicle ─────────────────────────────────────────────────────────────────

/** One charging curve data point: battery % → charge power (kW) */
export interface ChargingCurvePoint {
  batteryPercent: number; // 0-100
  powerKw: number;
}

/** Full vehicle record — maps 1:1 to SQLite vehicles table */
export interface Vehicle {
  // Primary key
  id: number;

  // Identity
  manufacturer: string;
  brand: string;
  model: string;
  trim: string;
  modelYear: number;

  // Battery (MVP required)
  usableCapacityKwh: number;

  // Range (MVP required — at least one must be non-null)
  wltpRangeKm: number | null;
  epaRangeKm: number | null;
  cltcRangeKm: number | null;
  manufacturerRangeKm: number | null;

  // Real-world range estimates (km)
  realWorldMixedRangeKm: number;
  realWorldHighwayRangeKm: number | null;
  realWorldCityRangeKm: number | null;

  // Efficiency (MVP required) — Wh/km
  efficiencyMixedWhPerKm: number;
  efficiencyHighwayWhPerKm: number | null;
  efficiencyCityWhPerKm: number | null;

  // AC charging
  maxAcChargingKw: number;
  acConnectorType: ConnectorType;

  // DC charging
  maxDcChargingKw: number;
  dcConnectorType: ConnectorType;

  // Charging times (minutes)
  chargingTime10To80Min: number | null;
  chargingTime20To80Min: number | null;
  chargingTime0To100Min: number | null;
  acFullChargeTimeMin: number | null;

  // Supported connector types (comma-separated in DB, parsed to array)
  supportedConnectors: ConnectorType[];

  // Assets
  imageUrl: string | null;
  logoUrl: string | null;

  // ── Optional fields (schema ready, populate later) ──

  driveType: DriveType | null;
  bodyStyle: BodyStyle | null;
  vinPrefix: string | null;
  generation: string | null;

  grossCapacityKwh: number | null;
  batteryChemistry: string | null;
  nominalVoltageV: number | null;
  moduleCount: number | null;
  cellCount: number | null;

  peakDcChargingKw: number | null;
  chargingCurve: ChargingCurvePoint[] | null;

  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  wheelbaseMm: number | null;
  groundClearanceMm: number | null;

  topSpeedKmh: number | null;
  powerKw: number | null;
  torqueNm: number | null;
  zeroTo100Sec: number | null;

  curbWeightKg: number | null;
  gvwrKg: number | null;

  coldWeatherEfficiencyMultiplier: number | null;
  hotWeatherEfficiencyMultiplier: number | null;

  // Metadata
  lastUpdated: string | null;
  dataSource: string | null;
  notes: string | null;
}

// ─── Location ─────────────────────────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface PlaceResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  coordinate?: LatLng;
}

// ─── Route Planning ───────────────────────────────────────────────────────────

export interface RoutePlannerInputs {
  vehicle: Vehicle | null;
  startLocation: PlaceResult | null;
  destination: PlaceResult | null;
  batteryPercent: number;
  efficiencyWhPerKm: number;
  estimatedRangeKm: number;
}

export interface RouteSettings {
  reserveBatteryPercent: number;    // default 15
  minArrivalBatteryPercent: number; // default 10
  maxChargeTargetPercent: number;   // default 80
  minChargerPowerKw: number;        // default 22
  chargerCacheTtlHours: number;     // default 24
}

export const DEFAULT_ROUTE_SETTINGS: RouteSettings = {
  reserveBatteryPercent: 15,
  minArrivalBatteryPercent: 10,
  maxChargeTargetPercent: 80,
  minChargerPowerKw: 22,
  chargerCacheTtlHours: 24,
};

// ─── Route Result ─────────────────────────────────────────────────────────────

export interface RouteLeg {
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
  arrivalBatteryPercent: number;
  polylinePoints: LatLng[];
}

export interface ChargingStop {
  charger: ChargerStation;
  distanceFromRouteKm: number;
  arrivalBatteryPercent: number;
  chargeFromPercent: number;
  chargeToPercent: number;
  estimatedChargeTimeMin: number;
  departureBatteryPercent: number;
}

export interface RouteResult {
  legs: RouteLeg[];
  chargingStops: ChargingStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
  needsCharging: boolean;
}

// ─── Charger / Open Charge Map ────────────────────────────────────────────────

export interface ChargerConnector {
  type: ConnectorType;
  powerKw: number;
  isOperational: boolean | null;
}

export interface ChargerStation {
  id: string;
  networkName: string;
  address: string;
  coordinate: LatLng;
  connectors: ChargerConnector[];
  maxPowerKw: number;
  pricingInfo: string | null;
  isLiveStatusAvailable: boolean;
  lastUpdated: string | null;
}

export interface ChargerFilter {
  connectorTypes: ConnectorType[];
  minPowerKw: number;
  networkOperator: string | null;
}

// ─── Geo-tile cache ───────────────────────────────────────────────────────────

export interface GeoTile {
  tileKey: string;   // "{latIndex}_{lngIndex}"
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  fetchedAt: number; // unix timestamp ms
}

// ─── Google Maps API ──────────────────────────────────────────────────────────

export interface DirectionsResult {
  polylinePoints: LatLng[];
  distanceKm: number;
  durationMin: number;
  waypointsOrder: number[];
}

export interface PlacesAutocompleteResult {
  predictions: PlaceResult[];
}
