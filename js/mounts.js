// Alle Reittiere teilen dieselbe Spielfigur. Hier wird nur ihr Aussehen gezeichnet.
export const MOUNTS = Object.freeze([
  { id: 'haflinger', label: 'Haflinger' },
  { id: 'islaender', label: 'Isländer' },
  { id: 'friese', label: 'Friese' },
  { id: 'kaltblut', label: 'Kaltblut' },
  { id: 'lusitano', label: 'Lusitano' },
  { id: 'fahrrad', label: 'Fahrrad' },
  { id: 'bobcat', label: 'Bobcat-Bagger' },
  { id: 'traktor', label: 'John-Deere-Traktor' },
]);
export const defaultMount = 'haflinger';
export const normalizeMount = id => MOUNTS.some(m => m.id === id) ? id : defaultMount;
export const mountLabel = id => MOUNTS.find(m => m.id === normalizeMount(id)).label;

const TAU = Math.PI * 2;
const INK = '#292631';
const SKIN = '#ffd9b3';

function shape(ctx, fill, draw, stroke = INK, width = 1) {
  ctx.beginPath();
  draw();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function oval(ctx, x, y, rx, ry, fill, stroke = null, angle = 0) {
  shape(ctx, fill, () => ctx.ellipse(x, y, rx, ry, angle, 0, TAU), stroke);
}
function line(ctx, color, width, points) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  points(ctx);
  ctx.stroke();
}
function box(ctx, x, y, w, h, color, radius = 2, stroke = INK) {
  shape(ctx, color, () => {
    ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }, stroke);
}

// Sitz und Kopf bleiben bei jedem Fahrzeug in der Spielerfarbe gut sichtbar.
function rider(ctx, c, t, { x = -1, seat = -40, handX = 14, handY = -46, legs = true, lean = 0 } = {}) {
  if (legs) {
    line(ctx, '#353548', 5, p => { p.moveTo(x, seat); p.lineTo(x + 5, seat + 12); });
    box(ctx, x + 3, seat + 10, 7, 4, '#20212b', 1, null);
  }
  shape(ctx, c.shirt, () => {
    ctx.moveTo(x - 6, seat); ctx.lineTo(x - 4 + lean, seat - 18);
    ctx.lineTo(x + 5 + lean, seat - 18); ctx.lineTo(x + 6, seat); ctx.closePath();
  }, null);
  line(ctx, c.shirt, 4, p => { p.moveTo(x + 1 + lean, seat - 15); p.lineTo(handX, handY); });
  oval(ctx, handX, handY, 2.6, 2.6, SKIN);
  const hx = x + 1 + lean, hy = seat - 24;
  line(ctx, c.hair, 5, p => {
    p.moveTo(hx - 5, hy); p.quadraticCurveTo(hx - 12, hy + 2, hx - 16, hy + 12 + Math.sin(t * 12) * 2);
  });
  oval(ctx, hx, hy, 7, 7, SKIN);
  shape(ctx, c.helmet, () => ctx.arc(hx, hy - 2, 7.6, Math.PI, 0), null);
  box(ctx, hx, hy - 3, 10, 2.5, c.helmet, 1, null);
  oval(ctx, hx + 3.5, hy + 1, 1.2, 1.2, '#222');
}

const HORSES = {
  haflinger: { coat: '#cd8d43', light: '#e3ab61', mane: '#fff0bb', leg: '#9f6535', body: 21, thick: 5, neck: 0, seat: -40 },
  islaender: { coat: '#b9a17b', light: '#d3bb94', mane: '#45352b', leg: '#76604a', body: 22, thick: 6, neck: 5, seat: -36 },
  friese: { coat: '#292d38', light: '#444957', mane: '#141722', leg: '#1c202a', body: 22, thick: 6, neck: -1, seat: -41 },
  kaltblut: { coat: '#83513b', light: '#a57550', mane: '#34251e', leg: '#623f32', body: 24, thick: 8, neck: -1, seat: -41 },
  lusitano: { coat: '#e5e7ea', light: '#faf9f4', mane: '#b8beca', leg: '#a6afbc', body: 21, thick: 4.5, neck: -3, seat: -40 },
};

function horse(ctx, id, o, c) {
  const h = HORSES[id], t = o.anim || 0, moving = Math.abs(o.vx || 0) > 20;
  const pony = id === 'islaender', draft = id === 'kaltblut', friese = id === 'friese';
  const ny = h.neck, bodyY = pony ? -25 : -28;
  // Vier Beine bewegen sich diagonal; die gemeinsame Bodenlinie bleibt y = 0.
  for (const [i, hx] of [-13, 10, -9, 15].entries()) {
    const phase = i % 2 ? Math.PI : 0;
    const a = !o.onGround ? (hx > 0 ? -0.7 : 0.7) : moving ? Math.sin(t * 16 + phase + (i > 1 ? 0.7 : 0)) * 0.58 : 0;
    const len = pony ? 18 : 21;
    const ex = hx + Math.sin(a) * len, ey = bodyY + 6 + Math.cos(a) * len;
    line(ctx, h.leg, h.thick, p => { p.moveTo(hx, bodyY + 5); p.lineTo(ex, ey - 2); });
    if (draft || friese) {
      shape(ctx, draft ? '#f9edda' : '#76808d', () => {
        ctx.moveTo(ex - h.thick / 2, ey - 9); ctx.lineTo(ex + h.thick / 2, ey - 9);
        ctx.lineTo(ex + h.thick / 2 + 3, ey - 1); ctx.lineTo(ex + 1, ey - 2);
        ctx.lineTo(ex - 2, ey); ctx.lineTo(ex - h.thick / 2 - 3, ey - 1); ctx.closePath();
      }, null);
    }
    box(ctx, ex - h.thick / 2 - 1, ey - 3, h.thick + 2, 4, '#25232a', 1, null);
  }
  // Langer Schweif mit einzelnen Strähnen, beim Isländer besonders dicht.
  line(ctx, h.mane, pony ? 9 : friese ? 8 : 6, p => {
    p.moveTo(-h.body + 2, bodyY - 3);
    p.bezierCurveTo(-30, bodyY - 7, -28, -17, -34 + Math.sin(t * 9) * 2, -10);
  });
  if (friese || pony) line(ctx, friese ? '#373b49' : '#6b5140', 1.5, p => {
    p.moveTo(-25, bodyY - 2); p.bezierCurveTo(-34, -20, -26, -16, -34, -9);
  });
  oval(ctx, 0, bodyY, h.body, draft ? 13 : 11, h.coat, INK);
  oval(ctx, -5, bodyY - 3, h.body - 6, 6, h.light);
  // Ein eigener geschwungener Hals macht den Lusitano auch in klein erkennbar.
  shape(ctx, h.coat, () => {
    ctx.moveTo(8, bodyY - 3);
    if (id === 'lusitano') {
      ctx.bezierCurveTo(11, -48, 9, -58, 23, -56);
      ctx.lineTo(28, -49); ctx.bezierCurveTo(21, -48, 23, -31, 17, -24);
    } else {
      ctx.lineTo(17, -52 + ny); ctx.quadraticCurveTo(24, -57 + ny, 28, -48 + ny);
      ctx.lineTo(21, bodyY + 3);
    }
    ctx.closePath();
  });
  if (id === 'lusitano') {
    for (const [x, y, r] of [[-15, -29, 2.4], [-8, -23, 2], [-2, -30, 2.8], [5, -23, 2.2], [10, -32, 2], [-10, -33, 1.7]]) {
      oval(ctx, x, y, r, r * 0.8, '#b7c0cc');
      oval(ctx, x - 0.5, y - 0.6, r * 0.45, r * 0.4, '#d9dee5');
    }
  }
  const headY = -48 + ny;
  oval(ctx, 29, headY + 2, draft ? 12 : 10, draft ? 7 : 6, h.coat, INK, 0.38);
  // Kleine Ohren, helle Schnauze und ein weißer Stirnstreifen beim Kaltblut.
  shape(ctx, h.coat, () => { ctx.moveTo(19, headY - 5); ctx.lineTo(20, headY - 14); ctx.lineTo(25, headY - 5); ctx.closePath(); });
  oval(ctx, 35, headY + 5, 4.5, 3.8, pony ? '#d6c6a6' : id === 'lusitano' ? '#c8c6c9' : draft ? '#d9b9a0' : '#e3b47b');
  if (draft) shape(ctx, '#fff5df', () => {
    ctx.moveTo(25, headY - 5); ctx.lineTo(30, headY - 3); ctx.lineTo(35, headY + 8);
    ctx.lineTo(31, headY + 8); ctx.lineTo(26, headY); ctx.closePath();
  }, null);
  oval(ctx, 26, headY - 2, 1.8, 1.8, '#111');
  oval(ctx, 26.5, headY - 2.5, 0.5, 0.5, '#fff');
  oval(ctx, 37, headY + 4, 1.1, 1.1, '#37313a');
  // Mähne: helle Haflinger-Strähnen, dichter Pony-Schopf und lange Friesen-Wellen.
  line(ctx, h.mane, pony ? 9 : friese ? 7 : 5, p => {
    p.moveTo(19, -54 + ny); p.quadraticCurveTo(10, -44 + ny, 10, bodyY - 3);
  });
  for (let i = 0; i < (friese || pony ? 5 : 3); i++) {
    const py = -53 + ny + i * 4;
    line(ctx, h.mane, pony ? 4 : 3, p => {
      p.moveTo(19 - i * 1.1, py);
      p.quadraticCurveTo(8 - i * 1.2, py + 1, (friese ? 5 : 10) - i, py + (friese ? 12 : 7));
    });
  }
  line(ctx, h.mane, 5, p => { p.moveTo(21, headY - 8); p.quadraticCurveTo(28, headY - 10, 29, headY - 2); });
  if (o.power >= 1) {
    // Der Stern färbt nur die Spitzen; Fell und Reittier bleiben erkennbar.
    for (let i = 0; i < 4; i++) {
      shape(ctx, i % 2 ? '#ffd23f' : '#ff7a1a', () => {
        const y = -49 + ny + i * 5;
        ctx.moveTo(13, y); ctx.lineTo(6 - Math.sin(t * 20 + i) * 2, y - 4); ctx.lineTo(11, y + 4); ctx.closePath();
      }, null);
    }
  }
  box(ctx, -10, h.seat + 3, 20, 7, c.shirt, 2, null);
  box(ctx, -9, h.seat, 17, 5, '#653b26', 2, null);
  line(ctx, '#493729', 1.2, p => { p.moveTo(14, h.seat - 6); p.lineTo(33, headY + 4); });
  rider(ctx, c, t, { seat: h.seat, handY: h.seat - 6 });
}

function wheel(ctx, x, y, r, rim, t, spokes = false) {
  oval(ctx, x, y, r, r, '#25272c', INK);
  oval(ctx, x, y, r * 0.67, r * 0.67, rim);
  ctx.save(); ctx.translate(x, y); ctx.rotate(t);
  for (let i = 0; i < (spokes ? 8 : 6); i++) {
    const a = i * TAU / (spokes ? 8 : 6);
    line(ctx, spokes ? '#dce3ed' : '#4c4e4e', spokes ? 0.8 : 2, p => {
      p.moveTo(Math.cos(a) * r * (spokes ? 0.1 : 0.79), Math.sin(a) * r * (spokes ? 0.1 : 0.79));
      p.lineTo(Math.cos(a) * r * (spokes ? 0.85 : 0.96), Math.sin(a) * r * (spokes ? 0.85 : 0.96));
    });
  }
  oval(ctx, 0, 0, spokes ? 2 : 3, spokes ? 2 : 3, spokes ? '#eef2f8' : '#c59417');
  ctx.restore();
}

function bicycle(ctx, o, c) {
  const t = o.anim || 0, moving = Math.abs(o.vx || 0) > 20, spin = moving ? t * 12 : 0;
  wheel(ctx, -23, -13, 12.5, '#637381', spin, true);
  wheel(ctx, 24, -13, 12.5, '#637381', spin, true);
  // Zwei offene Rahmendreiecke, Sattel und Lenker.
  line(ctx, '#ef7645', 3, p => {
    p.moveTo(-23, -13); p.lineTo(-10, -32); p.lineTo(4, -13); p.lineTo(-23, -13);
    p.moveTo(-10, -32); p.lineTo(15, -32); p.lineTo(4, -13); p.moveTo(15, -32); p.lineTo(24, -13);
  });
  line(ctx, '#d5dde3', 2.5, p => { p.moveTo(-10, -32); p.lineTo(-12, -38); p.moveTo(15, -32); p.lineTo(13, -42); p.lineTo(21, -42); });
  box(ctx, -19, -39, 14, 3, '#252735', 1, null);
  oval(ctx, 4, -13, 3, 3, '#c9d0db');
  // Beide Füße laufen mit der Kurbel, statt wie Reitbeine starr am Rad zu hängen.
  for (let i = 0; i < 2; i++) {
    const a = spin + i * Math.PI;
    const px = 4 + Math.cos(a) * 7, py = -13 + Math.sin(a) * 7;
    line(ctx, i ? '#303546' : '#4a5069', 4, p => {
      p.moveTo(-10, -38); p.lineTo(-2 + Math.cos(a) * 5, -26 + Math.sin(a) * 3); p.lineTo(px, py);
    });
    line(ctx, '#242735', 3, p => { p.moveTo(px - 2, py); p.lineTo(px + 4, py); });
    line(ctx, '#c9d0db', 1.2, p => { p.moveTo(4, -13); p.lineTo(px, py); });
  }
  rider(ctx, c, t, { x: -10, seat: -38, handX: 19, handY: -42, legs: false, lean: 5 });
}

function excavator(ctx, o, c) {
  const t = o.anim || 0, moving = Math.abs(o.vx || 0) > 20;
  // Gummiketten mit wandernden Profilen.
  box(ctx, -31, -16, 61, 15, '#262930', 7);
  box(ctx, -26, -13, 50, 8, '#606671', 4, null);
  for (let i = 0; i < 3; i++) oval(ctx, -18 + i * 17, -9, 4.3, 4.3, '#2b3037');
  for (let i = 0; i < 10; i++) {
    const x = -27 + ((i * 6 + (moving ? t * 28 : 0)) % 56);
    line(ctx, '#8b939c', 1.2, p => { p.moveTo(x, -15); p.lineTo(x + 1, -12); p.moveTo(x, -5); p.lineTo(x + 1, -2); });
  }
  box(ctx, -28, -31, 55, 17, '#f4f4ec', 4);
  box(ctx, -29, -30, 13, 11, '#dcded9', 2, null);
  box(ctx, -27, -26, 10, 3, '#d65137', 1, null);
  // Rückwand der Kabine, Sitz und Fahrer vor dem vorderen schwarzen Rahmen.
  box(ctx, -19, -70, 28, 42, '#b9dae0', 2);
  box(ctx, -17, -39, 18, 8, '#32363f', 2, null);
  rider(ctx, c, t, { x: -8, seat: -37, handX: 6, handY: -42 });
  line(ctx, '#202630', 3.5, p => { p.moveTo(-19, -29); p.lineTo(-19, -71); p.lineTo(10, -71); p.lineTo(13, -29); });
  box(ctx, -22, -75, 35, 5, '#30343c', 2);
  // Kurzer hydraulischer Arm und gezahnte Schaufel vor der Maschine.
  line(ctx, '#3c4249', 9, p => { p.moveTo(17, -27); p.lineTo(24, -48); p.lineTo(40, -31); });
  line(ctx, '#f5f2e7', 6, p => { p.moveTo(17, -27); p.lineTo(24, -48); p.lineTo(40, -31); });
  line(ctx, '#727b82', 2, p => { p.moveTo(20, -29); p.lineTo(27, -43); p.lineTo(37, -32); });
  oval(ctx, 24, -48, 3, 3, '#5b6570');
  shape(ctx, '#464b52', () => {
    ctx.moveTo(37, -32); ctx.lineTo(43, -34); ctx.lineTo(46, -18);
    ctx.lineTo(31, -18); ctx.lineTo(29, -22); ctx.lineTo(38, -22); ctx.closePath();
  });
  line(ctx, '#a9b0b6', 1.3, p => { p.moveTo(32, -18); p.lineTo(34, -15); p.moveTo(38, -18); p.lineTo(40, -15); p.moveTo(44, -18); p.lineTo(46, -15); });
  box(ctx, -7, -25, 21, 4, '#242932', 1, null);
  oval(ctx, 20, -22, 2.3, 2.3, '#ffe4a0');
}

function tractor(ctx, o, c) {
  const t = o.anim || 0, moving = Math.abs(o.vx || 0) > 20, spin = moving ? t * 9 : 0;
  // Dezenter Rauch ist nur eine Zeichnung und erzeugt keine Spielpartikel.
  if (moving) for (let i = 0; i < 3; i++) {
    const phase = (t * 1.7 + i / 3) % 1;
    oval(ctx, 22 - phase * 9, -53 - phase * 13, 2 + phase * 2.7, 1.5 + phase * 2, `rgba(190,201,207,${(1 - phase) * 0.45})`);
  }
  box(ctx, -24, -27, 56, 15, '#227e37', 3);
  box(ctx, 1, -40, 32, 19, '#399a42', 4);
  box(ctx, 4, -35, 27, 4, '#f0ca3a', 1, null);
  box(ctx, 29, -36, 6, 15, '#263936', 1);
  for (let i = 0; i < 3; i++) line(ctx, '#a8b2ab', 1, p => { p.moveTo(30, -32 + i * 4); p.lineTo(34, -32 + i * 4); });
  box(ctx, 32, -38, 4, 5, '#fff3b5', 1, null);
  line(ctx, '#3d4347', 4, p => { p.moveTo(22, -39); p.lineTo(22, -54); p.lineTo(25, -54); });
  box(ctx, -18, -43, 12, 6, '#30333a', 2, null);
  line(ctx, '#30333a', 2.5, p => { p.moveTo(-2, -29); p.lineTo(3, -43); });
  oval(ctx, 4, -43, 4, 2, '#30333a', INK, -0.3);
  rider(ctx, c, t, { x: -12, seat: -40, handX: 3, handY: -44 });
  // Grüner Kotflügel hinter dem großen Hinterrad.
  shape(ctx, '#42a247', () => {
    ctx.moveTo(-36, -24); ctx.bezierCurveTo(-35, -40, -7, -40, -3, -23);
    ctx.lineTo(-9, -23); ctx.bezierCurveTo(-11, -33, -29, -33, -30, -23); ctx.closePath();
  });
  wheel(ctx, -20, -16, 15.5, '#f4cf32', spin);
  wheel(ctx, 25, -10, 9.5, '#f4cf32', spin * 1.6);
  box(ctx, -4, -20, 12, 3, '#a9b4a6', 1, null);
}

// Lokale Zeichenkoordinaten: Mitte x=0, Boden y=0. Keine Spielregeln ändern.
export function drawMount(ctx, mountId, o = {}, c = {}) {
  const id = normalizeMount(mountId);
  const colors = { shirt: '#e5484d', helmet: '#a3191e', hair: '#f2c94c', ...c };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (HORSES[id]) horse(ctx, id, o, colors);
  else if (id === 'fahrrad') bicycle(ctx, o, colors);
  else if (id === 'bobcat') excavator(ctx, o, colors);
  else tractor(ctx, o, colors);
  ctx.restore();
}
