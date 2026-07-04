/**
 * Unit tests for deep-linking utilities.
 */

import {buildGoogleMapsUrl, buildWebGoogleMapsUrl} from '../src/utils/deepLinking';
import {LatLng} from '../src/types';

// Mock Platform to test both iOS and Android code paths
const mockPlatform = (os: 'ios' | 'android') => {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: {OS: os},
    Linking: {canOpenURL: jest.fn(), openURL: jest.fn()},
  }));
};

describe('buildWebGoogleMapsUrl', () => {
  const origin = 'London, UK';
  const destination = 'Paris, France';
  const waypoint: LatLng = {latitude: 51.0, longitude: 1.0};

  it('includes origin and destination', () => {
    const url = buildWebGoogleMapsUrl(origin, destination);
    expect(url).toContain('origin=');
    expect(url).toContain('destination=');
    expect(url).toContain('travelmode=driving');
  });

  it('includes waypoints when provided', () => {
    const url = buildWebGoogleMapsUrl(origin, destination, [waypoint]);
    expect(url).toContain('waypoints=');
    // The waypoint 51.0,1.0 may be serialised as "51,1" (JS drops trailing .0)
    expect(url).toContain('51');
    expect(url).toMatch(/1[,&]/); // longitude 1 appears before separator
  });

  it('does not include waypoints param when none provided', () => {
    const url = buildWebGoogleMapsUrl(origin, destination);
    expect(url).not.toContain('waypoints=');
  });

  it('uses LatLng format for coordinate origin', () => {
    const originCoord: LatLng = {latitude: 51.5, longitude: -0.1};
    const url = buildWebGoogleMapsUrl(originCoord, destination);
    expect(url).toContain('51.5');
    expect(url).toContain('-0.1');
  });
});

describe('buildGoogleMapsUrl (iOS)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: {OS: 'ios'},
      Linking: {canOpenURL: jest.fn(), openURL: jest.fn()},
    }));
  });

  it('uses comgooglemaps:// scheme on iOS', () => {
    // Re-require after mock
    const {buildGoogleMapsUrl: buildUrl} = require('../src/utils/deepLinking');
    const url = buildUrl('A', 'B');
    expect(url).toContain('comgooglemaps://');
  });
});

describe('buildGoogleMapsUrl (Android)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: {OS: 'android'},
      Linking: {canOpenURL: jest.fn(), openURL: jest.fn()},
    }));
  });

  it('uses https URL on Android', () => {
    const {buildGoogleMapsUrl: buildUrl} = require('../src/utils/deepLinking');
    const url = buildUrl('A', 'B');
    expect(url).toContain('https://www.google.com/maps/dir/');
  });
});
