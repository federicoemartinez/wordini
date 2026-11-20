import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closed, createBoard, isValid, neighbors, pathFor, points, shown, solve, SHAPES, turnBoard, turnCell } from '../js/board.js';

const LANGS = ['es', 'en', 'fr'];
const words = Object.fromEntries(
  LANGS.map(l => [l, JSON.parse(readFileSync(new URL(`../words/${l}.json`, import.meta.url), 'utf8'))]),
);
const tiny = { alphabet: 'ACMORS', valid: ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC'], common: ['AMOR', 'CASA', 'ROMA'] };
// Letras que dibujadas así quedan iguales o parecen otra (M/W, P/d, U/n, J/f, V/Λ, J/L, Z/S): nunca se dan vuelta de esa forma.
const LOOKALIKE = { upside: 'HINOSXZMWVPUJ', mirror: 'AHIMOTUVWXYJLZ' };
const adjacent = (a, b, size) => a !== b && Math.abs((a % size) - (b % size)) <= 1 && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1;

// Primer nivel desde el 40 cuya cancha tiene la forma `shape`.
function firstLevel(l, shape) {
  for (let level = 40; ; level++) if (createBoard(l, level, words[l]).shape === shape) return level;
}

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

test('niveles 1-200: tamaño, forma, mínimos, umbral, doradas, ?, letras al revés, candados y contramano', () => {
  let withLocks = 0;
  let withWrong = 0;
  const kinds = { 5: 0, 6: 0, shape: 0 };
  const shapes = new Set();
  for (const l of LANGS) {
    for (let level = 1; level <= 200; level++) {
      const b = createBoard(l, level, words[l]);
      const id = `${l}:${level}`;
      if (level < 40) assert.deepEqual([b.shape, b.size], ['square', level <= 10 ? 4 : 5], id);
      else kinds[b.shape === 'square' ? b.size : 'shape']++;
      if (b.shape !== 'square') shapes.add(b.shape);
      const mask = b.shape === 'square' ? Array(b.size).fill('#'.repeat(b.size)) : SHAPES[b.shape];
      assert.equal(b.letters.map(c => (c === null ? '.' : '#')).join(''), mask.join(''), `${id}: ${b.shape}`);
      const cells = b.letters.filter(c => c !== null).length;
      const common = b.missed([]);
      assert.equal(common.length, b.commonCount, id);
      assert.ok(common.length >= (cells === 16 ? 25 : 2 * cells), id);
      assert.ok(common.some(w => w.length >= (cells === 16 ? 6 : 7)), id);
      const total = common.reduce((n, w) => n + points(w), 0);
      assert.ok(b.threshold > 0 && b.threshold <= total, id);
      // Desde el 40, pct ya está en su tope (0.45): las canchas grandes piden un poco menos (spec §5)
      if (level >= 40) assert.equal(b.threshold, Math.ceil(0.45 * total * Math.min(1, Math.sqrt(25 / cells))), `${id}: umbral`);
      const special = [...b.gold.map(g => g.cell), ...b.hidden, ...b.flipped.map(f => f.cell), ...b.locks.map(k => k.cell)];
      assert.ok(special.every(c => b.letters[c] !== null), `${id}: casilla especial en un hueco`);
      const maxGold = level < 4 ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : 3;
      assert.ok(b.gold.length <= maxGold, id);
      assert.equal(new Set(b.gold.map(g => g.cell)).size, b.gold.length, `${id}: doradas repetidas`);
      assert.equal(b.hidden.length, level < 35 ? 0 : level < 50 ? 1 : 2, id);
      assert.equal(new Set(b.hidden).size, b.hidden.length, `${id}: ? repetidos`);
      assert.equal(b.flipped.length, level < 30 ? 0 : level < 40 ? 4 : 5, id);
      assert.equal(new Set(b.flipped.map(f => f.cell)).size, b.flipped.length, `${id}: al revés repetidas`);
      for (const f of b.flipped) {
        assert.ok(f.flip in LOOKALIKE, `${id}: ${f.flip}`);
        assert.ok(!LOOKALIKE[f.flip].includes(b.letters[f.cell]), `${id}: ${b.letters[f.cell]} ${f.flip} es ambigua`);
        assert.ok(!b.hidden.includes(f.cell) && !b.gold.some(g => g.cell === f.cell), `${id}: al revés sobre otra especial`);
      }
      assert.ok(b.locks.length <= (level < 15 ? 0 : level < 40 ? 1 : 2), id);
      withLocks += b.locks.length > 0;
      const others = [...b.gold.map(g => g.cell), ...b.hidden, ...b.flipped.map(f => f.cell)];
      b.locks.forEach((k, n) => {
        assert.ok(k.need >= 3 && k.need <= 5, `${id}: candado ${n} pide ${k.need}`);
        const prev = b.locks[n - 1];
        const from = prev ? prev.at + prev.need + 1 : 3; // de a uno: se cierra después de que se abrió el anterior
        assert.ok((!prev && k.at === 0) || (k.at >= from && k.at <= from + 3), `${id}: candado ${n} se cierra en ${k.at}`);
        assert.ok(!others.includes(k.cell), `${id}: candado sobre otra especial`);
        // Armables sin pasar por él: alcanzan aunque todas las de antes de cerrarse hayan sido de estas
        const free = common.filter(w => pathFor(w, b.letters, [], [k.cell])).length;
        assert.ok(free >= k.at + k.need, `${id}: no alcanzan las palabras para abrir el candado ${n}`);
      });
      assert.equal(new Set(b.locks.map(k => k.cell)).size, b.locks.length, `${id}: candados repetidos`);
      assert.ok(b.wrongWay.length <= (level < 25 ? 0 : 3), id);
      withWrong += b.wrongWay.length > 0;
      const ats = b.locks.map(k => k.at);
      b.wrongWay.forEach((n, k) => {
        // La 1.ª después de la palabra 3-6, cada una 4-8 palabras después de la anterior; una más si caía con un candado
        const [lo, hi] = k ? [b.wrongWay[k - 1] + 4, b.wrongWay[k - 1] + 8] : [3, 6];
        assert.ok((n >= lo && n <= hi) || (n === hi + 1 && ats.includes(hi)), `${id}: contramano ${k} en ${n}`);
        assert.ok(!ats.includes(n), `${id}: contramano en la misma palabra que un candado`);
      });
      if (b.gold.length || b.hidden.length) {
        const { through } = solve(b.letters, words[l]);
        for (const g of b.gold) {
          assert.ok(g.need >= 1 && g.need <= 3, id);
          assert.ok(through[g.cell].size >= 3 * g.need, `${id}: dorada ${g.cell} sin margen`);
        }
        for (const c of b.hidden) {
          assert.ok(through[c].size >= 8, `${id}: ? en ${c} con pocas palabras`);
          assert.ok(!b.gold.some(g => g.cell === c), `${id}: ? sobre una dorada`);
        }
      }
    }
  }
  assert.ok(withLocks > 100 && withLocks < 400, `${withLocks} canchas con candado`); // más o menos la mitad desde el 15
  assert.ok(withWrong > 180 && withWrong < 350, `${withWrong} canchas con contramano`); // más o menos la mitad desde el 25
  // Del 40 al 200 (161 canchas por idioma): la mitad 5×5, un cuarto 6×6, un cuarto con forma, y salen todas las formas
  const n = 3 * 161;
  assert.ok(kinds[5] > 0.4 * n && kinds[5] < 0.6 * n, JSON.stringify(kinds));
  for (const k of [6, 'shape']) assert.ok(kinds[k] > 0.15 * n && kinds[k] < 0.35 * n, JSON.stringify(kinds));
  assert.deepEqual([...shapes].sort(), Object.keys(SHAPES).sort());
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

test('pathFor esquiva las casillas pedidas (candados cerrados)', () => {
  const letters = [...'ASAZAZZZZ']; // la misma de arriba
  assert.ok(!pathFor('ASA', letters, [], [2]).includes(2)); // termina en la del centro
  assert.equal(pathFor('ASA', letters, [], [1]), null); // la única S está cerrada
});

test('closed: cada candado se cierra al llegar a `at` palabras y se abre `need` palabras después', () => {
  const b = { locks: [{ cell: 7, at: 0, need: 3 }, { cell: 2, at: 5, need: 4 }] };
  assert.deepEqual(closed(b, []), [7]);
  assert.deepEqual(closed(b, [...'ABC']), []);
  assert.deepEqual(closed(b, [...'ABCDE']), [2]);
  assert.deepEqual(closed(b, [...'ABCDEFGH']), [2]);
  assert.deepEqual(closed(b, [...'ABCDEFGHI']), []);
  assert.deepEqual(closed({ locks: [] }, []), []);
});

test('shown: las casillas ocultas se ven como ?; con teclado se escribe el ? literal', () => {
  // C A
  // ? A    detrás del ? hay una S
  const b = { letters: [...'CASA'], hidden: [2] };
  assert.deepEqual(shown(b), [...'CA?A']);
  assert.deepEqual(pathFor('CA?A', shown(b)), [0, 1, 2, 3]);
  assert.equal(pathFor('CASA', shown(b)), null); // tipear la S no encuentra la casilla: no se filtra la letra
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
    for (const level of [55, firstLevel(l, 'donut')]) {
      const b = createBoard(l, level, words[l]);
      const before = [...solve(b.letters, words[l]).found].sort();
      for (let t = 1; t < 8; t++) {
        const to = turnCell(b.size, t);
        const c = turnBoard(b, t);
        assert.equal(new Set(b.letters.map((_, i) => to(i))).size, b.letters.length, `${l} ${t}: no es una permutación`);
        b.letters.forEach((x, i) => assert.equal(c.letters[to(i)], x));
        assert.deepEqual(c.gold, b.gold.map(g => ({ ...g, cell: to(g.cell) })));
        assert.deepEqual(c.hidden, b.hidden.map(to));
        assert.deepEqual(c.flipped, b.flipped.map(f => ({ ...f, cell: to(f.cell) })));
        assert.deepEqual(c.locks, b.locks.map(k => ({ ...k, cell: to(k.cell) })));
        assert.deepEqual([...solve(c.letters, words[l]).found].sort(), before, `${l} ${t}`);
        assert.deepEqual(c.missed([]), b.missed([]));
      }
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

test('formas: cuadradas y simétricas ante las 8 simetrías del cuadrado (la cancha puede girar)', () => {
  for (const [name, rows] of Object.entries(SHAPES)) {
    const on = rows.join('');
    assert.ok(rows.every(r => r.length === rows.length) && /^[#.]+$/.test(on), name);
    for (let t = 1; t < 8; t++) {
      const to = turnCell(rows.length, t);
      for (let i = 0; i < on.length; i++) assert.equal(on[to(i)], on[i], `${name}: la simetría ${t} lleva ${i} a ${to(i)}`);
    }
  }
});

test('solve y pathFor saltean los huecos', () => {
  // C A ·
  // · S A      se arman CASA y SAC; los huecos (·) no tienen palabras
  // · · ·
  const letters = ['C', 'A', null, null, 'S', 'A', null, null, null];
  const { found, through } = solve(letters, tiny);
  assert.deepEqual([...found].sort(), ['CASA', 'SAC']);
  for (const i of [2, 3, 6, 7, 8]) assert.equal(through[i].size, 0, `hueco ${i}`);
  assert.deepEqual(pathFor('CASA', letters), [0, 1, 4, 5]);
  assert.equal(pathFor('CASAS', letters), null);
});
