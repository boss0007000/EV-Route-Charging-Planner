/**
 * Deep-link utilities for opening routes in the native Google Maps app.
 */

import {Linking, Platform} from 'react-native';
import {LatLng} from '../types';

/**
 * Build a Google Maps URL for multi-waypoint navigation.
 * Opens the native Google Maps app on iOS and Android.
 *
 * @param origin     - starting coordinate or address string
 * @param destination - final destination coordinate or address string
 * @param waypoints  - optional intermediate stops (charging stops)
 */
export function buildGoogleMapsUrl(
  origin: string | LatLng,
  destination: string | LatLng,
  waypoints: (string | LatLng)[] = [],
): string {
  const originParam = formatLocationParam(origin);
  const destParam = formatLocationParam(destination);

  const waypointsParam =
    waypoints.length > 0
      ? `&waypoints=${waypoints.map(formatLocationParam).join('|')}`
      : '';

  if (Platform.OS === 'ios') {
    // comgooglemaps:// scheme (opens Google Maps iOS app)
    return (
      `comgooglemaps://?saddr=${originParam}` +
      `&daddr=${destParam}` +
      waypointsParam +
      `&directionsmode=driving`
    );
  }

  // Android — use geo: intent which opens Google Maps
  // For multi-waypoint we use the https URL as fallback (Android intent handles it)
  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${originParam}` +
    `&destination=${destParam}` +
    waypointsParam +
    `&travelmode=driving`
  );
}

/**
 * Build a Google Maps URL and open it in the native app.
 * Falls back to the web URL if the native app is not installed.
 */
export async function openInGoogleMaps(
  origin: string | LatLng,
  destination: string | LatLng,
  waypoints: (string | LatLng)[] = [],
): Promise<void> {
  const nativeUrl = buildGoogleMapsUrl(origin, destination, waypoints);
  const webUrl = buildWebGoogleMapsUrl(origin, destination, waypoints);

  try {
    const canOpen = await Linking.canOpenURL(nativeUrl);
    if (canOpen) {
      await Linking.openURL(nativeUrl);
    } else {
      // Google Maps app not installed — open in browser
      await Linking.openURL(webUrl);
    }
  } catch {
    // Last resort
    await Linking.openURL(webUrl);
  }
}

/**
 * Build the standard web-based Google Maps directions URL.
 */
export function buildWebGoogleMapsUrl(
  origin: string | LatLng,
  destination: string | LatLng,
  waypoints: (string | LatLng)[] = [],
): string {
  const originParam = formatLocationParam(origin);
  const destParam = formatLocationParam(destination);
  const waypointsParam =
    waypoints.length > 0
      ? `&waypoints=${waypoints.map(formatLocationParam).join('|')}`
      : '';

  return (
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(originParam)}` +
    `&destination=${encodeURIComponent(destParam)}` +
    waypointsParam +
    `&travelmode=driving`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLocationParam(location: string | LatLng): string {
  if (typeof location === 'string') {
    return encodeURIComponent(location);
  }
  return `${location.latitude},${location.longitude}`;
}
