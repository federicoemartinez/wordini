// Canchas deterministas: el mismo (idioma, nivel) da la misma cancha en cualquier navegador. Spec §4.

// Perillas de dificultad (spec §4.6). Se calibran con `node tools/levels.mjs <lang>`.
const BIG_FROM = 11; // desde este nivel la grilla es 5×5
const MIN_COMMON = { 4: 25, 5: 50 }; // palabras comunes mínimas por cancha
const LONG = { 4: 6, 5: 7 }; // largo mínimo de la "palabra premio"
const GOLD_FROM = 4;
const MAX_TRIES = 500;
const POINTS = [0, 0, 0, 1, 2, 4, 7, 11]; // por largo; 8 o más = 16

const pct = level => (level < BIG_FROM ? 0.2 + 0.025 * (level - 1) : Math.min(0.45, 0.25 + 0.01 * (level - BIG_FROM)));
const maxGold = level => (level < GOLD_FROM ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : 3);

export const points = word => POINTS[word.length] ?? 16;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Primera posición de `list` (ordenada) con un valor >= s.
function lowerBound(list, s) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const isValid = (words, w) => words.valid[lowerBound(words.valid, w)] === w;
const isPrefix = (words, p) => words.valid[lowerBound(words.valid, p)]?.startsWith(p) ?? false;

// Vecinas de cada casilla (8 direcciones) en una grilla size×size numerada por filas.
export function neighbors(size) {
  return Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < size && cc >= 0 && cc < size) out.push(rr * size + cc);
      }
    }
    return out;
  });
}

// `common` como Set y pesos de letras, una vez por lista.
const prepared = new WeakMap();
function prepare(words) {
  if (prepared.has(words)) return prepared.get(words);
  const counts = {};
  for (const w of words.common) for (const c of w) counts[c] = (counts[c] ?? 0) + 1;
  const letters = [...words.alphabet].filter(c => counts[c]);
  let total = 0;
  const cumulative = letters.map(c => (total += counts[c]));
  const d = { common: new Set(words.common), letters, cumulative, total };
  prepared.set(words, d);
  return d;
}

function weightedLetter(rand, d) {
  const x = rand() * d.total;
  return d.letters[d.cumulative.findIndex(c => x < c)];
}

// Todas las palabras de `valid` que se pueden armar, y por casilla las comunes que pueden pasar por ella.
export function solve(letters, words) {
  const d = prepare(words);
  const adj = neighbors(Math.sqrt(letters.length));
  const found = new Set();
  const through = letters.map(() => new Set());
  const path = [];
  const walk = (i, s) => {
    s += letters[i];
    if (!isPrefix(words, s)) return;
    path.push(i);
    if (s.length >= 3 && isValid(words, s)) {
      found.add(s);
      if (d.common.has(s)) for (const c of path) through[c].add(s);
    }
    for (const j of adj[i]) if (!path.includes(j)) walk(j, s);
    path.pop();
  };
  letters.forEach((_, i) => walk(i, ''));
  return { found, through };
}

// Camino para `word` que pase por la mayor cantidad posible de casillas de `prefer`; null si no se puede armar.
export function pathFor(word, letters, prefer = []) {
  const adj = neighbors(Math.sqrt(letters.length));
  let best = null;
  let bestScore = -1;
  const path = [];
  const walk = i => {
    if (letters[i] !== word[path.length] || path.includes(i)) return;
    path.push(i);
    if (path.length === word.length) {
      const score = path.filter(c => prefer.includes(c)).length;
      if (score > bestScore) [best, bestScore] = [[...path], score];
    } else {
      for (const j of adj[i]) walk(j);
    }
    path.pop();
  };
  if (word) letters.forEach((_, i) => walk(i));
  return best;
}

// Doradas: casillas por las que pasan al menos 3×need comunes. Si no alcanzan, baja need o pone menos.
function pickGold(rand, level, through) {
  const n = maxGold(level) && rand() < 0.5 ? 1 + Math.floor(rand() * maxGold(level)) : 0;
  const gold = [];
  for (let g = 0; g < n; g++) {
    let need = 1 + Math.floor(rand() * 3);
    const free = through.map((_, c) => c).filter(c => !gold.some(x => x.cell === c));
    let options;
    while (need > 0 && !(options = free.filter(c => through[c].size >= 3 * need)).length) need--;
    if (need) gold.push({ cell: options[Math.floor(rand() * options.length)], need });
  }
  return gold;
}

export function createBoard(lang, level, words) {
  const rand = mulberry32(fnv1a(`${lang}:${level}`));
  const d = prepare(words);
  const size = level < BIG_FROM ? 4 : 5;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const letters = Array.from({ length: size * size }, () => weightedLetter(rand, d));
    const { found, through } = solve(letters, words);
    const common = [...found].filter(w => d.common.has(w)).sort();
    if (common.length < MIN_COMMON[size] || !common.some(w => w.length >= LONG[size])) continue;
    const commonPoints = common.reduce((n, w) => n + points(w), 0);
    return {
      size,
      letters,
      gold: pickGold(rand, level, through),
      threshold: Math.ceil(pct(level) * commonPoints),
      commonCount: common.length,
      missed: found => common.filter(w => !found.includes(w)),
    };
  }
  throw new Error(`no board for ${lang}:${level}`);
}
