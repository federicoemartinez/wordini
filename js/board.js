// Deterministic boards: the same (language, level) gives the same board in any browser. Spec §4.

// Difficulty knobs (spec §4.6). Calibrate with `node tools/levels.mjs <lang>`.
const BIG_FROM = 11; // from this level on the grid is 5×5
const MIN_COMMON = { 4: 25, 5: 50 }; // minimum common words per board
const LONG = { 4: 6, 5: 7 }; // minimum length of the "prize word"
const GOLD_FROM = 4;
export const TURN_FROM = 20; // from this level on the board turns/mirrors once at half the target (game.js turn)
const MAX_TRIES = 500;
const POINTS = [0, 0, 0, 1, 2, 4, 7, 11]; // by length; 8 or more = 16

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

// First index in the sorted `list` whose value is >= s.
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

// Neighbors of each tile (8 directions) in a size×size grid numbered row by row.
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

// Symmetry t (0-7) of the square: mirror left-right if t >= 4, then t % 4 quarter turns clockwise. Returns where
// each tile goes. Neighbors stay neighbors, so the same words can be traced; they're only somewhere else.
export const turnCell = (size, t) => i => {
  let r = Math.floor(i / size);
  let c = t >= 4 ? size - 1 - (i % size) : i % size;
  for (let q = 0; q < t % 4; q++) [r, c] = [c, size - 1 - r];
  return r * size + c;
};

export function turnBoard(board, t) {
  const to = turnCell(board.size, t);
  const letters = [];
  board.letters.forEach((c, i) => (letters[to(i)] = c));
  return { ...board, letters, gold: board.gold.map(g => ({ ...g, cell: to(g.cell) })) };
}

// `common` as a Set plus letter weights, computed once per list.
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

// Every `valid` word that can be traced, and per tile the common words that can go through it.
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

// Path for `word` through as many `prefer` tiles as possible; null if it can't be traced.
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

// Gold tiles: tiles with at least 3×need common words through them. If there aren't enough, lower need or place fewer.
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
