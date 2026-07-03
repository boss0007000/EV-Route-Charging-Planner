/**
 * RouteResultCard — shows a single route leg (distance, time, battery %).
 */

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {RouteLeg} from '../../types';
import {
  formatDistanceKm,
  formatDurationMin,
  formatBatteryPercent,
} from '../../utils/rangeCalculations';
import {COLORS} from '../../constants/colors';

interface Props {
  leg: RouteLeg;
  legIndex: number;
}

export default function RouteResultCard({leg, legIndex}: Props) {
  const batteryColor =
    leg.arrivalBatteryPercent <= 15
      ? COLORS.error
      : leg.arrivalBatteryPercent <= 30
      ? COLORS.warning
      : COLORS.primary;

  return (
    <View style={styles.card}>
      <View style={styles.leftBar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>{legIndex + 1}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.toText} numberOfLines={1}>
              → {leg.to}
            </Text>
            <Text style={styles.fromText} numberOfLines={1}>
              from {leg.from}
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>📏</Text>
            <Text style={styles.statValue}>{formatDistanceKm(leg.distanceKm)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statIcon}>⏱</Text>
            <Text style={styles.statValue}>{formatDurationMin(leg.durationMin)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statIcon}>🔋</Text>
            <Text style={[styles.statValue, {color: batteryColor}]}>
              {formatBatteryPercent(leg.arrivalBatteryPercent)}
            </Text>
            <Text style={styles.statSub}> on arrival</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  leftBar: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  toText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  fromText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  statIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  statSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
});
