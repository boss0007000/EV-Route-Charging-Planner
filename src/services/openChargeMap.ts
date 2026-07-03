/**
 * Open Charge Map API service.
 * Docs: https://openchargemap.org/site/develop/api
 */

import axios, {AxiosError} from 'axios';
import {ChargerConnector, ChargerStation, ConnectorType} from '../types';
import {API_CONFIG} from '../constants/config';

const http = axios.create({
  baseURL: API_CONFIG.openChargeMapBaseUrl,
  timeout: API_CONFIG.requestTimeoutMs,
  headers: {
    'X-API-Key': API_CONFIG.openChargeMapApiKey,
  },
});

// ─── OCM connector type IDs ────────────────────────────────────────────────────
// Maps OCM ConnectionTypeID to our ConnectorType enum
const OCM_CONNECTOR_MAP: Record<number, ConnectorType> = {
  2: 'CHAdeMO',
  25: 'Type2',       // IEC 62196-2 Type 2 (Mennekes)
  1: 'Type1',        // SAE J1772
  27: 'Type2',       // Type 2 (tethered)
  33: 'CCS2',        // CCS (Type 2) — Combined Charging System
  32: 'CCS1',        // CCS (Type 1) — Combined Charging System
  30: 'GB/T',        // GB/T DC
  26: 'GB/T',        // GB/T AC
  28: 'NACS',        // Tesla Supercharger / NACS
};

function mapConnectorId(connectionTypeId: number | null): ConnectorType | null {
  if (!connectionTypeId) return null;
  return OCM_CONNECTOR_MAP[connectionTypeId] ?? null;
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class OCMRateLimitError extends Error {
  isRateLimit = true;
  constructor() {
    super('Open Charge Map API rate limit reached');
  }
}

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Fetch charger stations by bounding box from Open Charge Map.
 * Uses a single bounding-box query to minimise API calls.
 */
export async function fetchChargersByBoundingBox(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  maxResults = 500,
): Promise<ChargerStation[]> {
  try {
    const response = await http.get('/poi/', {
      params: {
        output: 'json',
        boundingbox: true,
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        distance: 500, // large radius — bbox will be the real filter
        distanceunit: 'KM',
        // Explicit bbox params supported by OCM
        maxresults: maxResults,
        compact: true,
        verbose: false,
      },
    });

    const items: any[] = Array.isArray(response.data) ? response.data : [];
    return items
      .filter((item: any) => {
        const lat = item.AddressInfo?.Latitude;
        const lng = item.AddressInfo?.Longitude;
        return (
          lat != null &&
          lng != null &&
          lat >= minLat &&
          lat <= maxLat &&
          lng >= minLng &&
          lng <= maxLng
        );
      })
      .map(mapOCMItem);
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 429) {
      throw new OCMRateLimitError();
    }
    throw err;
  }
}

/**
 * Fetch chargers within a radius (km) of a point.
 * Used for route-specific charging stop search.
 */
export async function fetchChargersNearPoint(
  latitude: number,
  longitude: number,
  radiusKm: number,
  connectorTypes?: ConnectorType[],
  minPowerKw?: number,
  maxResults = 50,
): Promise<ChargerStation[]> {
  try {
    const params: Record<string, unknown> = {
      output: 'json',
      latitude,
      longitude,
      distance: radiusKm,
      distanceunit: 'KM',
      maxresults: maxResults,
      compact: true,
      verbose: false,
      levelid: 3, // Level 3 = DC fast charging (prioritise for routing)
    };

    const response = await http.get('/poi/', {params});
    const items: any[] = Array.isArray(response.data) ? response.data : [];
    let stations = items.map(mapOCMItem);

    // Client-side filters
    if (connectorTypes && connectorTypes.length > 0) {
      stations = stations.filter(s =>
        s.connectors.some(c => connectorTypes.includes(c.type)),
      );
    }
    if (minPowerKw != null) {
      stations = stations.filter(s => s.maxPowerKw >= minPowerKw);
    }

    return stations;
  } catch (err) {
    const axiosErr = err as AxiosError;
    if (axiosErr.response?.status === 429) {
      throw new OCMRateLimitError();
    }
    throw err;
  }
}

// ─── Mapping helper ───────────────────────────────────────────────────────────

function mapOCMItem(item: any): ChargerStation {
  const addr = item.AddressInfo ?? {};
  const connections: any[] = item.Connections ?? [];

  const connectors: ChargerConnector[] = connections
    .map((conn: any) => {
      const type = mapConnectorId(conn.ConnectionTypeID);
      if (!type) return null;
      const powerKw =
        conn.PowerKW ??
        (conn.Voltage && conn.Amps
          ? (conn.Voltage * conn.Amps) / 1000
          : 0);
      return {
        type,
        powerKw,
        isOperational:
          conn.StatusTypeID != null
            ? [20, 30, 50, 75, 100, 150, 200].includes(conn.StatusTypeID)
              ? true
              : null
            : null,
      } as ChargerConnector;
    })
    .filter((c): c is ChargerConnector => c !== null);

  const maxPowerKw = connectors.reduce(
    (max, c) => Math.max(max, c.powerKw),
    0,
  );

  const usageCost = item.UsageCost;
  const pricingInfo =
    typeof usageCost === 'string' && usageCost.trim()
      ? usageCost.trim()
      : null;

  // Live status: OCM provides StatusTypeID on connections
  const isLiveStatusAvailable = connections.some(
    (c: any) => c.StatusTypeID != null,
  );

  const networkName =
    item.OperatorInfo?.Title ??
    item.OperatorInfo?.WebsiteURL ??
    'Unknown Network';

  const address = [
    addr.AddressLine1,
    addr.Town,
    addr.StateOrProvince,
    addr.Postcode,
    addr.Country?.ISOCode,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    id: String(item.ID ?? `ocm-${addr.Latitude}-${addr.Longitude}`),
    networkName,
    address,
    coordinate: {
      latitude: addr.Latitude,
      longitude: addr.Longitude,
    },
    connectors,
    maxPowerKw,
    pricingInfo,
    isLiveStatusAvailable,
    lastUpdated: item.DateLastStatusUpdate ?? null,
  };
}
