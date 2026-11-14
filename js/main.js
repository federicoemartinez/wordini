import { createBoard, isValid, pathFor, points, turnBoard } from './board.js';
import { define } from './define.js';
import { claim, clockOffset, COUNTDOWN, create, duelBoard, getRoom, halfway, join, listen, other, phase, rematch, scores, timeLeft, turnOf, wordsOf } from './duel.js';
import { hint, newProgress, play, score, step, turn, wordOf } from './game.js';
import { duelText, formatTime, levelResult, shareText } from './share.js';
import { FLAGS, t } from './i18n.js';
import { get, set, loadGame, saveGame, sameBoard, sigOf } from './state.js';
import * as fx from './fx.js';

const $ = sel => document.querySelector(sel);
const SVG = 'http://www.w3.org/2000/svg';
const trail = document.createElementNS(SVG, 'svg');
const line = trail.appendChild(document.createElementNS(SVG, 'polyline'));
trail.id = 'trail';

let storage;
try {
  storage = localStorage;
} catch {} // blocked: the game works without persistence

let lang, words, board, game;
let path = []; // path in progress, by finger or keyboard
let typed = ''; // word typed on the keyboard
let tracing = false;
let since = null; // performance.now() since the clock started running; null = stopped
let loadSeq = 0; // only the latest requested load may touch the screen
let idleFrom = 0; // elapsed() at the last word found: after a minute without words the hint button nudges
const meanings = new Map(); // `${lang}:${word}` -> meaning of a hint word; null while loading or if there's none
let duel = null; // the 1-vs-1 in play: { code, me, room, offset, theirs, pending, live, turned, ended, stop }; null in the levels

function pickLang() {
  const wanted = [new URLSearchParams(location.search).get('l'), get(storage, 'wordini:lang'), navigator.language?.slice(0, 2)];
  return wanted.find(l => Object.hasOwn(FLAGS, l ?? '')) ?? 'en';
}

async function start(newLang) {
  const seq = ++loadSeq;
  if (game) stopClock(); // saves the time under the key of the language being left
  lang = newLang;
  board = game = undefined; // no game while loading: nothing can be saved under another language's key
  $('#board').replaceChildren();
  $('#hud').hidden = $('#found-box').hidden = $('#btn-next').hidden = $('#hint-row').hidden = true;
  set(storage, 'wordini:lang', lang);
  document.documentElement.lang = lang;
  $('#lang').value = lang;
  renderTexts();
  say(t(lang, 'loading'));
  const loaded = await fetchWords(lang);
  if (seq !== loadSeq) return; // the player switched language (or went into a duel) while loading
  if (!loaded) return say(t(lang, 'loadError'));
  words = loaded;
  enterLevel(loadGame(storage, lang));
}

// The word list of `l`, or null if it couldn't be downloaded.
async function fetchWords(l) {
  try {
    const res = await fetch(`words/${l}.json`);
    if (!res.ok) throw new Error(res.status);
    const loaded = await res.json();
    if (!Array.isArray(loaded?.valid) || !Array.isArray(loaded?.common)) throw new Error('old format'); // e.g. the criptex one, cached
    return loaded;
  } catch {
    return null;
  }
}

function enterLevel(saved) {
  board = createBoard(lang, saved.level, words);
  game = sameBoard(saved, board) ? saved : { level: saved.level, sig: sigOf(board), ...newProgress(board) };
  game.ms ??= 0; // games saved before the stopwatch existed
  game.hints ??= 0; // ...or hints
  if (game.turn) board = turnBoard(board, game.turn); // after sameBoard: the saved sig is the unturned board's
  idleFrom = game.ms;
  saveGame(storage, lang, game);
  path = [];
  typed = '';
  since = null;
  startClock(); // from the moment the board is visible: otherwise you could study it for free
  renderBoard();
  render();
  say('');
}

// The clock runs from when the board is shown until it's cleared, and only while the tab is visible.
const elapsed = () => game.ms + (since === null ? 0 : performance.now() - since);

function startClock() {
  if (game && since === null && !game.passed && !document.hidden) since = performance.now(); // no game: in a duel
}

// Folds the elapsed time into game.ms (what gets saved) without stopping the clock.
function syncClock() {
  if (since === null) return;
  const now = performance.now();
  game.ms += now - since;
  since = now;
}

function stopClock() {
  syncClock();
  since = null;
  saveGame(storage, lang, game);
}

function renderClock() {
  if (duel) return renderDuelClock();
  if (!game) return;
  $('#time').textContent = `⏱ ${formatTime(elapsed())}`;
  $('#btn-hint').classList.toggle('nudge', !game.hint && !$('#btn-hint').disabled && elapsed() - idleFrom > 60_000);
}

function renderTexts() {
  document.title = t(lang, 'title');
  document.querySelector('meta[name=description]').content = t(lang, 'description');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(lang, el.dataset.t);
  for (const el of document.querySelectorAll('[data-label]')) {
    el.title = t(lang, el.dataset.label);
    el.setAttribute('aria-label', el.title);
  }
}

function say(text, cls = '') {
  $('#word').textContent = text;
  $('#word').className = cls;
}

function renderBoard() {
  const el = $('#board');
  el.style.setProperty('--n', board.size);
  el.replaceChildren(
    ...board.letters.map((c, i) => {
      const tile = Object.assign(document.createElement('div'), { className: 'tile', textContent: c });
      tile.dataset.i = i;
      return tile;
    }),
    trail,
  );
  for (const g of board.gold) {
    el.children[g.cell].classList.add('gold');
    el.children[g.cell].append(Object.assign(document.createElement('b'), { className: 'badge' }));
  }
  line.setAttribute('points', '');
}

function render() {
  const pts = score(game.found);
  const missed = board.missed(game.found);
  $('#hud').hidden = $('#found-box').hidden = $('#hint-row').hidden = false;
  $('#level').textContent = `${t(lang, 'level')} ${game.level}`;
  $('#score').textContent = `${pts} / ${board.threshold}`;
  $('#fill').style.width = `${Math.min(100, (100 * pts) / board.threshold)}%`;
  $('#bar').classList.toggle('done', pts >= board.threshold);
  $('#common').textContent = `${board.commonCount - missed.length}/${board.commonCount} ${t(lang, 'common')}`;
  board.gold.forEach((g, k) => {
    const tile = $('#board').children[g.cell];
    tile.classList.toggle('done', game.goldLeft[k] === 0);
    tile.querySelector('.badge').textContent = game.goldLeft[k] || '✓';
  });
  renderFound(game.found);
  const h = game.hint;
  const lit = h ? h.path.slice(0, h.shown) : [];
  board.letters.forEach((_, i) => $('#board').children[i].classList.toggle('hint', lit.includes(i)));
  $('#board').querySelectorAll('.arrow').forEach(a => a.remove());
  lit.forEach((c, k) => {
    const next = h.path[k + 1];
    const deg = (Math.atan2(Math.floor(next / board.size) - Math.floor(c / board.size), (next % board.size) - (c % board.size)) * 180) / Math.PI;
    const arrow = Object.assign(document.createElement('i'), { className: 'arrow', textContent: '➜' });
    arrow.style.setProperty('--a', `${deg}deg`);
    $('#board').children[c].append(arrow);
  });
  $('#hint').textContent = h ? h.path.map((c, i) => (i < h.shown ? board.letters[c] : '_')).join(' ') : '';
  $('#meaning').textContent = (h && meaning(wordOf(board, h.path))) || '';
  $('#btn-hint').disabled = h ? h.shown >= h.path.length - 2 : !missed.length;
  $('#btn-next').hidden = !game.passed;
  renderClock();
}

// Found words under the grid, longest first.
function renderFound(found) {
  const lengths = [...new Set(found.map(w => w.length))].sort((a, b) => b - a);
  $('#found-title').textContent = `${t(lang, 'found')} (${found.length})`;
  $('#found').replaceChildren(
    ...lengths.map(n => {
      const p = document.createElement('p');
      p.append(Object.assign(document.createElement('b'), { textContent: n }), found.filter(w => w.length === n).sort().join(' '));
      return p;
    }),
  );
}

// Meaning of a hint word: asks Wiktionary the first time and renders again if it answers.
function meaning(word) {
  const key = `${lang}:${word}`;
  if (!meanings.has(key)) {
    meanings.set(key, null);
    define(lang, word).then(m => {
      meanings.set(key, m);
      if (m && game) render();
    });
  }
  return meanings.get(key);
}

// Highlights the path, draws the line through the tile centers and shows the word in progress.
function renderPath() {
  const tiles = [...$('#board').querySelectorAll('.tile')];
  tiles.forEach((tile, i) => tile.classList.toggle('on', path.includes(i)));
  const centers = path.map(i => `${tiles[i].offsetLeft + tiles[i].offsetWidth / 2},${tiles[i].offsetTop + tiles[i].offsetHeight / 2}`);
  line.setAttribute('points', centers.join(' '));
  if (path.length || typed) say(typed || wordOf(board, path), 'live');
}

function pop(text, where = $('#bar')) {
  const el = Object.assign(document.createElement('span'), { className: 'pop', textContent: text });
  where.append(el);
  setTimeout(() => el.remove(), 900);
}

const pendingGold = () => board.gold.filter((_, k) => game.goldLeft[k] > 0).map(g => g.cell);

function submit(p) {
  if (duel) return duelSubmit(p);
  const word = wordOf(board, p);
  const goldBefore = game.goldLeft.join();
  const result = play(game, board, words, p);
  path = [];
  typed = '';
  renderPath();
  if (result === 'short') {
    say(p.length > 1 ? t(lang, 'short') : '', 'short');
    return;
  }
  if (result === 'invalid' || result === 'dup') {
    say(`${word} · ${t(lang, result)}`, result);
    fx.bad();
    return;
  }
  if (result === 'cleared') stopClock();
  else syncClock();
  const turned = turn(game, board);
  if (turned) board = turnBoard(board, game.turn);
  saveGame(storage, lang, game);
  idleFrom = elapsed();
  say(turned ? `${word} · ${t(lang, 'turned')}` : word, 'good');
  pop(`+${points(word)}`);
  fx.good(word.length);
  if (game.goldLeft.join() !== goldBefore) fx.gold();
  if (turned) {
    renderBoard();
    fx.turn($('#board'), game.turn);
  }
  render();
  if (result === 'cleared') {
    fx.win();
    const g = game;
    setTimeout(() => game === g && showCleared(), 900); // not opened if the language changed in the meantime
  }
}

// Only each tile's central circle counts, so a diagonal doesn't grab a neighbor by mistake.
function tileAt(x, y) {
  const tile = document.elementFromPoint(x, y)?.closest('#board .tile');
  if (!tile) return null;
  const r = tile.getBoundingClientRect();
  const dx = x - (r.left + r.width / 2);
  const dy = y - (r.top + r.height / 2);
  return dx * dx + dy * dy <= (0.36 * r.width) ** 2 ? Number(tile.dataset.i) : null;
}

function onPointerDown(e) {
  const tile = e.target.closest('.tile');
  if (!board || !tile || !playable()) return;
  $('#board').setPointerCapture(e.pointerId);
  tracing = true;
  typed = '';
  path = [Number(tile.dataset.i)];
  startClock();
  fx.tick(1);
  renderPath();
}

function onPointerMove(e) {
  if (!tracing) return;
  const i = tileAt(e.clientX, e.clientY);
  if (i === null) return;
  const next = step(path, i, board.size);
  if (next === path) return;
  if (next.length > path.length) fx.tick(next.length);
  path = next;
  renderPath();
}

function onPointerUp(e) {
  if (!tracing) return;
  tracing = false;
  if (e.type === 'pointercancel') {
    path = [];
    renderPath();
    say('');
  } else submit(path);
}

const LIGATURES = { Œ: 'OE', Æ: 'AE' }; // same as the word lists (tools/build_words.py)

const letterOf = key => {
  if (key.length !== 1) return null;
  const up = key.toUpperCase();
  if (LIGATURES[up]) return LIGATURES[up];
  const c = up === 'Ñ' ? up : up.normalize('NFD')[0]; // É -> E, but Ñ stays
  return words.alphabet.includes(c) ? c : null;
};

function onKey(e) {
  if (!board || !playable() || tracing || document.querySelector('dialog[open]') || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' && !typed) return; // with nothing typed, Enter belongs to the focused link or button
  if (e.key === 'Enter') {
    const p = pathFor(typed, board.letters, pendingGold());
    if (p) submit(p);
    else {
      say(`${typed} · ${t(lang, typed.length < 3 ? 'short' : 'invalid')}`, 'invalid');
      fx.bad();
      typed = '';
      path = [];
      renderPath();
    }
  } else if (e.key === 'Backspace') typed = typed.slice(0, -1);
  else if (e.key === 'Escape') typed = '';
  else if (letterOf(e.key)) {
    typed += letterOf(e.key);
    startClock();
  } else return;
  e.preventDefault();
  if (e.key === 'Enter') return;
  path = pathFor(typed, board.letters, pendingGold()) ?? [];
  renderPath();
  if (!typed) say('');
}

function showCleared() {
  const missed = board.missed(game.found);
  $('#clear-score').textContent = levelResult(lang, game.level, score(game.found), game.ms, game.hints);
  $('#missed').textContent = missed.join(' ');
  $('#missed').hidden = true;
  $('#btn-missed').hidden = !missed.length;
  $('#dlg-clear').showModal();
}

function nextLevel() {
  if (!game?.passed) return;
  $('#dlg-clear').close();
  enterLevel({ level: game.level + 1 });
}

const gameUrl = () => `${location.origin}${location.pathname}?l=${lang}`;

// Native share sheet; without one, to the clipboard, and `btn` says so.
async function share(text, btn) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = t(lang, 'copied');
    setTimeout(() => (btn.textContent = t(lang, 'share')), 1500);
  } catch {
    prompt('', text); // no clipboard: let them copy it by hand
  }
}

// 1 vs 1 (spec duelo): same board for both, 5 minutes, each word only for whoever marks it first.
const serverNow = () => Date.now() + duel.offset;
const duelLink = code => `${location.origin}${location.pathname}?vs=${code}`;
// Only the last duel's seat is kept: enough to come back to it after a reload.
const seatIn = code => (get(storage, 'wordini:duel')?.code === code ? get(storage, 'wordini:duel').me : null);
const playable = () => !duel || (!!duel.room && !duel.ended && phase(duel.room, serverNow()) === 'playing');

async function challenge() {
  if (duel || !board) return;
  $('#btn-duel').disabled = true;
  try {
    const code = await create(lang);
    set(storage, 'wordini:duel', { code, me: 'a' });
    enterDuel(code);
  } catch {
    say(t(lang, 'duelOffline'), 'invalid');
  } finally {
    $('#btn-duel').disabled = false;
  }
}

async function enterDuel(code) {
  ++loadSeq; // a level still loading must not take the screen
  if (game) stopClock(); // the level's stopwatch waits for the duel
  board = game = undefined;
  const d = (duel = { code, me: seatIn(code), room: null, offset: 0, theirs: 0, pending: new Set() });
  history.replaceState(null, '', `?vs=${code}`);
  $('#board').replaceChildren();
  $('#hud').hidden = $('#hint-row').hidden = $('#btn-next').hidden = $('#found-box').hidden = $('#btn-duel').hidden = true;
  $('#lang').disabled = true;
  say(t(lang, 'loading'));
  try {
    const room = await getRoom(code);
    if (d !== duel) return;
    if (!room?.created) return duelMessage('duelNoRoom');
    const loaded = await fetchWords(room.lang); // before taking the seat: joining starts the countdown
    if (d !== duel) return;
    if (!loaded) return duelMessage('loadError');
    if (!d.me) {
      if (room.joined || !(room.joined = await join(code))) return duelMessage('duelFull');
      d.me = 'b';
      set(storage, 'wordini:duel', { code, me: 'b' });
    }
    d.offset = await clockOffset(code, d.me);
    if (d !== duel) return;
    lang = room.lang;
    words = loaded;
    document.documentElement.lang = $('#lang').value = lang;
    renderTexts();
    board = duelBoard(code, room, words);
    renderBoard();
    say('');
    d.room = room;
    d.theirs = scores(room, d.me).theirs;
    d.stop = listen(code, r => onDuelRoom(d, r));
    renderDuel();
  } catch {
    if (d === duel) duelMessage('duelOffline');
  }
}

function onDuelRoom(d, room) {
  if (d !== duel || !board) return;
  if (!room) return d.ended || duelMessage('duelNoRoom');
  d.room = room;
  const { theirs } = scores(room, d.me);
  if (theirs > d.theirs) pop(`+${theirs - d.theirs}`, $('#duel-rival'));
  d.theirs = theirs;
  renderDuel();
}

function renderDuel() {
  const { room, me } = duel;
  const s = scores(room, me);
  $('#duel-hud').hidden = $('#found-box').hidden = false;
  $('#duel-me b').textContent = `${t(lang, 'you')} ${s.mine}`;
  $('#duel-rival b').textContent = `${t(lang, 'rival')} ${s.theirs} (${s.nTheirs})`;
  renderFound(wordsOf(room, me));
  renderDuelClock();
  if (duel.ended) renderDuelEnd();
}

// Every 250 ms: waiting room, 3-2-1, time left and the end. The server's time decides (spec duelo §4.4).
function renderDuelClock() {
  const { room } = duel;
  if (!room || !board) return;
  const now = serverNow();
  const ph = phase(room, now);
  $('#board').classList.toggle('veiled', ph === 'waiting' || ph === 'countdown');
  if (ph === 'waiting') return duelWaiting();
  $('#dlg-duel').close();
  $('#duel-time').textContent = `⏳ ${formatTime(timeLeft(room, now))}`;
  if (ph === 'countdown') say(String(Math.ceil((room.joined + COUNTDOWN - now) / 1000)), 'count');
  else if ($('#word').className === 'count') say('');
  if (now < halfway(room)) duel.live = true; // this phone saw the board before the turn: it gets the show
  else if (!duel.turned) turnDuel();
  if (ph === 'over') endDuel();
}

// Halfway through, the board turns or mirrors for both at once. A path in progress is dropped: its tiles moved.
function turnDuel() {
  const sym = turnOf(duel.room);
  duel.turned = true;
  board = turnBoard(board, sym);
  tracing = false;
  path = [];
  typed = '';
  renderBoard();
  renderPath();
  if (!duel.live) return; // opened after the turn: it's just drawn turned
  say(t(lang, 'turned'), 'good');
  fx.turn($('#board'), sym);
}

function duelWaiting() {
  if ($('#dlg-duel').open) return;
  $('#duel-msg').textContent = t(lang, 'duelWait');
  $('#duel-link').value = duelLink(duel.code);
  $('#duel-invite').hidden = false;
  $('#dlg-duel').showModal();
}

// The duel can't go on (no such room, it's full, no connection): a message and the way back.
function duelMessage(key) {
  board = undefined; // the grid doesn't respond anymore
  $('#board').replaceChildren();
  $('#duel-hud').hidden = $('#found-box').hidden = true;
  say('');
  $('#duel-msg').textContent = t(lang, key);
  $('#duel-invite').hidden = true;
  if (!$('#dlg-duel').open) $('#dlg-duel').showModal();
}

// A word in the duel: checked here first, then the server decides who got it (spec duelo §4.3).
async function duelSubmit(p) {
  const d = duel;
  const word = wordOf(board, p);
  path = [];
  typed = '';
  renderPath();
  if (word.length < 3) return say(p.length > 1 ? t(lang, 'short') : '', 'short');
  const owner = d.room.words?.[word] ?? (d.pending.has(word) ? d.me : null);
  if (!isValid(words, word)) return duelNo(word, 'invalid');
  if (owner) return duelNo(word, owner === d.me ? 'dup' : 'blocked');
  d.pending.add(word);
  say(word, 'live');
  let got;
  try {
    got = await claim(d.code, word, d.me);
  } catch {
    got = null; // no connection
  }
  d.pending.delete(word);
  if (d !== duel) return;
  if (got === null) return duelNo(word, 'duelOffline');
  if (!got) return duelNo(word, d.room.words?.[word] === d.me ? 'dup' : 'blocked');
  (d.room.words ??= {})[word] = d.me; // EventSource confirms it right after; this is just sooner
  say(word, 'good');
  pop(`+${points(word)}`, $('#duel-me'));
  fx.good(word.length);
  renderDuel();
}

function duelNo(word, key) {
  say(`${key === 'blocked' ? '🔒 ' : ''}${word} · ${t(lang, key)}`, key === 'dup' ? 'dup' : 'invalid');
  fx.bad();
}

// Time's up. The result dialog comes back if it gets closed: after the end there's nothing else to do.
function endDuel() {
  if (!$('#dlg-duel-end').open) $('#dlg-duel-end').showModal();
  if (duel.ended) return;
  duel.ended = true;
  tracing = false;
  path = [];
  typed = '';
  renderPath();
  say('');
  const { mine, theirs } = scores(duel.room, duel.me);
  if (mine > theirs) fx.win();
  renderDuelEnd();
  // Once more after the server's 2 s of grace, in case the stream died: the result mustn't miss a word
  const d = duel;
  setTimeout(() => getRoom(d.code).then(r => onDuelRoom(d, r), () => {}), 2500);
}

// Drawn again when a last-second word or the rival's rematch arrives.
function renderDuelEnd() {
  const { room, me } = duel;
  const { mine, theirs } = scores(room, me);
  $('#duel-result').textContent = t(lang, mine > theirs ? 'won' : mine < theirs ? 'lost' : 'tie');
  $('#duel-score').textContent = `${mine} – ${theirs}`;
  $('#duel-mine').textContent = wordsOf(room, me).join(' ');
  $('#duel-theirs').textContent = wordsOf(room, other(me)).join(' ');
  $('#duel-ask').textContent = t(lang, 'rematchAsk');
  $('#duel-ask').hidden = !room.next;
}

async function onRematch() {
  const d = duel;
  $('#btn-rematch').disabled = true; // a double tap would make two rooms
  try {
    const r = await rematch(d.code, lang, d.room.next);
    if (d !== duel) return;
    if (r.me === 'a') set(storage, 'wordini:duel', r);
    d.stop();
    $('#dlg-duel-end').close();
    enterDuel(r.code);
  } catch {
    $('#duel-ask').textContent = t(lang, 'duelOffline');
    $('#duel-ask').hidden = false;
  } finally {
    $('#btn-rematch').disabled = false;
  }
}

function leaveDuel() {
  duel?.stop?.();
  duel = null;
  $('#dlg-duel').close();
  $('#dlg-duel-end').close();
  $('#duel-hud').hidden = true;
  $('#board').classList.remove('veiled');
  $('#lang').disabled = $('#btn-duel').hidden = false;
  history.replaceState(null, '', location.pathname);
  start(pickLang());
}

function renderMute() {
  $('#btn-mute').textContent = fx.muted ? '🔇' : '🔊';
}

$('#lang').innerHTML = Object.entries(FLAGS).map(([l, flag]) => `<option value="${l}">${flag} ${l.toUpperCase()}</option>`).join('');
fx.setMuted(get(storage, 'wordini:muted') === true);
renderMute();

$('#lang').onchange = e => {
  e.target.blur(); // otherwise the select keeps the keyboard
  start(e.target.value);
};
$('#board').onpointerdown = onPointerDown;
$('#board').onpointermove = onPointerMove;
$('#board').onpointerup = $('#board').onpointercancel = onPointerUp;
$('#btn-next').onclick = $('#btn-next-dlg').onclick = nextLevel;
$('#btn-missed').onclick = () => ($('#missed').hidden = false);
$('#btn-help').onclick = () => $('#dlg-help').showModal();
$('#btn-hint').onclick = () => {
  if (!game || !hint(game, board)) return;
  startClock();
  saveGame(storage, lang, game);
  fx.tick(game.hint.shown);
  render();
};
$('#btn-share').onclick = e => share(shareText(lang, game.level, score(game.found), game.ms, game.hints, gameUrl()), e.target);
$('#btn-duel').onclick = challenge;
$('#btn-duel-share').onclick = e => share(`${t(lang, 'duelInvite')} ${duelLink(duel.code)}`, e.target);
$('#btn-duel-back').onclick = $('#btn-duel-leave').onclick = leaveDuel;
$('#btn-rematch').onclick = onRematch;
$('#btn-duel-result').onclick = e => {
  const { mine, theirs } = scores(duel.room, duel.me);
  share(duelText(lang, mine, theirs, gameUrl()), e.target);
};
$('#dlg-duel').oncancel = $('#dlg-duel-end').oncancel = e => e.preventDefault(); // Esc doesn't leave: their buttons do
// ...but a back gesture or a second Esc can still close it: an error message closed that way leaves too
$('#dlg-duel').onclose = () => duel && !board && leaveDuel();
$('#btn-mute').onclick = () => {
  fx.setMuted(!fx.muted);
  set(storage, 'wordini:muted', fx.muted);
  renderMute();
};
document.addEventListener('keydown', onKey);
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, fx.unlock);
document.addEventListener('visibilitychange', () => {
  if (!game) return;
  if (document.hidden) stopClock();
  else startClock();
});
addEventListener('pagehide', () => game && stopClock()); // fallback: some browsers don't fire visibilitychange on close
setInterval(renderClock, 250);

const vs = new URLSearchParams(location.search).get('vs'); // a duel link (spec duelo §3)

if (!vs && !get(storage, 'wordini:help-seen')) { // in a duel the 5 minutes are already running
  $('#dlg-help').showModal();
  set(storage, 'wordini:help-seen', true);
}

// Chrome (Android and desktop) fires this when the game can be installed as an app: our button instead of its banner
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  $('#btn-install').hidden = false;
  $('#btn-install').onclick = () => {
    e.prompt();
    $('#btn-install').hidden = true; // the event works once; if they say no, Chrome fires it again on a later visit
  };
});
navigator.serviceWorker?.register('sw.js'); // a new version shows up on the next load (see sw.js)
// Last: the controls already respond while the words download
if (vs) {
  lang = pickLang(); // texts while the room loads; then it's the room's language
  renderTexts();
  enterDuel(vs.toUpperCase());
} else start(pickLang());
