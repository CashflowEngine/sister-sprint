import { TILE, ROWS, SOLID, buildLevel, themeFor, easeFor } from './levels.js';
import { Net, randomCode, MAX_PLAYERS } from './net.js';

// ---------------------------------------------------------------------------
// Grundwerte
// ---------------------------------------------------------------------------
const T = TILE;
const GRAV = 1900, JUMP_V = 790, MAX_FALL = 900;
const RUN = 270, ACC = 1600, AIR_ACC = 1100, FRICT = 2000;
const PW = 40, PH = 52;
const LEVEL_TIME = 250;
const START_LIVES = 5;
const STEP = 1 / 60;

const COLORS = [
  { name: 'Rot', shirt: '#e5484d', helmet: '#a3191e', horse: '#8b4a2b', mane: '#2b1a10', hair: '#f2c94c' },
  { name: 'Blau', shirt: '#3b82f6', helmet: '#1d3fb0', horse: '#f4efe6', mane: '#b9a68a', hair: '#6b3a1e' },
  { name: 'Grün', shirt: '#22c55e', helmet: '#14703a', horse: '#34343c', mane: '#121216', hair: '#d9822b' },
  { name: 'Lila', shirt: '#a855f7', helmet: '#6d1fb8', horse: '#d9a45a', mane: '#fff3d6', hair: '#2a1a12' },
  { name: 'Orange', shirt: '#f97316', helmet: '#b13a0a', horse: '#9a9aa3', mane: '#ececf2', hair: '#f5e1a4' },
];

const ITEM_TEXT = {
  power: 'Zauberstern',
  star: 'Regenbogen – 10 Sekunden unbesiegbar!',
  clock: 'Zauberuhr – alle Gegner eingefroren!',
  bomb: 'Donnerschlag – Gegner in der Nähe besiegt!',
  heart: 'Extraleben!',
  bag: 'Diamantenbeutel: +10 Diamanten!',
};

const now = () => performance.now() / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// Spielzustand
// ---------------------------------------------------------------------------
const G = {
  mode: 'menu', // menu | lobby | play
  role: null, // host | client
  myId: null,
  net: null,
  code: null,
  players: {},
  level: 1,
  map: null,
  theme: null,
  gemsTaken: new Set(),
  gemOwner: new Map(), // nur Gastgeber
  items: new Map(),
  enemies: [],
  tileLog: [],
  time: LEVEL_TIME,
  countdown: 0,
  frozenUntil: 0,
  bumps: new Map(),
  particles: [],
  shoes: [],
  toasts: [],
  cam: 0,
  nextItemId: 1,
  sendT: 0,
  infoDirty: false,
  goT: 0,
};

const me = {
  x: 0, y: 0, w: PW, h: PH, vx: 0, vy: 0, face: 1, onGround: false, hitWall: false,
  coyote: 0, jumpBuf: 0, alive: true, deathT: 0, deathX: 0, livesLeft: 3,
  power: 0, star: 0, inv: 0, finished: false, out: false, color: 0, anim: 0,
};

// ---------------------------------------------------------------------------
// Ton: kleine Synthesizer-Effekte und eine eigene Chiptune-Melodie
// ---------------------------------------------------------------------------
let AC = null, sfxGain = null, musicGain = null;
let muted = false;
try { muted = localStorage.getItem('ss_muted') === '1'; } catch (_) { /* egal */ }

function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  const master = AC.createGain();
  master.gain.value = 0.5;
  master.connect(AC.destination);
  sfxGain = AC.createGain(); sfxGain.gain.value = muted ? 0 : 0.6; sfxGain.connect(master);
  musicGain = AC.createGain(); musicGain.gain.value = muted ? 0 : 0.22; musicGain.connect(master);
  startMusic();
}

function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, when = 0, dest = sfxGain) {
  if (!AC) return;
  const t0 = AC.currentTime + when;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur, vol = 0.3) {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(), g = AC.createGain();
  src.buffer = buf; g.gain.value = vol;
  src.connect(g).connect(sfxGain);
  src.start();
}

function sfx(name) {
  if (!AC) return;
  switch (name) {
    case 'jump': tone(320, 0.16, 'square', 0.18, 2); break;
    case 'gem': tone(1320, 0.07, 'square', 0.15); tone(1760, 0.1, 'square', 0.15, 0, 0.06); break;
    case 'stomp': tone(260, 0.14, 'square', 0.25, 0.4); noise(0.08, 0.15); break;
    case 'bump': tone(130, 0.09, 'triangle', 0.35); break;
    case 'break': noise(0.25, 0.35); tone(180, 0.12, 'square', 0.15, 0.5); break;
    case 'item': [523, 659, 784].forEach((f, i) => tone(f, 0.1, 'square', 0.15, 0, i * 0.06)); break;
    case 'power': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.12, 'square', 0.15, 0, i * 0.06)); break;
    case 'hurt': tone(500, 0.3, 'sawtooth', 0.2, 0.25); break;
    case 'die': tone(660, 0.7, 'square', 0.22, 0.12); break;
    case 'goal': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.16, 'square', 0.16, 0, i * 0.1)); break;
    case 'shoot': tone(900, 0.12, 'square', 0.14, 0.35); break;
    case 'neigh': tone(760, 0.18, 'sawtooth', 0.12, 1.25); tone(900, 0.3, 'sawtooth', 0.1, 0.55, 0.15); break;
    case 'life': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'triangle', 0.25, 0, i * 0.08)); break;
  }
}

// Eigene Melodie (MIDI-Notennummern, 0 = Pause), 16tel bei ~150 bpm
const MELODY = [
  76, 0, 79, 0, 81, 0, 79, 76, 74, 0, 76, 0, 72, 0, 0, 0,
  76, 0, 79, 0, 81, 0, 84, 83, 81, 0, 79, 0, 76, 0, 0, 0,
  72, 0, 74, 0, 76, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0,
  74, 0, 76, 0, 72, 0, 69, 0, 71, 0, 72, 0, 74, 0, 0, 0,
];
const BASS = [45, 41, 48, 43];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function startMusic() {
  const stepLen = 0.1;
  let step = 0;
  let next = AC.currentTime + 0.1;
  setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    while (next < AC.currentTime + 0.2) {
      const when = next - AC.currentTime;
      const m = MELODY[step % MELODY.length];
      if (m) tone(midi(m), 0.09, 'square', 0.07, 0, when, musicGain);
      if (step % 2 === 0) {
        const root = BASS[Math.floor(step / 16) % BASS.length];
        tone(midi(step % 4 === 0 ? root : root + 12), 0.09, 'triangle', 0.16, 0, when, musicGain);
      }
      step++;
      next += stepLen;
    }
  }, 30);
}

function setMuted(v) {
  muted = v;
  try { localStorage.setItem('ss_muted', v ? '1' : '0'); } catch (_) { /* egal */ }
  if (sfxGain) sfxGain.gain.value = v ? 0 : 0.6;
  if (musicGain) musicGain.gain.value = v ? 0 : 0.22;
  $('btnMute').textContent = v ? '🔇' : '🔊';
}

document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) AC.suspend(); else AC.resume();
});

// ---------------------------------------------------------------------------
// Eingabe: Tastatur und Touch-Knöpfe
// ---------------------------------------------------------------------------
const keys = { left: false, right: false, jump: false, fire: false, jumpPressed: false, firePressed: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyX: 'fire', KeyJ: 'fire', KeyK: 'fire', ShiftLeft: 'fire', ShiftRight: 'fire',
};

function setKey(k, down) {
  if (down && !keys[k]) {
    if (k === 'jump') keys.jumpPressed = true;
    if (k === 'fire') keys.firePressed = true;
  }
  keys[k] = down;
}

window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = KEYMAP[e.code];
  if (!k) return;
  e.preventDefault();
  if (!e.repeat) setKey(k, true);
});
window.addEventListener('keyup', e => {
  const k = KEYMAP[e.code];
  if (k) setKey(k, false);
});
window.addEventListener('blur', () => { keys.left = keys.right = keys.jump = keys.fire = false; });

function setupTouch() {
  const pad = $('touch');
  const update = e => {
    e.preventDefault();
    const down = { left: false, right: false, jump: false, fire: false };
    for (const t of e.touches) {
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const btn = el && el.closest('.tbtn');
      if (btn) down[btn.dataset.k] = true;
    }
    for (const k of Object.keys(down)) setKey(k, down[k]);
    pad.querySelectorAll('.tbtn').forEach(b => b.classList.toggle('on', down[b.dataset.k]));
  };
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => pad.addEventListener(ev, update, { passive: false }));
  const isTouch = 'ontouchstart' in window || matchMedia('(pointer: coarse)').matches;
  if (isTouch) document.body.classList.add('touch');
  window.addEventListener('touchstart', () => { document.body.classList.add('touch'); resize(); }, { once: true });
}

// ---------------------------------------------------------------------------
// Level laden und Spielerposition
// ---------------------------------------------------------------------------
// Mehr Zeit in den ersten Leveln: Level 1 +100 s, Level 2 +50 s
const levelTime = n => LEVEL_TIME + Math.round(100 * easeFor(n));

function makeEnemy(e) {
  // Gegner sind in Level 1 nur halb so schnell, in Level 2 etwas langsamer
  const slow = 1 - 0.5 * easeFor(G.level);
  const speed = { k: 60, i: 40, f: 0, w: 0 }[e.type] * slow;
  return { ...e, w: 28, h: e.type === 'w' ? 24 : 28, vx: -speed, vy: 0, alive: true, face: -1, ox: e.x, oy: e.y, t: Math.random() * 3, tx: e.x, ty: e.y, pending: 0, onGround: false, hitWall: false, hop: 1.2 };
}

function loadLevel(n, spawnX) {
  G.level = n;
  G.map = buildLevel(n);
  G.theme = themeFor(n);
  G.gemsTaken.clear();
  G.gemOwner.clear();
  G.items.clear();
  G.bumps.clear();
  G.particles = [];
  G.shoes = [];
  G.enemies = G.map.enemies.map(makeEnemy);
  G.tileLog = [];
  G.time = levelTime(G.level);
  G.countdown = 0;
  G.frozenUntil = 0;
  me.finished = false;
  me.out = false;
  me.star = 0;
  let x = G.map.spawn.x + me.color * 14;
  if (spawnX != null) {
    x = G.map.chunkStarts[0] * T;
    for (const c of G.map.chunkStarts) if (c * T <= spawnX) x = c * T + 4;
  }
  placeMe(x);
  me.inv = 1.5;
  G.cam = clamp(me.x - 200, 0, G.map.w * T);
}

function placeMe(x) {
  me.x = x; me.y = (ROWS - 2) * T - PH; me.vx = 0; me.vy = 0;
  me.alive = true; me.onGround = false;
}

// ---------------------------------------------------------------------------
// Physik
// ---------------------------------------------------------------------------
function tileAt(tx, ty) {
  if (!G.map || tx < 0 || tx >= G.map.w || ty < 0 || ty >= ROWS) return '.';
  return G.map.t[ty][tx];
}

function solid(tx, ty) {
  if (tx < 0 || tx >= G.map.w) return true;
  if (ty < 0 || ty >= ROWS) return false;
  return SOLID.has(G.map.t[ty][tx]);
}

function moveBody(b, dt) {
  let head = null;
  b.hitWall = false;
  b.x += b.vx * dt;
  const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 1) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.001) / T);
    for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = y0; ty <= y1; ty++) if (solid(tx, ty)) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = true; break; }
  }
  b.y += b.vy * dt;
  b.onGround = false;
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.001) / T);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.001) / T);
    for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) { b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break; }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / T);
    const hit = [];
    for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) hit.push(tx);
    if (hit.length) {
      b.y = (ty + 1) * T; b.vy = 0;
      const cx = Math.floor((b.x + b.w / 2) / T);
      head = [hit.includes(cx) ? cx : hit[0], ty];
    }
  }
  return head;
}

const overlap = (a, b, pad = 0) =>
  a.x + pad < b.x + b.w && a.x + a.w - pad > b.x && a.y + pad < b.y + b.h && a.y + a.h - pad > b.y;

// ---------------------------------------------------------------------------
// Eigener Spieler
// ---------------------------------------------------------------------------
function sendEv(ev) {
  if (G.role === 'host') hostEvent(G.myId, ev);
  else G.net.send({ t: 'ev', e: ev });
}

function myInfo() { return G.players[G.myId]; }

function updateMe(dt) {
  if (me.out) return;
  me.anim += dt;
  if (!me.alive) {
    me.deathT -= dt;
    me.vy = Math.min(me.vy + GRAV * dt, MAX_FALL);
    me.y += me.vy * dt;
    if (me.deathT <= 0) {
      if (me.livesLeft > 0) respawn();
      else { me.out = true; toast('Keine Leben mehr – du schaust zu bis zum nächsten Level.'); }
    }
    return;
  }

  const dir = me.finished ? 0 : (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const acc = me.onGround ? ACC : AIR_ACC;
  if (dir) {
    me.vx += dir * acc * dt;
    me.face = dir;
  } else if (me.onGround) {
    const s = Math.sign(me.vx);
    me.vx -= s * FRICT * dt;
    if (Math.sign(me.vx) !== s) me.vx = 0;
  }
  me.vx = clamp(me.vx, -RUN, RUN);

  me.coyote = me.onGround ? 0.09 : me.coyote - dt;
  if (keys.jumpPressed) me.jumpBuf = 0.12; else me.jumpBuf -= dt;
  if (me.jumpBuf > 0 && me.coyote > 0 && !me.finished) {
    me.vy = -JUMP_V; me.jumpBuf = 0; me.coyote = 0; sfx('jump');
  }
  if (!keys.jump && me.vy < -320) me.vy = -320;
  me.vy = Math.min(me.vy + GRAV * dt, MAX_FALL);

  const prevBottom = me.y + me.h;
  const head = moveBody(me, dt);
  if (head) hitBlock(head[0], head[1]);

  // Gefahren
  if (me.y > ROWS * T + 20) return die(true);
  const tx0 = Math.floor((me.x + 6) / T), tx1 = Math.floor((me.x + me.w - 7) / T);
  const ty0 = Math.floor((me.y + 12) / T), ty1 = Math.floor((me.y + me.h - 2) / T);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = tileAt(tx, ty);
      if (t === '~') return die(true);
      if (t === '^' && me.y + me.h > ty * T + 14) { hurt(); me.vy = -520; }
    }
  }

  // Diamanten
  for (const g of G.map.gems) {
    if (G.gemsTaken.has(g.i)) continue;
    if (overlap(me, { x: g.x, y: g.y, w: 20, h: 20 })) {
      G.gemsTaken.add(g.i);
      sfx('gem');
      sparkle(g.x + 10, g.y + 10, '#7df3ff', 6);
      sendEv({ k: 'gem', i: g.i });
    }
  }

  // Gegenstände
  for (const it of G.items.values()) {
    if (it.pending && now() - it.pending < 1) continue;
    if (overlap(me, { x: it.x, y: it.y, w: 24, h: 24 })) {
      it.pending = now();
      sendEv({ k: 'take', id: it.id });
    }
  }

  // Gegner
  const frozen = now() < G.frozenUntil;
  for (const e of G.enemies) {
    if (!e.alive || (e.pending && now() - e.pending < 1)) continue;
    if (!overlap(me, e, 4)) continue;
    if (me.star > 0) { e.pending = now(); sendEv({ k: 'kill', id: e.id, how: 'star' }); sfx('stomp'); continue; }
    if (e.type !== 'i' && me.vy > 0 && prevBottom <= e.y + 14) {
      e.pending = now();
      me.vy = keys.jump ? -640 : -440;
      sfx('stomp');
      sendEv({ k: 'stomp', id: e.id });
      continue;
    }
    if (!frozen) hurt();
  }

  // Ziel
  if (!me.finished && me.x + me.w > G.map.flagX + 8 && me.x < G.map.flagX + 24) {
    me.finished = true;
    sfx('goal');
    sparkle(me.x + 20, me.y, '#ffe066', 20);
    sendEv({ k: 'goal' });
  }

  if (me.inv > 0) me.inv -= dt;
  if (me.star > 0) { me.star -= dt; if (Math.random() < 0.4) sparkle(me.x + Math.random() * PW, me.y + Math.random() * PH, `hsl(${Math.random() * 360},90%,65%)`, 1); }

  if (keys.firePressed) {
    if (me.power >= 2 && G.shoes.length < 2) {
      G.shoes.push({ x: me.x + PW / 2 + me.face * 18 - 7, y: me.y + 18, w: 14, h: 14, vx: me.face * 440, vy: -120, t: 1.6 });
      sfx('shoot');
    } else if (me.power < 2) sfx('neigh');
  }
}

function hitBlock(tx, ty) {
  const t = tileAt(tx, ty);
  G.bumps.set(tx + ',' + ty, now());
  sfx(t === 'B' && me.power >= 1 ? 'break' : 'bump');
  if ('?PB'.includes(t)) sendEv({ k: 'hit', tx, ty, big: me.power >= 1 });
}

function hurt() {
  if (me.inv > 0 || me.star > 0 || !me.alive || me.finished) return;
  if (me.power > 0) {
    me.power = 0; me.inv = 2; me.vy = -350;
    sfx('hurt');
    toast('Autsch! Deine Zauberkraft ist weg.');
  } else die(false);
}

function die(fell) {
  if (!me.alive || me.finished) return;
  me.alive = false;
  me.deathT = 1.8;
  me.vy = fell ? -150 : -650;
  me.power = 0;
  me.star = 0;
  me.deathX = me.x;
  const info = myInfo();
  if (fell && easeFor(G.level) >= 1) {
    // Level 1: Reinfallen kostet kein Leben, man startet einfach kurz davor neu
    me.livesLeft = info ? info.lives : 1;
    me.deathT = 1.0;
    sfx('hurt');
    toast('Hoppla! Kein Problem – gleich nochmal.');
    return;
  }
  me.livesLeft = (info ? info.lives : 1) - 1;
  sfx('die');
  sendEv({ k: 'dead' });
}

function respawn() {
  let x = G.map.chunkStarts[0];
  for (const c of G.map.chunkStarts) if (c * T <= me.deathX) x = c;
  placeMe(x * T + 4);
  me.inv = 2.5;
}

function updateShoes(dt) {
  for (const s of G.shoes) {
    s.t -= dt;
    s.vy = Math.min(s.vy + 1500 * dt, MAX_FALL);
    const vx = s.vx;
    moveBody(s, dt);
    if (s.onGround) s.vy = -380;
    if (s.hitWall || s.y > ROWS * T) s.t = 0;
    s.vx = vx;
    for (const e of G.enemies) {
      if (!e.alive || (e.pending && now() - e.pending < 1)) continue;
      if (overlap(s, e)) {
        e.pending = now(); s.t = 0;
        sendEv({ k: 'kill', id: e.id, how: 'shoe' });
        sfx('stomp');
        break;
      }
    }
  }
  G.shoes = G.shoes.filter(s => s.t > 0);
}

function myState() {
  const flags = (me.alive ? 1 : 0) | (Math.min(me.power, 3) << 1) | (me.star > 0 ? 8 : 0) |
    (me.inv > 0 ? 16 : 0) | (me.finished ? 32 : 0) | (me.out ? 64 : 0);
  return [Math.round(me.x), Math.round(me.y), Math.round(me.vx), Math.round(me.vy), me.face, flags,
    G.shoes.map(s => [Math.round(s.x), Math.round(s.y)])];
}

function applyPower(type) {
  if (type === 'power') {
    if (me.power < 2) {
      me.power++;
      toast(me.power === 1 ? '🔥 Feuer-Mähne! Spring von unten gegen Ziegel, um sie zu zerschlagen.' : '🧲 Hufeisen-Wurf! Mit X (oder dem Wurf-Knopf) werfen.');
    } else toast('Zauberstern: +100 Punkte');
    sfx('power');
  } else if (type === 'star') {
    me.star = 10; sfx('power'); toast('🌈 ' + ITEM_TEXT.star);
  } else if (type === 'heart') {
    sfx('life'); toast('❤️ ' + ITEM_TEXT.heart);
  } else {
    sfx('item'); toast(ITEM_TEXT[type]);
  }
}

// ---------------------------------------------------------------------------
// Gastgeber: verwaltet die gemeinsame Welt
// ---------------------------------------------------------------------------
function change(c) {
  applyChange(c);
  G.net.broadcast({ t: 'w', c });
}

function setTile(tx, ty, v) {
  G.tileLog.push([tx, ty, v]);
  change({ k: 'tile', tx, ty, v });
}

function rollItem() {
  const r = Math.random();
  const ease = easeFor(G.level);
  if (ease > 0 && r < 0.3 * ease) return r < 0.15 * ease ? 'heart' : 'star';
  if (r < 0.55) return 'power';
  if (r < 0.67) return 'star';
  if (r < 0.77) return 'clock';
  if (r < 0.85) return 'bomb';
  if (r < 0.92) return 'heart';
  return 'bag';
}

function addGems(p, n) {
  p.gems += n;
  p.score += n * 10;
  while (Math.floor(p.gems / 100) > p.lifeMarks) {
    p.lifeMarks++;
    p.lives++;
    change({ k: 'msg', text: `💎 ${p.name} hat 100 Diamanten: Extraleben!` });
  }
}

function killEnemy(e, by, how) {
  if (!e.alive) return;
  e.alive = false;
  const p = G.players[by];
  if (p) p.score += 50;
  change({ k: 'edead', id: e.id, how });
  G.infoDirty = true;
}

function hostEvent(id, ev) {
  const p = G.players[id];
  if (!p || G.mode !== 'play') return;
  switch (ev.k) {
    case 'gem': {
      if (G.gemOwner.has(ev.i) || !G.map.gems[ev.i]) return;
      G.gemOwner.set(ev.i, id);
      addGems(p, 1);
      change({ k: 'gem', i: ev.i, by: id });
      break;
    }
    case 'hit': {
      const t = tileAt(ev.tx, ev.ty);
      if (t === '?') {
        setTile(ev.tx, ev.ty, 'X');
        addGems(p, 1);
        change({ k: 'fx', fx: 'gempop', tx: ev.tx, ty: ev.ty });
      } else if (t === 'P') {
        setTile(ev.tx, ev.ty, 'X');
        const it = { id: G.nextItemId++, type: rollItem(), x: ev.tx * T + 4, y: (ev.ty - 1) * T + 4 };
        change({ k: 'item', it });
      } else if (t === 'B' && ev.big) {
        setTile(ev.tx, ev.ty, '.');
        p.score += 20;
        change({ k: 'fx', fx: 'brick', tx: ev.tx, ty: ev.ty });
      }
      break;
    }
    case 'take': {
      const it = G.items.get(ev.id);
      if (!it) return;
      change({ k: 'itemgone', id: it.id, by: id, type: it.type });
      p.score += 50;
      if (it.type === 'heart') p.lives++;
      if (it.type === 'bag') addGems(p, 10);
      if (it.type === 'power') p.score += 50;
      if (it.type === 'clock') change({ k: 'freeze', s: 8 });
      if (it.type === 'bomb') {
        const px = p.s ? p.s[0] : 0;
        for (const e of G.enemies) if (e.alive && Math.abs(e.x - px) < 700) killEnemy(e, id, 'bomb');
        change({ k: 'fx', fx: 'flash' });
      }
      break;
    }
    case 'stomp':
    case 'kill': {
      const e = G.enemies[ev.id];
      if (e && e.alive) killEnemy(e, id, ev.k === 'stomp' ? 'stomp' : ev.how);
      break;
    }
    case 'dead':
      p.lives = Math.max(0, p.lives - 1);
      break;
    case 'goal': {
      if (p.finishedLevel === G.level) return;
      p.finishedLevel = G.level;
      p.score += G.countdown > 0 ? 200 : 500;
      if (!G.countdown) G.countdown = 8;
      change({ k: 'msg', text: `🏁 ${p.name} ist im Ziel!` });
      break;
    }
  }
  G.infoDirty = true;
}

const pFlags = p => (p.s ? p.s[5] : 1);

function hostUpdate(dt) {
  G.players[G.myId].s = myState();

  if (G.countdown > 0) {
    G.countdown -= dt;
    const active = Object.values(G.players).filter(p => !(pFlags(p) & 64));
    if (active.length && active.every(p => p.finishedLevel === G.level)) G.countdown = Math.min(G.countdown, 1.5);
    if (G.countdown <= 0) nextLevel();
  } else {
    G.time -= dt;
    if (G.time <= 0) { G.time = levelTime(G.level); change({ k: 'timeup' }); }
  }

  const all = Object.values(G.players);
  if (all.length && all.every(p => p.lives <= 0 && !(pFlags(p) & 1))) {
    G.goT += dt;
    if (G.goT > 2.5) {
      G.goT = 0;
      all.forEach(p => { p.lives = START_LIVES; });
      G.infoDirty = true;
      change({ k: 'level', n: G.level, text: 'Game Over – alle versuchen dieses Level noch einmal!' });
    }
  } else G.goT = 0;

  if (now() >= G.frozenUntil) {
    const xs = all.map(p => (p.s ? p.s[0] : me.x));
    for (const e of G.enemies) {
      if (e.alive && xs.some(x => Math.abs(x - e.x) < 900)) simEnemy(e, dt, xs);
    }
  }

  G.sendT -= dt;
  if (G.sendT <= 0) {
    G.sendT = 0.05;
    const ps = {};
    for (const p of all) if (p.s) ps[p.id] = p.s;
    const es = [];
    for (const e of G.enemies) if (e.alive) es.push([e.id, Math.round(e.x), Math.round(e.y), e.face]);
    G.net.broadcast({ t: 's', p: ps, e: es, time: Math.ceil(G.time), cd: Math.ceil(G.countdown), fr: Math.max(0, G.frozenUntil - now()) });
  }
  if (G.infoDirty) sendInfo();
}

function simEnemy(e, dt, xs) {
  e.t += dt;
  if (e.type === 'w') {
    e.x = e.ox + Math.sin(e.t * 1.2) * 90;
    e.y = e.oy + Math.sin(e.t * 3) * 26;
    e.face = Math.cos(e.t * 1.2) > 0 ? 1 : -1;
    return;
  }
  if (e.type === 'f' && e.onGround) {
    e.vx = 0;
    e.hop -= dt;
    if (e.hop <= 0) {
      e.hop = 1.3 + Math.random() + 1.5 * easeFor(G.level);
      let tx = xs[0];
      for (const x of xs) if (Math.abs(x - e.x) < Math.abs(tx - e.x)) tx = x;
      e.face = tx < e.x ? -1 : 1;
      e.vx = e.face * 130;
      e.vy = -620;
    }
  }
  e.vy = Math.min(e.vy + GRAV * dt, MAX_FALL);
  const vx0 = e.vx;
  moveBody(e, dt);
  if (e.type !== 'f') {
    if (e.hitWall) e.vx = -vx0;
    else if (e.onGround) {
      const ahead = vx0 > 0 ? e.x + e.w + 2 : e.x - 2;
      if (!solid(Math.floor(ahead / T), Math.floor((e.y + e.h + 4) / T))) e.vx = -vx0;
    }
    if (e.vx) e.face = Math.sign(e.vx);
  }
  if (e.y > ROWS * T + 60) killEnemy(e, null, 'fall');
}

function nextLevel() {
  const n = G.level + 1;
  for (const p of Object.values(G.players)) {
    if (p.finishedLevel === G.level) p.score += Math.floor(G.time) * 2;
    if (p.lives <= 0) p.lives = 2;
  }
  G.infoDirty = true;
  change({ k: 'level', n, text: `Level ${n}: ${themeFor(n).name}` });
}

function sendInfo() {
  G.infoDirty = false;
  const p = {};
  for (const q of Object.values(G.players)) p[q.id] = { name: q.name, color: q.color, lives: q.lives, gems: q.gems, score: q.score };
  G.net.broadcast({ t: 'i', p });
  updatePlayerList();
}

function newPlayer(id, name, color) {
  return { id, name, color, lives: START_LIVES, gems: 0, score: 0, lifeMarks: 0, s: null, finishedLevel: 0, rx: null, ry: null };
}

function cleanName(n) {
  return String(n || '').replace(/[<>]/g, '').trim().slice(0, 12) || 'Reiterin';
}

function hostMessage(id, m) {
  if (m.t === 'hello') {
    if (Object.keys(G.players).length >= MAX_PLAYERS) {
      G.net.sendTo(id, { t: 'full' });
      G.net.kick(id);
      return;
    }
    const used = new Set(Object.values(G.players).map(p => p.color));
    let color = 0;
    while (used.has(color)) color++;
    const p = newPlayer(id, cleanName(m.name), color);
    G.players[id] = p;
    G.net.sendTo(id, {
      t: 'welcome', id, color, mode: G.mode, level: G.level, code: G.code,
      world: {
        tiles: G.tileLog, gems: [...G.gemOwner.keys()], items: [...G.items.values()],
        dead: G.enemies.filter(e => !e.alive).map(e => e.id), fr: Math.max(0, G.frozenUntil - now()), spawnX: me.x,
      },
    });
    sendInfo();
    change({ k: 'msg', text: `👋 ${p.name} ist dabei!` });
    return;
  }
  const p = G.players[id];
  if (!p) return;
  if (m.t === 'p') p.s = m.s;
  else if (m.t === 'ev') hostEvent(id, m.e);
}

function hostLeave(id) {
  const p = G.players[id];
  if (!p) return;
  delete G.players[id];
  sendInfo();
  change({ k: 'msg', text: `${p.name} hat das Spiel verlassen.` });
}

// ---------------------------------------------------------------------------
// Änderungen anwenden (bei allen Spielern gleich)
// ---------------------------------------------------------------------------
function applyChange(c) {
  switch (c.k) {
    case 'start':
      G.mode = 'play';
      hideOverlay();
      loadLevel(c.n);
      toast(`Level ${c.n}: ${themeFor(c.n).name} – Los geht's!`);
      break;
    case 'tile':
      if (G.map) G.map.t[c.ty][c.tx] = c.v;
      break;
    case 'gem': {
      G.gemsTaken.add(c.i);
      const g = G.map.gems[c.i];
      if (c.by !== G.myId && g) sparkle(g.x + 10, g.y + 10, '#7df3ff', 4);
      break;
    }
    case 'fx': {
      if (c.fx === 'gempop') {
        G.particles.push({ type: 'gem', x: c.tx * T + 16, y: c.ty * T - 6, vx: 0, vy: -260, life: 0.6, max: 0.6 });
        sfx('gem');
      } else if (c.fx === 'brick') {
        const col = G.theme.brick;
        for (let i = 0; i < 6; i++) G.particles.push({ type: 'debris', x: c.tx * T + 16, y: c.ty * T + 16, vx: (Math.random() - 0.5) * 300, vy: -200 - Math.random() * 250, life: 1, max: 1, color: col, rot: Math.random() * 6 });
        sfx('break');
      } else if (c.fx === 'flash') {
        G.flash = 0.4;
        noise(0.5, 0.4);
      }
      break;
    }
    case 'item':
      G.items.set(c.it.id, { ...c.it, born: now(), pending: 0 });
      sfx('item');
      break;
    case 'itemgone':
      G.items.delete(c.id);
      if (c.by === G.myId) applyPower(c.type);
      break;
    case 'edead': {
      const e = G.enemies[c.id];
      if (e) {
        e.alive = false;
        if (c.how !== 'fall') {
          sparkle(e.x + 14, e.y + 14, '#ffffff', 8);
          G.particles.push({ type: 'text', text: '+50', x: e.x + 14, y: e.y, vx: 0, vy: -60, life: 0.9, max: 0.9 });
        }
      }
      break;
    }
    case 'freeze':
      G.frozenUntil = now() + c.s;
      toast('⏰ ' + ITEM_TEXT.clock);
      break;
    case 'msg':
      toast(c.text);
      break;
    case 'level':
      loadLevel(c.n);
      if (c.text) toast(c.text);
      sfx('power');
      break;
    case 'timeup':
      toast('⏱ Die Zeit ist abgelaufen!');
      if (me.alive && !me.finished && !me.out) die(false);
      break;
  }
}

// ---------------------------------------------------------------------------
// Mitspieler: Nachrichten vom Gastgeber
// ---------------------------------------------------------------------------
function clientMessage(_, m) {
  switch (m.t) {
    case 'welcome': {
      G.myId = m.id;
      me.color = m.color;
      G.code = m.code;
      if (m.mode === 'play') {
        G.mode = 'play';
        loadLevel(m.level, m.world.spawnX);
        for (const [tx, ty, v] of m.world.tiles) G.map.t[ty][tx] = v;
        for (const i of m.world.gems) G.gemsTaken.add(i);
        for (const it of m.world.items) G.items.set(it.id, { ...it, born: now(), pending: 0 });
        for (const id of m.world.dead) if (G.enemies[id]) G.enemies[id].alive = false;
        G.frozenUntil = now() + m.world.fr;
        hideOverlay();
        toast(`Willkommen in Level ${m.level}: ${G.theme.name}!`);
      } else {
        G.mode = 'lobby';
        loadLevel(m.level);
        showLobby();
      }
      break;
    }
    case 'full':
      showMessage('Spiel ist voll', `Es können höchstens ${MAX_PLAYERS} Leute gleichzeitig spielen.`);
      break;
    case 'i': {
      for (const id of Object.keys(G.players)) if (!m.p[id]) delete G.players[id];
      for (const [id, info] of Object.entries(m.p)) G.players[id] = Object.assign(G.players[id] || { id, s: null, rx: null, ry: null }, info);
      updatePlayerList();
      break;
    }
    case 's': {
      for (const [id, s] of Object.entries(m.p)) if (G.players[id] && id !== G.myId) G.players[id].s = s;
      for (const [id, x, y, face] of m.e) {
        const e = G.enemies[id];
        if (e && e.alive) { e.tx = x; e.ty = y; e.face = face; }
      }
      G.time = m.time;
      G.countdown = m.cd;
      if (m.fr > 0 && G.frozenUntil < now() + m.fr - 0.5) G.frozenUntil = now() + m.fr;
      break;
    }
    case 'w':
      applyChange(m.c);
      break;
  }
}

function clientUpdate(dt) {
  G.sendT -= dt;
  if (G.sendT <= 0) {
    G.sendT = 0.05;
    G.net.send({ t: 'p', s: myState() });
  }
  const k = Math.min(1, dt * 14);
  for (const e of G.enemies) {
    if (Math.abs(e.tx - e.x) > 200) e.x = e.tx; else e.x += (e.tx - e.x) * k;
    e.y += (e.ty - e.y) * k;
  }
}

// ---------------------------------------------------------------------------
// Effekte und Nachrichten
// ---------------------------------------------------------------------------
function sparkle(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    G.particles.push({ type: 'spark', x, y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.8) * 220, life: 0.5, max: 0.5, color });
  }
}

function toast(text) {
  G.toasts.push({ text, t: 3.5 });
  if (G.toasts.length > 4) G.toasts.shift();
}

function updateParticles(dt) {
  for (const p of G.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'debris' || p.type === 'spark') p.vy += 900 * dt;
    if (p.type === 'gem') p.vy += 500 * dt;
    if (p.rot != null) p.rot += dt * 8;
  }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const t of G.toasts) t.t -= dt;
  G.toasts = G.toasts.filter(t => t.t > 0);
  if (G.flash > 0) G.flash -= dt;
}

function updateRemote(dt) {
  const k = Math.min(1, dt * 15);
  for (const p of Object.values(G.players)) {
    if (p.id === G.myId || !p.s) continue;
    if (p.rx == null || Math.abs(p.s[0] - p.rx) > 250) { p.rx = p.s[0]; p.ry = p.s[1]; }
    p.rx += (p.s[0] - p.rx) * k;
    p.ry += (p.s[1] - p.ry) * k;
    p.anim = (p.anim || 0) + dt;
  }
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------
let lastHudB = 0;
const cv = $('game');
const ctx = cv.getContext('2d');
let dpr = 1, scale = 1, VW = 800, VH = ROWS * T, SH = 480, offY = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.floor(innerWidth * dpr);
  cv.height = Math.floor(innerHeight * dpr);
  // Auf Touch-Geräten bleibt unten Platz für die Knöpfe
  const pad = document.body.classList.contains('touch') ? 100 * dpr : 0;
  const avail = cv.height - pad;
  scale = Math.min(avail / VH, cv.width / 560);
  VW = cv.width / scale;
  SH = cv.height / scale;
  offY = avail / scale - VH;
}
window.addEventListener('resize', resize);

function updateCam(dt) {
  let target = me;
  if (me.out || !me.alive) {
    const other = Object.values(G.players).find(p => p.id !== G.myId && p.s && (p.s[5] & 1));
    if (other && me.out) target = { x: other.rx ?? other.s[0] };
  }
  const want = clamp(target.x + PW / 2 - VW * 0.42, 0, Math.max(0, G.map.w * T - VW));
  G.cam += (want - G.cam) * Math.min(1, dt * 7);
}

const hash = (a, b = 0) => {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function drawSky() {
  const th = G.theme;
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VW, SH);
  const t = now();
  if (th.stars) {
    for (let i = 0; i < 60; i++) {
      const x = ((hash(i, 1) * 2000 - G.cam * 0.05) % VW + VW) % VW;
      const y = hash(i, 2) * SH * 0.6;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 6; i++) {
      const w = VW + 300;
      const x = ((hash(i, 3) * 3000 - G.cam * 0.12 - t * 8) % w + w) % w - 150;
      const y = 30 + hash(i, 4) * SH * 0.35;
      ctx.beginPath();
      ctx.ellipse(x, y, 44, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 28, y - 10, 28, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 26, y - 4, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHills(color, factor, base, amp) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VH);
  for (let x = 0; x <= VW + 10; x += 10) {
    const wx = x + G.cam * factor;
    ctx.lineTo(x, base - Math.sin(wx / 140) * amp - Math.sin(wx / 53) * amp * 0.35);
  }
  ctx.lineTo(VW, VH);
  ctx.closePath();
  ctx.fill();
}

function drawTile(t, tx, ty, x, y) {
  const th = G.theme;
  if (t === '#') {
    ctx.fillStyle = th.ground;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    if (hash(tx, ty) < 0.5) ctx.fillRect(x + 6, y + 14, 6, 4);
    if (hash(ty, tx) < 0.5) ctx.fillRect(x + 20, y + 22, 5, 4);
    const above = tileAt(tx, ty - 1);
    if (!SOLID.has(above)) {
      ctx.fillStyle = th.top;
      ctx.fillRect(x, y, T, 8);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) ctx.arc(x + 4 + i * 8, y + 8, 4, 0, Math.PI);
      ctx.fill();
    }
  } else if (t === '=') {
    ctx.fillStyle = th.stone;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x, y, T, 4); ctx.fillRect(x, y, 4, T);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, y + T - 4, T, 4); ctx.fillRect(x + T - 4, y, 4, T);
  } else if (t === 'B') {
    ctx.fillStyle = th.brick;
    ctx.fillRect(x, y, T, T);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 11); ctx.lineTo(x + T, y + 11);
    ctx.moveTo(x, y + 22); ctx.lineTo(x + T, y + 22);
    ctx.moveTo(x + 16, y); ctx.lineTo(x + 16, y + 11);
    ctx.moveTo(x + 8, y + 11); ctx.lineTo(x + 8, y + 22);
    ctx.moveTo(x + 24, y + 11); ctx.lineTo(x + 24, y + 22);
    ctx.moveTo(x + 16, y + 22); ctx.lineTo(x + 16, y + T);
    ctx.stroke();
    ctx.strokeRect(x + 1, y + 1, T - 2, T - 2);
  } else if (t === '?' || t === 'P') {
    const glow = 0.75 + 0.25 * Math.sin(now() * 5 + tx);
    ctx.fillStyle = `rgba(255,${Math.round(180 * glow)},40,1)`;
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(x, y, T, 4);
    ctx.fillStyle = 'rgba(120,60,0,0.5)';
    ctx.fillRect(x, y + T - 4, T, 4);
    drawDiamond(x + 16, y + 16, 8, '#fff', '#ffe9a8');
  } else if (t === 'X') {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(x, y, T, T);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 4, y + 4, T - 8, T - 8);
  } else if (t === '^') {
    ctx.fillStyle = '#c9ced8';
    ctx.strokeStyle = '#5a6070';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 8, y + T);
      ctx.lineTo(x + i * 8 + 4, y + 12);
      ctx.lineTo(x + i * 8 + 8, y + T);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (t === '~') {
    const lava = th.liquid === 'lava';
    const top = tileAt(tx, ty - 1) !== '~';
    ctx.fillStyle = lava ? '#ff5a1f' : '#2f8fe0';
    const wave = top ? 6 + Math.sin(now() * 3 + tx) * 3 : 0;
    ctx.fillRect(x, y + wave, T, T - wave);
    ctx.fillStyle = lava ? '#ffd23f' : '#9fdcff';
    if (top) ctx.fillRect(x, y + wave, T, 3);
  }
}

function drawDeco(kind, x, y, seed) {
  const t = now();
  switch (kind) {
    case 'flower': {
      ctx.strokeStyle = '#2f8a2f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.stroke();
      ctx.fillStyle = ['#ff6fa8', '#ffd84d', '#ffffff', '#b98cff'][Math.floor(seed * 4)];
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + Math.cos(i * 1.26) * 4, y - 14 + Math.sin(i * 1.26) * 4, 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.arc(x, y - 14, 2.5, 0, 7); ctx.fill();
      break;
    }
    case 'mushroom':
      ctx.fillStyle = '#f5ecd8'; ctx.fillRect(x - 3, y - 9, 6, 9);
      ctx.fillStyle = '#e03b3b'; ctx.beginPath(); ctx.arc(x, y - 9, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 13, 2, 0, 7); ctx.arc(x + 4, y - 11, 1.6, 0, 7); ctx.fill();
      break;
    case 'crystal':
      ctx.fillStyle = `rgba(140,230,255,${0.6 + 0.3 * Math.sin(t * 2 + seed * 9)})`;
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x - 3, y - 18); ctx.lineTo(x + 1, y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y - 12); ctx.lineTo(x + 8, y); ctx.fill();
      break;
    case 'cactus':
      ctx.fillStyle = '#3f9a4a';
      ctx.fillRect(x - 3, y - 22, 6, 22);
      ctx.fillRect(x - 10, y - 14, 4, 8); ctx.fillRect(x - 10, y - 10, 8, 4);
      ctx.fillRect(x + 6, y - 18, 4, 8); ctx.fillRect(x + 2, y - 14, 8, 4);
      break;
    case 'snow':
      ctx.fillStyle = '#2f6b4a';
      ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x - 10, y - 4); ctx.lineTo(x + 10, y - 4); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x - 5, y - 15); ctx.lineTo(x + 5, y - 15); ctx.fill();
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(x - 2, y - 4, 4, 4);
      break;
    case 'torch':
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 2, y - 16, 4, 16);
      ctx.fillStyle = '#ffb02e';
      ctx.beginPath(); ctx.ellipse(x, y - 20 - Math.sin(t * 12 + seed * 9) * 1.5, 4, 6 + Math.sin(t * 9) * 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(x, y - 19, 2, 0, 7); ctx.fill();
      break;
  }
}

function drawDiamond(x, y, r, c1, c2) {
  ctx.fillStyle = c1;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c2;
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.5, y); ctx.lineTo(x, y + r * 0.2); ctx.lineTo(x - r * 0.5, y);
  ctx.closePath();
  ctx.fill();
}

function drawStar(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawItem(it) {
  const t = now();
  const x = it.x + 12, y = it.y + 12 + Math.sin(t * 4 + it.id) * 3;
  ctx.save();
  ctx.shadowColor = '#fff6a0';
  ctx.shadowBlur = 12;
  switch (it.type) {
    case 'power': drawStar(x, y, 12, '#ffb000'); drawStar(x, y, 6, '#fff3a0'); break;
    case 'star': {
      const cols = ['#ff4d4d', '#ffb000', '#ffe600', '#3ddc84', '#3b82f6', '#a855f7'];
      cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 6, 12 - i * 2, Math.PI, 0); ctx.stroke(); });
      break;
    }
    case 'clock':
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 7); ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 2); ctx.stroke();
      break;
    case 'bomb':
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y + 2, 10, 0, 7); ctx.fill();
      ctx.strokeStyle = '#a0784a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 5, y - 6); ctx.lineTo(x + 9, y - 12); ctx.stroke();
      ctx.fillStyle = Math.sin(t * 20) > 0 ? '#ffd23f' : '#ff5a1f'; ctx.beginPath(); ctx.arc(x + 10, y - 13, 3, 0, 7); ctx.fill();
      break;
    case 'heart':
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath();
      ctx.moveTo(x, y + 10);
      ctx.bezierCurveTo(x - 16, y - 2, x - 6, y - 14, x, y - 5);
      ctx.bezierCurveTo(x + 6, y - 14, x + 16, y - 2, x, y + 10);
      ctx.fill();
      break;
    case 'bag': drawDiamond(x, y, 12, '#c084fc', '#f3e8ff'); break;
  }
  ctx.restore();
}

function darker(hex, f = 0.7) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// Pferd mit Reiterin. (x, y) = linke obere Ecke der Spielfigur.
function drawRider(x, y, o) {
  const c = COLORS[o.color % COLORS.length];
  const t = o.anim;
  ctx.save();
  ctx.translate(Math.round(x + PW / 2), Math.round(y + PH));
  if (!o.alive) { ctx.translate(0, -PH / 2); ctx.rotate(Math.PI); ctx.translate(0, -PH / 2); }
  ctx.scale(o.face * 0.86, 0.86);
  if (o.finished) ctx.translate(0, -Math.abs(Math.sin(t * 6)) * 8);

  if (o.star) {
    ctx.shadowColor = `hsl(${(t * 400) % 360},100%,60%)`;
    ctx.shadowBlur = 18;
  }
  const horse = c.horse, dark = darker(horse, 0.62);
  const flame = o.power >= 1;
  const moving = Math.abs(o.vx) > 20;

  // Beine
  const legs = [[12, 0], [8, Math.PI], [-10, 0.6], [-14, Math.PI + 0.6]];
  ctx.lineCap = 'round';
  for (const [hx, ph] of legs) {
    let a = 0;
    if (!o.onGround) a = hx > 0 ? -0.9 : 0.9;
    else if (moving) a = Math.sin(t * 16 + ph) * 0.65;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx, -22);
    const ex = hx + Math.sin(a) * 20, ey = -22 + Math.cos(a) * 20;
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(ex - 3, ey - 2, 6, 4);
  }

  // Schweif
  ctx.strokeStyle = flame ? '#ff7a1a' : c.mane;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-19, -30);
  ctx.quadraticCurveTo(-30, -30, -31, -14 + Math.sin(t * 10) * 3);
  ctx.stroke();

  // Körper, Hals und Kopf
  ctx.fillStyle = horse;
  ctx.beginPath(); ctx.ellipse(0, -28, 21, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -33); ctx.lineTo(18, -52); ctx.lineTo(27, -50); ctx.lineTo(21, -26); ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.translate(27, -48); ctx.rotate(0.5);
  ctx.beginPath(); ctx.ellipse(4, 0, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(19, -54); ctx.lineTo(21, -62); ctx.lineTo(24, -53); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(25, -51, 1.8, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(34, -42, 1.2, 0, 7); ctx.fill();

  // Mähne (mit Zauberkraft als Flamme)
  if (flame) {
    for (let i = 0; i < 5; i++) {
      const px = 18 - i * 2.4, py = -54 + i * 5;
      const fl = 6 + Math.sin(t * 20 + i) * 3;
      ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff5a1f';
      ctx.beginPath(); ctx.moveTo(px + 3, py); ctx.lineTo(px - fl, py - 2); ctx.lineTo(px + 1, py + 5); ctx.closePath(); ctx.fill();
    }
  } else {
    ctx.strokeStyle = c.mane; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(18, -55); ctx.lineTo(11, -34); ctx.stroke();
  }

  // Sattel
  ctx.fillStyle = '#5a2d0c';
  ctx.fillRect(-8, -40, 15, 5);
  ctx.fillStyle = c.shirt;
  ctx.fillRect(-9, -36, 17, 3);

  // Reiterin
  ctx.strokeStyle = '#2f3040'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-1, -40); ctx.lineTo(4, -28); ctx.stroke();
  ctx.fillStyle = '#1e1e24'; ctx.fillRect(2, -30, 6, 4);
  ctx.fillStyle = c.shirt;
  ctx.beginPath();
  ctx.moveTo(-7, -40); ctx.lineTo(-5, -58); ctx.lineTo(4, -58); ctx.lineTo(5, -40); ctx.closePath(); ctx.fill();
  // Arm und Zügel
  ctx.strokeStyle = c.shirt; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, -54); ctx.lineTo(13, -46); ctx.stroke();
  ctx.fillStyle = '#ffd9b3'; ctx.beginPath(); ctx.arc(14, -46, 2.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(14, -46); ctx.lineTo(30, -44); ctx.stroke();
  // Zopf
  ctx.strokeStyle = c.hair; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-5, -64); ctx.quadraticCurveTo(-14, -62, -16, -52 + Math.sin(t * 12) * 2); ctx.stroke();
  // Kopf und Reithelm
  ctx.fillStyle = '#ffd9b3';
  ctx.beginPath(); ctx.arc(0, -64, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.helmet;
  ctx.beginPath(); ctx.arc(0, -66, 7.6, Math.PI, 0); ctx.fill();
  ctx.fillRect(0, -67, 10, 2.5);
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(3.5, -63, 1.2, 0, 7); ctx.fill();
  ctx.restore();

  if (o.name) {
    // Gut lesbares Namensschild: weiße Schrift auf dunklem Grund, Farbstreifen in Spielerfarbe
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const w = ctx.measureText(o.name).width + 14;
    const bx = x + PW / 2 - w / 2, by = y - 33;
    ctx.fillStyle = 'rgba(20,10,40,0.78)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, w, 18, 6); ctx.fill(); } else ctx.fillRect(bx, by, w, 18);
    ctx.fillStyle = c.shirt;
    ctx.fillRect(bx + 4, by + 15, w - 8, 3);
    ctx.fillStyle = '#fff';
    ctx.fillText(o.name, x + PW / 2, by + 13);
  }
}

function drawEnemy(e) {
  const t = now() + e.id;
  const frozen = now() < G.frozenUntil;
  const x = e.x, y = e.y, cx = x + 14;
  ctx.save();
  switch (e.type) {
    case 'k': {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = frozen ? 0 : Math.sin(t * 14 + i) * 3;
        ctx.beginPath(); ctx.moveTo(x + 6 + i * 8, y + 20); ctx.lineTo(x + 4 + i * 8 + a, y + 28); ctx.stroke();
      }
      ctx.fillStyle = '#b3261e';
      ctx.beginPath(); ctx.ellipse(cx, y + 16, 14, 11, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(x, y + 15, 28, 6);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx - 5, y + 11, 2.5, 0, 7); ctx.arc(cx + 5, y + 9, 2.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + e.face * 14, y + 18, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + e.face * 15, y + 17, 1.6, 0, 7); ctx.fill();
      break;
    }
    case 'i': {
      ctx.fillStyle = '#6b4a2a';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.2) * 11, y + 20 + Math.sin(a - 0.2) * 11);
        ctx.lineTo(cx + Math.cos(a) * 19, y + 20 + Math.sin(a) * 19);
        ctx.lineTo(cx + Math.cos(a + 0.2) * 11, y + 20 + Math.sin(a + 0.2) * 11);
        ctx.fill();
      }
      ctx.fillStyle = '#8a6440';
      ctx.beginPath(); ctx.ellipse(cx, y + 20, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c9a0';
      ctx.beginPath(); ctx.ellipse(cx + e.face * 11, y + 22, 6, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx + e.face * 16, y + 22, 1.8, 0, 7); ctx.arc(cx + e.face * 9, y + 19, 1.5, 0, 7); ctx.fill();
      break;
    }
    case 'w': {
      const flap = frozen ? 0 : Math.sin(t * 40) * 5;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(cx - 3, y + 4 - flap * 0.5, 7, 4 + flap * 0.3, -0.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 5, y + 3 - flap * 0.5, 7, 4 + flap * 0.3, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.ellipse(cx, y + 14, 13, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillRect(cx - 6, y + 7, 3, 14); ctx.fillRect(cx + 1, y + 7, 3, 14);
      ctx.beginPath(); ctx.moveTo(cx - e.face * 13, y + 13); ctx.lineTo(cx - e.face * 19, y + 15); ctx.lineTo(cx - e.face * 13, y + 17); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + e.face * 9, y + 12, 2, 0, 7); ctx.fill();
      break;
    }
    case 'f': {
      ctx.fillStyle = '#3cb043';
      ctx.beginPath(); ctx.ellipse(cx, y + 19, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9be37a';
      ctx.beginPath(); ctx.ellipse(cx, y + 22, 9, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3cb043';
      ctx.beginPath(); ctx.arc(cx - 6, y + 10, 5, 0, 7); ctx.arc(cx + 6, y + 10, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 6, y + 9, 3, 0, 7); ctx.arc(cx + 6, y + 9, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(cx - 6 + e.face, y + 9, 1.5, 0, 7); ctx.arc(cx + 6 + e.face, y + 9, 1.5, 0, 7); ctx.fill();
      break;
    }
  }
  if (frozen) {
    ctx.fillStyle = 'rgba(160,215,255,0.55)';
    ctx.fillRect(x - 2, y - 2, 32, 32);
  }
  ctx.restore();
}

function drawShoe(x, y) {
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(x + 7, y + 7, 6, Math.PI * 0.15 + now() * 12, Math.PI * 1.85 + now() * 12);
  ctx.stroke();
}

function drawFlag() {
  const x = G.map.flagX + 14;
  const base = (ROWS - 2) * T;
  ctx.fillStyle = '#ddd';
  ctx.fillRect(x, base - 5 * T, 4, 5 * T);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(x + 2, base - 5 * T, 6, 0, 7); ctx.fill();
  const wave = Math.sin(now() * 6) * 4;
  ctx.fillStyle = '#ff4d8d';
  ctx.beginPath();
  ctx.moveTo(x + 4, base - 5 * T + 6);
  ctx.quadraticCurveTo(x + 24, base - 5 * T + 6 + wave, x + 44, base - 5 * T + 18);
  ctx.quadraticCurveTo(x + 24, base - 5 * T + 26 + wave, x + 4, base - 5 * T + 34);
  ctx.fill();
  drawStar(x + 20, base - 5 * T + 20, 6, '#fff');
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawSky();
  ctx.translate(0, offY);
  const th = G.theme;
  drawHills(th.far, 0.2, VH * 0.55, 40);
  drawHills(th.near, 0.45, VH * 0.7, 30);
  if (SH - offY > VH) {
    ctx.fillStyle = darker(th.ground, 0.45);
    ctx.fillRect(0, VH, VW, SH - offY - VH);
  }

  const cam = Math.round(G.cam);
  ctx.translate(-cam, 0);
  const tx0 = Math.max(0, Math.floor(cam / T) - 1), tx1 = Math.min(G.map.w - 1, Math.ceil((cam + VW) / T));
  const tnow = now();
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = G.map.t[ty][tx];
      if (t === '.') continue;
      let y = ty * T;
      const b = G.bumps.get(tx + ',' + ty);
      if (b != null) {
        const p = (tnow - b) / 0.15;
        if (p >= 1) G.bumps.delete(tx + ',' + ty);
        else y -= Math.sin(p * Math.PI) * 8;
      }
      drawTile(t, tx, ty, tx * T, y);
      if (t === '#' && tileAt(tx, ty - 1) === '.' && hash(tx, 7) < 0.22) drawDeco(th.deco, tx * T + 16, ty * T, hash(tx, 8));
    }
  }

  drawFlag();

  for (const g of G.map.gems) {
    if (G.gemsTaken.has(g.i) || g.x < cam - 40 || g.x > cam + VW + 40) continue;
    drawDiamond(g.x + 10, g.y + 10 + Math.sin(tnow * 3 + g.i) * 2, 9, '#38e1ff', '#d6fbff');
  }
  for (const it of G.items.values()) drawItem(it);
  for (const e of G.enemies) if (e.alive && e.x > cam - 60 && e.x < cam + VW + 60) drawEnemy(e);

  for (const p of Object.values(G.players)) {
    if (p.id === G.myId || !p.s || p.rx == null) continue;
    const f = p.s[5];
    if (f & 64) continue;
    for (const s of p.s[6] || []) drawShoe(s[0], s[1]);
    if (!(f & 1)) continue;
    if ((f & 16) && Math.floor(tnow * 10) % 2) continue;
    drawRider(p.rx, p.ry, {
      color: p.color, face: p.s[4], anim: p.anim || 0, vx: p.s[2], onGround: Math.abs(p.s[3]) < 5,
      alive: true, power: (f >> 1) & 3, star: !!(f & 8), finished: !!(f & 32), name: p.name,
    });
  }

  for (const s of G.shoes) drawShoe(s.x, s.y);
  if (!me.out && G.mode === 'play' && !(me.inv > 0 && me.alive && Math.floor(tnow * 10) % 2)) {
    const info = myInfo();
    drawRider(me.x, me.y, {
      color: me.color, face: me.face, anim: me.anim, vx: me.vx, onGround: me.onGround, alive: me.alive,
      power: me.power, star: me.star > 0, finished: me.finished, name: info ? info.name : '',
    });
  }

  for (const p of G.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.type === 'spark') { ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
    else if (p.type === 'debris') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
    } else if (p.type === 'gem') drawDiamond(p.x, p.y, 9, '#38e1ff', '#d6fbff');
    else if (p.type === 'text') {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y);
    }
  }
  ctx.globalAlpha = 1;

  if (G.flash > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${G.flash})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (G.mode === 'play') drawHud();
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(10,10,30,0.55)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 10); else ctx.rect(x, y, w, h);
  ctx.fill();
}

function drawHud() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = innerWidth;
  const small = W < 700;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const info = myInfo() || { lives: 0, gems: 0, score: 0 };

  panel(10, 10, small ? 190 : 250, 54);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${small ? 12 : 14}px system-ui, sans-serif`;
  ctx.fillText(`Level ${G.level} · ${G.theme.name}`, 20, 26);
  const time = Math.max(0, Math.ceil(G.time));
  ctx.fillStyle = time <= 30 ? '#ff8a8a' : '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(`⏱ ${time}`, (small ? 190 : 250), 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  let pw = '';
  if (me.power >= 1) pw += ' 🔥';
  if (me.power >= 2) pw += '🧲';
  if (me.star > 0) pw += ' 🌈' + Math.ceil(me.star);
  ctx.fillText(`❤ ${info.lives}   💎 ${info.gems}   ★ ${info.score}${pw}`, 20, 48);

  // Mitspieler-Liste
  const list = Object.values(G.players).sort((a, b) => a.color - b.color);
  const lw = small ? 150 : 200;
  panel(W - lw - 10, 10, lw, 12 + list.length * 20);
  const hudB = Math.round(10 + 12 + list.length * 20 + 8);
  if (hudB !== lastHudB) { lastHudB = hudB; document.documentElement.style.setProperty('--hud-bottom', hudB + 'px'); }
  ctx.font = `${small ? 11 : 13}px system-ui, sans-serif`;
  list.forEach((p, i) => {
    const y = 22 + i * 20;
    ctx.fillStyle = COLORS[p.color % COLORS.length].shirt;
    ctx.beginPath(); ctx.arc(W - lw + 4, y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    const f = p.id === G.myId ? myState()[5] : pFlags(p);
    const mark = f & 64 ? ' 💤' : f & 32 ? ' 🏁' : '';
    ctx.fillText(`${p.name}${mark}`, W - lw + 14, y);
    ctx.textAlign = 'right';
    ctx.fillText(`❤${p.lives} 💎${p.gems}`, W - 18, y);
    ctx.textAlign = 'left';
  });

  // Countdown und Hinweise
  ctx.textAlign = 'center';
  if (G.countdown > 0) {
    panel(W / 2 - 150, 74, 300, 36);
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(`🏁 Nächstes Level in ${Math.ceil(G.countdown)} …`, W / 2, 92);
  }
  G.toasts.forEach((t, i) => {
    ctx.globalAlpha = Math.min(1, t.t * 2);
    ctx.font = `bold ${small ? 12 : 15}px system-ui, sans-serif`;
    const w = Math.min(W - 20, ctx.measureText(t.text).width + 24);
    panel(W / 2 - w / 2, 120 + i * 34, w, 28);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, W / 2, 134 + i * 34, W - 30);
  });
  ctx.globalAlpha = 1;
  if (me.out) {
    panel(W / 2 - 160, innerHeight / 2 - 20, 320, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('💤 Du schaust zu – im nächsten Level bist du wieder dabei!', W / 2, innerHeight / 2, 300);
  }
}

// ---------------------------------------------------------------------------
// Menü, Warteraum, Einladen
// ---------------------------------------------------------------------------
function show(id) {
  $('overlay').hidden = false;
  for (const c of ['menu', 'lobby', 'msgBox']) $(c).hidden = c !== id;
}
function hideOverlay() { $('overlay').hidden = true; }

function shareUrl() {
  return `${location.origin}${location.pathname}?room=${G.code}`;
}

let qrDone = null;
function showLobby() {
  show('lobby');
  $('roomCode').textContent = G.code;
  $('shareLink').value = shareUrl();
  if (qrDone !== G.code && window.QRCode) {
    $('qr').innerHTML = '';
    new window.QRCode($('qr'), { text: shareUrl(), width: 150, height: 150 });
    qrDone = G.code;
  }
  const isHost = G.role === 'host';
  $('btnStart').hidden = !(isHost || G.mode === 'play');
  $('btnStart').textContent = G.mode === 'play' ? 'Zurück zum Spiel' : "Los geht's!";
  $('waitMsg').hidden = isHost || G.mode === 'play';
  updatePlayerList();
}

function updatePlayerList() {
  const ul = $('plist');
  ul.innerHTML = '';
  const list = Object.values(G.players).sort((a, b) => a.color - b.color);
  for (const p of list) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = COLORS[p.color % COLORS.length].shirt;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(p.name + (p.id === 'H' ? ' (Gastgeber)' : '') + (p.id === G.myId ? ' – du' : '')));
    ul.appendChild(li);
  }
  $('pcount').textContent = `${list.length} / ${MAX_PLAYERS}`;
}

function showMessage(title, text, solo = false) {
  show('msgBox');
  $('msgTitle').textContent = title;
  $('msgText').textContent = text;
  $('btnSolo').hidden = !solo;
}

function getName() {
  const n = cleanName($('name').value);
  try { localStorage.setItem('ss_name', n); } catch (_) { /* egal */ }
  return n;
}

async function startHost() {
  initAudio();
  const name = getName();
  $('err').textContent = 'Spiel wird erstellt …';
  G.net = new Net({ onMessage: hostMessage, onLeave: hostLeave, onClosed: () => {} });
  let code = null;
  for (let i = 0; i < 4 && !code; i++) {
    try { code = await G.net.hostGame(randomCode()); } catch (e) {
      if (!e.retry) {
        $('err').textContent = '';
        showMessage('Keine Verbindung', 'Das Spiel konnte nicht online gestellt werden: ' + (e.message || e.type || e) + ' Du kannst trotzdem allein spielen.', true);
        return;
      }
    }
  }
  $('err').textContent = '';
  becomeHost(code, name);
  history.replaceState(null, '', `?room=${code}`);
  showLobby();
}

function becomeHost(code, name) {
  G.role = 'host';
  G.myId = 'H';
  G.code = code;
  G.mode = 'lobby';
  me.color = 0;
  G.players = { H: newPlayer('H', name, 0) };
  loadLevel(1);
}

function startSolo() {
  G.net = { broadcast() {}, sendTo() {}, kick() {}, send() {} };
  becomeHost('SOLO', getName());
  change({ k: 'start', n: 1 });
}

async function startJoin(code) {
  initAudio();
  const name = getName();
  $('err').textContent = 'Verbinde …';
  G.role = 'client';
  G.code = code;
  G.net = new Net({
    onMessage: clientMessage,
    onLeave: () => {},
    onClosed: reason => { if (G.mode !== 'menu') { G.mode = 'menu'; showMessage('Spiel beendet', reason + ' Wenn der Gastgeber das Fenster schließt, endet das Spiel für alle.'); } },
  });
  try {
    G.myId = await G.net.joinGame(code);
    G.net.send({ t: 'hello', name });
    $('err').textContent = '';
  } catch (e) {
    $('err').textContent = e.message || String(e);
    G.role = null;
  }
}

function setupMenu() {
  let saved = '';
  try { saved = localStorage.getItem('ss_name') || ''; } catch (_) { /* egal */ }
  $('name').value = saved || 'Reiterin ' + Math.floor(Math.random() * 90 + 10);
  const room = new URLSearchParams(location.search).get('room');
  if (room) {
    const code = room.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    $('joinBox').hidden = false;
    $('joinCode').textContent = code;
    $('btnHost').textContent = 'Stattdessen eigenes Spiel starten';
    $('btnHost').classList.add('secondary');
    $('btnJoin').onclick = () => startJoin(code);
  }
  $('btnHost').onclick = startHost;
  $('btnStart').onclick = () => {
    if (G.mode === 'play') hideOverlay();
    else if (G.role === 'host') change({ k: 'start', n: 1 });
  };
  $('btnCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(shareUrl()); $('btnCopy').textContent = 'Kopiert ✓'; }
    catch (_) { $('shareLink').select(); document.execCommand('copy'); $('btnCopy').textContent = 'Kopiert ✓'; }
    setTimeout(() => { $('btnCopy').textContent = 'Kopieren'; }, 2000);
  };
  $('btnMsg').onclick = () => { location.href = location.pathname; };
  $('btnSolo').onclick = startSolo;
  $('btnInvite').onclick = () => { if (G.mode === 'play' && G.code !== 'SOLO') showLobby(); };
  $('btnMute').onclick = () => { initAudio(); setMuted(!muted); };
  $('btnRotateOk').onclick = () => { document.body.classList.add('rotate-ok'); };
  setMuted(muted);
  show('menu');
}

// ---------------------------------------------------------------------------
// Hauptschleife
// ---------------------------------------------------------------------------
let last = performance.now(), acc = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000);
  last = ts;
  if (G.mode === 'play' && G.map) {
    acc += dt;
    while (acc >= STEP) {
      updateMe(STEP);
      updateShoes(STEP);
      if (G.role === 'host') hostUpdate(STEP); else clientUpdate(STEP);
      updateParticles(STEP);
      updateRemote(STEP);
      updateCam(STEP);
      keys.jumpPressed = false;
      keys.firePressed = false;
      acc -= STEP;
    }
    document.body.classList.add('playing');
  } else {
    acc = 0;
    if (G.map) G.cam += dt * 40;
    if (G.map && G.cam > G.map.w * T - VW) G.cam = 0;
  }
  if (G.map) render();
  else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#6ec3ff'; ctx.fillRect(0, 0, cv.width, cv.height); }
  $('btnInvite').hidden = !(G.mode === 'play' && G.code && G.code !== 'SOLO');
  requestAnimationFrame(frame);
}

setupTouch();
resize();
setupMenu();
loadLevel(1);
G.mode = 'menu';
requestAnimationFrame(frame);

// Für Tests im Browser
window.__ss = { G, me };
