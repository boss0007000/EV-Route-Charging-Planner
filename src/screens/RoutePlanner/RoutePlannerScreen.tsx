/**
 * Route Planner Screen (Screen 1)
 *
 * Inputs: vehicle, start, destination, battery%, efficiency
 * Output: route result with map preview and charging stops
 */

import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MapView, {Polyline, Marker, PROVIDER_GOOGLE} from 'react-native-maps';

import VehicleSelector from '../../components/VehicleSelector/VehicleSelector';
import LocationInput from '../../components/LocationInput/LocationInput';
import BatterySlider from '../../components/BatterySlider/BatterySlider';
import RouteResultCard from '../../components/RouteResultCard/RouteResultCard';
import ChargerCard from '../../components/ChargerCard/ChargerCard';

import {calculateRoute} from '../../services/routeCalculation';
import {openInGoogleMaps} from '../../utils/deepLinking';
import {
  calculateUsableRangeKm,
  applyBufferedRange,
} from '../../utils/rangeCalculations';
import {useAppSettings} from '../../context/AppSettingsContext';
import {COLORS} from '../../constants/colors';
import {Vehicle, PlaceResult, RouteResult} from '../../types';

type Step = 'input' | 'loading' | 'result';

export default function RoutePlannerScreen() {
  const {settings} = useAppSettings();

  // ── Form state ────────────────────────────────────────────────────────────
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [startPlace, setStartPlace] = useState<PlaceResult | null>(null);
  const [destPlace, setDestPlace] = useState<PlaceResult | null>(null);
  const [batteryPercent, setBatteryPercent] = useState(80);
  const [efficiencyInput, setEfficiencyInput] = useState('');
  const [rangeInput, setRangeInput] = useState('');
  const [userOverrodeRange, setUserOverrodeRange] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const efficiencyWhPerKm = useMemo(() => {
    const n = parseFloat(efficiencyInput);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [efficiencyInput]);

  const computedRangeKm = useMemo(() => {
    if (!vehicle || efficiencyWhPerKm <= 0) return 0;
    return applyBufferedRange(
      calculateUsableRangeKm(batteryPercent, vehicle.usableCapacityKwh, efficiencyWhPerKm),
    );
  }, [vehicle, batteryPercent, efficiencyWhPerKm]);

  // When vehicle or battery changes, auto-fill efficiency and range
  const handleVehicleSelect = useCallback((v: Vehicle) => {
    setVehicle(v);
    setEfficiencyInput(String(v.efficiencyMixedWhPerKm));
    setUserOverrodeRange(false);
  }, []);

  const handleBatteryChange = useCallback(
    (pct: number) => {
      setBatteryPercent(pct);
      if (!userOverrodeRange) setRangeInput('');
    },
    [userOverrodeRange],
  );

  const handleRangeInput = useCallback((text: string) => {
    setRangeInput(text);
    setUserOverrodeRange(true);
  }, []);

  const displayedRange = useMemo(() => {
    if (userOverrodeRange && rangeInput !== '') return rangeInput;
    return computedRangeKm > 0 ? String(Math.round(computedRangeKm)) : '';
  }, [userOverrodeRange, rangeInput, computedRangeKm]);

  const isFormValid =
    vehicle !== null &&
    startPlace !== null &&
    destPlace !== null &&
    batteryPercent > 0 &&
    efficiencyWhPerKm > 0;

  // ── Result state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('input');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Calculate Route ────────────────────────────────────────────────────────
  const handleCalculate = useCallback(async () => {
    if (!vehicle || !startPlace || !destPlace) return;
    setStep('loading');
    setErrorMsg(null);
    try {
      const result = await calculateRoute(
        vehicle,
        startPlace,
        destPlace,
        batteryPercent,
        efficiencyWhPerKm,
        settings,
      );
      setRouteResult(result);
      setStep('result');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Route calculation failed');
      setStep('input');
      Alert.alert('Error', err?.message ?? 'Could not calculate route. Check API keys.');
    }
  }, [vehicle, startPlace, destPlace, batteryPercent, efficiencyWhPerKm, settings]);

  const handleOpenInMaps = useCallback(async () => {
    if (!routeResult || !startPlace || !destPlace) return;
    const waypoints = routeResult.chargingStops.map(s => s.charger.coordinate);
    await openInGoogleMaps(
      startPlace.coordinate ?? startPlace.description,
      destPlace.coordinate ?? destPlace.description,
      waypoints,
    );
  }, [routeResult, startPlace, destPlace]);

  const handleReset = useCallback(() => {
    setStep('input');
    setRouteResult(null);
  }, []);

  // ── Render: Result ────────────────────────────────────────────────────────
  if (step === 'result' && routeResult) {
    const allPolylinePoints = routeResult.legs.flatMap(l => l.polylinePoints);
    const mapRegion = allPolylinePoints.length > 0
      ? {
          latitude: (Math.min(...allPolylinePoints.map(p => p.latitude)) +
            Math.max(...allPolylinePoints.map(p => p.latitude))) / 2,
          longitude: (Math.min(...allPolylinePoints.map(p => p.longitude)) +
            Math.max(...allPolylinePoints.map(p => p.longitude))) / 2,
          latitudeDelta: Math.max(
            Math.max(...allPolylinePoints.map(p => p.latitude)) -
              Math.min(...allPolylinePoints.map(p => p.latitude)),
            0.05,
          ) * 1.3,
          longitudeDelta: Math.max(
            Math.max(...allPolylinePoints.map(p => p.longitude)) -
              Math.min(...allPolylinePoints.map(p => p.longitude)),
            0.05,
          ) * 1.3,
        }
      : undefined;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView>
          {/* Map Preview */}
          {allPolylinePoints.length > 0 && (
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={mapRegion}>
              {routeResult.legs.map((leg, i) => (
                <Polyline
                  key={i}
                  coordinates={leg.polylinePoints}
                  strokeColor={COLORS.primary}
                  strokeWidth={4}
                />
              ))}
              {routeResult.chargingStops.map((stop, i) => (
                <Marker
                  key={i}
                  coordinate={stop.charger.coordinate}
                  title={stop.charger.networkName}
                  description={`${Math.round(stop.charger.maxPowerKw)} kW`}
                  pinColor={COLORS.primaryLight}
                />
              ))}
            </MapView>
          )}

          <View style={styles.resultContent}>
            {/* Summary header */}
            <View style={styles.resultHeader}>
              <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <View style={styles.summaryBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeValue}>
                    {Math.round(routeResult.totalDistanceKm)} km
                  </Text>
                  <Text style={styles.badgeLabel}>Total</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeValue}>
                    {Math.floor(routeResult.totalDurationMin / 60)}h{' '}
                    {Math.round(routeResult.totalDurationMin % 60)}m
                  </Text>
                  <Text style={styles.badgeLabel}>Est. time</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeValue}>
                    {routeResult.chargingStops.length}
                  </Text>
                  <Text style={styles.badgeLabel}>Stops</Text>
                </View>
              </View>
            </View>

            {/* No charging needed */}
            {!routeResult.needsCharging && (
              <View style={styles.noChargingCard}>
                <Text style={styles.noChargingIcon}>✅</Text>
                <View>
                  <Text style={styles.noChargingTitle}>
                    No charging needed!
                  </Text>
                  <Text style={styles.noChargingSubtitle}>
                    You can reach your destination on a single charge.
                  </Text>
                </View>
              </View>
            )}

            {/* Leg cards */}
            <Text style={styles.sectionTitle}>Journey Legs</Text>
            {routeResult.legs.map((leg, i) => (
              <RouteResultCard key={i} leg={leg} legIndex={i} />
            ))}

            {/* Charging stop cards */}
            {routeResult.chargingStops.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Charging Stops</Text>
                {routeResult.chargingStops.map((stop, i) => (
                  <ChargerCard
                    key={i}
                    station={stop.charger}
                    arrivalBatteryPercent={stop.arrivalBatteryPercent}
                    chargeToPercent={stop.chargeToPercent}
                    chargeTimeMin={stop.estimatedChargeTimeMin}
                    showChargingDetails
                  />
                ))}
              </>
            )}

            {/* Open in Google Maps */}
            <TouchableOpacity
              style={styles.mapsBtn}
              onPress={handleOpenInMaps}>
              <Text style={styles.mapsBtnIcon}>🗺</Text>
              <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Input ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.appName}>⚡ ChargeRoute</Text>
            <Text style={styles.heroTitle}>Plan Your EV Journey</Text>
            <Text style={styles.heroSubtitle}>
              Find the best route. Charge smart. Arrive with confidence.
            </Text>
          </View>

          {/* Vehicle selector */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Your Car</Text>
            <VehicleSelector
              selected={vehicle}
              onSelect={handleVehicleSelect}
            />
          </View>

          {/* Locations */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Starting Location</Text>
            <LocationInput
              placeholder="Enter starting location"
              value={startPlace}
              onChange={setStartPlace}
              showCurrentLocation
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Destination</Text>
            <LocationInput
              placeholder="Enter destination"
              value={destPlace}
              onChange={setDestPlace}
            />
          </View>

          {/* Battery + range + efficiency row */}
          <View style={styles.statsRow}>
            {/* Battery % */}
            <View style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Current Battery</Text>
              <BatterySlider
                value={batteryPercent}
                onChange={handleBatteryChange}
              />
            </View>

            {/* Estimated range */}
            <View style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Estimated Range</Text>
              <View style={styles.rangeRow}>
                <Text style={styles.rangeIcon}>🛣</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={displayedRange}
                  onChangeText={handleRangeInput}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.rangeUnit}>km</Text>
              </View>
              <Text style={styles.rangeHint}>
                {userOverrodeRange ? 'Manual override' : 'Auto-calculated'}
              </Text>
            </View>

            {/* Efficiency */}
            <View style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Efficiency</Text>
              <View style={styles.rangeRow}>
                <Text style={styles.rangeIcon}>⚡</Text>
                <TextInput
                  style={styles.rangeInput}
                  value={efficiencyInput}
                  onChangeText={setEfficiencyInput}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>
              <Text style={styles.rangeUnit}>Wh/km</Text>
              <Text style={styles.rangeHint}>
                Enter your real-world efficiency
              </Text>
            </View>
          </View>

          {/* Calculate button */}
          {step === 'loading' ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingBtnText}>Calculating…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.calculateBtn,
                !isFormValid && styles.calculateBtnDisabled,
              ]}
              onPress={handleCalculate}
              disabled={!isFormValid}>
              <Text style={styles.calculateBtnIcon}>➤</Text>
              <Text style={styles.calculateBtnText}>Calculate Route</Text>
            </TouchableOpacity>
          )}

          {errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 20,
  },
  appName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    lineHeight: 34,
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  statsRow: {
    // stack on small screens
  },
  statsCard: {
    flex: 1,
  },
  statsCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  rangeInput: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  rangeUnit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  rangeHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  calculateBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  calculateBtnDisabled: {
    backgroundColor: COLORS.textMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  calculateBtnIcon: {
    fontSize: 16,
    color: '#fff',
    marginRight: 8,
  },
  calculateBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  loadingBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 12,
  },
  loadingBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  errorText: {
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  // Result screen
  map: {
    height: 240,
    width: '100%',
  },
  resultContent: {
    padding: 16,
    paddingBottom: 32,
  },
  resultHeader: {
    marginBottom: 16,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryBadges: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  badgeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  badgeLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  noChargingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  noChargingIcon: {
    fontSize: 28,
  },
  noChargingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  noChargingSubtitle: {
    fontSize: 12,
    color: COLORS.primaryDark,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 4,
  },
  mapsBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 10,
  },
  mapsBtnIcon: {
    fontSize: 18,
  },
  mapsBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
