import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPuzzle, dayNumber, LAUNCH_DATE } from '../js/puzzle.js';

const LANGS = ['es', 'en', 'fr'];
const words = Object.fromEntries(
  LANGS.map(l => [l, JSON.parse(readFileSync(new URL(`../words/${l}.json`, import.meta.url), 'utf8'))]),
);

// Búsqueda tonta sobre los 10^5 offsets, sin poda: verificación independiente del generador.
function bruteForce(rings, valid) {
  const found = [];
  for (let n = 0; n < 100000; n++) {
    const o = [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100) % 10, Math.floor(n / 1000) % 10, Math.floor(n / 10000)];
    let ok = true;
    for (let k = 0; k < 3 && ok; k++) ok = valid.has(rings.map((r, i) => r[(o[i] + k) % 10]).join(''));
    if (ok) found.push(o);
  }
  return found;
}

test('mismo idioma y día dan el mismo puzzle; otro día da otro', () => {
  const a = createPuzzle('es', 7, words.es);
  const b = createPuzzle('es', 7, words.es);
  assert.deepEqual(a.rings, b.rings);
  assert.deepEqual(a.start, b.start);
  assert.deepEqual(a.reveal(), b.reveal());
  assert.notDeepEqual(createPuzzle('es', 8, words.es).rings, a.rings);
});

test('forma: 5 anillos de 10 letras del alfabeto', () => {
  for (const l of LANGS) {
    const p = createPuzzle(l, 0, words[l]);
    assert.equal(p.rings.length, 5);
    for (const ring of p.rings) {
      assert.equal(ring.length, 10);
      for (const c of ring) assert.ok(words[l].alphabet.includes(c), `${l}: letra ${c}`);
    }
  }
});

test('los días 0-364 se generan; arrancan sin anillos correctos; respuestas válidas', () => {
  for (const l of LANGS) {
    const answers = new Set(words[l].answers);
    const t0 = performance.now();
    for (let day = 0; day < 365; day++) {
      const p = createPuzzle(l, day, words[l]);
      assert.deepEqual(p.check(p.start), [false, false, false, false, false], `${l}:${day}`);
      const { offsets, words: sol } = p.reveal();
      assert.deepEqual(p.check(offsets), [true, true, true, true, true]);
      assert.equal(new Set(sol).size, 3);
      for (const w of sol) assert.ok(answers.has(w), `${l}:${day} ${w}`);
    }
    const avg = (performance.now() - t0) / 365;
    assert.ok(avg < 100, `${l}: ${avg.toFixed(1)} ms promedio`);
  }
});

test('solución única según fuerza bruta (muestra de 30 días por idioma)', () => {
  for (const l of LANGS) {
    const valid = new Set(words[l].valid);
    for (let day = 0; day < 30; day++) {
      const p = createPuzzle(l, day, words[l]);
      assert.deepEqual(bruteForce(p.rings, valid), [p.reveal().offsets], `${l}:${day}`);
    }
  }
});

test('dayNumber: consecutivo a cualquier hora, también al cambiar el horario', () => {
  const tz = process.env.TZ;
  try {
    for (const zone of ['America/New_York', 'Europe/Paris', 'America/Argentina/Buenos_Aires']) {
      process.env.TZ = zone;
      const [y, m, d] = LAUNCH_DATE;
      for (let i = 0; i < 400; i++) {
        for (const [h, min] of [[0, 30], [12, 0], [23, 59]]) {
          assert.equal(dayNumber(new Date(y, m, d + i, h, min)), i, `${zone} día ${i} ${h}:${min}`);
        }
      }
    }
  } finally {
    process.env.TZ = tz;
  }
});

test('dayNumber: 23:59 y 00:01 son días distintos; antes del lanzamiento es 0', () => {
  const [y, m, d] = LAUNCH_DATE;
  assert.equal(dayNumber(new Date(y, m, d + 5, 0, 1)) - dayNumber(new Date(y, m, d + 4, 23, 59)), 1);
  assert.equal(dayNumber(new Date(y, m, d - 30)), 0);
});
