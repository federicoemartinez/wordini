// Puzzle diario determinista: misma (idioma, día) => mismo puzzle en cualquier navegador. Spec §4.
export const LAUNCH_DATE = [2026, 10, 9]; // año, mes 0-11, día: fecha del primer deploy público
export const RING = 10;
export const COLS = 5;
export const ROWS = 3;

// Días desde el lanzamiento según la fecha local. Date.UTC evita los días de 23/25 h por cambio de horario.
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, (local - Date.UTC(...LAUNCH_DATE)) / 86400000);
}

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

// Prefijos de valid (las palabras completas también son prefijos) y pesos de letras, una vez por lista.
const prepared = new WeakMap();
function prepare(words) {
  if (prepared.has(words)) return prepared.get(words);
  const prefixes = new Set();
  const counts = {};
  for (const w of words.valid) {
    for (let k = 1; k <= w.length; k++) prefixes.add(w.slice(0, k));
    for (const c of w) counts[c] = (counts[c] ?? 0) + 1;
  }
  const letters = [...words.alphabet].filter(c => counts[c]);
  let total = 0;
  const cumulative = letters.map(c => (total += counts[c]));
  const d = { prefixes, letters, cumulative, total };
  prepared.set(words, d);
  return d;
}

function weightedLetter(rand, d) {
  const x = rand() * d.total;
  return d.letters[d.cumulative.findIndex(c => x < c)];
}

// Cuenta combinaciones de offsets cuyas 3 filas son palabras válidas, columna por columna con poda.
// Corta en 2: solo importa si hay exactamente una.
function countSolutions(rings, prefixes) {
  const walk = (col, rows) => {
    if (col === COLS) return 1;
    let n = 0;
    for (let o = 0; o < RING && n < 2; o++) {
      const next = rows.map((r, k) => r + rings[col][(o + k) % RING]);
      if (next.every(p => prefixes.has(p))) n += walk(col + 1, next);
    }
    return n;
  };
  return walk(0, Array(ROWS).fill(''));
}

export function createPuzzle(lang, day, words) {
  const rand = mulberry32(fnv1a(`${lang}:${day}`));
  const d = prepare(words);
  for (let tries = 0; tries < 200; tries++) {
    const chosen = [];
    while (chosen.length < ROWS) {
      const w = words.answers[Math.floor(rand() * words.answers.length)];
      if (!chosen.includes(w)) chosen.push(w);
    }
    for (let fill = 0; fill < 20; fill++) {
      const rings = [];
      const solution = [];
      for (let i = 0; i < COLS; i++) {
        const p = Math.floor(rand() * RING);
        const ring = Array.from({ length: RING }, () => weightedLetter(rand, d));
        chosen.forEach((w, k) => (ring[(p + k) % RING] = w[i]));
        rings.push(ring);
        solution.push(p);
      }
      if (countSolutions(rings, d.prefixes) !== 1) continue;
      const start = solution.map(s => (s + 1 + Math.floor(rand() * (RING - 1))) % RING);
      return {
        rings,
        start,
        check: offsets => offsets.map((o, i) => o === solution[i]),
        reveal: () => ({ offsets: [...solution], words: [...chosen] }),
      };
    }
  }
  throw new Error(`no unique puzzle for ${lang}:${day}`);
}
