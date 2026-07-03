/**
 * ChargerCard — info sheet for a single charging station.
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {ChargerStation} from '../../types';
import {COLORS} from '../../constants/colors';

interface Props {
  station: ChargerStation;
  arrivalBatteryPercent?: number;
  chargeToPercent?: number;
  chargeTimeMin?: number;
  showChargingDetails?: boolean;
}

const CONNECTOR_LABELS: Record<string, string> = {
  CCS2: 'CCS2',
  CCS1: 'CCS1',
  'GB/T': 'GB/T',
  NACS: 'NACS',
  CHAdeMO: 'CHAdeMO',
  Type2: 'Type 2',
  Type1: 'Type 1',
};

export default function ChargerCard({
  station,
  arrivalBatteryPercent,
  chargeToPercent,
  chargeTimeMin,
  showChargingDetails = false,
}: Props) {
  const formatTime = (min: number) => {
    if (min < 60) return `~${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚡</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.networkName} numberOfLines={1}>
            {station.networkName}
          </Text>
          <Text style={styles.address} numberOfLines={2}>
            {station.address}
          </Text>
        </View>
        <View style={styles.powerBadge}>
          <Text style={styles.powerText}>{Math.round(station.maxPowerKw)}</Text>
          <Text style={styles.powerUnit}>kW</Text>
        </View>
      </View>

      {/* Connectors */}
      <View style={styles.connectors}>
        {station.connectors.map((conn, idx) => (
          <View key={idx} style={styles.connectorBadge}>
            <Text style={styles.connectorText}>
              {CONNECTOR_LABELS[conn.type] ?? conn.type}
            </Text>
            <Text style={styles.connectorPower}>{conn.powerKw}kW</Text>
          </View>
        ))}
      </View>

      {/* Pricing */}
      {station.pricingInfo ? (
        <Text style={styles.pricing}>{station.pricingInfo}</Text>
      ) : null}

      {/* Availability */}
      <View style={styles.availRow}>
        <View
          style={[
            styles.availDot,
            {
              backgroundColor: station.isLiveStatusAvailable
                ? COLORS.success
                : COLORS.textMuted,
            },
          ]}
        />
        <Text style={styles.availText}>
          {station.isLiveStatusAvailable
            ? 'Live status available'
            : 'Availability unknown'}
        </Text>
      </View>

      {/* Charging details (shown in route result) */}
      {showChargingDetails &&
        arrivalBatteryPercent != null &&
        chargeToPercent != null &&
        chargeTimeMin != null && (
          <View style={styles.chargingDetails}>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Arrive at</Text>
                <Text style={styles.detailValue}>
                  {Math.round(arrivalBatteryPercent)}%
                </Text>
              </View>
              <Text style={styles.detailArrow}>→</Text>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Depart at</Text>
                <Text style={styles.detailValue}>{Math.round(chargeToPercent)}%</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Charge time</Text>
                <Text style={[styles.detailValue, styles.chargeTime]}>
                  {formatTime(chargeTimeMin)}
                </Text>
              </View>
            </View>
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  headerInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  address: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  powerBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight + '22',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  powerText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  powerUnit: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  connectors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  connectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  connectorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  connectorPower: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  pricing: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chargingDetails: {
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  chargeTime: {
    color: COLORS.primary,
  },
  detailArrow: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
});
