// One-shot helper (not a real test): dumps SEED_VEHICLES to JSON via the
// project's existing jest/babel TS pipeline, since the harness's plain-node
// generator script can't import .ts directly.
import * as fs from 'fs';
import * as path from 'path';
import {SEED_VEHICLES} from '../src/database/vehicleSeedData';

test('dump vehicles to json', () => {
  const withIds = SEED_VEHICLES.map((v, i) => ({
    id: i + 1,
    manufacturer: v.manufacturer,
    brand: v.brand,
    model: v.model,
    trim: v.trim,
    usableCapacityKwh: v.usableCapacityKwh,
    efficiencyMixedWhPerKm: v.efficiencyMixedWhPerKm,
    maxDcChargingKw: v.maxDcChargingKw,
    supportedConnectors: v.supportedConnectors,
    chargingTime10To80Min: v.chargingTime10To80Min,
    chargingTime20To80Min: v.chargingTime20To80Min,
    chargingTime0To100Min: v.chargingTime0To100Min,
    chargingCurve: v.chargingCurve,
  }));
  fs.writeFileSync(
    path.join(__dirname, 'vehicles.json'),
    JSON.stringify(withIds, null, 2),
  );
  expect(withIds.length).toBeGreaterThan(0);
});
