/**
 * Admin Screen — vehicle database entry tool.
 * Allows adding new vehicles to the local SQLite database.
 */

import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import {insertVehicle, getAllVehicles, deleteVehicle} from '../../database/vehicleDb';
import {Vehicle, ConnectorType} from '../../types';
import {COLORS} from '../../constants/colors';

const CONNECTOR_OPTIONS: ConnectorType[] = [
  'CCS2', 'CCS1', 'GB/T', 'NACS', 'CHAdeMO', 'Type2', 'Type1',
];

type FormField = {
  key: string;
  label: string;
  keyboardType?: 'default' | 'numeric';
  required?: boolean;
  hint?: string;
};

const REQUIRED_FIELDS: FormField[] = [
  {key: 'manufacturer', label: 'Manufacturer', required: true},
  {key: 'brand', label: 'Brand', required: true},
  {key: 'model', label: 'Model', required: true},
  {key: 'trim', label: 'Trim / Variant'},
  {key: 'modelYear', label: 'Model Year', keyboardType: 'numeric', required: true},
  {key: 'usableCapacityKwh', label: 'Usable Capacity (kWh)', keyboardType: 'numeric', required: true},
  {key: 'wltpRangeKm', label: 'WLTP Range (km)', keyboardType: 'numeric'},
  {key: 'epaRangeKm', label: 'EPA Range (km)', keyboardType: 'numeric'},
  {key: 'realWorldMixedRangeKm', label: 'Real-world Mixed Range (km)', keyboardType: 'numeric', required: true},
  {key: 'efficiencyMixedWhPerKm', label: 'Efficiency Mixed (Wh/km)', keyboardType: 'numeric', required: true, hint: 'Primary value used in range math'},
  {key: 'efficiencyHighwayWhPerKm', label: 'Efficiency Highway (Wh/km)', keyboardType: 'numeric'},
  {key: 'efficiencyCityWhPerKm', label: 'Efficiency City (Wh/km)', keyboardType: 'numeric'},
  {key: 'maxAcChargingKw', label: 'Max AC Charging (kW)', keyboardType: 'numeric', required: true},
  {key: 'maxDcChargingKw', label: 'Max DC Charging (kW)', keyboardType: 'numeric', required: true},
  {key: 'chargingTime10To80Min', label: 'Charging 10→80% (min)', keyboardType: 'numeric'},
  {key: 'chargingTime20To80Min', label: 'Charging 20→80% (min)', keyboardType: 'numeric'},
  {key: 'chargingTime0To100Min', label: 'Charging 0→100% (min)', keyboardType: 'numeric'},
  {key: 'acFullChargeTimeMin', label: 'AC Full Charge (min)', keyboardType: 'numeric'},
  {key: 'dataSource', label: 'Data Source (URL or name)'},
  {key: 'notes', label: 'Notes'},
];

type FormValues = Record<string, string>;

export default function AdminScreen() {
  const [tab, setTab] = useState<'add' | 'list'>('add');
  const [form, setForm] = useState<FormValues>({});
  const [acConnector, setAcConnector] = useState<ConnectorType>('Type2');
  const [dcConnector, setDcConnector] = useState<ConnectorType>('CCS2');
  const [supportedConnectors, setSupportedConnectors] = useState<ConnectorType[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const updateField = useCallback((key: string, value: string) => {
    setForm(prev => ({...prev, [key]: value}));
  }, []);

  const toggleSupportedConnector = useCallback((ct: ConnectorType) => {
    setSupportedConnectors(prev =>
      prev.includes(ct) ? prev.filter(c => c !== ct) : [...prev, ct],
    );
  }, []);

  const handleSave = useCallback(async () => {
    // Validate required fields
    const missing = REQUIRED_FIELDS.filter(
      f => f.required && !form[f.key]?.trim(),
    );
    if (missing.length > 0) {
      Alert.alert(
        'Missing fields',
        `Please fill in: ${missing.map(f => f.label).join(', ')}`,
      );
      return;
    }

    const numOrNull = (k: string): number | null => {
      const n = parseFloat(form[k] ?? '');
      return isNaN(n) ? null : n;
    };
    const num = (k: string): number => parseFloat(form[k] ?? '0') || 0;

    try {
      await insertVehicle({
        manufacturer: form.manufacturer.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        trim: form.trim?.trim() ?? '',
        modelYear: parseInt(form.modelYear, 10),
        usableCapacityKwh: num('usableCapacityKwh'),
        wltpRangeKm: numOrNull('wltpRangeKm'),
        epaRangeKm: numOrNull('epaRangeKm'),
        cltcRangeKm: numOrNull('cltcRangeKm'),
        manufacturerRangeKm: numOrNull('manufacturerRangeKm'),
        realWorldMixedRangeKm: num('realWorldMixedRangeKm'),
        realWorldHighwayRangeKm: numOrNull('realWorldHighwayRangeKm'),
        realWorldCityRangeKm: numOrNull('realWorldCityRangeKm'),
        efficiencyMixedWhPerKm: num('efficiencyMixedWhPerKm'),
        efficiencyHighwayWhPerKm: numOrNull('efficiencyHighwayWhPerKm'),
        efficiencyCityWhPerKm: numOrNull('efficiencyCityWhPerKm'),
        maxAcChargingKw: num('maxAcChargingKw'),
        acConnectorType: acConnector,
        maxDcChargingKw: num('maxDcChargingKw'),
        dcConnectorType: dcConnector,
        chargingTime10To80Min: numOrNull('chargingTime10To80Min'),
        chargingTime20To80Min: numOrNull('chargingTime20To80Min'),
        chargingTime0To100Min: numOrNull('chargingTime0To100Min'),
        acFullChargeTimeMin: numOrNull('acFullChargeTimeMin'),
        supportedConnectors,
        imageUrl: form.imageUrl?.trim() ?? null,
        logoUrl: form.logoUrl?.trim() ?? null,
        driveType: null, bodyStyle: null, vinPrefix: null, generation: null,
        grossCapacityKwh: null, batteryChemistry: null, nominalVoltageV: null,
        moduleCount: null, cellCount: null, peakDcChargingKw: null,
        chargingCurve: null, lengthMm: null, widthMm: null, heightMm: null,
        wheelbaseMm: null, groundClearanceMm: null, topSpeedKmh: null,
        powerKw: null, torqueNm: null, zeroTo100Sec: null,
        curbWeightKg: null, gvwrKg: null,
        coldWeatherEfficiencyMultiplier: null, hotWeatherEfficiencyMultiplier: null,
        lastUpdated: new Date().toISOString().slice(0, 10),
        dataSource: form.dataSource?.trim() ?? null,
        notes: form.notes?.trim() ?? null,
      });
      Alert.alert('Saved!', `${form.manufacturer} ${form.model} added.`);
      setForm({});
      setSupportedConnectors([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save vehicle');
    }
  }, [form, acConnector, dcConnector, supportedConnectors]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    const list = await getAllVehicles();
    setVehicles(list);
    setLoadingList(false);
  }, []);

  const handleDelete = useCallback(async (v: Vehicle) => {
    Alert.alert(
      'Delete',
      `Delete ${v.manufacturer} ${v.model}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteVehicle(v.id);
            await loadList();
          },
        },
      ],
    );
  }, [loadList]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'add' && styles.tabActive]}
          onPress={() => setTab('add')}>
          <Text style={[styles.tabText, tab === 'add' && styles.tabTextActive]}>
            ➕ Add Vehicle
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => {
            setTab('list');
            loadList();
          }}>
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>
            🗂 Vehicle List
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'add' ? (
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.formTitle}>Add New Vehicle</Text>
          <Text style={styles.formSubtitle}>
            Fields marked * are required for route math.
          </Text>

          {REQUIRED_FIELDS.map(field => (
            <View key={field.key} style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>
                {field.label}
                {field.required ? ' *' : ''}
              </Text>
              {field.hint ? (
                <Text style={styles.fieldHint}>{field.hint}</Text>
              ) : null}
              <TextInput
                style={styles.fieldInput}
                value={form[field.key] ?? ''}
                onChangeText={v => updateField(field.key, v)}
                keyboardType={field.keyboardType ?? 'default'}
                placeholderTextColor={COLORS.textMuted}
                placeholder={field.required ? 'Required' : 'Optional'}
              />
            </View>
          ))}

          {/* AC Connector */}
          <Text style={styles.fieldLabel}>AC Connector Type *</Text>
          <View style={styles.connectorRow}>
            {CONNECTOR_OPTIONS.map(ct => (
              <TouchableOpacity
                key={ct}
                style={[
                  styles.connChip,
                  acConnector === ct && styles.connChipActive,
                ]}
                onPress={() => setAcConnector(ct)}>
                <Text
                  style={[
                    styles.connChipText,
                    acConnector === ct && styles.connChipTextActive,
                  ]}>
                  {ct}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* DC Connector */}
          <Text style={[styles.fieldLabel, styles.mt8]}>
            DC Connector Type *
          </Text>
          <View style={styles.connectorRow}>
            {CONNECTOR_OPTIONS.map(ct => (
              <TouchableOpacity
                key={ct}
                style={[
                  styles.connChip,
                  dcConnector === ct && styles.connChipActive,
                ]}
                onPress={() => setDcConnector(ct)}>
                <Text
                  style={[
                    styles.connChipText,
                    dcConnector === ct && styles.connChipTextActive,
                  ]}>
                  {ct}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Supported Connectors */}
          <Text style={[styles.fieldLabel, styles.mt8]}>
            Supported Connectors *
          </Text>
          <View style={styles.connectorRow}>
            {CONNECTOR_OPTIONS.map(ct => (
              <TouchableOpacity
                key={ct}
                style={[
                  styles.connChip,
                  supportedConnectors.includes(ct) && styles.connChipActive,
                ]}
                onPress={() => toggleSupportedConnector(ct)}>
                <Text
                  style={[
                    styles.connChipText,
                    supportedConnectors.includes(ct) && styles.connChipTextActive,
                  ]}>
                  {ct}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>💾 Save Vehicle</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <Text style={styles.formTitle}>
            Vehicle Database ({vehicles.length})
          </Text>
          {loadingList ? (
            <Text style={styles.loadingText}>Loading…</Text>
          ) : vehicles.length === 0 ? (
            <Text style={styles.emptyText}>No vehicles yet.</Text>
          ) : (
            vehicles.map(v => (
              <View key={v.id} style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>
                    {v.manufacturer} {v.model}
                  </Text>
                  <Text style={styles.listItemSub}>
                    {v.trim} · {v.modelYear} · {v.usableCapacityKwh} kWh ·{' '}
                    {v.efficiencyMixedWhPerKm} Wh/km
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(v)}
                  style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  tabs: {flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border},
  tab: {flex: 1, paddingVertical: 14, alignItems: 'center'},
  tabActive: {borderBottomWidth: 2, borderBottomColor: COLORS.primary},
  tabText: {fontSize: 14, fontWeight: '600', color: COLORS.textSecondary},
  tabTextActive: {color: COLORS.primary},
  formContent: {padding: 16, paddingBottom: 40},
  formTitle: {fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4},
  formSubtitle: {fontSize: 13, color: COLORS.textSecondary, marginBottom: 16},
  fieldWrap: {marginBottom: 12},
  fieldLabel: {fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 4},
  fieldHint: {fontSize: 11, color: COLORS.textSecondary, marginBottom: 4},
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    color: COLORS.text, backgroundColor: COLORS.surface,
  },
  connectorRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4},
  connChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  connChipActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  connChipText: {fontSize: 12, fontWeight: '600', color: COLORS.text},
  connChipTextActive: {color: '#fff'},
  mt8: {marginTop: 8},
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnText: {fontSize: 16, fontWeight: '700', color: '#fff'},
  listContent: {padding: 16, paddingBottom: 40},
  loadingText: {textAlign: 'center', color: COLORS.textSecondary, marginTop: 20},
  emptyText: {textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 15},
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  listItemInfo: {flex: 1},
  listItemName: {fontSize: 14, fontWeight: '700', color: COLORS.text},
  listItemSub: {fontSize: 12, color: COLORS.textSecondary, marginTop: 2},
  deleteBtn: {padding: 8},
  deleteBtnText: {fontSize: 18},
});
