import Config from 'react-native-config';

/** Runtime configuration loaded from .env */
export const API_CONFIG = {
  googleMapsApiKey: Config.GOOGLE_MAPS_API_KEY ?? '',
  openChargeMapApiKey: Config.OPEN_CHARGE_MAP_API_KEY ?? '',

  // Google Maps REST endpoints
  googleMapsDirectionsUrl:
    'https://maps.googleapis.com/maps/api/directions/json',
  googleMapsPlacesAutocompleteUrl:
    'https://maps.googleapis.com/maps/api/place/autocomplete/json',
  googleMapsGeocodingUrl:
    'https://maps.googleapis.com/maps/api/geocode/json',

  // Open Charge Map
  openChargeMapBaseUrl: 'https://api.openchargemap.io/v3',

  // Request timeouts (ms)
  requestTimeoutMs: 10000,
};

/** Routing / planning constants */
export const ROUTE_CONSTANTS = {
  safetyBufferFactor: 0.90,      // apply 10% buffer to usable range
  geoTileDegrees: 0.1,           // ~11 km grid cells
  chargerSearchRadiusKm: 20,     // radius around "charge needed" point
  mapPanDebounceMs: 600,         // wait before fetching after pan
  chargerCacheTtlMs: 24 * 60 * 60 * 1000, // 24 h default TTL
};

/** Database name */
export const DB_NAME = 'chargeroute.db';
export const DB_VERSION = '1.0';
