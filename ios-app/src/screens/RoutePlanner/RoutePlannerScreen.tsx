/**
 * Route Planner Screen (Screen 1)
 *
 * Inputs: vehicle, start, destination, battery%, efficiency
 * Output: route result with map preview and charging stops
 */

import React, {useState, useCallback, useMemo, useEffect} from 'react';
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
import GlassCard from '../../components/GlassCard/GlassCard';
import GlassButton from '../../components/GlassButton/GlassButton';

import {calculateRoute, RouteInfeasibleError, RouteTooLongError} from '../../services/routeCalculation';
import {openInGoogleMaps} from '../../utils/deepLinking';
import {
  calculateUsableRangeKm,
  applyBufferedRange,
} from '../../utils/rangeCalculations';
import {useAppSettings} from '../../context/AppSettingsContext';
import {COLORS, GLASS} from '../../constants/colors';
import {Vehicle, PlaceResult, RouteResult} from '../../types';

type Step = 'input' | 'loading' | 'result';

const MIN_ARRIVAL_BATTERY_PERCENT = 5;
const MAX_ARRIVAL_BATTERY_PERCENT = 30;
const MIN_CHARGE_TO_TARGET_PERCENT = 50;
const MAX_CHARGE_TO_TARGET_PERCENT = 100;

export default function RoutePlannerScreen() {
  const {settings, isLoaded} = useAppSettings();

  // ── Form state ────────────────────────────────────────────────────────────
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [startPlace, setStartPlace] = useState<PlaceResult | null>(null);
  const [destPlace, setDestPlace] = useState<PlaceResult | null>(null);
  const [batteryPercent, setBatteryPercent] = useState(80);
  const [arrivalBatteryPercent, setArrivalBatteryPercent] = useState(
    settings.reserveBatteryPercent,
  );
  // How full to charge back up to at each stop. Previously hard-coded at
  // DEFAULT_ROUTE_SETTINGS.maxChargeTargetPercent (80%) with no UI control
  // at all — see ev_test_report.md, ARRIVAL_TARGET_MISMATCH.
  const [chargeToTargetPercent, setChargeToTargetPercent] = useState(
    settings.maxChargeTargetPercent,
  );
  const [efficiencyInput, setEfficiencyInput] = useState('');

  // Seed the arrival-battery and charge-to-target sliders from the
  // persisted settings once they load (covers the case where a saved value
  // differs from the defaults of 15% / 80%).
  useEffect(() => {
    if (isLoaded) {
      setArrivalBatteryPercent(settings.reserveBatteryPercent);
      setChargeToTargetPercent(settings.maxChargeTargetPercent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleArrivalBatteryChange = useCallback((pct: number) => {
    const clamped = Math.min(
      MAX_ARRIVAL_BATTERY_PERCENT,
      Math.max(MIN_ARRIVAL_BATTERY_PERCENT, pct),
    );
    setArrivalBatteryPercent(clamped);
  }, []);

  const handleChargeToTargetChange = useCallback((pct: number) => {
    const clamped = Math.min(
      MAX_CHARGE_TO_TARGET_PERCENT,
      Math.max(MIN_CHARGE_TO_TARGET_PERCENT, pct),
    );
    setChargeToTargetPercent(clamped);
  }, []);

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

  // When vehicle changes, auto-fill efficiency (range recomputes from it automatically)
  const handleVehicleSelect = useCallback((v: Vehicle) => {
    setVehicle(v);
    setEfficiencyInput(String(v.efficiencyMixedWhPerKm));
  }, []);

  const handleBatteryChange = useCallback((pct: number) => {
    setBatteryPercent(pct);
  }, []);

  // Estimated Range is a read-only, auto-calculated display (see
  // ev_test_report.md, RANGE_FIELD_HAS_NO_EFFECT): calculateRoute() derives
  // range internally from battery% + efficiency + the vehicle's own
  // usableCapacityKwh — it never took a range parameter, so a manual
  // override here previously changed the number on screen and nothing else.
  const displayedRange = useMemo(() => {
    return computedRangeKm > 0 ? String(Math.round(computedRangeKm)) : '—';
  }, [computedRangeKm]);

  // Previously just a boolean driving a disabled button with no explanation
  // anywhere on screen (see ev_test_report.md, NO_VALIDATION_MESSAGE_SHOWN).
  // Deriving *which* condition failed lets the UI say why, not just refuse.
  const validationMessage = useMemo(() => {
    if (!vehicle) return 'Select your vehicle to continue.';
    if (!startPlace) return 'Choose a starting location from the suggestions list.';
    if (!destPlace) return 'Choose a destination from the suggestions list.';
    if (!(batteryPercent > 0)) return 'Current battery must be above 0%.';
    if (!(efficiencyWhPerKm > 0)) return 'Enter a valid efficiency (Wh/km) above 0.';
    return null;
  }, [vehicle, startPlace, destPlace, batteryPercent, efficiencyWhPerKm]);

  const isFormValid = validationMessage === null;

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
        {
          ...settings,
          reserveBatteryPercent: arrivalBatteryPercent,
          maxChargeTargetPercent: chargeToTargetPercent,
        },
      );
      setRouteResult(result);
      setStep('result');
    } catch (err: any) {
      setStep('input');

      if (err instanceof RouteInfeasibleError) {
        setErrorMsg(err.message);
        const suggested = err.suggestedMinStartBatteryPercent;
        if (suggested != null && suggested > batteryPercent) {
          Alert.alert(
            'Route Not Feasible',
            `No charger could be found near ${err.strandedNear}. ` +
              `Starting with at least ${suggested}% battery would let you reach that point safely.`,
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: `Use ${suggested}%`,
                onPress: () => handleBatteryChange(suggested),
              },
            ],
          );
        } else {
          Alert.alert(
            'Route Not Feasible',
            `No charger could be found near ${err.strandedNear}, even at a full charge. ` +
              `Try a different route, or check back once more chargers are mapped in that area.`,
          );
        }
        return;
      }

      if (err instanceof RouteTooLongError) {
        setErrorMsg(err.message);
        Alert.alert(
          'Trip Needs More Charging Stops',
          `This route needs more charging stops than ChargeRoute can plan in one pass ` +
            `(reached ${Math.round(err.distanceCoveredKm)} km of ${Math.round(err.totalDistanceKm)} km). ` +
            `Try raising your Charge To Target so each stop covers more distance, or split the trip.`,
        );
        return;
      }

      setErrorMsg(err?.message ?? 'Route calculation failed');
      Alert.alert('Error', err?.message ?? 'Could not calculate route. Check API keys.');
    }
  }, [
    vehicle,
    startPlace,
    destPlace,
    batteryPercent,
    efficiencyWhPerKm,
    settings,
    arrivalBatteryPercent,
    chargeToTargetPercent,
    handleBatteryChange,
  ]);

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
                <GlassCard style={styles.badge}>
                  <Text style={styles.badgeValue}>
                    {Math.round(routeResult.totalDistanceKm)} km
                  </Text>
                  <Text style={styles.badgeLabel}>Total</Text>
                </GlassCard>
                <GlassCard style={styles.badge}>
                  <Text style={styles.badgeValue}>
                    {Math.floor(routeResult.totalDurationMin / 60)}h{' '}
                    {Math.round(routeResult.totalDurationMin % 60)}m
                  </Text>
                  <Text style={styles.badgeLabel}>Est. time</Text>
                </GlassCard>
                <GlassCard style={styles.badge}>
                  <Text style={styles.badgeValue}>
                    {routeResult.chargingStops.length}
                  </Text>
                  <Text style={styles.badgeLabel}>Stops</Text>
                </GlassCard>
              </View>
            </View>

            {/* No charging needed — solid semantic-green banner, kept opaque
                on purpose so a success state never reads as "faded" glass. */}
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
            <GlassButton style={styles.mapsBtn} onPress={handleOpenInMaps}>
              <Text style={styles.mapsBtnIcon}>🗺</Text>
              <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
            </GlassButton>
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
          <GlassCard style={styles.card}>
            <Text style={styles.fieldLabel}>Your Car</Text>
            <VehicleSelector
              selected={vehicle}
              onSelect={handleVehicleSelect}
            />
          </GlassCard>

          {/* Locations */}
          <GlassCard style={styles.card}>
            <Text style={styles.fieldLabel}>Starting Location</Text>
            <LocationInput
              placeholder="Enter starting location"
              value={startPlace}
              onChange={setStartPlace}
              showCurrentLocation
            />
          </GlassCard>

          <GlassCard style={styles.card}>
            <Text style={styles.fieldLabel}>Destination</Text>
            <LocationInput
              placeholder="Enter destination"
              value={destPlace}
              onChange={setDestPlace}
            />
          </GlassCard>

          {/* Battery + range + efficiency row */}
          <View style={styles.statsRow}>
            {/* Battery % */}
            <GlassCard style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Current Battery</Text>
              <BatterySlider
                value={batteryPercent}
                onChange={handleBatteryChange}
              />
            </GlassCard>

            {/* Arrival battery target */}
            <GlassCard style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Arrival Battery Target</Text>
              <Text style={styles.arrivalHint}>
                Minimum battery before ChargeRoute schedules a stop
              </Text>
              <BatterySlider
                value={arrivalBatteryPercent}
                onChange={handleArrivalBatteryChange}
                min={MIN_ARRIVAL_BATTERY_PERCENT}
                max={MAX_ARRIVAL_BATTERY_PERCENT}
              />
            </GlassCard>

            {/* Charge-to target — how full each stop charges back up to.
                Previously hard-coded at 80% with no control (see
                ev_test_report.md, ARRIVAL_TARGET_MISMATCH). */}
            <GlassCard style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Charge To Target</Text>
              <Text style={styles.arrivalHint}>
                Battery level you charge back up to at each stop
              </Text>
              <BatterySlider
                value={chargeToTargetPercent}
                onChange={handleChargeToTargetChange}
                min={MIN_CHARGE_TO_TARGET_PERCENT}
                max={MAX_CHARGE_TO_TARGET_PERCENT}
              />
            </GlassCard>

            {/* Estimated range — read-only. calculateRoute() derives range
                internally from battery% + efficiency + vehicle capacity; it
                never accepted a range override, so editing this number used
                to change the display and nothing else (see
                ev_test_report.md, RANGE_FIELD_HAS_NO_EFFECT). */}
            <GlassCard style={[styles.card, styles.statsCard]}>
              <Text style={styles.statsCardLabel}>Estimated Range</Text>
              <View style={styles.rangeRow}>
                <Text style={styles.rangeIcon}>🛣</Text>
                <Text style={styles.rangeInput}>{displayedRange}</Text>
                <Text style={styles.rangeUnit}>km</Text>
              </View>
              <Text style={styles.rangeHint}>Auto-calculated</Text>
            </GlassCard>

            {/* Efficiency */}
            <GlassCard style={[styles.card, styles.statsCard]}>
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
            </GlassCard>
          </View>

          {/* Calculate button */}
          {step === 'loading' ? (
            <View style={styles.loadingBtn}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.loadingBtnText}>Calculating…</Text>
            </View>
          ) : (
            <GlassButton
              style={styles.calculateBtn}
              tintColor={GLASS.primaryTint}
              onPress={handleCalculate}
              disabled={!isFormValid}>
              <Text style={styles.calculateBtnIcon}>➤</Text>
              <Text style={styles.calculateBtnText}>Calculate Route</Text>
            </GlassButton>
          )}

          {!isFormValid && step !== 'loading' ? (
            <Text style={styles.validationText}>{validationMessage}</Text>
          ) : null}

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
    paddingBottom: 100,
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  arrivalHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: -4,
    marginBottom: 8,
    lineHeight: 14,
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
    borderRadius: 16,
    paddingVertical: 18,
    marginTop: 8,
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
  validationText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 13,
  },
  // Result screen
  map: {
    height: 240,
    width: '100%',
  },
  resultContent: {
    padding: 16,
    paddingBottom: 100,
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
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
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
