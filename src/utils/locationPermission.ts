/**
 * Runtime location permission request (Android + iOS).
 * Geolocation.getCurrentPosition silently fails without this.
 */

import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message:
          'ChargeRoute needs your location to find nearby chargers and plan routes.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  const status = await Geolocation.requestAuthorization('whenInUse');
  return status === 'granted';
}
