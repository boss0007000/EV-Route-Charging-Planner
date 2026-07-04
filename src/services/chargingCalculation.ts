/**
 * Charging calculation service — re-exports estimateChargeTimeMin
 * and provides additional helpers for the route planner UI.
 */

export {estimateChargeTimeMin} from '../utils/rangeCalculations';

import {Vehicle} from '../types';
import {estimateChargeTimeMin} from '../utils/rangeCalculations';

/**
 * Given charge needed from arrivalPercent to targetPercent,
 * return a human-readable time string and power note.
 */
export function describeCharge(
  vehicle: Vehicle,
  fromPercent: number,
  toPercent: number,
): {timeMin: number; displayString: string} {
  const timeMin = estimateChargeTimeMin(vehicle, fromPercent, toPercent);
  const hours = Math.floor(timeMin / 60);
  const mins = Math.round(timeMin % 60);
  const displayString =
    hours > 0 ? `~${hours}h ${mins}m charge` : `~${mins} min charge`;
  return {timeMin, displayString};
}
