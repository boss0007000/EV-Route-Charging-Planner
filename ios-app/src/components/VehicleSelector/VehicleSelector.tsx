/**
 * VehicleSelector — searchable dropdown modal to pick an EV.
 */

import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {Vehicle} from '../../types';
import {searchVehicles, getAllVehicles} from '../../database/vehicleDb';
import {seedVehiclesIfEmpty} from '../../database/vehicleDb';
import {SEED_VEHICLES} from '../../database/vehicleSeedData';
import {COLORS} from '../../constants/colors';

interface Props {
  selected: Vehicle | null;
  onSelect: (vehicle: Vehicle) => void;
}

export default function VehicleSelector({selected, onSelect}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);

  const openModal = useCallback(async () => {
    setModalVisible(true);
    setLoading(true);
    await seedVehiclesIfEmpty(SEED_VEHICLES);
    const all = await getAllVehicles();
    setResults(all);
    setLoading(false);
  }, []);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length === 0) {
      const all = await getAllVehicles();
      setResults(all);
    } else {
      const found = await searchVehicles(text);
      setResults(found);
    }
  }, []);

  const handleSelect = useCallback(
    (vehicle: Vehicle) => {
      onSelect(vehicle);
      setModalVisible(false);
      setQuery('');
    },
    [onSelect],
  );

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={openModal}
        accessibilityRole="button"
        accessibilityLabel="Select vehicle">
        {selected ? (
          <View style={styles.selectedRow}>
            <View style={styles.vehicleIcon}>
              <Text style={styles.vehicleIconText}>🚗</Text>
            </View>
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedName} numberOfLines={1}>
                {selected.manufacturer} {selected.model}
              </Text>
              <Text style={styles.selectedSub} numberOfLines={1}>
                {selected.trim} · {selected.modelYear}
              </Text>
            </View>
            <Text style={styles.chevron}>▼</Text>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.vehicleIcon}>
              <Text style={styles.vehicleIconText}>🚗</Text>
            </View>
            <Text style={styles.placeholderText}>Select your vehicle</Text>
            <Text style={styles.chevron}>▼</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vehicle</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search manufacturer or model…"
            value={query}
            onChangeText={handleSearch}
            autoFocus
            placeholderTextColor={COLORS.textMuted}
          />

          {loading ? (
            <ActivityIndicator
              style={styles.loader}
              color={COLORS.primary}
              size="large"
            />
          ) : (
            <FlatList
              data={results}
              keyExtractor={item => String(item.id)}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.listItem}
                  onPress={() => handleSelect(item)}>
                  <View style={styles.vehicleIconSmall}>
                    <Text style={styles.vehicleIconText}>🚗</Text>
                  </View>
                  <View style={styles.listItemInfo}>
                    <Text style={styles.listItemName}>
                      {item.manufacturer} {item.model}
                    </Text>
                    <Text style={styles.listItemSub}>
                      {item.trim} · {item.modelYear} ·{' '}
                      {item.usableCapacityKwh} kWh
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => (
                <View style={styles.separator} />
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No vehicles found</Text>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.surface,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placeholder: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleIconText: {
    fontSize: 18,
  },
  vehicleIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  placeholderText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textMuted,
  },
  chevron: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginLeft: 8,
  },
  modal: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 56,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeBtn: {
    fontSize: 18,
    color: COLORS.textSecondary,
    padding: 4,
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    fontSize: 15,
    color: COLORS.text,
  },
  loader: {
    marginTop: 40,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  listItemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 60,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
