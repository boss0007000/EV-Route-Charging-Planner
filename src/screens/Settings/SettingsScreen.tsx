/**
 * Settings Screen — route planning configuration.
 * Accessible from the Route Planner header or navigation.
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
import {useAppSettings} from '../../context/AppSettingsContext';
import {COLORS} from '../../constants/colors';
import {DEFAULT_ROUTE_SETTINGS} from '../../types';

export default function SettingsScreen() {
  const {settings, updateSettings} = useAppSettings();

  const [reserve, setReserve] = useState(String(settings.reserveBatteryPercent));
  const [minArrival, setMinArrival] = useState(
    String(settings.minArrivalBatteryPercent),
  );
  const [maxCharge, setMaxCharge] = useState(
    String(settings.maxChargeTargetPercent),
  );
  const [minPower, setMinPower] = useState(String(settings.minChargerPowerKw));
  const [cacheTtl, setCacheTtl] = useState(
    String(settings.chargerCacheTtlHours),
  );

  const save = useCallback(async () => {
    const r = parseInt(reserve, 10);
    const a = parseInt(minArrival, 10);
    const c = parseInt(maxCharge, 10);
    const p = parseInt(minPower, 10);
    const ttl = parseInt(cacheTtl, 10);

    if (
      isNaN(r) || r < 5 || r > 30 ||
      isNaN(a) || a < 5 || a > 20 ||
      isNaN(c) || c < 50 || c > 100 ||
      isNaN(p) || p < 0 ||
      isNaN(ttl) || ttl < 1
    ) {
      Alert.alert('Invalid values', 'Please check your settings values.');
      return;
    }

    await updateSettings({
      reserveBatteryPercent: r,
      minArrivalBatteryPercent: a,
      maxChargeTargetPercent: c,
      minChargerPowerKw: p,
      chargerCacheTtlHours: ttl,
    });
    Alert.alert('Saved', 'Settings updated.');
  }, [reserve, minArrival, maxCharge, minPower, cacheTtl, updateSettings]);

  const reset = useCallback(async () => {
    await updateSettings(DEFAULT_ROUTE_SETTINGS);
    setReserve(String(DEFAULT_ROUTE_SETTINGS.reserveBatteryPercent));
    setMinArrival(String(DEFAULT_ROUTE_SETTINGS.minArrivalBatteryPercent));
    setMaxCharge(String(DEFAULT_ROUTE_SETTINGS.maxChargeTargetPercent));
    setMinPower(String(DEFAULT_ROUTE_SETTINGS.minChargerPowerKw));
    setCacheTtl(String(DEFAULT_ROUTE_SETTINGS.chargerCacheTtlHours));
  }, [updateSettings]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>⚙️ Route Settings</Text>
        <Text style={styles.subtitle}>
          Adjust how the route planner handles battery thresholds and
          charging stops.
        </Text>

        <SettingRow
          label="Reserve Battery %"
          hint="Stop to charge when battery drops to this level (default: 15%)"
          value={reserve}
          onChange={setReserve}
          unit="%"
        />
        <SettingRow
          label="Min Arrival Battery %"
          hint="Minimum recommended battery at destination (default: 10%)"
          value={minArrival}
          onChange={setMinArrival}
          unit="%"
        />
        <SettingRow
          label="Max Charge Target %"
          hint="Charge to this level before continuing (default: 80%)"
          value={maxCharge}
          onChange={setMaxCharge}
          unit="%"
        />
        <SettingRow
          label="Min Charger Power"
          hint="Exclude chargers below this power for road-trip routing (default: 22 kW)"
          value={minPower}
          onChange={setMinPower}
          unit="kW"
        />
        <SettingRow
          label="Charger Cache TTL"
          hint="How long to cache charger data before re-fetching (default: 24 h)"
          value={cacheTtl}
          onChange={setCacheTtl}
          unit="hours"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetBtn} onPress={reset}>
          <Text style={styles.resetBtnText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  label,
  hint,
  value,
  onChange,
  unit,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingHint}>{hint}</Text>
      <View style={styles.settingInputRow}>
        <TextInput
          style={styles.settingInput}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          maxLength={5}
        />
        <Text style={styles.settingUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  settingRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  settingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    width: 80,
    textAlign: 'center',
  },
  settingUnit: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  resetBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
  },
  resetBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
