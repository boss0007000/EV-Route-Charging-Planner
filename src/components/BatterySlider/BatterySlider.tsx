/**
 * BatterySlider — slider (0–100%) with synced numeric input.
 */

import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
} from 'react-native';
import Slider from '@react-native-community/slider';
import {COLORS} from '../../constants/colors';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export default function BatterySlider({value, onChange}: Props) {
  const [inputText, setInputText] = useState(String(Math.round(value)));

  const handleSliderChange = useCallback(
    (v: number) => {
      const rounded = Math.round(v);
      setInputText(String(rounded));
      onChange(rounded);
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);
      const num = parseInt(text, 10);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        onChange(num);
      }
    },
    [onChange],
  );

  const handleInputBlur = useCallback(() => {
    const num = parseInt(inputText, 10);
    if (isNaN(num) || num < 0 || num > 100) {
      setInputText(String(Math.round(value)));
    }
  }, [inputText, value]);

  const getBatteryColor = (pct: number) => {
    if (pct <= 15) return COLORS.error;
    if (pct <= 30) return COLORS.warning;
    return COLORS.primary;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.batteryIconContainer}>
          <Text style={[styles.batteryIcon]}>
            {value > 75 ? '🔋' : value > 30 ? '🪫' : '🔌'}
          </Text>
        </View>
        <View style={styles.valueContainer}>
          <TextInput
            style={[
              styles.valueInput,
              {color: getBatteryColor(value)},
            ]}
            value={inputText}
            onChangeText={handleInputChange}
            onBlur={handleInputBlur}
            keyboardType="numeric"
            maxLength={3}
          />
          <Text style={[styles.pctLabel, {color: getBatteryColor(value)}]}>
            %
          </Text>
        </View>
      </View>

      {/* Battery bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${value}%`,
              backgroundColor: getBatteryColor(value),
            },
          ]}
        />
      </View>

      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={handleSliderChange}
        minimumTrackTintColor={getBatteryColor(value)}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={getBatteryColor(value)}
      />

      <View style={styles.labels}>
        <Text style={styles.labelText}>0%</Text>
        <Text style={styles.labelText}>50%</Text>
        <Text style={styles.labelText}>100%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  batteryIconContainer: {
    marginRight: 8,
  },
  batteryIcon: {
    fontSize: 22,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueInput: {
    fontSize: 28,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'right',
  },
  pctLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  slider: {
    marginHorizontal: -10,
    height: 36,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
