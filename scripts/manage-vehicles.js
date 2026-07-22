#!/usr/bin/env node
/**
 * Standalone vehicle-database admin tool.
 *
 * This is NOT part of the shipped app — nothing in App.tsx or any screen
 * imports it, so Metro never bundles it into the app users install.
 * It edits src/database/vehicleSeedData.ts directly, which is the file
 * the app seeds its on-device SQLite DB from (only on first launch — see
 * seedVehiclesIfEmpty in src/database/vehicleDb.ts). Devices that already
 * have data won't pick up new entries until a fresh install/reset.
 *
 * Run: node scripts/manage-vehicles.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('node:readline/promises');
const {stdin, stdout} = require('node:process');

const SEED_FILE = path.join(__dirname, '..', 'src', 'database', 'vehicleSeedData.ts');
const ARRAY_START_RE = /export const SEED_VEHICLES: SeedVehicle\[\] = \[\n/;
const BLOCK_RE = /^ {2}\{\n([\s\S]*?)\n {2}\},$/gm;

const CONNECTOR_OPTIONS = ['CCS2', 'CCS1', 'GB/T', 'NACS', 'CHAdeMO', 'Type2', 'Type1'];

// Mirrors AdminScreen.tsx's REQUIRED_FIELDS exactly, so this tool produces
// the same shape of record the in-app form used to.
const FIELDS = [
  {key: 'manufacturer', label: 'Manufacturer', required: true},
  {key: 'brand', label: 'Brand', required: true},
  {key: 'model', label: 'Model', required: true},
  {key: 'trim', label: 'Trim / Variant'},
  {key: 'modelYear', label: 'Model Year', numeric: true, required: true},
  {key: 'usableCapacityKwh', label: 'Usable Capacity (kWh)', numeric: true, required: true},
  {key: 'wltpRangeKm', label: 'WLTP Range (km)', numeric: true},
  {key: 'epaRangeKm', label: 'EPA Range (km)', numeric: true},
  {key: 'realWorldMixedRangeKm', label: 'Real-world Mixed Range (km)', numeric: true, required: true},
  {key: 'efficiencyMixedWhPerKm', label: 'Efficiency Mixed (Wh/km)', numeric: true, required: true},
  {key: 'efficiencyHighwayWhPerKm', label: 'Efficiency Highway (Wh/km)', numeric: true},
  {key: 'efficiencyCityWhPerKm', label: 'Efficiency City (Wh/km)', numeric: true},
  {key: 'maxAcChargingKw', label: 'Max AC Charging (kW)', numeric: true, required: true},
  {key: 'maxDcChargingKw', label: 'Max DC Charging (kW)', numeric: true, required: true},
  {key: 'chargingTime10To80Min', label: 'Charging 10→80% (min)', numeric: true},
  {key: 'chargingTime20To80Min', label: 'Charging 20→80% (min)', numeric: true},
  {key: 'chargingTime0To100Min', label: 'Charging 0→100% (min)', numeric: true},
  {key: 'acFullChargeTimeMin', label: 'AC Full Charge (min)', numeric: true},
  {key: 'dataSource', label: 'Data Source (URL or name)'},
  {key: 'notes', label: 'Notes'},
];

function readSeedFile() {
  const text = fs.readFileSync(SEED_FILE, 'utf8');
  const startMatch = ARRAY_START_RE.exec(text);
  if (!startMatch) {
    throw new Error(`Could not find SEED_VEHICLES array start in ${SEED_FILE}`);
  }
  const endIndex = text.lastIndexOf('\n];');
  if (endIndex === -1) {
    throw new Error(`Could not find SEED_VEHICLES array end in ${SEED_FILE}`);
  }
  return {
    text,
    arrayBodyStart: startMatch.index + startMatch[0].length,
    arrayBodyEnd: endIndex + 1, // include the trailing newline before `];`
  };
}

function parseBlocks(arrayBody) {
  const blocks = [];
  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(arrayBody)) !== null) {
    const body = m[1];
    const field = re => (body.match(re) || [])[1];
    blocks.push({
      raw: m[0],
      manufacturer: field(/manufacturer: '([^']*)'/),
      brand: field(/brand: '([^']*)'/),
      model: field(/model: '([^']*)'/),
      trim: field(/trim: '([^']*)'/),
      modelYear: field(/modelYear: (\d+)/),
    });
  }
  return blocks;
}

function listVehicles() {
  const {text, arrayBodyStart, arrayBodyEnd} = readSeedFile();
  const blocks = parseBlocks(text.slice(arrayBodyStart, arrayBodyEnd));
  if (blocks.length === 0) {
    console.log('No vehicles in seed data.');
    return blocks;
  }
  console.log(`\n${blocks.length} vehicles:\n`);
  blocks.forEach((b, i) => {
    const trim = b.trim ? ` (${b.trim})` : '';
    console.log(`  ${i + 1}. ${b.manufacturer} ${b.model}${trim} — ${b.modelYear}`);
  });
  console.log('');
  return blocks;
}

async function promptField(rl, field) {
  const suffix = field.required ? ' *' : ' (optional, Enter to skip)';
  while (true) {
    const answer = (await rl.question(`${field.label}${suffix}: `)).trim();
    if (!answer) {
      if (field.required) {
        console.log('This field is required.');
        continue;
      }
      return field.numeric ? null : '';
    }
    if (field.numeric) {
      const n = parseFloat(answer);
      if (Number.isNaN(n)) {
        console.log('Please enter a number.');
        continue;
      }
      return n;
    }
    return answer;
  }
}

async function promptConnector(rl, label) {
  while (true) {
    const answer = (await rl.question(`${label} [${CONNECTOR_OPTIONS.join(', ')}]: `)).trim();
    if (CONNECTOR_OPTIONS.includes(answer)) {
      return answer;
    }
    console.log(`Must be one of: ${CONNECTOR_OPTIONS.join(', ')}`);
  }
}

async function promptSupportedConnectors(rl) {
  while (true) {
    const answer = (
      await rl.question(`Supported Connectors, comma-separated [${CONNECTOR_OPTIONS.join(', ')}]: `)
    ).trim();
    const list = answer.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length === 0) {
      console.log('At least one connector is required.');
      continue;
    }
    const bad = list.find(c => !CONNECTOR_OPTIONS.includes(c));
    if (bad) {
      console.log(`Unknown connector "${bad}". Must be one of: ${CONNECTOR_OPTIONS.join(', ')}`);
      continue;
    }
    return list;
  }
}

function tsString(v) {
  return v === null ? 'null' : `'${String(v).replace(/'/g, "\\'")}'`;
}
function tsNum(v) {
  return v === null ? 'null' : String(v);
}

function buildObjectSource(v) {
  const lines = [
    '  {',
    `    manufacturer: ${tsString(v.manufacturer)},`,
    `    brand: ${tsString(v.brand)},`,
    `    model: ${tsString(v.model)},`,
    `    trim: ${tsString(v.trim || '')},`,
    `    modelYear: ${tsNum(v.modelYear)},`,
    `    usableCapacityKwh: ${tsNum(v.usableCapacityKwh)},`,
    `    wltpRangeKm: ${tsNum(v.wltpRangeKm)},`,
    `    epaRangeKm: ${tsNum(v.epaRangeKm)},`,
    '    cltcRangeKm: null,',
    '    manufacturerRangeKm: null,',
    `    realWorldMixedRangeKm: ${tsNum(v.realWorldMixedRangeKm)},`,
    '    realWorldHighwayRangeKm: null,',
    '    realWorldCityRangeKm: null,',
    `    efficiencyMixedWhPerKm: ${tsNum(v.efficiencyMixedWhPerKm)},`,
    `    efficiencyHighwayWhPerKm: ${tsNum(v.efficiencyHighwayWhPerKm)},`,
    `    efficiencyCityWhPerKm: ${tsNum(v.efficiencyCityWhPerKm)},`,
    `    maxAcChargingKw: ${tsNum(v.maxAcChargingKw)},`,
    `    acConnectorType: '${v.acConnectorType}' as ConnectorType,`,
    `    maxDcChargingKw: ${tsNum(v.maxDcChargingKw)},`,
    `    dcConnectorType: '${v.dcConnectorType}' as ConnectorType,`,
    `    chargingTime10To80Min: ${tsNum(v.chargingTime10To80Min)},`,
    `    chargingTime20To80Min: ${tsNum(v.chargingTime20To80Min)},`,
    `    chargingTime0To100Min: ${tsNum(v.chargingTime0To100Min)},`,
    `    acFullChargeTimeMin: ${tsNum(v.acFullChargeTimeMin)},`,
    `    supportedConnectors: [${v.supportedConnectors.map(c => `'${c}'`).join(', ')}] as ConnectorType[],`,
    '    imageUrl: null, logoUrl: null,',
    '    driveType: null, bodyStyle: null, vinPrefix: null, generation: null,',
    '    grossCapacityKwh: null, batteryChemistry: null, nominalVoltageV: null, moduleCount: null, cellCount: null,',
    '    peakDcChargingKw: null, chargingCurve: null,',
    '    lengthMm: null, widthMm: null, heightMm: null, wheelbaseMm: null, groundClearanceMm: null,',
    '    topSpeedKmh: null, powerKw: null, torqueNm: null, zeroTo100Sec: null,',
    '    curbWeightKg: null, gvwrKg: null,',
    '    coldWeatherEfficiencyMultiplier: null, hotWeatherEfficiencyMultiplier: null,',
    `    lastUpdated: ${tsString(new Date().toISOString().slice(0, 10))}, dataSource: ${tsString(v.dataSource || null)}, notes: ${tsString(v.notes || null)},`,
    '  },',
  ];
  return lines.join('\n');
}

async function addVehicleFlow(rl) {
  console.log('\nAdd New Vehicle (fields marked * are required)\n');
  const values = {};
  for (const field of FIELDS) {
    values[field.key] = await promptField(rl, field);
  }
  values.acConnectorType = await promptConnector(rl, 'AC Connector Type');
  values.dcConnectorType = await promptConnector(rl, 'DC Connector Type');
  values.supportedConnectors = await promptSupportedConnectors(rl);

  const block = buildObjectSource(values);
  const {text, arrayBodyEnd} = readSeedFile();
  const updated = text.slice(0, arrayBodyEnd) + block + '\n' + text.slice(arrayBodyEnd);
  fs.writeFileSync(SEED_FILE, updated);
  console.log(`\nSaved: ${values.manufacturer} ${values.model}.`);
  console.log('Run `npm run type-check` to verify, then rebuild the app for it to take effect.');
  console.log('(Only new/fresh installs re-seed — existing installs keep their current DB.)\n');
}

async function deleteVehicleFlow(rl) {
  const blocks = listVehicles();
  if (blocks.length === 0) {
    return;
  }
  const answer = (await rl.question('Number to delete (Enter to cancel): ')).trim();
  if (!answer) {
    return;
  }
  const idx = parseInt(answer, 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= blocks.length) {
    console.log('Invalid selection.');
    return;
  }
  const target = blocks[idx];
  const confirm = (
    await rl.question(`Delete ${target.manufacturer} ${target.model}? (y/N): `)
  ).trim().toLowerCase();
  if (confirm !== 'y') {
    console.log('Cancelled.');
    return;
  }

  const {text, arrayBodyStart} = readSeedFile();
  const before = text.slice(0, arrayBodyStart);
  const arrayBody = text.slice(arrayBodyStart);
  const removed = arrayBody.replace(target.raw + '\n', '');
  fs.writeFileSync(SEED_FILE, before + removed);
  console.log(`Deleted ${target.manufacturer} ${target.model}.\n`);
}

async function main() {
  const rl = readline.createInterface({input: stdin, output: stdout});
  try {
    while (true) {
      console.log('--- Vehicle DB Admin ---');
      console.log('1) List vehicles');
      console.log('2) Add vehicle');
      console.log('3) Delete vehicle');
      console.log('4) Quit');
      const choice = (await rl.question('> ')).trim();
      if (choice === '1') {
        listVehicles();
      } else if (choice === '2') {
        await addVehicleFlow(rl);
      } else if (choice === '3') {
        await deleteVehicleFlow(rl);
      } else if (choice === '4' || choice.toLowerCase() === 'q') {
        break;
      } else {
        console.log('Unknown option.\n');
      }
    }
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
