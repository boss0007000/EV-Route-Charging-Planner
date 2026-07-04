/**
 * Charger Map Screen (Screen 2)
 *
 * Full-screen pannable map with charger pins loaded from OCM
 * using geo-tile caching. Filter bar for connector type and power.
 */

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Switch,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import MapView, {
  Marker,
  Region,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';

import ChargerCard from '../../components/ChargerCard/ChargerCard';
import {getChargersForBounds} from '../../utils/geoTileCache';
import {ChargerFilter, ChargerStation, ConnectorType} from '../../types';
import {COLORS} from '../../constants/colors';
import {ROUTE_CONSTANTS} from '../../constants/config';
import {useAppSettings} from '../../context/AppSettingsContext';

const CONNECTOR_OPTIONS: ConnectorType[] = [
  'CCS2',
  'CCS1',
  'GB/T',
  'NACS',
  'CHAdeMO',
  'Type2',
  'Type1',
];

const DEFAULT_FILTER: ChargerFilter = {
  connectorTypes: [],
  minPowerKw: 0,
  networkOperator: null,
};

const DEFAULT_REGION: Region = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export default function ChargerMapScreen() {
  const {settings} = useAppSettings();

  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [stations, setStations] = useState<ChargerStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [isThrottled, setIsThrottled] = useState(false);
  const [filter, setFilter] = useState<ChargerFilter>(DEFAULT_FILTER);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedStation, setSelectedStation] =
    useState<ChargerStation | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  // Load chargers for current region (debounced)
  const loadChargers = useCallback(
    async (r: Region) => {
      const halfLat = r.latitudeDelta / 2;
      const halfLng = r.longitudeDelta / 2;
      const minLat = r.latitude - halfLat;
      const maxLat = r.latitude + halfLat;
      const minLng = r.longitude - halfLng;
      const maxLng = r.longitude + halfLng;

      setLoading(true);
      setIsThrottled(false);
      try {
        const results = await getChargersForBounds(
          minLat, maxLat, minLng, maxLng,
          settings.chargerCacheTtlHours * 60 * 60 * 1000,
          () => setIsThrottled(true),
        );
        setStations(results);
      } catch {
        // Keep existing stations on error
      } finally {
        setLoading(false);
      }
    },
    [settings.chargerCacheTtlHours],
  );

  // Center on user location on mount
  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const userRegion: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };
        setRegion(userRegion);
        loadChargers(userRegion);
      },
      _err => {
        // Fall back to default region
        loadChargers(DEFAULT_REGION);
      },
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
    );
  }, [loadChargers]);

  const handleRegionChangeComplete = useCallback(
    (r: Region) => {
      setRegion(r);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        loadChargers(r);
      }, ROUTE_CONSTANTS.mapPanDebounceMs);
    },
    [loadChargers],
  );

  const handleLocateMe = useCallback(() => {
    Geolocation.getCurrentPosition(
      pos => {
        const r: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 400);
        loadChargers(r);
      },
      _err => {},
      {enableHighAccuracy: true, timeout: 10000, maximumAge: 60000},
    );
  }, [loadChargers]);

  // Filter stations for display
  const filteredStations = stations.filter(s => {
    if (
      filter.connectorTypes.length > 0 &&
      !s.connectors.some(c => filter.connectorTypes.includes(c.type))
    ) {
      return false;
    }
    if (filter.minPowerKw > 0 && s.maxPowerKw < filter.minPowerKw) {
      return false;
    }
    if (
      filter.networkOperator &&
      !s.networkName
        .toLowerCase()
        .includes(filter.networkOperator.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const toggleConnectorFilter = useCallback((ct: ConnectorType) => {
    setFilter(prev => ({
      ...prev,
      connectorTypes: prev.connectorTypes.includes(ct)
        ? prev.connectorTypes.filter(c => c !== ct)
        : [...prev.connectorTypes, ct],
    }));
  }, []);

  const activeFilterCount =
    filter.connectorTypes.length +
    (filter.minPowerKw > 0 ? 1 : 0) +
    (filter.networkOperator ? 1 : 0);

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}>
        {filteredStations.map(station => (
          <Marker
            key={station.id}
            coordinate={station.coordinate}
            onPress={() => setSelectedStation(station)}
            title={station.networkName}
            pinColor={COLORS.primary}
          />
        ))}
      </MapView>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topBarInner}>
          {/* Status badge */}
          {loading ? (
            <View style={styles.statusBadge}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.statusText}>Loading…</Text>
            </View>
          ) : isThrottled ? (
            <View style={[styles.statusBadge, styles.throttledBadge]}>
              <Text style={styles.statusText}>Showing cached data</Text>
            </View>
          ) : filteredStations.length > 0 ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {filteredStations.length} charger
                {filteredStations.length !== 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}

          {/* Filter button */}
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setFilterVisible(true)}>
            <Text style={styles.filterBtnText}>
              ⚙ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* My location FAB */}
      <TouchableOpacity
        style={styles.locateFab}
        onPress={handleLocateMe}
        accessibilityLabel="My location">
        <Text style={styles.locateFabIcon}>📍</Text>
      </TouchableOpacity>

      {/* Selected station card */}
      {selectedStation && (
        <View style={styles.stationCard}>
          <TouchableOpacity
            style={styles.stationCardClose}
            onPress={() => setSelectedStation(null)}>
            <Text style={styles.stationCardCloseText}>✕</Text>
          </TouchableOpacity>
          <ChargerCard station={selectedStation} />
        </View>
      )}

      {/* Filter modal */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterVisible(false)}>
        <View style={styles.filterOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Chargers</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Text style={styles.filterClose}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Connector types */}
              <Text style={styles.filterSectionTitle}>Connector Type</Text>
              <View style={styles.connectorGrid}>
                {CONNECTOR_OPTIONS.map(ct => (
                  <TouchableOpacity
                    key={ct}
                    style={[
                      styles.connectorChip,
                      filter.connectorTypes.includes(ct) &&
                        styles.connectorChipActive,
                    ]}
                    onPress={() => toggleConnectorFilter(ct)}>
                    <Text
                      style={[
                        styles.connectorChipText,
                        filter.connectorTypes.includes(ct) &&
                          styles.connectorChipTextActive,
                      ]}>
                      {ct}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Minimum power */}
              <Text style={styles.filterSectionTitle}>Minimum Power (kW)</Text>
              <View style={styles.powerRow}>
                {[0, 22, 50, 100, 150, 250].map(kw => (
                  <TouchableOpacity
                    key={kw}
                    style={[
                      styles.powerChip,
                      filter.minPowerKw === kw && styles.powerChipActive,
                    ]}
                    onPress={() =>
                      setFilter(prev => ({...prev, minPowerKw: kw}))
                    }>
                    <Text
                      style={[
                        styles.powerChipText,
                        filter.minPowerKw === kw && styles.powerChipTextActive,
                      ]}>
                      {kw === 0 ? 'Any' : `${kw}+`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Network operator */}
              <Text style={styles.filterSectionTitle}>
                Network Operator (optional)
              </Text>
              <TextInput
                style={styles.networkInput}
                placeholder="e.g. Tesla, Ionity…"
                placeholderTextColor={COLORS.textMuted}
                value={filter.networkOperator ?? ''}
                onChangeText={text =>
                  setFilter(prev => ({
                    ...prev,
                    networkOperator: text || null,
                  }))
                }
              />

              {/* Reset */}
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => setFilter(DEFAULT_FILTER)}>
                <Text style={styles.resetBtnText}>Reset Filters</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  map: {flex: 1},
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 8,
    paddingBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  throttledBadge: {
    backgroundColor: 'rgba(255,250,240,0.95)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  locateFab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  locateFabIcon: {
    fontSize: 22,
  },
  stationCard: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
  },
  stationCardClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  stationCardCloseText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  // Filter modal
  filterOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  filterSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    padding: 20,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterClose: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  connectorChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  connectorChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  connectorChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  connectorChipTextActive: {
    color: '#fff',
  },
  powerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  powerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  powerChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  powerChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  powerChipTextActive: {
    color: '#fff',
  },
  networkInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  resetBtn: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  resetBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
