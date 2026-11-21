import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoard } from '../js/board.js';
import { applyEvent, COUNTDOWN, duelBoard, halfway, LENGTH, newCode, other, phase, scores, timeLeft, turnOf, withPending, wordsOf } from '../js/duel.js';

const es = JSON.parse(readFileSync(new URL('../words/es.json', import.meta.url), 'utf8'));

test('newCode: 5 caracteres fáciles de dictar', () => {
  for (let i = 0; i < 200; i++) assert.match(newCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/);
  assert.equal(newCode(() => 0), 'AAAAA');
  assert.equal(newCode(() => 0.999), '99999');
});

test('duelBoard: misma sala, misma cancha de 5×5 sin doradas; otra sala, otra cancha', () => {
  const room = { lang: 'es', created: 1794615810327 };
  const a = duelBoard('K7QX2', room, es);
  assert.deepEqual(duelBoard('K7QX2', room, es).letters, a.letters);
  assert.equal(a.size, 5);
  assert.deepEqual(a.gold, []);
  assert.notDeepEqual(duelBoard('M3PZ8', room, es).letters, a.letters);
  assert.notDeepEqual(createBoard('es', 11, es).letters, a.letters); // no es la del nivel 11
});

test('duelBoard: un código que se vuelve a usar en otra sala no repite la cancha', () => {
  const a = duelBoard('K7QX2', { lang: 'es', created: 1794615810327 }, es);
  assert.notDeepEqual(duelBoard('K7QX2', { lang: 'es', created: 1794615810328 }, es).letters, a.letters);
});

test('halfway y turnOf: el giro es a los 2:30 y el mismo para los dos', () => {
  const room = { created: 500, joined: 1000 };
  assert.equal(halfway(room), 1000 + COUNTDOWN + LENGTH / 2);
  for (let created = 0; created < 50; created++) assert.ok([1, 2, 3, 4, 5, 6, 7].includes(turnOf({ created })));
  assert.equal(turnOf(room), turnOf({ ...room }));
  assert.notEqual(turnOf({ created: 1 }), turnOf({ created: 2 }));
});

test('applyEvent: put en la raíz reemplaza la sala; null es que no existe', () => {
  assert.deepEqual(applyEvent(null, 'put', { path: '/', data: { lang: 'es' } }), { lang: 'es' });
  assert.equal(applyEvent({ lang: 'es' }, 'put', { path: '/', data: null }), null);
});

test('applyEvent: put en una ruta crea lo que falte, y null borra', () => {
  const room = applyEvent({ lang: 'es' }, 'put', { path: '/words/CASA', data: 'a' });
  assert.deepEqual(room, { lang: 'es', words: { CASA: 'a' } });
  assert.deepEqual(applyEvent(room, 'put', { path: '/words/CASA', data: null }), { lang: 'es', words: {} });
});

test('applyEvent: patch reemplaza cada hijo que nombra, también con rutas de varios niveles', () => {
  assert.deepEqual(applyEvent(null, 'patch', { path: '/', data: { lang: 'es', created: 5 } }), { lang: 'es', created: 5 });
  const room = { lang: 'es', words: { SOL: 'b' } };
  assert.deepEqual(applyEvent(room, 'patch', { path: '/words', data: { CASA: 'a', SOL: null } }), { lang: 'es', words: { CASA: 'a' } });
  assert.deepEqual(applyEvent({}, 'patch', { path: '/', data: { 'words/PAN': 'b' } }), { words: { PAN: 'b' } });
});

test('phase y timeLeft en los bordes', () => {
  const room = { joined: 1000 };
  const start = 1000 + COUNTDOWN;
  assert.equal(phase({}, 0), 'waiting');
  assert.equal(phase(null, 0), 'waiting');
  assert.equal(phase(room, 1000), 'countdown');
  assert.equal(phase(room, start - 1), 'countdown');
  assert.equal(phase(room, start), 'playing');
  assert.equal(phase(room, start + LENGTH - 1), 'playing');
  assert.equal(phase(room, start + LENGTH), 'over');
  assert.equal(timeLeft(room, 1000), LENGTH); // en la cuenta regresiva se ven los 5:00 enteros
  assert.equal(timeLeft(room, start + 1000), LENGTH - 1000);
  assert.equal(timeLeft(room, start + LENGTH + 5000), 0);
});

test('wordsOf, other y scores (solo puntos: se gana por puntos)', () => {
  const room = { words: { SOL: 'a', PERRO: 'b', CASA: 'a', MAR: 'b', AMOR: 'b' } };
  assert.deepEqual(wordsOf(room, 'a'), ['CASA', 'SOL']);
  assert.deepEqual(wordsOf({}, 'a'), []);
  assert.equal(other('a'), 'b');
  assert.equal(other('b'), 'a');
  assert.deepEqual(scores(room, 'a'), { mine: 3, theirs: 7 });
  assert.deepEqual(scores(room, 'b'), { mine: 7, theirs: 3 });
});

test('withPending: las palabras en camino suman, pero manda el servidor y la sala no se toca', () => {
  const room = { lang: 'es', words: { SOL: 'b', MAR: 'a' } };
  const seen = withPending(room, new Set(['CASA', 'SOL']), 'a');
  assert.deepEqual(seen.words, { CASA: 'a', SOL: 'b', MAR: 'a' }); // SOL la marcó el rival primero
  assert.deepEqual(room.words, { SOL: 'b', MAR: 'a' });
  assert.deepEqual(withPending({ lang: 'es' }, new Set(['PAN']), 'b').words, { PAN: 'b' });
  assert.deepEqual(withPending(room, new Set(), 'a'), room);
});
