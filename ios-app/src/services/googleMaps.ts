/**
 * Google Maps API service — Directions and Places Autocomplete.
 */

import axios from 'axios';
import {
  DirectionsResult,
  LatLng,
  PlaceResult,
  PlacesAutocompleteResult,
} from '../types';
import {API_CONFIG} from '../constants/config';

const http = axios.create({
  timeout: API_CONFIG.requestTimeoutMs,
});

// ─── Directions ────────────────────────────────────────────────────────────────

/**
 * Get driving directions between two points.
 * Returns polyline, distance, duration.
 */
export async function getDirections(
  origin: LatLng | string,
  destination: LatLng | string,
  waypoints?: (LatLng | string)[],
): Promise<DirectionsResult> {
  const originParam =
    typeof origin === 'string'
      ? origin
      : `${origin.latitude},${origin.longitude}`;
  const destParam =
    typeof destination === 'string'
      ? destination
      : `${destination.latitude},${destination.longitude}`;

  const params: Record<string, string> = {
    origin: originParam,
    destination: destParam,
    mode: 'driving',
    units: 'metric',
    key: API_CONFIG.googleMapsApiKey,
  };

  if (waypoints && waypoints.length > 0) {
    params.waypoints = waypoints
      .map(wp => (typeof wp === 'string' ? wp : `${wp.latitude},${wp.longitude}`))
      .join('|');
  }

  const response = await http.get(API_CONFIG.googleMapsDirectionsUrl, {params});
  const data = response.data;

  if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
    throw new Error(`Directions API error: ${data.status}`);
  }

  const route = data.routes[0];
  const legs = route.legs as any[];

  const totalDistanceM = legs.reduce(
    (sum: number, leg: any) => sum + (leg.distance?.value ?? 0),
    0,
  );
  const totalDurationS = legs.reduce(
    (sum: number, leg: any) => sum + (leg.duration?.value ?? 0),
    0,
  );

  // Decode polyline
  const encodedPolyline: string = route.overview_polyline?.points ?? '';
  const polylinePoints = decodePolyline(encodedPolyline);

  return {
    polylinePoints,
    distanceKm: totalDistanceM / 1000,
    durationMin: totalDurationS / 60,
    waypointsOrder: route.waypoint_order ?? [],
  };
}

/**
 * Get a LatLng from a place ID using the Geocoding API.
 */
export async function geocodePlaceId(placeId: string): Promise<LatLng> {
  const response = await http.get(API_CONFIG.googleMapsGeocodingUrl, {
    params: {
      place_id: placeId,
      key: API_CONFIG.googleMapsApiKey,
    },
  });
  const data = response.data;

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    throw new Error(`Geocoding API error: ${data.status}`);
  }

  const loc = data.results[0].geometry.location;
  return {latitude: loc.lat, longitude: loc.lng};
}

/**
 * Reverse-geocode a LatLng to a human-readable address.
 */
export async function reverseGeocode(coord: LatLng): Promise<string> {
  const response = await http.get(API_CONFIG.googleMapsGeocodingUrl, {
    params: {
      latlng: `${coord.latitude},${coord.longitude}`,
      key: API_CONFIG.googleMapsApiKey,
    },
  });
  const data = response.data;

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return `${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`;
  }

  return data.results[0].formatted_address as string;
}

// ─── Places Autocomplete ──────────────────────────────────────────────────────

/**
 * Autocomplete a place query string.
 * Returns up to 5 place suggestions.
 */
export async function autocompletePlaces(
  input: string,
  sessionToken?: string,
  locationBias?: LatLng,
): Promise<PlaceResult[]> {
  if (!input.trim()) return [];

  const params: Record<string, string> = {
    input,
    key: API_CONFIG.googleMapsApiKey,
    types: 'geocode|establishment',
  };

  if (sessionToken) params.sessiontoken = sessionToken;
  if (locationBias) {
    params.location = `${locationBias.latitude},${locationBias.longitude}`;
    params.radius = '50000'; // 50 km bias radius
  }

  const response = await http.get(
    API_CONFIG.googleMapsPlacesAutocompleteUrl,
    {params},
  );
  const data = response.data as PlacesAutocompleteResult & {predictions: any[]};

  if (!data.predictions) return [];

  return data.predictions.slice(0, 5).map((pred: any) => ({
    placeId: pred.place_id,
    description: pred.description,
    mainText: pred.structured_formatting?.main_text ?? pred.description,
    secondaryText: pred.structured_formatting?.secondary_text ?? '',
  }));
}

// ─── Polyline Decoder ─────────────────────────────────────────────────────────

/**
 * Decode a Google Maps encoded polyline string into an array of LatLng points.
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({latitude: lat / 1e5, longitude: lng / 1e5});
  }

  return points;
}

/**
 * Find the LatLng point along the polyline that is closest to targetDistanceKm
 * from the start of the polyline.
 */
export function pointAtDistanceKm(
  polylinePoints: LatLng[],
  targetDistanceKm: number,
): LatLng | null {
  if (polylinePoints.length === 0) return null;

  let cumulativeKm = 0;

  for (let i = 1; i < polylinePoints.length; i++) {
    const prev = polylinePoints[i - 1];
    const curr = polylinePoints[i];
    const segmentKm = haversineKm(prev, curr);

    if (cumulativeKm + segmentKm >= targetDistanceKm) {
      // Interpolate within this segment
      const remaining = targetDistanceKm - cumulativeKm;
      const fraction = segmentKm > 0 ? remaining / segmentKm : 0;
      return {
        latitude: prev.latitude + fraction * (curr.latitude - prev.latitude),
        longitude: prev.longitude + fraction * (curr.longitude - prev.longitude),
      };
    }

    cumulativeKm += segmentKm;
  }

  // Target further than total length — return last point
  return polylinePoints[polylinePoints.length - 1];
}

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
