// ChargeRoute Ad Builder: builds ad frames (feed 1080x1350, story 1080x1920,
// landscape 1200x628) from real app screenshots, using the app's exact palette.
const C = { primaryLight: '#22C55E', primaryDark: '#15803D' };
const hex = h => ({ r: parseInt(h.slice(1, 3), 16) / 255, g: parseInt(h.slice(3, 5), 16) / 255, b: parseInt(h.slice(5, 7), 16) / 255 });
const solid = h => [{ type: 'SOLID', color: hex(h) }];
const FORMATS = [
  { name: 'Feed 1080x1350', w: 1080, h: 1350, layout: 'portrait' },
  { name: 'Story 1080x1920', w: 1080, h: 1920, layout: 'portrait' },
  { name: 'Landscape 1200x628', w: 1200, h: 628, layout: 'landscape' },
];
const PHONE_RATIO = 2400 / 1080; // screenshots are 1080x2400

function text(str, size, style, color, width) {
  const t = figma.createText();
  t.fontName = { family: 'Inter', style };
  t.fontSize = size;
  t.characters = str;
  t.fills = solid(color);
  t.textAutoResize = 'HEIGHT';
  t.resize(width, t.height);
  return t;
}

function phone(image, w) {
  const h = Math.round(w * PHONE_RATIO);
  const bezel = Math.round(w * 0.035);
  const outer = figma.createFrame();
  outer.name = 'Phone';
  outer.resize(w + bezel * 2, h + bezel * 2);
  outer.cornerRadius = Math.round(w * 0.14);
  outer.fills = solid('#0B0F14');
  outer.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.28 }, offset: { x: 0, y: 24 }, radius: 48, spread: 0, visible: true, blendMode: 'NORMAL' }];
  outer.clipsContent = true;
  const screen = figma.createRectangle();
  screen.name = 'Screenshot';
  screen.resize(w, h);
  screen.x = bezel;
  screen.y = bezel;
  screen.cornerRadius = Math.round(w * 0.11);
  screen.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
  outer.appendChild(screen);
  return outer;
}

function buildAd(fmt, shot, head, cta) {
  const f = figma.createFrame();
  f.name = fmt.name + ' - ' + shot.name;
  f.resize(fmt.w, fmt.h);
  f.clipsContent = true;
  f.fills = [{
    type: 'GRADIENT_LINEAR',
    gradientTransform: [[0, 1, 0], [-1, 0, 1]],
    gradientStops: [
      { position: 0, color: Object.assign({ a: 1 }, hex(C.primaryLight)) },
      { position: 1, color: Object.assign({ a: 1 }, hex(C.primaryDark)) },
    ],
  }];

  const pad = Math.round(fmt.w * 0.07);
  const image = figma.createImage(shot.bytes);
  const portrait = fmt.layout === 'portrait';
  const brand = text('ChargeRoute', portrait ? 40 : 28, 'Bold', '#FFFFFF', fmt.w * 0.6);
  brand.x = pad;
  brand.y = pad;

  if (portrait) {
    const headline = text(head, 72, 'Bold', '#FFFFFF', fmt.w - pad * 2);
    headline.x = pad;
    headline.y = pad + 80;
    const ph = phone(image, Math.round(fmt.w * 0.52));
    ph.x = Math.round((fmt.w - ph.width) / 2);
    ph.y = Math.round(headline.y + headline.height + 50);
    f.appendChild(ph); // phone bleeds off the bottom edge on purpose
    const pill = figma.createFrame();
    pill.name = 'CTA';
    pill.layoutMode = 'HORIZONTAL';
    pill.primaryAxisSizingMode = 'AUTO';
    pill.counterAxisSizingMode = 'AUTO';
    pill.paddingLeft = pill.paddingRight = 36;
    pill.paddingTop = pill.paddingBottom = 20;
    pill.cornerRadius = 999;
    pill.fills = solid('#FFFFFF');
    const label = text(cta, 32, 'Bold', C.primaryDark, 600);
    label.textAutoResize = 'WIDTH_AND_HEIGHT';
    pill.appendChild(label);
    f.appendChild(pill);
    pill.x = pad;
    pill.y = fmt.h - pill.height - pad;
    f.appendChild(headline);
  } else {
    const headline = text(head, 46, 'Bold', '#FFFFFF', fmt.w * 0.5);
    headline.x = pad;
    headline.y = 140;
    const ph = phone(image, 250);
    ph.x = fmt.w - ph.width - pad;
    ph.y = 60;
    f.appendChild(ph);
    const label = text(cta, 26, 'Bold', '#FFFFFF', fmt.w * 0.5);
    label.x = pad;
    label.y = fmt.h - pad - 40;
    f.appendChild(label);
    f.appendChild(headline);
  }
  f.appendChild(brand);
  return f;
}

figma.showUI(__html__, { width: 340, height: 520 });
figma.ui.onmessage = async msg => {
  if (msg.type !== 'build') return;
  await Promise.all(['Regular', 'Bold'].map(s => figma.loadFontAsync({ family: 'Inter', style: s })));
  const created = [];
  let y = 0;
  for (const fmt of FORMATS) {
    let x = 0;
    for (let i = 0; i < msg.shots.length; i++) {
      const head = msg.heads[i] || msg.heads[msg.heads.length - 1] || '';
      const ad = buildAd(fmt, msg.shots[i], head, msg.cta);
      ad.x = x;
      ad.y = y;
      figma.currentPage.appendChild(ad);
      created.push(ad);
      x += fmt.w + 80;
    }
    y += fmt.h + 160;
  }
  figma.viewport.scrollAndZoomIntoView(created);
  figma.notify('Created ' + created.length + ' ad frames');
  figma.closePlugin();
};
