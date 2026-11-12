import { createBoard, pathFor, points } from './board.js';
import { define } from './define.js';
import { hint, newProgress, play, score, step, wordOf } from './game.js';
import { formatTime, levelResult, shareText } from './share.js';
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
  let loaded;
  try {
    const res = await fetch(`words/${lang}.json`);
    if (!res.ok) throw new Error(res.status);
    loaded = await res.json();
    if (!Array.isArray(loaded?.valid) || !Array.isArray(loaded?.common)) throw new Error('old format'); // e.g. the criptex one, cached
  } catch {
    if (seq === loadSeq) say(t(lang, 'loadError'));
    return;
  }
  if (seq !== loadSeq) return; // the player switched language while loading
  words = loaded;
  enterLevel(loadGame(storage, lang));
}

function enterLevel(saved) {
  board = createBoard(lang, saved.level, words);
  game = sameBoard(saved, board) ? saved : { level: saved.level, sig: sigOf(board), ...newProgress(board) };
  game.ms ??= 0; // games saved before the stopwatch existed
  game.hints ??= 0; // ...or hints
  idleFrom = game.ms;
  saveGame(storage, lang, game);
  path = [];
  typed = '';
  since = null;
  if (game.ms > 0) startClock(); // was already playing this level: resume
  renderBoard();
  render();
  say('');
}

// The clock runs from the level's first letter until it's cleared, and only while the tab is visible.
const elapsed = () => game.ms + (since === null ? 0 : performance.now() - since);

function startClock() {
  if (since === null && !game.passed && !document.hidden) since = performance.now();
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
  if (!game) return;
  $('#time').textContent = `⏱ ${formatTime(elapsed())}`;
  $('#btn-hint').classList.toggle('nudge', !game.hint && !$('#btn-hint').disabled && elapsed() - idleFrom > 60_000);
}

function renderTexts() {
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
  const lengths = [...new Set(game.found.map(w => w.length))].sort((a, b) => b - a);
  $('#found-title').textContent = `${t(lang, 'found')} (${game.found.length})`;
  $('#found').replaceChildren(
    ...lengths.map(n => {
      const p = document.createElement('p');
      p.append(Object.assign(document.createElement('b'), { textContent: n }), game.found.filter(w => w.length === n).sort().join(' '));
      return p;
    }),
  );
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

function pop(text) {
  const el = Object.assign(document.createElement('span'), { className: 'pop', textContent: text });
  $('#bar').append(el);
  setTimeout(() => el.remove(), 900);
}

const pendingGold = () => board.gold.filter((_, k) => game.goldLeft[k] > 0).map(g => g.cell);

function submit(p) {
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
  saveGame(storage, lang, game);
  idleFrom = elapsed();
  say(word, 'good');
  pop(`+${points(word)}`);
  fx.good(word.length);
  if (game.goldLeft.join() !== goldBefore) fx.gold();
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
  if (!board || !tile) return;
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
  if (!board || tracing || document.querySelector('dialog[open]') || e.target.tagName === 'SELECT') return;
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

async function share() {
  const url = `${location.origin}${location.pathname}?l=${lang}`;
  const text = shareText(lang, game.level, score(game.found), game.ms, game.hints, url);
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
    $('#btn-share').textContent = t(lang, 'copied');
    setTimeout(() => ($('#btn-share').textContent = t(lang, 'share')), 1500);
  } catch {
    prompt('', text); // no clipboard: let them copy it by hand
  }
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
$('#btn-share').onclick = share;
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
  else if (game.ms > 0) startClock();
});
addEventListener('pagehide', () => game && stopClock()); // fallback: some browsers don't fire visibilitychange on close
setInterval(renderClock, 250);

if (!get(storage, 'wordini:help-seen')) {
  $('#dlg-help').showModal();
  set(storage, 'wordini:help-seen', true);
}

start(pickLang()); // last: the controls already respond while the words download
