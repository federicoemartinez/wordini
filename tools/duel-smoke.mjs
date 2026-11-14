// Checks database.rules.json and js/duel.js against a real database (spec duelo §7). After publishing the rules:
//   node tools/duel-smoke.mjs                                                    the game's database
//   node tools/duel-smoke.mjs http://demo-wordini-default-rtdb.localhost:9000   the Firebase emulator
// Leaves a few rooms behind; any challenge more than a day later sweeps them.
import assert from 'node:assert/strict';
import { claim, clockOffset, create, DB, getRoom, join, rematch, setDB } from '../js/duel.js';

if (process.argv[2]) setDB(process.argv[2].replace(/\/$/, ''));
const DAY = 86_400_000;
const status = async (method, path, body, query = '') =>
  (await fetch(`${DB}/${path}.json${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body) })).status;
const check = async (label, fn) => {
  await fn();
  console.log(`ok  ${label}`);
};

const code = await create('es');
await check(`crea la sala ${code} en ${DB}`, async () => {
  const room = await getRoom(code);
  assert.equal(room.lang, 'es');
  assert.equal(typeof room.created, 'number');
});
await check('la hora del servidor vuelve en la respuesta', async () => assert.ok(Number.isFinite(await clockOffset(code, 'a'))));
await check('no se marca nada sin rival', async () => assert.equal(await claim(code, 'CASA', 'a'), false));
await check('entra el segundo y no entra un tercero', async () => {
  assert.equal(await join(code), true);
  assert.equal(await join(code), false);
});
await check('no se marca nada en la cuenta regresiva', async () => assert.equal(await claim(code, 'CASA', 'a'), false));
await new Promise(r => setTimeout(r, 3200));
await check('la primera escritura gana', async () => {
  assert.equal(await claim(code, 'CASA', 'a'), true);
  assert.equal(await claim(code, 'CASA', 'b'), false);
  assert.equal(await claim(code, 'CASA', 'a'), false);
});
await check('la Ñ viaja bien', async () => {
  assert.equal(await claim(code, 'CAÑA', 'b'), true);
  assert.deepEqual((await getRoom(code)).words, { CASA: 'a', CAÑA: 'b' });
});
await check('palabras cortas o de un jugador que no existe, no', async () => {
  assert.equal(await claim(code, 'SO', 'a'), false);
  assert.equal(await status('PUT', `rooms/${code}/words/PERRO`, 'c'), 401);
});
await check('no se pisa ni se borra nada', async () => {
  assert.equal(await status('PUT', `rooms/${code}/lang`, 'en'), 401);
  assert.equal(await status('PUT', `rooms/${code}/joined`, 1), 401);
  assert.equal(await status('PUT', `rooms/${code}/basura`, 1), 401);
  assert.equal(await status('DELETE', `rooms/${code}`), 401);
  assert.equal(await status('PATCH', 'rooms', { [code]: null }), 401);
});
await check('no se pueden listar las salas en juego', async () => {
  assert.equal(await status('GET', 'rooms'), 401);
  assert.equal(await status('GET', 'rooms', undefined, '?shallow=true'), 401);
  assert.equal(await status('GET', 'rooms', undefined, `?orderBy="created"&endAt=${Date.now()}&limitToFirst=20`), 401);
  assert.equal(await status('PUT', 'sweep', Date.now()), 401);
  const before = Date.now() - DAY - 3_600_000;
  assert.equal(await status('PUT', 'sweep', before), 200);
  assert.equal(await status('GET', 'rooms', undefined, `?orderBy="created"&endAt=${before}&limitToFirst=20`), 200);
  assert.equal(await status('GET', 'rooms', undefined, `?orderBy="created"&endAt=${before}&limitToFirst=21`), 401);
});
await check('revancha: el primero arma la sala y el otro entra a esa', async () => {
  const first = await rematch(code, 'es');
  assert.equal(first.me, 'a');
  assert.deepEqual(await rematch(code, 'es'), { code: first.code, me: 'b' });
  assert.deepEqual(await rematch(code, 'es', first.code), { code: first.code, me: 'b' });
});
await check('una sala que no existe', async () => {
  assert.equal(await getRoom('ZZZZZ'), null);
  assert.equal(await join('ZZZZZ'), false);
});
console.log('todo bien');
