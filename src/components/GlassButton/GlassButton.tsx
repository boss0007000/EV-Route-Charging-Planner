/**
 * GlassButton — a tinted "Liquid Glass" primary button.
 *
 * iOS 26's Liquid Glass buttons aren't flat-filled color; they're a blurred,
 * translucent tint over whatever sits behind them, with a bright top-edge
 * highlight. This mirrors that: BlurView + a semi-transparent color tint
 * (rather than an opaque fill) + a subtle highlight border.
 */
import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {GLASS} from '../../constants/colors';

interface GlassButtonProps {
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Translucent tint color, e.g. GLASS.primaryTint. Defaults to the primary green glass tint. */
  tintColor?: string;
  testID?: string;
}

export default function GlassButton({
  onPress,
  disabled,
  style,
  children,
  tintColor = GLASS.primaryTint,
  testID,
}: GlassButtonProps) {
  const flat = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const {backgroundColor: _ignored, ...outerStyle} = flat;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.container, outerStyle, disabled && styles.disabled]}
      testID={testID}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="light"
        blurAmount={18}
        reducedTransparencyFallbackColor={GLASS.fallbackColor}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: disabled ? GLASS.tintDark : tintColor},
        ]}
      />
      <View style={styles.highlightEdge} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.primaryBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.16,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  disabled: {
    opacity: 0.6,
  },
  highlightEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GLASS.highlight,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
