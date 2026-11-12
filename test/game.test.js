import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hint, newProgress, play, score, step, wordOf } from '../js/game.js';

// C A S A
// M O R S
// Z Z Z Z
// Z Z Z Z
const words = { valid: ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC'] };
const common = ['AMOR', 'CASA', 'CASAS', 'ROMA'];
const board = (gold = [], threshold = 100) => ({
  letters: [...'CASAMORSZZZZZZZZ'],
  gold,
  threshold,
  missed: found => common.filter(w => !found.includes(w)),
});
const CASA = [0, 1, 2, 3];
const ROMA = [6, 5, 4, 1];

test('step: suma vecinas, ignora lejanas y repetidas, vuelve atrás', () => {
  assert.deepEqual(step([], 5, 4), [5]);
  assert.deepEqual(step([5], 10, 4), [5, 10]); // diagonal
  assert.deepEqual(step([5], 7, 4), [5]); // no es vecina
  assert.deepEqual(step([5, 10], 10, 4), [5, 10]); // la misma de nuevo
  assert.deepEqual(step([5, 10, 9], 5, 4), [5, 10, 9]); // ya usada y no es la anteúltima
  assert.deepEqual(step([5, 10, 9], 10, 4), [5, 10]); // vuelve a la anteúltima: borra la última
  assert.deepEqual(step([3], 4, 4), [3]); // 3 y 4 no son vecinas (fin de fila / principio de la siguiente)
});

test('newProgress: nada encontrado, doradas completas, reloj en 0', () => {
  assert.deepEqual(newProgress(board([{ cell: 5, need: 2 }])), { found: [], goldLeft: [2], passed: false, ms: 0, hints: 0 });
});

test('wordOf y score', () => {
  assert.equal(wordOf(board(), CASA), 'CASA');
  assert.equal(score(['CASA', 'MAS', 'CASAS']), 2 + 1 + 4);
});

test('play: corta, inválida, repetida y nueva', () => {
  const b = board();
  const p = newProgress(b);
  assert.equal(play(p, b, words, [0, 1]), 'short');
  assert.equal(play(p, b, words, [0, 1, 4]), 'invalid'); // CAM
  assert.equal(play(p, b, words, CASA), 'ok');
  assert.equal(play(p, b, words, CASA), 'dup');
  assert.equal(play(p, b, words, [2, 1, 0]), 'ok'); // SAC: mismas casillas, otra palabra
  assert.deepEqual(p.found, ['CASA', 'SAC']);
});

test('play: la misma palabra por otro camino no vuelve a sumar', () => {
  const b = { ...board(), letters: [...'CASACASAZZZZZZZZ'] };
  const p = newProgress(b);
  assert.equal(play(p, b, words, [0, 1, 2, 3]), 'ok');
  assert.equal(play(p, b, words, [4, 5, 6, 7]), 'dup');
});

test('play: las doradas se descuentan solo si el camino pasa por ellas y no bajan de 0', () => {
  const b = board([{ cell: 5, need: 1 }, { cell: 0, need: 2 }]);
  const p = newProgress(b);
  assert.deepEqual(p.goldLeft, [1, 2]);
  play(p, b, words, CASA); // pasa por 0
  assert.deepEqual(p.goldLeft, [1, 1]);
  play(p, b, words, ROMA); // pasa por 5
  assert.deepEqual(p.goldLeft, [0, 1]);
  play(p, b, words, [5, 6, 4, 1]); // ORMA: inválida, no descuenta
  play(p, b, words, [1, 4, 5, 6]); // AMOR: pasa por 5, que ya está en 0
  assert.deepEqual(p.goldLeft, [0, 1]);
});

test('play: el nivel se pasa una sola vez, con umbral y doradas en 0', () => {
  const b = board([{ cell: 0, need: 1 }], 4);
  const p = newProgress(b);
  assert.equal(play(p, b, words, ROMA), 'ok'); // 2 pts, falta la dorada
  assert.equal(play(p, b, words, [1, 4, 5, 6]), 'ok'); // AMOR: 4 pts, la dorada sigue pendiente
  assert.equal(p.passed, false);
  assert.equal(play(p, b, words, CASA), 'cleared');
  assert.equal(p.passed, true);
  assert.equal(play(p, b, words, [0, 1, 2, 3, 7]), 'ok'); // CASAS después de pasar: suma, sin otro festejo
});

test('hint: prende la primera casilla de una común que falta, la más cercana a 5 letras', () => {
  const b = board();
  const p = newProgress(b);
  assert.equal(hint(p, b), true);
  assert.deepEqual(p.hint, { path: [0, 1, 2, 3, 7], shown: 1 }); // CASAS
  assert.equal(p.hints, 1);
});

test('hint: cada pedido prende una casilla más; la flecha de la última muestra otra, así que paran 2 antes', () => {
  const b = board();
  const p = newProgress(b);
  for (let i = 0; i < 3; i++) assert.equal(hint(p, b), true);
  assert.equal(p.hint.shown, 3);
  assert.equal(hint(p, b), false); // CASAS: 3 prendidas + la flecha hacia la 4.ª; la 5.ª nunca se muestra
  assert.deepEqual([p.hint.shown, p.hints], [3, 3]);
});

test('hint: prefiere una palabra que pase por una dorada pendiente', () => {
  const b = board([{ cell: 5, need: 1 }]);
  const p = newProgress(b);
  hint(p, b);
  assert.deepEqual(p.hint.path, [1, 4, 5, 6]); // AMOR, por la O dorada
  p.goldLeft = [0];
  delete p.hint;
  hint(p, b);
  assert.deepEqual(p.hint.path, [0, 1, 2, 3, 7]); // dorada completa: vuelve a CASAS
});

test('hint: encontrar la palabra la borra; sin comunes que falten no hay pista', () => {
  const b = board();
  const p = newProgress(b);
  hint(p, b);
  play(p, b, words, [0, 1, 2, 3, 7]); // CASAS
  assert.equal(p.hint, undefined);
  p.found.push('AMOR', 'CASA', 'ROMA');
  assert.equal(hint(p, b), false);
  assert.equal(p.hint, undefined);
});
