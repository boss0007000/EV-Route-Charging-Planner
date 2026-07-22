/**
 * Hidden entry point into the Garage/Admin screen.
 * There is no visible tab or button for it — call `requestAdminUnlock`
 * from a secret gesture elsewhere in the app (see the app-name tap
 * counter in RoutePlannerScreen) to reveal it.
 */
import {DeviceEventEmitter} from 'react-native';

const ADMIN_UNLOCK_EVENT = 'chargeroute:admin-unlock';

export function requestAdminUnlock() {
  DeviceEventEmitter.emit(ADMIN_UNLOCK_EVENT);
}

export function subscribeAdminUnlock(handler: () => void) {
  const subscription = DeviceEventEmitter.addListener(ADMIN_UNLOCK_EVENT, handler);
  return () => subscription.remove();
}
