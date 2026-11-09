import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, loadGame, sameBoard, saveGame, set, sigOf } from '../js/state.js';

const memory = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
const board = { letters: [...'CASAMORSZZZZZZZZ'], gold: [{ cell: 0, need: 2 }] };

test('sin nada guardado se arranca en el nivel 1', () => {
  assert.deepEqual(loadGame(memory(), 'es'), { level: 1 });
});

test('guardar y restaurar; cada idioma tiene su partida', () => {
  const st = memory();
  const game = { level: 7, sig: sigOf(board), found: ['CASA'], goldLeft: [1], passed: false };
  saveGame(st, 'es', game);
  assert.deepEqual(loadGame(st, 'es'), game);
  assert.deepEqual(loadGame(st, 'fr'), { level: 1 });
});

test('el formato del criptex o un nivel inválido se descartan', () => {
  const st = memory();
  set(st, 'wordini:es', { day: 3, offsets: [1, 2, 3, 4, 5], attempts: [], tried: [], status: 'won', stats: {} });
  assert.deepEqual(loadGame(st, 'es'), { level: 1 });
  set(st, 'wordini:es', { level: 0 });
  assert.deepEqual(loadGame(st, 'es'), { level: 1 });
  set(st, 'wordini:es', { level: '4' });
  assert.deepEqual(loadGame(st, 'es'), { level: 1 });
});

test('sameBoard: misma cancha sí; otras letras, otras doradas o datos rotos no', () => {
  const game = { level: 7, sig: sigOf(board), found: [], goldLeft: [2], passed: false };
  assert.ok(sameBoard(game, board));
  assert.ok(!sameBoard({ ...game, sig: 'OTRA' }, board));
  assert.ok(!sameBoard({ ...game, goldLeft: [] }, board));
  assert.ok(!sameBoard({ level: 7 }, board));
});

test('storage roto o ausente: nada lanza y se arranca de cero', () => {
  for (const st of [broken, undefined]) {
    assert.doesNotThrow(() => saveGame(st, 'es', { level: 3 }));
    assert.doesNotThrow(() => set(st, 'wordini:lang', 'es'));
    assert.equal(get(st, 'wordini:lang'), null);
    assert.deepEqual(loadGame(st, 'es'), { level: 1 });
  }
});
