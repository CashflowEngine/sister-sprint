// Level-Bausteine und Level-Generator.
// Jedes Level wird aus festen Bausteinen ("Chunks") zusammengesetzt.
// Die Auswahl hängt nur von der Levelnummer ab, deshalb sehen alle
// Spieler exakt dasselbe Level, ohne dass die Karte übertragen werden muss.

export const TILE = 32;
export const ROWS = 15;

// Feste Blöcke, auf denen man stehen kann
export const SOLID = new Set(['#', '=', 'B', '?', 'P', 'X']);

export const THEMES = [
  { name: 'Blumenwiese', sky: ['#6ec3ff', '#d9f2ff'], far: '#9ad89a', near: '#6fc36f', ground: '#9a5b2e', top: '#4cc24c', stone: '#c48a52', brick: '#c0563a', liquid: 'water', deco: 'flower', stars: false },
  { name: 'Zauberwald', sky: ['#24584a', '#9fd1ad'], far: '#3f8a5f', near: '#2a6b45', ground: '#5a3a22', top: '#3fa34d', stone: '#8a6a45', brick: '#9a4a30', liquid: 'water', deco: 'mushroom', stars: false },
  { name: 'Kristallhöhle', sky: ['#140c2b', '#3d2a66'], far: '#33275a', near: '#251c45', ground: '#4a3b6b', top: '#9a7ce0', stone: '#6c5aa0', brick: '#7d4aa0', liquid: 'water', deco: 'crystal', stars: true },
  { name: 'Sandwüste', sky: ['#ff9d5c', '#ffe7b0'], far: '#f0c27a', near: '#d9a05a', ground: '#c28a45', top: '#f2d27f', stone: '#b5773a', brick: '#b0502e', liquid: 'water', deco: 'cactus', stars: false },
  { name: 'Eisberge', sky: ['#8ccdff', '#f0f9ff'], far: '#dcefff', near: '#b8daf5', ground: '#6d93b8', top: '#ffffff', stone: '#8fb3d6', brick: '#7a9cc4', liquid: 'water', deco: 'snow', stars: false },
  { name: 'Ritterburg', sky: ['#22141a', '#6b3a2a'], far: '#4a3a40', near: '#35282e', ground: '#5a5a66', top: '#8a8a99', stone: '#77778a', brick: '#8a3a2a', liquid: 'lava', deco: 'torch', stars: true },
];

// Legende:
// .  leer          #  Boden          =  Steinblock      B  Ziegel (mit Feuer-Mähne zerschlagbar)
// ?  Bonusblock    P  Zauberblock    ^  Stacheln        ~  Wasser / Lava
// o  Diamant       k  Käfer          i  Igel (nicht draufspringen!)
// w  Wespe         f  Frosch         S  Start          F  Ziel-Flagge
// h  Hufeisen zum Einsammeln (gibt Wurf-Munition, jeder Spieler hat seine eigenen)
// Jeder Baustein hat 10 Zeilen (das sind die unteren 10 Zeilen des Levels).
const START = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....o.o.o......',
  '..S.......h.....',
  '################',
  '################',
];

const END = [
  '................',
  '................',
  '................',
  '................',
  '.......ooo......',
  '................',
  '................',
  '..........F.....',
  '################',
  '################',
];

const CHUNKS = [
  { d: 0, rows: [
    '................',
    '................',
    '................',
    '................',
    '....?B?B?.......',
    '................',
    '.......o.o......',
    '............h...',
    '################',
    '################',
  ] },
  { d: 0, rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....ooo........',
    '................',
    '..h.......k.....',
    '######...#######',
    '######...#######',
  ] },
  { d: 0, rows: [
    '................',
    '................',
    '................',
    '.......oo.......',
    '.......==.......',
    '......====......',
    '.....======.....',
    '....========....',
    '################',
    '################',
  ] },
  { d: 1, rows: [
    '................',
    '................',
    '.....o..o.......',
    '................',
    '....BBBBBB......',
    '................',
    '................',
    '.........i......',
    '################',
    '################',
  ] },
  { d: 1, rows: [
    '................',
    '................',
    '................',
    '.......ooo......',
    '................',
    '......====......',
    '................',
    '................',
    '####..........##',
    '####..........##',
  ] },
  { d: 0, rows: [
    '................',
    '................',
    '................',
    '................',
    '.....?...?......',
    '................',
    '................',
    '..h...^^^.......',
    '################',
    '################',
  ] },
  { d: 1, rows: [
    '................',
    '.........ooo....',
    '........====....',
    '................',
    '................',
    '...====.........',
    '.............w..',
    '................',
    '################',
    '################',
  ] },
  { d: 1, rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....o....o.....',
    '....==....==....',
    '................',
    '###..........###',
    '###~~~~~~~~~~###',
  ] },
  { d: 0, rows: [
    '................',
    '................',
    '................',
    '................',
    '......P.........',
    '................',
    '................',
    '...h.......f....',
    '################',
    '################',
  ] },
  { d: 1, rows: [
    '................',
    '................',
    '.....oooooo.....',
    '....========....',
    '................',
    '................',
    '..=.............',
    '..=....k....h...',
    '################',
    '################',
  ] },
  { d: 1, rows: [
    '................',
    '................',
    '.........o......',
    '................',
    '....?P?.........',
    '.........==.....',
    '.........==.....',
    '.........==.....',
    '################',
    '################',
  ] },
  { d: 2, rows: [
    '................',
    '................',
    '..........ooo...',
    '.........====...',
    '................',
    '....===.........',
    '................',
    '................',
    '##.............#',
    '##~~~~~~~~~~~~~#',
  ] },
  { d: 2, rows: [
    '................',
    '................',
    '................',
    '................',
    '...?.....?......',
    '................',
    '................',
    '.h.k...i...k..f.',
    '################',
    '################',
  ] },
  { d: 2, rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '...oo.oo.oo.....',
    '..BBB.BBB.BBB...',
    '................',
    '##^^^^^^^^^^^###',
    '################',
  ] },
  { d: 3, rows: [
    '................',
    '................',
    '................',
    '.......w........',
    '................',
    '..........===...',
    '................',
    '..h......f......',
    '#####...####....',
    '#####...####....',
  ] },
  { d: 1, rows: [
    '................',
    '.o.o.o.o.o.o.o..',
    '................',
    '................',
    '..?.?.P.?.?.....',
    '................',
    '................',
    '................',
    '################',
    '################',
  ] },
  { d: 3, rows: [
    '................',
    '................',
    '..w.......w.....',
    '................',
    '....?......P....',
    '................',
    '................',
    '..h..i....i.....',
    '##^^##########^^',
    '################',
  ] },
  { d: 2, rows: [
    '................',
    '................',
    '..........oo....',
    '................',
    '.........====...',
    '.....oo.........',
    '....====........',
    '..............k.',
    '##...........###',
    '##~~~~~~~~~~~###',
  ] },
];

// Kleiner Zufallsgenerator mit festem Startwert (gleiches Level überall)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function themeFor(level) {
  return THEMES[(level - 1) % THEMES.length];
}

// Sanfter Einstieg: Level 1 und 2 sind deutlich leichter, ab Level 3 gilt alles wie gehabt.
// ease = 1 (Level 1), 0.5 (Level 2), 0 (ab Level 3)
export function easeFor(level) {
  return level <= 1 ? 1 : level === 2 ? 0.5 : 0;
}

const hasWater = c => c.rows.some(r => r.includes('~'));

// Macht einen Baustein für die ersten Level freundlicher (immer gleich, damit alle Spieler dasselbe Level sehen)
function soften(rows, ease, nearStart) {
  return rows.map((r, i) => {
    let s = r;
    if (ease >= 1) {
      s = s.replace(/\^/g, '.');                      // keine Stacheln
      s = s.replace(/[iw]/g, '.');                     // kein Igel, keine Wespe
      if (i >= 8) s = s.replace(/#\.\.\.#/g, '##..#');  // Gruben nur 2 statt 3 Felder breit
    }
    if (ease > 0 && nearStart) s = s.replace(/[kiwf]/g, '.'); // keine Gegner direkt nach dem Start
    return s;
  });
}

export function buildLevel(level) {
  const rand = rng(level * 9973 + 17);
  const ease = easeFor(level);
  const maxD = Math.min(3, Math.floor((level + 1) / 2));
  // Level 1: nur die leichtesten Bausteine; Level 2: ohne Wasser-Gruben
  const pool = CHUNKS.filter(c => (ease >= 1 ? c.d === 0 : c.d <= maxD) && !(ease > 0 && hasWater(c)));
  const count = ease >= 1 ? 6 : ease > 0 ? 7 : 6 + Math.min(level, 10);
  const parts = [START];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let idx;
    do {
      // Höhere Level wählen bevorzugt schwerere Bausteine
      const pick = Math.floor(rand() * pool.length);
      const alt = Math.floor(rand() * pool.length);
      idx = level > 2 && pool[alt].d > pool[pick].d ? alt : pick;
    } while (idx === last && pool.length > 1);
    last = idx;
    parts.push(ease > 0 ? soften(pool[idx].rows, ease, i < 2) : pool[idx].rows);
  }
  parts.push(END);

  const width = parts.reduce((s, p) => s + p[0].length, 0);
  const t = [];
  for (let r = 0; r < ROWS; r++) t.push(new Array(width).fill('.'));

  const map = { w: width, t, gems: [], shoes: [], enemies: [], chunkStarts: [], spawn: { x: 64, y: 0 }, flagX: 0, level };
  let ox = 0;
  for (const rows of parts) {
    map.chunkStarts.push(ox);
    const w = rows[0].length;
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < w; c++) {
        const ch = rows[r][c];
        const x = ox + c, y = r + (ROWS - rows.length);
        if ('#=BP?^~'.includes(ch)) t[y][x] = ch;
        else if (ch === 'o') map.gems.push({ i: map.gems.length, x: x * TILE + 6, y: y * TILE + 6 });
        else if (ch === 'h') map.shoes.push({ i: map.shoes.length, x: x * TILE + 2, y: y * TILE + 2 });
        else if ('kiwf'.includes(ch)) map.enemies.push({ id: map.enemies.length, type: ch, x: x * TILE + 2, y: y * TILE + 4 });
        else if (ch === 'S') map.spawn = { x: x * TILE, y: y * TILE - 30 };
        else if (ch === 'F') map.flagX = x * TILE;
      }
    }
    // Sicherer Boden am Anfang jedes Bausteins: dort wird man nach einem Sturz wiederbelebt
    for (let c = 0; c < 2; c++) {
      for (let y = ROWS - 6; y < ROWS - 2; y++) if (t[y][ox + c] !== '#') t[y][ox + c] = '.';
      t[ROWS - 2][ox + c] = '#';
      t[ROWS - 1][ox + c] = '#';
    }
    ox += w;
  }
  return map;
}
