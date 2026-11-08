import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStats, recordResult, loadGame, saveGame, get, set } from '../js/state.js';

const memory = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

test('ganar el día siguiente a otra victoria suma racha', () => {
  const s = recordResult(recordResult(emptyStats(), 3, true, 2), 4, true, 5);
  assert.deepEqual(s, { played: 2, won: 2, streak: 2, maxStreak: 2, lastWinDay: 4, dist: [0, 1, 0, 0, 1, 0] });
});

test('ganar después de un día sin victoria arranca la racha en 1', () => {
  const s = recordResult(recordResult(emptyStats(), 3, true, 1), 5, true, 1);
  assert.equal(s.streak, 1);
  assert.equal(s.maxStreak, 1);
});

test('perder corta la racha y conserva la mejor', () => {
  let s = recordResult(emptyStats(), 1, true, 3);
  s = recordResult(s, 2, true, 3);
  s = recordResult(s, 3, false, 6);
  assert.deepEqual(s, { played: 3, won: 2, streak: 0, maxStreak: 2, lastWinDay: 2, dist: [0, 0, 2, 0, 0, 0] });
});

test('recordResult no muta las estadísticas recibidas', () => {
  const s = emptyStats();
  recordResult(s, 0, true, 1);
  assert.deepEqual(s, emptyStats());
});

test('loadGame restaura la partida del mismo día', () => {
  const st = memory();
  const game = { day: 7, offsets: [1, 2, 3, 4, 5], attempts: [[true, false, false, false, false]], tried: ['12345'], status: 'playing', stats: emptyStats() };
  saveGame(st, 'es', game);
  assert.deepEqual(loadGame(st, 'es', 7), game);
});

test('loadGame descarta la partida de otro día y conserva las estadísticas', () => {
  const st = memory();
  const stats = recordResult(emptyStats(), 6, true, 2);
  saveGame(st, 'es', { day: 6, offsets: [0, 0, 0, 0, 0], attempts: [[true, true, true, true, true]], tried: ['00000'], status: 'won', stats });
  assert.deepEqual(loadGame(st, 'es', 7), { day: 7, offsets: null, attempts: [], tried: [], status: 'playing', stats });
});

test('cada idioma tiene su propia partida', () => {
  const st = memory();
  saveGame(st, 'es', { ...loadGame(st, 'es', 7), status: 'won' });
  assert.equal(loadGame(st, 'fr', 7).status, 'playing');
});

test('storage roto o ausente: nada lanza y se arranca de cero', () => {
  for (const st of [broken, undefined]) {
    assert.doesNotThrow(() => saveGame(st, 'es', loadGame(st, 'es', 1)));
    assert.doesNotThrow(() => set(st, 'wordini:lang', 'es'));
    assert.equal(get(st, 'wordini:lang'), null);
    assert.deepEqual(loadGame(st, 'es', 1).stats, emptyStats());
  }
});
