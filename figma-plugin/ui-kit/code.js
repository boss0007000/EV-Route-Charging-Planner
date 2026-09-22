// ChargeRoute UI Kit
// Recreates the real app screens as native, editable Figma layers — not
// screenshots. Colors, copy, spacing and component structure are pulled
// directly from src/constants/colors.ts and the screen/component source
// (RoutePlannerScreen, ChargerMapScreen, GlassCard, GlassButton,
// BatterySlider, VehicleSelector, LocationInput, ChargerCard,
// RouteResultCard, App.tsx tab bar), as of the fix for the charger-map and
// address-formatting bugs. Run this plugin once; it builds five screens
// side by side. Everything it creates is a normal, fully editable Figma
// layer (auto-layout frames, text, shapes) — nothing is a flattened image.

// ─── Design tokens (from src/constants/colors.ts) ──────────────────────────
const COLORS = {
  primary: '#16A34A',
  primaryLight: '#22C55E',
  primaryDark: '#15803D',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',
};

const SCREEN_W = 390;
const PAD = 16;
const STATUS_H = 40;
const TAB_H = 60;
const CONTENT_W = SCREEN_W - PAD * 2; // 358
const CARD_PAD = 16;
const CARD_CONTENT_W = CONTENT_W - CARD_PAD * 2; // 326

const FW = {400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold'};

// ─── Low-level helpers ──────────────────────────────────────────────────────
function hexToRgb(h) {
  return {r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255};
}
function paint(h, a) {
  return [{type: 'SOLID', color: hexToRgb(h), opacity: a == null ? 1 : a}];
}

function txt(str, opts) {
  opts = opts || {};
  const t = figma.createText();
  t.fontName = {family: 'Inter', style: FW[opts.weight || 400]};
  t.characters = str;
  t.fontSize = opts.size || 14;
  t.fills = paint(opts.color || COLORS.text, opts.opacity);
  t.textAlignHorizontal = opts.align || 'LEFT';
  if (opts.lineHeight) t.lineHeight = {value: opts.lineHeight, unit: 'PIXELS'};
  if (opts.letterSpacing) t.letterSpacing = {value: opts.letterSpacing, unit: 'PIXELS'};
  if (opts.width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(opts.width, t.height);
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  return t;
}

// Auto-layout container. direction: 'VERTICAL' | 'HORIZONTAL'.
// wMode/hMode: 'FIXED' (needs w/h) or 'HUG' (default — sizes to content).
function box(name, opts) {
  opts = opts || {};
  const direction = opts.direction || 'VERTICAL';
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = direction;
  if (opts.wrap) f.layoutWrap = 'WRAP';
  const pad = opts.padding || [0, 0, 0, 0];
  const p = Array.isArray(pad) ? pad : [pad, pad, pad, pad];
  f.paddingTop = p[0];
  f.paddingRight = p[1];
  f.paddingBottom = p[2];
  f.paddingLeft = p[3];
  f.itemSpacing = opts.gap || 0;
  if (opts.wrap) f.counterAxisSpacing = opts.gap || 0;
  const wMode = opts.wMode || 'HUG';
  const hMode = opts.hMode || 'HUG';
  if (direction === 'HORIZONTAL') {
    f.primaryAxisSizingMode = wMode === 'HUG' ? 'AUTO' : 'FIXED';
    f.counterAxisSizingMode = hMode === 'HUG' ? 'AUTO' : 'FIXED';
  } else {
    f.primaryAxisSizingMode = hMode === 'HUG' ? 'AUTO' : 'FIXED';
    f.counterAxisSizingMode = wMode === 'HUG' ? 'AUTO' : 'FIXED';
  }
  f.resize(opts.w || 10, opts.h || 10);
  f.primaryAxisAlignItems = opts.align || 'MIN';
  f.counterAxisAlignItems = opts.crossAlign || 'MIN';
  f.fills = opts.fill ? paint(opts.fill, opts.fillOpacity) : [];
  f.cornerRadius = opts.radius || 0;
  if (opts.stroke) {
    f.strokes = paint(opts.stroke, opts.strokeOpacity);
    f.strokeWeight = opts.strokeWeight || 1;
  } else {
    f.strokes = [];
  }
  f.clipsContent = !!opts.clip;
  const effects = [];
  if (opts.blurBg) effects.push({type: 'BACKGROUND_BLUR', radius: opts.blurAmount || 20, visible: true});
  if (opts.shadow) {
    effects.push({
      type: 'DROP_SHADOW',
      color: {r: 0, g: 0, b: 0, a: opts.shadowOpacity != null ? opts.shadowOpacity : 0.1},
      offset: {x: 0, y: opts.shadowY != null ? opts.shadowY : 4},
      radius: opts.shadowRadius != null ? opts.shadowRadius : 12,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    });
  }
  if (effects.length) f.effects = effects;
  return f;
}
function col(name, opts) { return box(name, Object.assign({direction: 'VERTICAL'}, opts)); }
function row(name, opts) { return box(name, Object.assign({direction: 'HORIZONTAL'}, opts)); }

// Plain (non-auto-layout) frame for manual/absolute child positioning —
// used only where children genuinely need to overlap (map overlays, the
// battery-slider track+thumb).
function plainFrame(name, w, h, opts) {
  opts = opts || {};
  const f = figma.createFrame();
  f.name = name;
  f.resize(w, h);
  f.fills = opts.fill ? paint(opts.fill, opts.fillOpacity) : [];
  f.cornerRadius = opts.radius || 0;
  f.clipsContent = !!opts.clip;
  return f;
}
function abs(node, x, y) { node.x = x; node.y = y; return node; }

function ellipse(name, d, color, opacity) {
  const e = figma.createEllipse();
  e.name = name;
  e.resize(d, d);
  e.fills = paint(color, opacity);
  return e;
}
function rect(name, w, h, color, radius, opacity) {
  const r = figma.createRectangle();
  r.name = name;
  r.resize(w, h);
  r.fills = paint(color, opacity);
  r.cornerRadius = radius || 0;
  return r;
}

// Circular icon badge: emoji centered in a filled circle.
function iconCircle(emoji, diameter, bg, textSize) {
  const f = row('icon-badge', {w: diameter, h: diameter, wMode: 'FIXED', hMode: 'FIXED', fill: bg, radius: diameter / 2, align: 'CENTER', crossAlign: 'CENTER'});
  f.appendChild(txt(emoji, {size: textSize || Math.round(diameter * 0.5)}));
  return f;
}

function divider(width, color) {
  return rect('divider', width, 1, color || COLORS.border);
}

function batteryColorFor(pct) {
  if (pct <= 15) return COLORS.error;
  if (pct <= 30) return COLORS.warning;
  return COLORS.primary;
}
function batteryEmojiFor(pct) {
  return pct > 75 ? '🔋' : pct > 30 ? '🪫' : '🔌';
}

function connectorRow(w, pairs) {
  const r = row('connectors', {w: w, wMode: 'FIXED', hMode: 'HUG', wrap: true, gap: 6});
  pairs.forEach(function (c) {
    const b = row('conn', {padding: [4, 8, 4, 8], radius: 8, fill: COLORS.background, gap: 4, crossAlign: 'CENTER'});
    b.appendChild(txt(c[0], {size: 12, weight: 600, color: COLORS.text}));
    b.appendChild(txt(c[1], {size: 11, color: COLORS.textSecondary}));
    r.appendChild(b);
  });
  return r;
}

// ─── Composite components ───────────────────────────────────────────────────

// GlassCard approximation: translucent white + background blur + hairline
// border + soft shadow + top highlight, matching GlassCard.tsx.
function glassCard(name, opts) {
  opts = opts || {};
  return col(name, Object.assign({
    w: opts.w || CONTENT_W,
    wMode: 'FIXED',
    hMode: 'HUG',
    padding: opts.padding != null ? opts.padding : CARD_PAD,
    gap: opts.gap || 0,
    radius: opts.radius != null ? opts.radius : 16,
    fill: '#FFFFFF',
    fillOpacity: 0.72,
    blurBg: true,
    blurAmount: 22,
    stroke: '#FFFFFF',
    strokeOpacity: 0.6,
    shadow: true,
    shadowOpacity: 0.08,
    shadowY: 4,
    shadowRadius: 12,
  }, opts));
}

// GlassButton approximation: tinted glass fill + blur + top highlight.
function glassButton(name, contentRow, opts) {
  opts = opts || {};
  const b = row(name, Object.assign({
    w: opts.w || CONTENT_W,
    wMode: 'FIXED',
    hMode: 'HUG',
    padding: opts.padding || [opts.paddingV || 18, 0, opts.paddingV || 18, 0],
    radius: opts.radius != null ? opts.radius : 16,
    fill: opts.tint || COLORS.primary,
    fillOpacity: 0.86,
    blurBg: true,
    blurAmount: 18,
    stroke: '#FFFFFF',
    strokeOpacity: 0.35,
    shadow: true,
    shadowOpacity: 0.16,
    shadowY: 4,
    shadowRadius: 10,
    align: 'CENTER',
    crossAlign: 'CENTER',
  }, opts));
  b.appendChild(contentRow);
  return b;
}

// Slider visual: 8px rounded track + fill + thumb (manual positioning,
// since track/fill/thumb must overlap).
function sliderTrack(w, pct, color) {
  const h = 16;
  const f = plainFrame('slider', w, h, {});
  const bg = rect('track-bg', w, 8, COLORS.border, 4);
  abs(bg, 0, 4);
  const fillPx = Math.max(8, Math.min(w, w * (pct / 100)));
  const fg = rect('track-fill', fillPx, 8, color, 4);
  abs(fg, 0, 4);
  const thumb = ellipse('thumb', 16, color);
  thumb.strokes = paint('#FFFFFF');
  thumb.strokeWeight = 2;
  abs(thumb, Math.max(0, Math.min(w - 16, fillPx - 8)), 0);
  f.appendChild(bg);
  f.appendChild(fg);
  f.appendChild(thumb);
  return f;
}

// Full BatterySlider recreation — mirrors BatterySlider.tsx.
function batterySlider(value, min, max, hint) {
  const color = batteryColorFor(value);
  const c = col('battery-slider', {w: CARD_CONTENT_W, wMode: 'FIXED', hMode: 'HUG', gap: 8});

  const header = row('header', {gap: 8, align: 'MIN', crossAlign: 'CENTER'});
  header.appendChild(txt(batteryEmojiFor(value), {size: 22}));
  const valueRow = row('value', {gap: 2, align: 'MIN', crossAlign: 'MIN'});
  valueRow.appendChild(txt(String(Math.round(value)), {size: 28, weight: 700, color: color}));
  valueRow.appendChild(txt('%', {size: 16, weight: 600, color: color}));
  header.appendChild(valueRow);
  c.appendChild(header);

  if (hint) {
    c.appendChild(txt(hint, {size: 11, color: COLORS.textMuted, width: CARD_CONTENT_W, lineHeight: 14}));
  }

  c.appendChild(sliderTrack(CARD_CONTENT_W, ((value - min) / (max - min)) * 100, color));

  const labels = row('labels', {w: CARD_CONTENT_W, wMode: 'FIXED', hMode: 'HUG', align: 'SPACE_BETWEEN'});
  labels.appendChild(txt(min + '%', {size: 11, color: COLORS.textMuted}));
  labels.appendChild(txt(Math.round((min + max) / 2) + '%', {size: 11, color: COLORS.textMuted}));
  labels.appendChild(txt(max + '%', {size: 11, color: COLORS.textMuted}));
  c.appendChild(labels);

  return c;
}

// A pill/chip — used for filter chips, connector badges, status pills.
function pill(label, opts) {
  opts = opts || {};
  const p = row('chip', {
    padding: opts.padding || [8, 14, 8, 14],
    radius: opts.radius != null ? opts.radius : 20,
    fill: opts.fill,
    fillOpacity: opts.fillOpacity,
    stroke: opts.stroke,
    strokeWeight: opts.strokeWeight || 1.5,
    align: 'CENTER',
    crossAlign: 'CENTER',
    gap: 4,
    shadow: opts.shadow,
    shadowOpacity: 0.12,
    shadowY: 1,
    shadowRadius: 3,
  });
  p.appendChild(txt(label, {size: opts.size || 13, weight: opts.weight || 600, color: opts.color || COLORS.text}));
  return p;
}

function fieldLabel(str) {
  return txt(str, {size: 13, weight: 600, color: COLORS.text});
}

// A bordered "text field" look: icon + label subgroup on the left, an
// optional trailing icon pinned to the right via a 2-child space-between.
function inputRow(name, iconEmoji, placeholder, opts) {
  opts = opts || {};
  const left = row('left', {gap: 8, crossAlign: 'CENTER'});
  if (iconEmoji) left.appendChild(txt(iconEmoji, {size: 18}));
  left.appendChild(txt(opts.value || placeholder, {size: 15, color: opts.value ? COLORS.text : COLORS.textMuted}));

  const r = row(name, {
    w: CARD_CONTENT_W, wMode: 'FIXED', hMode: 'HUG',
    padding: [14, 12, 14, 12], radius: 12,
    fill: COLORS.surface, stroke: COLORS.border, strokeWeight: 1.5,
    crossAlign: 'CENTER', align: opts.trailingEmoji ? 'SPACE_BETWEEN' : 'MIN',
  });
  r.appendChild(left);
  if (opts.trailingEmoji) r.appendChild(txt(opts.trailingEmoji, {size: 18}));
  return r;
}

// Status bar strip (time + tiny glyphs) — decorative, over COLORS.background.
function statusBar() {
  const s = row('status-bar', {
    w: SCREEN_W, wMode: 'FIXED', h: STATUS_H, hMode: 'FIXED',
    padding: [12, 16, 0, 16], align: 'SPACE_BETWEEN', crossAlign: 'CENTER',
  });
  s.appendChild(txt('9:41', {size: 15, weight: 600, color: COLORS.text}));
  const right = row('status-icons', {gap: 4, crossAlign: 'CENTER'});
  right.appendChild(txt('📶', {size: 12}));
  right.appendChild(txt('🔋', {size: 13}));
  s.appendChild(right);
  return s;
}

// Bottom tab bar — mirrors App.tsx's Tab.Navigator styling. Two equal-width
// tabs spanning the full screen width.
function tabBar(activeLabel) {
  const bar = row('tab-bar', {
    w: SCREEN_W, wMode: 'FIXED', h: TAB_H, hMode: 'FIXED',
    padding: [8, 0, 6, 0], crossAlign: 'CENTER',
    fill: '#FFFFFF', fillOpacity: 0.55, blurBg: true, blurAmount: 24,
    stroke: '#FFFFFF', strokeOpacity: 0.55, strokeWeight: 1,
  });
  function tab(label, emoji) {
    const active = label === activeLabel;
    const t = col('tab-' + label, {w: SCREEN_W / 2, wMode: 'FIXED', hMode: 'HUG', gap: 2, align: 'CENTER', crossAlign: 'CENTER'});
    t.appendChild(txt(emoji, {size: 20, opacity: active ? 1 : 0.5}));
    t.appendChild(txt(label, {size: 12, weight: 500, color: active ? COLORS.primary : COLORS.textSecondary}));
    return t;
  }
  bar.appendChild(tab('Plan', '🗺'));
  bar.appendChild(tab('Map', '⚡'));
  return bar;
}

// Decorative map placeholder — stylized roads + charger dots, standing in
// for live Google Maps tiles (which can't be recreated as static Figma
// vectors). Real screens use react-native-maps + OpenChargeMap markers.
function mapPlaceholder(w, h) {
  const f = plainFrame('map-placeholder', w, h, {fill: '#E4EEE7', clip: true});
  const roads = [
    [-40, 60, 520, 10, -20], [30, 220, 420, 8, 12], [-60, 380, 500, 10, -8],
    [200, -40, 460, 8, 70], [40, -20, 10, 420, 0],
  ];
  roads.forEach(function (r_, i) {
    const rd = rect('road-' + i, r_[2], r_[3], '#C9D9CE', r_[3] / 2);
    rd.rotation = r_[4];
    abs(rd, r_[0], r_[1]);
    f.appendChild(rd);
  });
  const dots = [
    [60, 90], [110, 140], [95, 210], [150, 260], [210, 180], [260, 240],
    [70, 320], [180, 340], [240, 120], [300, 300], [40, 250], [130, 60],
  ];
  dots.forEach(function (d, i) {
    const outer = ellipse('charger-' + i, 16, COLORS.primaryLight, 0.9);
    abs(outer, d[0] - 8, d[1] - 8);
    const inner = ellipse('charger-dot-' + i, 6, COLORS.primaryDark);
    abs(inner, d[0] - 3, d[1] - 3);
    f.appendChild(outer);
    f.appendChild(inner);
  });
  const you = ellipse('you-are-here', 18, COLORS.info);
  you.strokes = paint('#FFFFFF');
  you.strokeWeight = 3;
  abs(you, w / 2 - 9, h / 2 - 9);
  f.appendChild(you);
  return f;
}

// A charger info card (used for both the route-result stop and the map's
// selected-station popover).
function chargerInfoCard(name, network, address, powerKw, connectors, pricing, showClose) {
  const card = glassCard(name, {gap: 10});
  if (showClose) {
    const closeRow = row('close-row', {w: CARD_CONTENT_W, wMode: 'FIXED', hMode: 'HUG', align: 'MAX'});
    closeRow.appendChild(txt('✕', {size: 16, color: COLORS.textSecondary}));
    card.appendChild(closeRow);
  }
  const head = row('head', {gap: 12, crossAlign: 'MIN'});
  head.appendChild(iconCircle('⚡', 40, COLORS.background, 20));
  const infoW = CARD_CONTENT_W - 40 - 12 - 60;
  const info = col('info', {gap: 2, hMode: 'HUG', wMode: 'FIXED', w: infoW});
  info.appendChild(txt(network, {size: 15, weight: 700, color: COLORS.text, width: infoW}));
  info.appendChild(txt(address, {size: 12, color: COLORS.textSecondary, width: infoW}));
  head.appendChild(info);
  const powerBadge = col('power', {radius: 10, padding: [4, 10, 4, 10], fill: COLORS.primaryLight, fillOpacity: 0.13, align: 'CENTER', crossAlign: 'CENTER'});
  powerBadge.appendChild(txt(String(powerKw), {size: 18, weight: 800, color: COLORS.primary}));
  powerBadge.appendChild(txt('kW', {size: 10, weight: 600, color: COLORS.primary}));
  head.appendChild(powerBadge);
  card.appendChild(head);

  card.appendChild(connectorRow(CARD_CONTENT_W, connectors));

  if (pricing) {
    card.appendChild(txt(pricing, {size: 12, color: COLORS.textSecondary, width: CARD_CONTENT_W}));
  }

  const availRow = row('avail', {gap: 6, crossAlign: 'CENTER'});
  availRow.appendChild(ellipse('dot', 8, COLORS.success));
  availRow.appendChild(txt('Live status available', {size: 12, color: COLORS.textSecondary}));
  card.appendChild(availRow);

  return card;
}

// ─── Screen builders ─────────────────────────────────────────────────────────

function screenShell(name) {
  return box(name, {direction: 'VERTICAL', w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', fill: COLORS.background, clip: true});
}

function buildPlanInputScreen() {
  const root = screenShell('01 · Plan — Input');
  root.appendChild(statusBar());

  const content = col('content', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: [PAD, PAD, PAD, PAD], gap: 12});

  const header = col('header', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', gap: 4});
  header.appendChild(txt('⚡ ChargeRoute', {size: 14, weight: 700, color: COLORS.primary}));
  header.appendChild(txt('Plan Your EV Journey', {size: 28, weight: 800, color: COLORS.text, lineHeight: 34, width: CONTENT_W}));
  header.appendChild(txt('Find the best route. Charge smart. Arrive with confidence.', {size: 14, color: COLORS.textSecondary, lineHeight: 20, width: CONTENT_W}));
  content.appendChild(header);

  const vehicleCard = glassCard('card-vehicle', {gap: 10});
  vehicleCard.appendChild(fieldLabel('Your Car'));
  const vLeft = row('v-left', {gap: 12, crossAlign: 'CENTER'});
  vLeft.appendChild(iconCircle('🚗', 36, COLORS.background, 18));
  vLeft.appendChild(txt('Select your vehicle', {size: 15, color: COLORS.textMuted}));
  const vehicleRow = row('vehicle-selector', {
    w: CARD_CONTENT_W, wMode: 'FIXED', hMode: 'HUG', padding: 14, radius: 12,
    fill: COLORS.surface, stroke: COLORS.border, strokeWeight: 1.5,
    crossAlign: 'CENTER', align: 'SPACE_BETWEEN',
  });
  vehicleRow.appendChild(vLeft);
  vehicleRow.appendChild(txt('▼', {size: 12, color: COLORS.textSecondary}));
  vehicleCard.appendChild(vehicleRow);
  content.appendChild(vehicleCard);

  const startCard = glassCard('card-start', {gap: 10});
  startCard.appendChild(fieldLabel('Starting Location'));
  startCard.appendChild(inputRow('start-input', '📍', 'Enter starting location', {trailingEmoji: '🎯'}));
  content.appendChild(startCard);

  const destCard = glassCard('card-dest', {gap: 10});
  destCard.appendChild(fieldLabel('Destination'));
  destCard.appendChild(inputRow('dest-input', '📍', 'Enter destination', {}));
  content.appendChild(destCard);

  const battCard = glassCard('card-battery', {gap: 8});
  battCard.appendChild(txt('CURRENT BATTERY', {size: 12, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.4}));
  battCard.appendChild(batterySlider(80, 0, 100, null));
  content.appendChild(battCard);

  const arrivalCard = glassCard('card-arrival', {gap: 8});
  arrivalCard.appendChild(txt('ARRIVAL BATTERY TARGET', {size: 12, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.4}));
  arrivalCard.appendChild(batterySlider(15, 5, 30, 'Minimum battery before ChargeRoute schedules a stop'));
  content.appendChild(arrivalCard);

  const chargeCard = glassCard('card-charge-to', {gap: 8});
  chargeCard.appendChild(txt('CHARGE TO TARGET', {size: 12, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.4}));
  chargeCard.appendChild(batterySlider(80, 50, 100, 'Battery level you charge back up to at each stop'));
  content.appendChild(chargeCard);

  const rangeCard = glassCard('card-range', {gap: 4});
  rangeCard.appendChild(txt('ESTIMATED RANGE', {size: 12, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.4}));
  const rangeRow = row('range-row', {gap: 6, crossAlign: 'BASELINE'});
  rangeRow.appendChild(txt('🛣', {size: 18}));
  rangeRow.appendChild(txt('295', {size: 24, weight: 700, color: COLORS.text}));
  rangeRow.appendChild(txt('km', {size: 12, color: COLORS.textSecondary}));
  rangeCard.appendChild(rangeRow);
  rangeCard.appendChild(txt('Auto-calculated', {size: 11, color: COLORS.textMuted}));
  content.appendChild(rangeCard);

  const effCard = glassCard('card-efficiency', {gap: 4});
  effCard.appendChild(txt('EFFICIENCY', {size: 12, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.4}));
  const effRow = row('eff-row', {gap: 6, crossAlign: 'BASELINE'});
  effRow.appendChild(txt('⚡', {size: 18}));
  effRow.appendChild(txt('156', {size: 24, weight: 700, color: COLORS.text}));
  effCard.appendChild(effRow);
  effCard.appendChild(txt('Wh/km', {size: 12, color: COLORS.textSecondary}));
  effCard.appendChild(txt('Enter your real-world efficiency', {size: 11, color: COLORS.textMuted}));
  content.appendChild(effCard);

  const btnContent = row('btn-content', {gap: 8, crossAlign: 'CENTER'});
  btnContent.appendChild(txt('➤', {size: 16, color: '#FFFFFF'}));
  btnContent.appendChild(txt('Calculate Route', {size: 17, weight: 700, color: '#FFFFFF'}));
  content.appendChild(glassButton('btn-calculate', btnContent, {w: CONTENT_W, radius: 16, paddingV: 18}));

  root.appendChild(content);
  root.appendChild(tabBar('Plan'));
  return root;
}

function buildPlanResultScreen() {
  const root = screenShell('02 · Plan — Result');
  root.appendChild(statusBar());
  root.appendChild(mapPlaceholder(SCREEN_W, 220));

  const content = col('content', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: [PAD, PAD, PAD, PAD], gap: 16});

  const headerCol = col('result-header', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', gap: 12});
  headerCol.appendChild(txt('← Back', {size: 15, weight: 600, color: COLORS.primary}));
  const badgeW = Math.floor((CONTENT_W - 10 * 2) / 3);
  const badges = row('summary-badges', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', gap: 10});
  [['360 km', 'Total'], ['4h 36m', 'Est. time'], ['1', 'Stops']].forEach(function (b) {
    const card = glassCard('badge', {w: badgeW, radius: 12, padding: 12, gap: 2, align: 'CENTER', crossAlign: 'CENTER'});
    card.appendChild(txt(b[0], {size: 16, weight: 800, color: COLORS.text}));
    card.appendChild(txt(b[1], {size: 11, color: COLORS.textSecondary}));
    badges.appendChild(card);
  });
  headerCol.appendChild(badges);
  content.appendChild(headerCol);

  content.appendChild(txt('Journey Legs', {size: 16, weight: 700, color: COLORS.text}));

  function legCard(step, to, from, distance, duration, arrivalPct) {
    const BAR_W = 4, innerPad = 14, gapHead = 10, badgeD = 28;
    const innerW = CONTENT_W - BAR_W;
    const innerContentW = innerW - innerPad * 2;
    const infoW = innerContentW - badgeD - gapHead;

    const inner = col('leg-content', {hMode: 'HUG', wMode: 'FIXED', w: innerW, padding: innerPad, gap: 10});

    const head = row('leg-head', {gap: gapHead, crossAlign: 'CENTER'});
    const badge = row('step-badge', {w: badgeD, h: badgeD, wMode: 'FIXED', hMode: 'FIXED', radius: badgeD / 2, fill: COLORS.primary, align: 'CENTER', crossAlign: 'CENTER'});
    badge.appendChild(txt(String(step), {size: 13, weight: 700, color: '#FFFFFF'}));
    head.appendChild(badge);
    const info = col('leg-info', {gap: 1, hMode: 'HUG', wMode: 'FIXED', w: infoW});
    info.appendChild(txt('→ ' + to, {size: 14, weight: 700, color: COLORS.text, width: infoW}));
    info.appendChild(txt('from ' + from, {size: 12, color: COLORS.textSecondary, width: infoW}));
    head.appendChild(info);
    inner.appendChild(head);

    const statsRow_ = row('leg-stats', {w: innerContentW, wMode: 'FIXED', hMode: 'HUG', crossAlign: 'CENTER', align: 'SPACE_BETWEEN'});
    function stat(icon, val, color) {
      const s = row('stat', {gap: 4, crossAlign: 'BASELINE'});
      s.appendChild(txt(icon, {size: 13}));
      s.appendChild(txt(val, {size: 13, weight: 600, color: color || COLORS.text}));
      return s;
    }
    const arrColor = arrivalPct <= 15 ? COLORS.error : arrivalPct <= 30 ? COLORS.warning : COLORS.primary;
    statsRow_.appendChild(stat('📏', distance));
    statsRow_.appendChild(stat('⏱', duration));
    statsRow_.appendChild(stat('🔋', arrivalPct + '% on arrival', arrColor));
    inner.appendChild(statsRow_);

    // Inner's hug height is now resolved — give the left accent bar the
    // same height so it spans the full card.
    const bar = rect('bar', BAR_W, inner.height, COLORS.primary);

    const outer = row('leg-' + step, {
      w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', radius: 14, clip: true,
      fill: '#FFFFFF', fillOpacity: 0.72, blurBg: true, blurAmount: 22,
      stroke: '#FFFFFF', strokeOpacity: 0.6, shadow: true, shadowOpacity: 0.08, shadowY: 4, shadowRadius: 12,
    });
    outer.appendChild(bar);
    outer.appendChild(inner);
    return outer;
  }

  content.appendChild(legCard(1, 'A74M Jct 16, Johnstonebridge, Lockerbie, Dumfriesshire, DG11 1HD', 'Manchester Airport (MAN), Manchester, UK', '219 km', '2h 33m', 27));
  content.appendChild(legCard(2, 'Edinburgh, UK', 'Charging Stop 1', '142 km', '1h 39m', 45));

  content.appendChild(txt('Charging Stops', {size: 16, weight: 700, color: COLORS.text}));

  const chargerCard = chargerInfoCard(
    'charger-card',
    'Roadchef Annandale Water Services',
    'A74M Jct 16, Johnstonebridge, Lockerbie, Dumfriesshire, DG11 1HD',
    350,
    [['CCS2', '40kW'], ['Type 2', '22kW'], ['CHAdeMO', '40kW'], ['CCS2', '350kW'], ['CCS2', '350kW'], ['CCS2', '350kW'], ['CHAdeMO', '100kW'], ['CHAdeMO', '100kW'], ['CHAdeMO', '100kW']],
    'DC (contactless): £0.85/kWh, DC (GRIDSERVE app): £0.79/kWh, AC: £0.49/kWh',
    false,
  );
  chargerCard.appendChild(divider(CARD_CONTENT_W));
  const detailRow = row('detail-row', {w: CARD_CONTENT_W, wMode: 'FIXED', hMode: 'HUG', crossAlign: 'CENTER', align: 'SPACE_BETWEEN'});
  function detail(label, value, color) {
    const d = col('detail', {gap: 2, crossAlign: 'CENTER'});
    d.appendChild(txt(label, {size: 11, color: COLORS.textSecondary}));
    d.appendChild(txt(value, {size: 15, weight: 700, color: color || COLORS.text}));
    return d;
  }
  detailRow.appendChild(detail('Arrive at', '27%'));
  detailRow.appendChild(txt('→', {size: 16, color: COLORS.textMuted}));
  detailRow.appendChild(detail('Depart at', '80%'));
  detailRow.appendChild(detail('Charge time', '~24 min', COLORS.primary));
  chargerCard.appendChild(detailRow);
  content.appendChild(chargerCard);

  const mapsBtnContent = row('maps-btn-content', {gap: 10, crossAlign: 'CENTER'});
  mapsBtnContent.appendChild(txt('🗺', {size: 18}));
  mapsBtnContent.appendChild(txt('Open in Google Maps', {size: 16, weight: 700, color: '#FFFFFF'}));
  content.appendChild(glassButton('btn-maps', mapsBtnContent, {w: CONTENT_W, radius: 14, paddingV: 16}));

  root.appendChild(content);
  root.appendChild(tabBar('Plan'));
  return root;
}

function buildMapScreen() {
  const SCREEN_H = 844;
  const root = plainFrame('03 · Charger Map', SCREEN_W, SCREEN_H, {fill: COLORS.background, clip: true});

  const mapArea = mapPlaceholder(SCREEN_W, SCREEN_H - TAB_H);
  abs(mapArea, 0, 0);
  root.appendChild(mapArea);

  // Overlay: status bar, top pills, locate FAB and station card — all
  // absolutely positioned over the map, matching ChargerMapScreen's
  // absolute-positioned topBar/locateFab/stationCard (which measure from
  // the full screen height, not the area above the tab bar — the
  // translucent tab bar floats on top and doesn't shrink this coordinate
  // space). clipsContent is left false so nothing near the bottom edge
  // gets cut off.
  const overlay = plainFrame('overlay', SCREEN_W, SCREEN_H, {});
  abs(overlay, 0, 0);

  const sb = statusBar();
  abs(sb, 0, 0);
  overlay.appendChild(sb);

  const topBar = row('top-bar', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: [8, 16, 8, 16], align: 'SPACE_BETWEEN', crossAlign: 'CENTER'});
  topBar.appendChild(pill('118 chargers', {fill: '#FFFFFF', fillOpacity: 0.95, shadow: true}));
  topBar.appendChild(pill('⚙ Filters', {fill: '#FFFFFF', fillOpacity: 0.95, shadow: true}));
  abs(topBar, 0, STATUS_H);
  overlay.appendChild(topBar);

  const fab = row('locate-fab', {w: 48, h: 48, wMode: 'FIXED', hMode: 'FIXED', radius: 24, fill: COLORS.surface, align: 'CENTER', crossAlign: 'CENTER', shadow: true, shadowOpacity: 0.15, shadowY: 2, shadowRadius: 4});
  fab.appendChild(txt('📍', {size: 22}));
  abs(fab, SCREEN_W - 16 - 48, SCREEN_H - 100 - 48);
  overlay.appendChild(fab);

  const stationCard = chargerInfoCard(
    'station-card',
    'GRIDSERVE Electric Forecourt',
    'Extra, Rugby Road, Norton, CV22 6NP',
    350,
    [['CCS2', '350kW'], ['CCS2', '350kW'], ['Type 2', '22kW']],
    null,
    true,
  );
  stationCard.resize(SCREEN_W - 32, stationCard.height);
  abs(stationCard, 16, SCREEN_H - 80 - stationCard.height);
  overlay.appendChild(stationCard);

  root.appendChild(overlay);

  const tb = tabBar('Map');
  abs(tb, 0, SCREEN_H - TAB_H);
  root.appendChild(tb);

  return root;
}

function buildVehiclePickerScreen() {
  const root = box('04 · Vehicle Picker', {direction: 'VERTICAL', w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', fill: COLORS.background, clip: true});

  const header = row('modal-header', {
    w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: [56, 20, 20, 20],
    align: 'SPACE_BETWEEN', crossAlign: 'CENTER', fill: COLORS.surface,
    stroke: COLORS.border, strokeWeight: 1,
  });
  header.appendChild(txt('Select Vehicle', {size: 18, weight: 700, color: COLORS.text}));
  header.appendChild(txt('✕', {size: 18, color: COLORS.textSecondary}));
  root.appendChild(header);

  const searchWrap = box('search-wrap', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: 16, fill: COLORS.background});
  const search = row('search-input', {
    w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', padding: 12, radius: 10,
    fill: COLORS.surface, stroke: COLORS.border, strokeWeight: 1.5, crossAlign: 'CENTER',
  });
  search.appendChild(txt('Search manufacturer or model…', {size: 15, color: COLORS.textMuted}));
  searchWrap.appendChild(search);
  root.appendChild(searchWrap);

  const list = col('vehicle-list', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG'});
  const vehicles = [
    ['Audi (Volkswagen Group) Q4 e-tron', '45 / Sportback / 55 quattro · 2024 · 77 kWh'],
    ['Audi (Volkswagen Group) Q8 e-tron', '2024 · 89 kWh'],
    ['BMW i3', '120 Ah (final/largest-battery spec) · 2013 · 37.9 kWh'],
    ['BMW i4', 'eDrive35 / eDrive40 / M60 · 2023 · 63.9 kWh'],
    ['BMW iX3', 'Gen2 40/50 xDrive · 2026 · 108.7 kWh'],
  ];
  const infoW = CONTENT_W - 32 - 12;
  vehicles.forEach(function (v, i) {
    const item = row('vehicle-item', {
      w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: [14, 16, 14, 16],
      gap: 12, crossAlign: 'CENTER', fill: COLORS.surface,
    });
    item.appendChild(iconCircle('🚗', 32, COLORS.background, 16));
    const info = col('vehicle-info', {gap: 2, hMode: 'HUG', wMode: 'FIXED', w: infoW});
    info.appendChild(txt(v[0], {size: 15, weight: 600, color: COLORS.text, width: infoW}));
    info.appendChild(txt(v[1], {size: 12, color: COLORS.textSecondary, width: infoW}));
    item.appendChild(info);
    list.appendChild(item);
    if (i < vehicles.length - 1) {
      const sep = row('sep-wrap', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: [0, 0, 0, 60]});
      sep.appendChild(divider(SCREEN_W - 60));
      list.appendChild(sep);
    }
  });
  root.appendChild(list);

  return root;
}

function buildFilterSheetScreen() {
  const SCREEN_H = 844;
  const root = box('05 · Filter Chargers', {
    direction: 'VERTICAL', w: SCREEN_W, wMode: 'FIXED', h: SCREEN_H, hMode: 'FIXED',
    fill: '#000000', fillOpacity: 0.4, clip: true, align: 'MAX', crossAlign: 'MIN',
  });

  const sheet = col('filter-sheet', {w: SCREEN_W, wMode: 'FIXED', hMode: 'HUG', padding: 20, gap: 4, fill: COLORS.surface});
  sheet.topLeftRadius = 24;
  sheet.topRightRadius = 24;

  const head = row('filter-head', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', align: 'SPACE_BETWEEN', crossAlign: 'CENTER'});
  head.appendChild(txt('Filter Chargers', {size: 18, weight: 700, color: COLORS.text}));
  head.appendChild(txt('Done', {size: 16, weight: 600, color: COLORS.primary}));
  sheet.appendChild(head);
  sheet.appendChild(box('spacer1', {w: 1, h: 8, wMode: 'FIXED', hMode: 'FIXED'}));

  sheet.appendChild(txt('CONNECTOR TYPE', {size: 13, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.5}));
  const connGrid = row('conn-grid', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', wrap: true, gap: 8});
  ['CCS2', 'CCS1', 'GB/T', 'NACS', 'CHAdeMO', 'Type2', 'Type1'].forEach(function (c) {
    connGrid.appendChild(pill(c, {stroke: COLORS.border, fill: COLORS.surface, fillOpacity: 1}));
  });
  sheet.appendChild(connGrid);

  sheet.appendChild(box('spacer2', {w: 1, h: 4, wMode: 'FIXED', hMode: 'FIXED'}));
  sheet.appendChild(txt('MINIMUM POWER (KW)', {size: 13, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.5}));
  const powerRow = row('power-row', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', wrap: true, gap: 8});
  ['Any', '22+', '50+', '100+', '150+', '250+'].forEach(function (p, i) {
    if (i === 0) {
      powerRow.appendChild(pill(p, {fill: COLORS.primary, fillOpacity: 1, stroke: COLORS.primary, color: '#FFFFFF'}));
    } else {
      powerRow.appendChild(pill(p, {stroke: COLORS.border}));
    }
  });
  sheet.appendChild(powerRow);

  sheet.appendChild(box('spacer3', {w: 1, h: 4, wMode: 'FIXED', hMode: 'FIXED'}));
  sheet.appendChild(txt('NETWORK OPERATOR (OPTIONAL)', {size: 13, weight: 600, color: COLORS.textSecondary, letterSpacing: 0.5}));
  const netInput = row('net-input', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', padding: [10, 12, 10, 12], radius: 10, stroke: COLORS.border, strokeWeight: 1.5, fill: COLORS.background});
  netInput.appendChild(txt('e.g. Tesla, Ionity…', {size: 14, color: COLORS.textMuted}));
  sheet.appendChild(netInput);

  const resetWrap = row('reset-wrap', {w: CONTENT_W, wMode: 'FIXED', hMode: 'HUG', align: 'CENTER', padding: [16, 0, 8, 0]});
  resetWrap.appendChild(pill('Reset Filters', {stroke: COLORS.border, color: COLORS.textSecondary, padding: [10, 24, 10, 24]}));
  sheet.appendChild(resetWrap);

  root.appendChild(sheet);
  return root;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  await Promise.all(
    ['Regular', 'Medium', 'Semi Bold', 'Bold', 'Extra Bold'].map(function (style) {
      return figma.loadFontAsync({family: 'Inter', style: style});
    }),
  );

  const screens = [
    buildPlanInputScreen(),
    buildPlanResultScreen(),
    buildMapScreen(),
    buildVehiclePickerScreen(),
    buildFilterSheetScreen(),
  ];

  let x = 0;
  screens.forEach(function (s) {
    s.x = x;
    s.y = 0;
    figma.currentPage.appendChild(s);
    x += s.width + 140;
  });

  const title = txt('ChargeRoute — UI Kit (recreated from app source, editable)', {size: 20, weight: 700, color: COLORS.text});
  title.x = 0;
  title.y = -50;
  figma.currentPage.appendChild(title);

  figma.viewport.scrollAndZoomIntoView(screens);
  figma.notify('Built ' + screens.length + ' ChargeRoute screens');
  figma.closePlugin();
}

main().catch(function (err) {
  console.error(err);
  figma.notify('ChargeRoute UI Kit error: ' + (err && err.message ? err.message : String(err)));
  figma.closePlugin();
});
