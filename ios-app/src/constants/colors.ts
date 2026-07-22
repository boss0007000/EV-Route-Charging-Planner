/** App-wide color palette */
export const COLORS = {
  primary: '#16A34A',      // Green-600
  primaryLight: '#22C55E', // Green-500
  primaryDark: '#15803D',  // Green-700
  background: '#F9FAFB',   // Gray-50
  surface: '#FFFFFF',
  border: '#E5E7EB',       // Gray-200
  text: '#111827',         // Gray-900
  textSecondary: '#6B7280',// Gray-500
  textMuted: '#9CA3AF',    // Gray-400
  error: '#EF4444',        // Red-500
  warning: '#F59E0B',      // Amber-500
  success: '#22C55E',      // Green-500
  info: '#3B82F6',         // Blue-500
  cardShadow: 'rgba(0,0,0,0.06)',
  overlay: 'rgba(0,0,0,0.4)',
};

/** Liquid-Glass material tokens — shared by GlassCard, the tab bar, and glass buttons. */
export const GLASS = {
  blurAmount: 22,
  // Fallback solid color for devices/OSes with Reduce Transparency on, or no blur support.
  fallbackColor: 'rgba(249,250,251,0.92)',
  tintLight: 'rgba(255,255,255,0.38)',
  tintDark: 'rgba(17,24,39,0.35)',
  border: 'rgba(255,255,255,0.55)',
  highlight: 'rgba(255,255,255,0.85)',
  // Tinted-glass primary button: a translucent version of COLORS.primary,
  // not a flat fill — this is what makes it read as "glass" rather than paint.
  primaryTint: 'rgba(22,163,74,0.72)',
  primaryBorder: 'rgba(255,255,255,0.35)',
};
