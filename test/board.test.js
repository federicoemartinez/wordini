import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoard, isValid, neighbors, pathFor, points, solve, turnBoard, turnCell } from '../js/board.js';

const LANGS = ['es', 'en', 'fr'];
const words = Object.fromEntries(
  LANGS.map(l => [l, JSON.parse(readFileSync(new URL(`../words/${l}.json`, import.meta.url), 'utf8'))]),
);
const tiny = { alphabet: 'ACMORS', valid: ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC'], common: ['AMOR', 'CASA', 'ROMA'] };
const adjacent = (a, b, size) => a !== b && Math.abs((a % size) - (b % size)) <= 1 && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1;

// Otra implementación, sin poda ni bisección: ¿se puede armar `word` en la grilla?
function onBoard(letters, word) {
  const size = Math.sqrt(letters.length);
  const from = (i, k, used) => {
    if (letters[i] !== word[k] || used.includes(i)) return false;
    if (k === word.length - 1) return true;
    return letters.some((_, j) => adjacent(i, j, size) && from(j, k + 1, [...used, i]));
  };
  return letters.some((_, i) => from(i, 0, []));
}

test('puntos por largo', () => {
  assert.deepEqual(['SOL', 'CASA', 'PERRO', 'CAMION', 'ESCALON', 'COLEGIOS', 'PERIODICAS'].map(points), [1, 2, 4, 7, 11, 16, 16]);
});

test('isValid busca por bisección en valid', () => {
  assert.ok(isValid(tiny, 'CASA'));
  assert.ok(!isValid(tiny, 'CAS'));
  assert.ok(!isValid(tiny, 'ZZZ'));
});

test('vecinas: esquina, borde y centro en 4×4', () => {
  const n = neighbors(4);
  assert.deepEqual(n[0], [1, 4, 5]);
  assert.deepEqual(n[1], [0, 2, 4, 5, 6]);
  assert.deepEqual(n[5], [0, 1, 2, 4, 6, 8, 9, 10]);
});

test('solve en una grilla armada a mano', () => {
  // C A S A
  // M O R S
  // . . . .   (Z no está en el alfabeto chico: nunca forma nada)
  const letters = [...'CASAMORSZZZZZZZZ'];
  const { found, through } = solve(letters, tiny);
  assert.deepEqual([...found].sort(), ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC']);
  assert.deepEqual([...through[0]].sort(), ['CASA']); // la C solo sirve para CASA entre las comunes
  assert.deepEqual([...through[5]].sort(), ['AMOR', 'ROMA']); // la O
  assert.equal(through[8].size, 0);
});

test('mismo idioma y nivel dan la misma cancha; otro nivel da otra', () => {
  const a = createBoard('es', 7, words.es);
  const b = createBoard('es', 7, words.es);
  assert.deepEqual([a.letters, a.gold, a.threshold], [b.letters, b.gold, b.threshold]);
  assert.notDeepEqual(createBoard('es', 8, words.es).letters, a.letters);
});

test('niveles 1-200: tamaño, mínimos, umbral y doradas', () => {
  for (const l of LANGS) {
    for (let level = 1; level <= 200; level++) {
      const b = createBoard(l, level, words[l]);
      const id = `${l}:${level}`;
      const size = level <= 10 ? 4 : 5;
      assert.equal(b.size, size, id);
      assert.equal(b.letters.length, size * size, id);
      const common = b.missed([]);
      assert.equal(common.length, b.commonCount, id);
      assert.ok(common.length >= (size === 4 ? 25 : 50), id);
      assert.ok(common.some(w => w.length >= (size === 4 ? 6 : 7)), id);
      const total = common.reduce((n, w) => n + points(w), 0);
      assert.ok(b.threshold > 0 && b.threshold <= total, id);
      const maxGold = level < 4 ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : 3;
      assert.ok(b.gold.length <= maxGold, id);
      assert.equal(new Set(b.gold.map(g => g.cell)).size, b.gold.length, `${id}: doradas repetidas`);
      if (b.gold.length) {
        const { through } = solve(b.letters, words[l]);
        for (const g of b.gold) {
          assert.ok(g.need >= 1 && g.need <= 3, id);
          assert.ok(through[g.cell].size >= 3 * g.need, `${id}: dorada ${g.cell} sin margen`);
        }
      }
    }
  }
});

test('las comunes del solver coinciden con una búsqueda independiente', () => {
  for (const l of LANGS) {
    for (const level of [1, 6, 15, 42]) {
      const b = createBoard(l, level, words[l]);
      const expected = words[l].common.filter(w => onBoard(b.letters, w));
      assert.deepEqual(b.missed([]), expected, `${l}:${level}`);
    }
  }
});

test('pathFor: camino válido o null si no se puede armar', () => {
  const b = createBoard('es', 3, words.es);
  for (const w of b.missed([]).slice(0, 30)) {
    const p = pathFor(w, b.letters);
    assert.equal(p.map(i => b.letters[i]).join(''), w);
    assert.equal(new Set(p).size, p.length);
    for (let k = 1; k < p.length; k++) assert.ok(adjacent(p[k - 1], p[k], b.size), w);
  }
  assert.equal(pathFor('QQQQ', b.letters), null);
  assert.equal(pathFor('', b.letters), null);
});

test('pathFor prefiere el camino que pasa por las casillas pedidas', () => {
  // A S A
  // Z A Z      "ASA" se arma terminando en la A de la esquina (2) o en la del centro (4)
  // Z Z Z
  const letters = [...'ASAZAZZZZ'];
  assert.ok(pathFor('ASA', letters, [4]).includes(4));
  assert.ok(pathFor('ASA', letters, [2]).includes(2));
  assert.equal(pathFor('ASAS', letters), null); // hay una sola S
});

test('turnCell: giro horario y espejo en 3×3', () => {
  // 0 1 2      giro: 6 3 0     espejo: 2 1 0
  // 3 4 5            7 4 1             5 4 3
  // 6 7 8            8 5 2             8 7 6
  const layout = t => {
    const out = [];
    for (let i = 0; i < 9; i++) out[turnCell(3, t)(i)] = i;
    return out;
  };
  assert.deepEqual(layout(1), [6, 3, 0, 7, 4, 1, 8, 5, 2]);
  assert.deepEqual(layout(2), [8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(layout(4), [2, 1, 0, 5, 4, 3, 8, 7, 6]);
  assert.deepEqual(layout(0), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});

test('turnBoard: las 7 simetrías mueven todo y dejan las mismas palabras', () => {
  for (const l of LANGS) {
    const b = createBoard(l, 25, words[l]);
    const before = [...solve(b.letters, words[l]).found].sort();
    for (let t = 1; t < 8; t++) {
      const to = turnCell(b.size, t);
      const c = turnBoard(b, t);
      assert.equal(new Set(b.letters.map((_, i) => to(i))).size, b.letters.length, `${l} ${t}: no es una permutación`);
      b.letters.forEach((x, i) => assert.equal(c.letters[to(i)], x));
      assert.deepEqual(c.gold, b.gold.map(g => ({ ...g, cell: to(g.cell) })));
      assert.deepEqual([...solve(c.letters, words[l]).found].sort(), before, `${l} ${t}`);
      assert.deepEqual(c.missed([]), b.missed([]));
    }
  }
});

test('rendimiento: createBoard 5×5 tarda menos de 50 ms en promedio', () => {
  for (const l of LANGS) {
    const t0 = performance.now();
    for (let level = 11; level <= 60; level++) createBoard(l, level, words[l]);
    const avg = (performance.now() - t0) / 50;
    assert.ok(avg < 50, `${l}: ${avg.toFixed(1)} ms promedio`);
  }
});
