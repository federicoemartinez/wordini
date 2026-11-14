// 1-vs-1 duel: rooms in Firebase Realtime Database over REST and EventSource, no SDK. Spec duelo §4.
// The database URL is public on purpose: there is no key, database.rules.json is what protects the data.
import { BIG_FROM, createBoard } from './board.js';
import { score } from './game.js';

export const COUNTDOWN = 3000;
export const LENGTH = 300_000;
export let DB = 'https://wordini-14776-default-rtdb.firebaseio.com';
export const setDB = url => (DB = url); // only for tools/duel-smoke.mjs against the emulator
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1: easy to read out loud
const DAY = 86_400_000;
const TS = { '.sv': 'timestamp' }; // the server writes its own time

export const newCode = (rand = Math.random) => Array.from({ length: 5 }, () => ALPHABET[Math.floor(rand() * ALPHABET.length)]).join('');

// Same board for both players: comes from the room code. 5×5 and no gold tiles.
export const duelBoard = (lang, code, words) => ({ ...createBoard(lang, BIG_FROM, words, `duel:${code}`), gold: [] });

export const other = me => (me === 'a' ? 'b' : 'a');
export const wordsOf = (room, who) => Object.keys(room?.words ?? {}).filter(w => room.words[w] === who).sort();

export function scores(room, me) {
  const [mine, theirs] = [wordsOf(room, me), wordsOf(room, other(me))];
  return { mine: score(mine), theirs: score(theirs), nMine: mine.length, nTheirs: theirs.length };
}

// 'waiting' (no rival yet), 'countdown', 'playing' or 'over', at server time `now`.
export function phase(room, now) {
  if (!room?.joined) return 'waiting';
  const start = room.joined + COUNTDOWN;
  return now < start ? 'countdown' : now < start + LENGTH ? 'playing' : 'over';
}

export const timeLeft = (room, now) => Math.max(0, Math.min(LENGTH, room.joined + COUNTDOWN + LENGTH - now));

// Applies one EventSource event to the room and returns it: 'put' replaces what's at `path`, 'patch' replaces
// each child it names. null deletes. A put at "/" replaces the whole room (null = the room doesn't exist).
export function applyEvent(room, type, { path, data }) {
  const at = path.split('/').filter(Boolean);
  const changes = type === 'patch' ? Object.entries(data).map(([k, v]) => [[...at, ...k.split('/')], v]) : [[at, data]];
  for (const [keys, value] of changes) {
    if (!keys.length) {
      room = value;
      continue;
    }
    room ??= {};
    let node = room;
    for (const k of keys.slice(0, -1)) node = node[k] ??= {};
    if (value === null) delete node[keys.at(-1)];
    else node[keys.at(-1)] = value;
  }
  return room;
}

const url = (path, query = '') => `${DB}/${path}.json${query}`;

// A write. Returns the server's answer, or null if the rules rejected it (taken, out of time…). No network, or no
// answer in 8 s (a stalled mobile connection), throws.
async function send(method, path, body) {
  const res = await fetch(url(path), { method, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status}`);
  return res.json();
}

export async function getRoom(code) {
  const res = await fetch(url(`rooms/${code}`));
  if (!res.ok) throw new Error(`GET ${code}: ${res.status}`);
  return res.json();
}

// Deletes up to 20 rooms more than a day old. The rules only let you list rooms created before `sweep`, and only
// take a `sweep` more than a day old, so rooms in play never show up (spec §4.5). Best effort: failing is fine.
async function sweep() {
  const before = Date.now() - DAY - 3_600_000; // an hour of margin for a clock running ahead
  if ((await send('PUT', 'sweep', before)) === null) return;
  const res = await fetch(url('rooms', `?orderBy="created"&endAt=${before}&limitToFirst=20`));
  const old = res.ok ? Object.keys((await res.json()) ?? {}) : [];
  if (old.length) await send('PATCH', 'rooms', Object.fromEntries(old.map(code => [code, null])));
}

// Sweeps, then creates a room as 'a'. Returns its code.
export async function create(lang) {
  await sweep().catch(() => {});
  for (let tries = 0; tries < 5; tries++) {
    const code = newCode();
    if (await send('PATCH', `rooms/${code}`, { lang, created: TS })) return code; // null: the code exists, another one
  }
  throw new Error('no room');
}

// Takes the second seat. Returns the server's `joined` time, or null if someone already took it.
export const join = code => send('PUT', `rooms/${code}/joined`, TS);

// Server time minus local time, from the timestamp that writing t/<me> answers with (spec §4.4).
export async function clockOffset(code, me) {
  const sent = Date.now();
  const server = await send('PUT', `rooms/${code}/t/${me}`, TS);
  return server - (sent + Date.now()) / 2;
}

// Marks `word` as `me`'s. true if it's theirs; false if the rules said no (already marked, or out of time).
export const claim = async (code, word, me) => (await send('PUT', `rooms/${code}/words/${encodeURIComponent(word)}`, me)) !== null;

// Rematch: a new room linked from `next` of the old one, or the rival's if they linked theirs first.
// Returns { code, me }: 'a' = the new room is ours (wait for them), 'b' = it's theirs (join it).
export async function rematch(code, lang, next) {
  if (!next) {
    const fresh = await create(lang);
    if (await send('PUT', `rooms/${code}/next`, fresh)) return { code: fresh, me: 'a' };
    next = await (await fetch(url(`rooms/${code}/next`))).json();
  }
  return { code: next, me: 'b' };
}

// Streams the room: onRoom(room) on every change (null = it doesn't exist). EventSource reconnects by itself and
// Firebase then sends the whole room again. Returns a function that stops it.
export function listen(code, onRoom) {
  let room = null;
  const es = new EventSource(url(`rooms/${code}`));
  for (const type of ['put', 'patch']) es.addEventListener(type, e => onRoom((room = applyEvent(room, type, JSON.parse(e.data)))));
  es.addEventListener('cancel', () => onRoom(null));
  return () => es.close();
}
