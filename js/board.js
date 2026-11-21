// Deterministic boards: the same (language, level) gives the same board in any browser. Spec §4.

// Difficulty knobs (spec §4.6). Calibrate with `node tools/levels.mjs <lang>`.
export const BIG_FROM = 11; // from this level on the grid is 5×5
const SHAPE_FROM = 40; // from this level on a board may be 6×6 or have a shape (pickShape)
const minCommon = cells => (cells === 16 ? 25 : 2 * cells); // minimum common words per board: 4×4 25, 5×5 50
const minLong = cells => (cells === 16 ? 6 : 7); // minimum length of the "prize word"
const GOLD_FROM = 4;
const LOCK_FROM = 15; // from this level on a tile may get locked for a few words (closed)
export const TURN_FROM = 20; // from this level on the board turns/mirrors once at half the target (game.js turn)
const WRONG_FROM = 25; // from this level on the board may go wrong way for a word, now and then (game.js read)
const FLIP_FROM = 30; // from this level on some letters are drawn upside down or mirrored (main.js renderBoard)
const HIDE_FROM = 35; // from this level on some tiles always show "?" (shown)
const MAX_TRIES = 500;
const POINTS = [0, 0, 0, 1, 2, 4, 7, 11]; // by length; 8 or more = 16

const pct = level => (level < BIG_FROM ? 0.2 + 0.025 * (level - 1) : Math.min(0.45, 0.25 + 0.01 * (level - BIG_FROM)));
const maxGold = level => (level < GOLD_FROM ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : 3);
const maxLocks = level => (level < LOCK_FROM ? 0 : level < 40 ? 1 : 2);
const maxHidden = level => (level < HIDE_FROM ? 0 : level < 50 ? 1 : 2);
const maxFlipped = level => (level < FLIP_FROM ? 0 : level < 40 ? 4 : 5);
// Letters that drawn each way would look the same, or like another one (M/W, P/d, U/n, J/f, V/Λ, J/L, Z/S).
const LOOKALIKE = { upside: 'HINOSXZMWVPUJ', mirror: 'AHIMOTUVWXYJLZ' };
const flipsOf = c => Object.keys(LOOKALIKE).filter(f => !LOOKALIKE[f].includes(c));
// Boards with a shape: '#' a tile, '.' a hole. Each one looks the same after any of the 8 symmetries of the square,
// so the board can still turn (turnCell). `tilt` is the 5×5, drawn turned 45° (style.css).
export const SHAPES = {
  tilt: ['#####', '#####', '#####', '#####', '#####'],
  diamond: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  spikes: ['...#...', '.#####.', '.#####.', '#######', '.#####.', '.#####.', '...#...'],
  cross: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
  octagon: ['..##..', '.####.', '######', '######', '.####.', '..##..'],
  donut: ['######', '######', '##..##', '##..##', '######', '######'],
};

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
  const gold = board.gold.map(g => ({ ...g, cell: to(g.cell) }));
  const move = x => ({ ...x, cell: to(x.cell) });
  return { ...board, letters, gold, hidden: board.hidden.map(to), flipped: board.flipped.map(move), locks: board.locks.map(move) };
}

// Letters as the player sees them: "?" on the hidden tiles. The real letter is still the one that counts.
export const shown = board => board.letters.map((c, i) => (board.hidden.includes(i) ? '?' : c));

// Lock tiles closed after finding `found` words: each closes at `at` words and opens `need` words later. Closed
// tiles can't be traced.
export const closed = (board, found) => board.locks.filter(k => found.length >= k.at && found.length < k.at + k.need).map(k => k.cell);

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
    if (letters[i] === null) return; // a hole (SHAPES)
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

// Path for `word` through as many `prefer` tiles as possible and none of `avoid`; null if it can't be traced.
export function pathFor(word, letters, prefer = [], avoid = []) {
  const adj = neighbors(Math.sqrt(letters.length));
  let best = null;
  let bestScore = -1;
  const path = [];
  const walk = i => {
    if (letters[i] !== word[path.length] || path.includes(i) || avoid.includes(i)) return;
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

// Hidden tiles: at least 8 common words through them (that leaves out X, Q, Ñ...) and not already special (`taken`).
function pickHidden(rand, level, through, taken) {
  const hidden = [];
  for (let k = 0; k < maxHidden(level); k++) {
    const options = through.map((_, c) => c).filter(c => through[c].size >= 8 && !taken.includes(c) && !hidden.includes(c));
    if (options.length) hidden.push(options[Math.floor(rand() * options.length)]);
  }
  return hidden;
}

// Letters drawn backwards: tiles not already special, each one flipped a way that doesn't make it ambiguous.
function pickFlipped(rand, level, letters, taken) {
  const flipped = [];
  for (let k = 0; k < maxFlipped(level); k++) {
    const options = letters.map((_, c) => c).filter(c => letters[c] && flipsOf(letters[c]).length && !taken.includes(c) && !flipped.some(f => f.cell === c));
    if (!options.length) break;
    const cell = options[Math.floor(rand() * options.length)];
    const ways = flipsOf(letters[cell]);
    flipped.push({ cell, flip: ways[Math.floor(rand() * ways.length)] });
  }
  return flipped;
}

// Locks: the tiles most common words go through, so opening one feels like a prize. The first one is closed from the
// start half the time, otherwise it closes after word 3-6; each opens 3-5 words later. One at a time: the next one
// closes 1-4 words after the previous one opened (two at once could leave too few words to open them).
function pickLocks(rand, level, through, taken) {
  const n = maxLocks(level) && rand() < 0.5 ? maxLocks(level) : 0;
  if (!n) return [];
  const best = through.map((_, c) => c).filter(c => !taken.includes(c)).sort((a, b) => through[b].size - through[a].size);
  let at = rand() < 0.5 ? 0 : 3 + Math.floor(rand() * 4);
  return best.slice(0, n).map(cell => {
    const lock = { cell, at, need: 3 + Math.floor(rand() * 3) };
    at += lock.need + 1 + Math.floor(rand() * 4);
    return lock;
  });
}

// Wrong way: after this many words, the next one that counts is traced backwards. Half the boards, 1-3 times: the
// first after word 3-6, each next one 4-8 words later; one word later if a lock closes on it (one surprise at a time).
function pickWrongWay(rand, level, lockAts) {
  if (level < WRONG_FROM || rand() >= 0.5) return [];
  const wrongWay = [];
  let at = 3 + Math.floor(rand() * 4);
  for (let n = 1 + Math.floor(rand() * 3); n > 0; n--) {
    if (lockAts.includes(at)) at++;
    wrongWay.push(at);
    at += 4 + Math.floor(rand() * 5);
  }
  return wrongWay;
}

// From SHAPE_FROM on: half the boards 5×5, a quarter 6×6, a quarter with a shape. With its own generator: drawing
// from the letters' one would change every board from there on, the 5×5 ones too.
function pickShape(lang, level) {
  const square = size => ({ shape: 'square', rows: Array(size).fill('#'.repeat(size)) });
  if (level < SHAPE_FROM) return square(level < BIG_FROM ? 4 : 5);
  const rand = mulberry32(fnv1a(`${lang}:${level}:shape`));
  const x = rand();
  if (x < 0.5) return square(5);
  if (x < 0.75) return square(6);
  const names = Object.keys(SHAPES);
  const shape = names[Math.floor(rand() * names.length)];
  return { shape, rows: SHAPES[shape] };
}

export function createBoard(lang, level, words, seed = `${lang}:${level}`) {
  const rand = mulberry32(fnv1a(seed));
  const d = prepare(words);
  const { shape, rows } = pickShape(lang, level);
  const size = rows.length;
  const mask = [...rows.join('')].map(c => c === '#');
  const cells = mask.filter(Boolean).length;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const letters = mask.map(on => (on ? weightedLetter(rand, d) : null)); // null: a hole
    const { found, through } = solve(letters, words);
    const common = [...found].filter(w => d.common.has(w)).sort();
    if (common.length < minCommon(cells) || !common.some(w => w.length >= minLong(cells))) continue;
    const commonPoints = common.reduce((n, w) => n + points(w), 0);
    // Each special tile is picked after the previous ones and only from its level on: earlier boards stay the same
    const gold = pickGold(rand, level, through);
    const hidden = pickHidden(rand, level, through, gold.map(g => g.cell));
    const flipped = pickFlipped(rand, level, letters, [...gold.map(g => g.cell), ...hidden]);
    const locks = pickLocks(rand, level, through, [...gold.map(g => g.cell), ...hidden, ...flipped.map(f => f.cell)]);
    return {
      size,
      shape,
      letters,
      gold,
      hidden,
      flipped,
      locks,
      wrongWay: pickWrongWay(rand, level, locks.map(k => k.at)),
      // Bigger boards ask for a bit less of what's there: halfway (in proportion) between the same share as a 5×5
      // and the same points
      threshold: Math.ceil(pct(level) * commonPoints * Math.min(1, Math.sqrt(25 / cells))),
      commonCount: common.length,
      missed: found => common.filter(w => !found.includes(w)),
    };
  }
  throw new Error(`no board for ${lang}:${level}`);
}
