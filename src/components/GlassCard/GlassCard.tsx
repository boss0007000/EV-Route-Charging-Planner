/**
 * GlassCard — a frosted "Liquid Glass" style panel.
 *
 * Replaces the app's old opaque white card (solid COLORS.surface background
 * + flat shadow) with a translucent, blurred panel in the style of iOS 26's
 * Liquid Glass material: a live blur backdrop, a light tint so content stays
 * legible over any background, and a soft top-edge highlight that reads as
 * a specular reflection on glass.
 *
 * Any `backgroundColor` / `padding` passed in `style` is pulled out and
 * applied to the right internal layer (padding always applies to the content
 * layer, never the blurred layer, or corners would clip incorrectly).
 */
import React from 'react';
import {View, StyleSheet, StyleProp, ViewStyle, Platform} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {GLASS} from '../../constants/colors';

interface GlassCardProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** 'light' (default) reads well on this app's light background; 'dark' for on-map overlays. */
  tint?: 'light' | 'dark' | 'xlight';
  /** Blur strength, 0-100. Defaults to GLASS.blurAmount. */
  blurAmount?: number;
  testID?: string;
}

// Props that describe how this card's *own children* are arranged (padding,
// flex layout, spacing) belong on the inner content wrapper, not the outer
// container — the outer container only owns sizing/position within ITS
// parent (flex/width/margin/borderRadius) plus the absolutely-positioned
// blur/tint/highlight layers, which must never be inset by padding or they'd
// leave an unblurred gap at the card's edges.
const CONTENT_KEYS = [
  'padding', 'paddingHorizontal', 'paddingVertical',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'flexDirection', 'alignItems', 'justifyContent', 'alignContent',
  'gap', 'rowGap', 'columnGap',
] as const;

export default function GlassCard({
  style,
  children,
  tint = 'light',
  blurAmount = GLASS.blurAmount,
  testID,
}: GlassCardProps) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, unknown>;
  const contentStyle: Record<string, unknown> = {};
  const containerStyle: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) {
    if (key === 'backgroundColor') continue; // handled by the tint layer instead
    if ((CONTENT_KEYS as readonly string[]).includes(key)) {
      contentStyle[key] = flat[key];
    } else {
      containerStyle[key] = flat[key];
    }
  }

  return (
    <View style={[styles.container, containerStyle as ViewStyle]} testID={testID}>
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType={tint}
        blurAmount={blurAmount}
        reducedTransparencyFallbackColor={GLASS.fallbackColor}
      />
      <View style={[StyleSheet.absoluteFill, styles.tintLayer, tint === 'dark' && styles.tintLayerDark]} />
      <View style={styles.highlightEdge} pointerEvents="none" />
      <View style={contentStyle as ViewStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GLASS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.10,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tintLayer: {
    backgroundColor: GLASS.tintLight,
  },
  tintLayerDark: {
    backgroundColor: GLASS.tintDark,
  },
  highlightEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: GLASS.highlight,
  },
});
