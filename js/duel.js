// 1-vs-1 duel: rooms in Firebase Realtime Database over REST and EventSource, no SDK. Spec duelo §4.
// The database URL is public on purpose: there is no key, database.rules.json is what protects the data.
import { BIG_FROM, createBoard } from './board.js';
import { score } from './game.js';

export const COUNTDOWN = 3000;
export const LENGTH = 300_000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1: easy to read out loud

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
