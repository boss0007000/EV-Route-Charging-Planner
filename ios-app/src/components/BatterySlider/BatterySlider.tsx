/**
 * BatterySlider — slider (0–100%) with synced numeric input.
 */

import React, {useState, useCallback, useEffect} from 'react';
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
  min?: number;
  max?: number;
}

export default function BatterySlider({value, onChange, min = 0, max = 100}: Props) {
  const [inputText, setInputText] = useState(String(Math.round(value)));

  // Whether the *currently typed* text is a valid, in-range integer.
  // Previously an out-of-range or non-numeric keystroke was silently
  // dropped — onChange just never fired, with no indication to the user
  // that what they typed wasn't taking effect (see ev_test_report.md,
  // INVALID_INPUT_NOT_REJECTED). Deriving this from inputText on every
  // render lets the input show it's rejecting the value immediately.
  const parsedInput = parseInt(inputText, 10);
  const isInputInvalid =
    inputText !== '' &&
    (isNaN(parsedInput) || String(parsedInput) !== inputText.trim() || parsedInput < min || parsedInput > max);

  // Keep the displayed number in sync when `value` changes externally
  // (e.g. a parent programmatically setting it), not just via this
  // component's own slider/text-input interactions.
  useEffect(() => {
    setInputText(String(Math.round(value)));
  }, [value]);

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
      if (!isNaN(num) && String(num) === text.trim() && num >= min && num <= max) {
        onChange(num);
      }
    },
    [onChange, min, max],
  );

  const handleInputBlur = useCallback(() => {
    const num = parseInt(inputText, 10);
    if (isNaN(num) || num < min || num > max) {
      setInputText(String(Math.round(value)));
    }
  }, [inputText, value, min, max]);

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
              {color: isInputInvalid ? COLORS.error : getBatteryColor(value)},
              isInputInvalid && styles.valueInputInvalid,
            ]}
            value={inputText}
            onChangeText={handleInputChange}
            onBlur={handleInputBlur}
            keyboardType="numeric"
            maxLength={4}
          />
          <Text style={[styles.pctLabel, {color: isInputInvalid ? COLORS.error : getBatteryColor(value)}]}>
            %
          </Text>
        </View>
      </View>

      {isInputInvalid && (
        <Text style={styles.invalidHint}>
          Enter a whole number from {min} to {max} — still using {Math.round(value)}%
        </Text>
      )}

      {/* Battery bar */}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${((value - min) / (max - min)) * 100}%`,
              backgroundColor: getBatteryColor(value),
            },
          ]}
        />
      </View>

      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={handleSliderChange}
        minimumTrackTintColor={getBatteryColor(value)}
        maximumTrackTintColor={COLORS.border}
        thumbTintColor={getBatteryColor(value)}
      />

      <View style={styles.labels}>
        <Text style={styles.labelText}>{min}%</Text>
        <Text style={styles.labelText}>{Math.round((min + max) / 2)}%</Text>
        <Text style={styles.labelText}>{max}%</Text>
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
  valueInputInvalid: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.error,
  },
  invalidHint: {
    fontSize: 11,
    color: COLORS.error,
    marginTop: -4,
    marginBottom: 6,
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
