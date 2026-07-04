/**
 * Unit tests for range calculation utilities.
 */

import {
  calculateUsableRangeKm,
  applyBufferedRange,
  calculateBufferedRangeKm,
  batteryAfterDriving,
  findChargeNeededPointKm,
  estimateChargeTimeMin,
  kwh100kmToWhPerKm,
  whPerKmToKwh100km,
  formatDistanceKm,
  formatDurationMin,
  formatBatteryPercent,
} from '../src/utils/rangeCalculations';
import {Vehicle} from '../src/types';

// Minimal vehicle for testing
const TEST_VEHICLE: Vehicle = {
  id: 1,
  manufacturer: 'Test',
  brand: 'Test',
  model: 'TestEV',
  trim: 'Base',
  modelYear: 2024,
  usableCapacityKwh: 75,
  wltpRangeKm: 500,
  epaRangeKm: 450,
  cltcRangeKm: null,
  manufacturerRangeKm: 500,
  realWorldMixedRangeKm: 420,
  realWorldHighwayRangeKm: 360,
  realWorldCityRangeKm: 480,
  efficiencyMixedWhPerKm: 150,
  efficiencyHighwayWhPerKm: 180,
  efficiencyCityWhPerKm: 130,
  maxAcChargingKw: 11,
  acConnectorType: 'Type2',
  maxDcChargingKw: 150,
  dcConnectorType: 'CCS2',
  chargingTime10To80Min: 35,
  chargingTime20To80Min: 28,
  chargingTime0To100Min: 90,
  acFullChargeTimeMin: 420,
  supportedConnectors: ['CCS2', 'Type2'],
  imageUrl: null,
  logoUrl: null,
  driveType: null, bodyStyle: null, vinPrefix: null, generation: null,
  grossCapacityKwh: null, batteryChemistry: null, nominalVoltageV: null,
  moduleCount: null, cellCount: null, peakDcChargingKw: null,
  chargingCurve: null, lengthMm: null, widthMm: null, heightMm: null,
  wheelbaseMm: null, groundClearanceMm: null, topSpeedKmh: null,
  powerKw: null, torqueNm: null, zeroTo100Sec: null,
  curbWeightKg: null, gvwrKg: null,
  coldWeatherEfficiencyMultiplier: null, hotWeatherEfficiencyMultiplier: null,
  lastUpdated: null, dataSource: null, notes: null,
};

// ── calculateUsableRangeKm ────────────────────────────────────────────────────

describe('calculateUsableRangeKm', () => {
  it('calculates full range at 100% battery', () => {
    // (100/100 * 75 * 1000) / 150 = 500 km
    expect(calculateUsableRangeKm(100, 75, 150)).toBeCloseTo(500);
  });

  it('calculates half range at 50% battery', () => {
    // (50/100 * 75 * 1000) / 150 = 250 km
    expect(calculateUsableRangeKm(50, 75, 150)).toBeCloseTo(250);
  });

  it('returns 0 for zero efficiency', () => {
    expect(calculateUsableRangeKm(100, 75, 0)).toBe(0);
  });

  it('returns 0 for negative efficiency', () => {
    expect(calculateUsableRangeKm(100, 75, -10)).toBe(0);
  });

  it('returns 0 for zero battery', () => {
    expect(calculateUsableRangeKm(0, 75, 150)).toBeCloseTo(0);
  });

  it('scales correctly with capacity', () => {
    const range100 = calculateUsableRangeKm(80, 100, 200);
    const range50 = calculateUsableRangeKm(80, 50, 200);
    expect(range100).toBeCloseTo(range50 * 2);
  });
});

// ── applyBufferedRange ────────────────────────────────────────────────────────

describe('applyBufferedRange', () => {
  it('applies 10% reduction', () => {
    expect(applyBufferedRange(500)).toBeCloseTo(450);
  });

  it('handles zero', () => {
    expect(applyBufferedRange(0)).toBe(0);
  });
});

// ── calculateBufferedRangeKm ──────────────────────────────────────────────────

describe('calculateBufferedRangeKm', () => {
  it('is 90% of usable range', () => {
    const usable = calculateUsableRangeKm(80, 75, 150);
    const buffered = calculateBufferedRangeKm(80, 75, 150);
    expect(buffered).toBeCloseTo(usable * 0.9);
  });
});

// ── batteryAfterDriving ───────────────────────────────────────────────────────

describe('batteryAfterDriving', () => {
  it('calculates correct remaining battery after 100km', () => {
    // Start: 80%, capacity 75kWh, efficiency 150 Wh/km, drive 100km
    // Energy used: 100 * 150 = 15000 Wh = 15 kWh
    // Start energy: 0.8 * 75 = 60 kWh
    // Remaining: 60 - 15 = 45 kWh = 60% of 75
    expect(batteryAfterDriving(80, 75, 150, 100)).toBeCloseTo(60);
  });

  it('never goes below 0', () => {
    expect(batteryAfterDriving(10, 75, 150, 1000)).toBe(0);
  });

  it('returns 100 when driving 0 km', () => {
    expect(batteryAfterDriving(100, 75, 150, 0)).toBeCloseTo(100);
  });
});

// ── findChargeNeededPointKm ───────────────────────────────────────────────────

describe('findChargeNeededPointKm', () => {
  it('returns null when destination reachable without charging', () => {
    // 80% battery, 75 kWh, 150 Wh/km → buffered range = 360 km
    // Route is only 200 km → no charge needed
    const result = findChargeNeededPointKm(80, 75, 150, 200, 15);
    expect(result).toBeNull();
  });

  it('returns charge point when route is too long', () => {
    // 50% battery → usable ≈ (50/100 * 75 * 1000 - 15/100 * 75 * 1000) / 150 = 175 km
    // buffered ≈ 175 * 0.9 = 157.5 km
    // Route = 400 km → charge needed
    const result = findChargeNeededPointKm(50, 75, 150, 400, 15);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
    expect(result!).toBeLessThan(400);
  });

  it('returns 0 when already at/below reserve', () => {
    const result = findChargeNeededPointKm(10, 75, 150, 300, 15);
    // 10% battery at threshold 15% → immediately needs charge
    expect(result).toBe(0);
  });
});

// ── estimateChargeTimeMin ─────────────────────────────────────────────────────

describe('estimateChargeTimeMin', () => {
  it('estimates 10→80% using vehicle data', () => {
    const t = estimateChargeTimeMin(TEST_VEHICLE, 10, 80);
    // Should be close to the 35 min reference value (10→80)
    expect(t).toBeCloseTo(35, 0);
  });

  it('returns 0 when from >= to', () => {
    expect(estimateChargeTimeMin(TEST_VEHICLE, 80, 80)).toBe(0);
    expect(estimateChargeTimeMin(TEST_VEHICLE, 90, 80)).toBe(0);
  });

  it('estimates partial charge proportionally', () => {
    const halfTime = estimateChargeTimeMin(TEST_VEHICLE, 10, 45);
    const fullTime = estimateChargeTimeMin(TEST_VEHICLE, 10, 80);
    // Half the range should take roughly half the time
    expect(halfTime).toBeCloseTo(fullTime / 2, 0);
  });

  it('uses fallback with max DC power when no timing data available', () => {
    const noTimingVehicle: Vehicle = {
      ...TEST_VEHICLE,
      chargingTime10To80Min: null,
      chargingTime20To80Min: null,
      chargingTime0To100Min: null,
    };
    const t = estimateChargeTimeMin(noTimingVehicle, 20, 80);
    // Energy needed: (80-20)/100 * 75 * 1000 Wh = 45000 Wh = 45 kWh
    // At 150 kW: 45/150 * 60 = 18 min
    expect(t).toBeCloseTo(18, 0);
  });

  it('uses charging curve when available', () => {
    const curveVehicle: Vehicle = {
      ...TEST_VEHICLE,
      chargingCurve: [
        {batteryPercent: 0, powerKw: 150},
        {batteryPercent: 80, powerKw: 100},
        {batteryPercent: 100, powerKw: 20},
      ],
    };
    const t = estimateChargeTimeMin(curveVehicle, 10, 80);
    expect(t).toBeGreaterThan(0);
  });
});

// ── Unit conversion helpers ───────────────────────────────────────────────────

describe('unit conversions', () => {
  it('converts kWh/100km to Wh/km', () => {
    expect(kwh100kmToWhPerKm(15)).toBe(150);
    expect(kwh100kmToWhPerKm(20)).toBe(200);
  });

  it('converts Wh/km to kWh/100km', () => {
    expect(whPerKmToKwh100km(150)).toBe(15);
    expect(whPerKmToKwh100km(200)).toBe(20);
  });

  it('round-trips correctly', () => {
    const original = 175;
    expect(kwh100kmToWhPerKm(whPerKmToKwh100km(original))).toBeCloseTo(original);
  });
});

// ── Format helpers ────────────────────────────────────────────────────────────

describe('format helpers', () => {
  describe('formatDistanceKm', () => {
    it('formats km with rounding', () => {
      expect(formatDistanceKm(123.7)).toBe('124 km');
      expect(formatDistanceKm(0.4)).toBe('0 km');
    });
  });

  describe('formatDurationMin', () => {
    it('formats minutes under an hour', () => {
      expect(formatDurationMin(45)).toBe('45 min');
    });

    it('formats hours and minutes', () => {
      expect(formatDurationMin(90)).toBe('1h 30m');
    });

    it('formats exact hours', () => {
      expect(formatDurationMin(120)).toBe('2h');
    });
  });

  describe('formatBatteryPercent', () => {
    it('rounds and adds %', () => {
      expect(formatBatteryPercent(72.4)).toBe('72%');
      expect(formatBatteryPercent(15.6)).toBe('16%');
    });
  });
});
