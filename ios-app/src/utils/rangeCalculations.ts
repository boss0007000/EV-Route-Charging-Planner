/**
 * Core range and charging calculation utilities.
 * All efficiency in Wh/km. All capacity in kWh.
 */

import {Vehicle, ChargingCurvePoint} from '../types';
import {ROUTE_CONSTANTS} from '../constants/config';

const {safetyBufferFactor} = ROUTE_CONSTANTS;

// ─── Range Calculations ───────────────────────────────────────────────────────

/**
 * Calculate usable range in km.
 * usable_range = (battery% / 100 × usable_capacity_kWh × 1000) / efficiency_wh_per_km
 */
export function calculateUsableRangeKm(
  batteryPercent: number,
  usableCapacityKwh: number,
  efficiencyWhPerKm: number,
): number {
  if (efficiencyWhPerKm <= 0) return 0;
  const energyWh = (batteryPercent / 100) * usableCapacityKwh * 1000;
  return energyWh / efficiencyWhPerKm;
}

/**
 * Apply the 10% safety buffer to the calculated range.
 * buffered_range = usable_range × 0.90
 */
export function applyBufferedRange(usableRangeKm: number): number {
  return usableRangeKm * safetyBufferFactor;
}

/**
 * Full calculation: current battery% → buffered usable range in km.
 */
export function calculateBufferedRangeKm(
  batteryPercent: number,
  usableCapacityKwh: number,
  efficiencyWhPerKm: number,
): number {
  const usable = calculateUsableRangeKm(
    batteryPercent,
    usableCapacityKwh,
    efficiencyWhPerKm,
  );
  return applyBufferedRange(usable);
}

/**
 * Calculate the battery % remaining after driving distanceKm.
 * Returns 0 if it would go below 0.
 */
export function batteryAfterDriving(
  currentBatteryPercent: number,
  usableCapacityKwh: number,
  efficiencyWhPerKm: number,
  distanceKm: number,
): number {
  const energyUsedWh = distanceKm * efficiencyWhPerKm;
  const totalEnergyWh = usableCapacityKwh * 1000;
  const energyRemainingWh =
    (currentBatteryPercent / 100) * totalEnergyWh - energyUsedWh;
  const remainingPercent = (energyRemainingWh / totalEnergyWh) * 100;
  return Math.max(0, remainingPercent);
}

/**
 * Given a route distance, find the km point where the battery will
 * drop to reserveBatteryPercent.
 * Returns null if the full route can be completed without hitting reserve.
 */
export function findChargeNeededPointKm(
  startBatteryPercent: number,
  usableCapacityKwh: number,
  efficiencyWhPerKm: number,
  routeDistanceKm: number,
  reserveBatteryPercent: number,
): number | null {
  // Energy available above reserve
  const totalEnergyWh = usableCapacityKwh * 1000;
  const reserveEnergyWh = (reserveBatteryPercent / 100) * totalEnergyWh;
  const startEnergyWh = (startBatteryPercent / 100) * totalEnergyWh;
  const usableEnergyWh = startEnergyWh - reserveEnergyWh;

  if (usableEnergyWh <= 0) return 0; // already at/below reserve

  const maxRangeKm = usableEnergyWh / efficiencyWhPerKm;

  // Apply safety buffer — treat 90% of that range as usable
  const bufferedMaxRangeKm = maxRangeKm * safetyBufferFactor;

  if (bufferedMaxRangeKm >= routeDistanceKm) return null; // no charge needed

  return bufferedMaxRangeKm;
}

// ─── Charging Time Estimation ─────────────────────────────────────────────────

/**
 * Estimate charge time (minutes) from fromPercent → toPercent using
 * vehicle data. Uses charging curve if available, otherwise linearly
 * interpolates from the 10→80% or 20→80% data.
 */
export function estimateChargeTimeMin(
  vehicle: Vehicle,
  fromPercent: number,
  toPercent: number,
): number {
  if (fromPercent >= toPercent) return 0;

  // If charging curve data is available, use trapezoidal integration
  if (vehicle.chargingCurve && vehicle.chargingCurve.length >= 2) {
    return estimateFromCurve(vehicle, fromPercent, toPercent);
  }

  // Fall back to linear interpolation from 10-80% or 20-80%
  return estimateLinear(vehicle, fromPercent, toPercent);
}

function estimateFromCurve(
  vehicle: Vehicle,
  fromPercent: number,
  toPercent: number,
): number {
  const curve = vehicle.chargingCurve!;
  const capacityKwh = vehicle.usableCapacityKwh;

  // Sort curve ascending by battery percent
  const sorted = [...curve].sort((a, b) => a.batteryPercent - b.batteryPercent);

  // Clamp bounds
  const clampedFrom = Math.max(sorted[0].batteryPercent, fromPercent);
  const clampedTo = Math.min(sorted[sorted.length - 1].batteryPercent, toPercent);

  if (clampedFrom >= clampedTo) return 0;

  // Trapezoidal integration: time = Σ (ΔkWh / avgPower)
  let totalTimeHours = 0;
  let prevPercent = clampedFrom;
  let prevPower = interpolatePowerAtPercent(sorted, clampedFrom);

  for (const point of sorted) {
    if (point.batteryPercent <= clampedFrom) continue;
    if (point.batteryPercent > clampedTo) break;

    const deltaPercent = point.batteryPercent - prevPercent;
    const deltaKwh = (deltaPercent / 100) * capacityKwh;
    const avgPower = (prevPower + point.powerKw) / 2;
    if (avgPower > 0) totalTimeHours += deltaKwh / avgPower;

    prevPercent = point.batteryPercent;
    prevPower = point.powerKw;
  }

  // Last segment to clampedTo
  if (prevPercent < clampedTo) {
    const deltaPercent = clampedTo - prevPercent;
    const deltaKwh = (deltaPercent / 100) * capacityKwh;
    const endPower = interpolatePowerAtPercent(sorted, clampedTo);
    const avgPower = (prevPower + endPower) / 2;
    if (avgPower > 0) totalTimeHours += deltaKwh / avgPower;
  }

  return totalTimeHours * 60;
}

function interpolatePowerAtPercent(
  curve: ChargingCurvePoint[],
  percent: number,
): number {
  if (curve.length === 0) return 0;
  if (percent <= curve[0].batteryPercent) return curve[0].powerKw;
  if (percent >= curve[curve.length - 1].batteryPercent) {
    return curve[curve.length - 1].powerKw;
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (percent >= a.batteryPercent && percent <= b.batteryPercent) {
      const t = (percent - a.batteryPercent) / (b.batteryPercent - a.batteryPercent);
      return a.powerKw + t * (b.powerKw - a.powerKw);
    }
  }
  return 0;
}

function estimateLinear(
  vehicle: Vehicle,
  fromPercent: number,
  toPercent: number,
): number {
  // Try to get a reference charge time and rate
  // Prefer 10→80% data
  let refFrom = 10;
  let refTo = 80;
  let refTimeMin = vehicle.chargingTime10To80Min;

  if (!refTimeMin && vehicle.chargingTime20To80Min) {
    refFrom = 20;
    refTo = 80;
    refTimeMin = vehicle.chargingTime20To80Min;
  }

  if (!refTimeMin && vehicle.chargingTime0To100Min) {
    refFrom = 0;
    refTo = 100;
    refTimeMin = vehicle.chargingTime0To100Min;
  }

  if (!refTimeMin || refTo <= refFrom) {
    // Last resort: use max DC power
    const capacityKwh = vehicle.usableCapacityKwh;
    const energyNeededKwh = ((toPercent - fromPercent) / 100) * capacityKwh;
    const powerKw = vehicle.maxDcChargingKw || 50;
    return (energyNeededKwh / powerKw) * 60;
  }

  // Linear rate: minutes per percentage point
  const rateMinPerPercent = refTimeMin / (refTo - refFrom);
  return rateMinPerPercent * (toPercent - fromPercent);
}

/**
 * Convert energy efficiency from kWh/100km to Wh/km
 */
export function kwh100kmToWhPerKm(kwh100km: number): number {
  return kwh100km * 10;
}

/**
 * Convert Wh/km to kWh/100km
 */
export function whPerKmToKwh100km(whPerKm: number): number {
  return whPerKm / 10;
}

/**
 * Format a distance in km for display (e.g. "123 km" or "1,234 km")
 */
export function formatDistanceKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

/**
 * Format a duration in minutes for display (e.g. "1h 23m" or "45 min")
 */
export function formatDurationMin(minutes: number): string {
  const totalMin = Math.round(minutes);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/**
 * Format a battery percentage for display
 */
export function formatBatteryPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}
