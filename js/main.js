import { createPuzzle, dayNumber, RING, COLS } from './puzzle.js';
import { shareText } from './share.js';
import { FLAGS, t } from './i18n.js';
import { get, set, loadGame, saveGame, recordResult } from './state.js';
import * as fx from './fx.js';

const MAX_ATTEMPTS = 6;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = sel => document.querySelector(sel);
const ringEl = i => $('#lock').children[i];

let storage;
try {
  storage = localStorage;
} catch {} // bloqueado: el juego funciona sin persistencia

let lang, puzzle, game;
let selected = 0;

const locked = i => game.attempts.some(a => a[i]);
const alreadyTried = () => game.tried.includes(game.offsets.join(''));

function pickLang() {
  const wanted = [new URLSearchParams(location.search).get('l'), get(storage, 'wordini:lang'), navigator.language?.slice(0, 2)];
  return wanted.find(l => Object.hasOwn(FLAGS, l ?? '')) ?? 'en';
}

async function start(newLang) {
  lang = newLang;
  set(storage, 'wordini:lang', lang);
  document.documentElement.lang = lang;
  $('#lang').value = lang;
  renderTexts();
  let words;
  try {
    words = await (await fetch(`words/${lang}.json`)).json();
  } catch {
    game = puzzle = undefined; // nunca guardar la partida de un idioma con la clave de otro
    $('#lock').replaceChildren();
    $('#message').textContent = t(lang, 'loadError');
    return;
  }
  if (lang !== newLang) return; // el jugador cambió de idioma mientras cargaba
  const day = dayNumber();
  puzzle = createPuzzle(lang, day, words);
  game = loadGame(storage, lang, day);
  game.offsets ??= [...puzzle.start];
  if (game.status === 'lost') game.offsets = puzzle.reveal().offsets;
  renderLock();
  renderStatus();
}

function renderTexts() {
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(lang, el.dataset.t);
  for (const el of document.querySelectorAll('[data-label]')) {
    el.title = t(lang, el.dataset.label);
    el.setAttribute('aria-label', el.title);
  }
}

function renderLock() {
  $('#lock').replaceChildren(
    ...puzzle.rings.map((_, i) => {
      const ring = document.createElement('div');
      ring.className = 'ring';
      ring.tabIndex = 0;
      ring.style.setProperty('--i', i);
      ring.innerHTML =
        '<button class="up" tabindex="-1" aria-hidden="true">▲</button>' +
        '<div class="reel"><div class="strip"></div></div>' +
        '<button class="down" tabindex="-1" aria-hidden="true">▼</button>';
      ring.querySelector('.up').onclick = () => rotate(i, 1);
      ring.querySelector('.down').onclick = () => rotate(i, -1);
      ring.onfocus = () => (selected = i);
      dragToRotate(ring.querySelector('.reel'), i);
      return ring;
    }),
  );
  puzzle.rings.forEach((_, i) => renderRing(i, 0));
}

// Muestra 5 letras: 1 arriba, las 3 de la ventana y 1 abajo. dir anima el paso (+1 sube, -1 baja).
function renderRing(i, dir) {
  const ring = ringEl(i);
  const o = game.offsets[i];
  const letters = [-1, 0, 1, 2, 3].map(k => puzzle.rings[i][(o + k + RING) % RING]);
  const strip = ring.querySelector('.strip');
  strip.replaceChildren(...letters.map(c => Object.assign(document.createElement('div'), { className: 'cell', textContent: c })));
  ring.classList.toggle('locked', locked(i));
  ring.setAttribute('aria-label', letters.slice(1, 4).join(' '));
  if (dir && !calm) {
    strip.animate([{ transform: `translateY(${dir * 20}%)` }, { transform: 'none' }], { duration: 140, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  }
}

function rotate(i, dir) {
  selected = i;
  if (game.status !== 'playing' || locked(i)) return;
  game.offsets[i] = (game.offsets[i] + dir + RING) % RING;
  renderRing(i, dir);
  fx.tick();
  renderStatus();
  saveGame(storage, lang, game);
}

// Cada vez que el arrastre recorre la altura de una letra, el anillo avanza un paso.
function dragToRotate(reel, i) {
  let y0 = null;
  reel.onpointerdown = e => {
    y0 = e.clientY;
    reel.setPointerCapture(e.pointerId);
    ringEl(i).focus({ preventScroll: true });
  };
  reel.onpointermove = e => {
    if (y0 === null) return;
    const cell = reel.offsetHeight / 5;
    while (y0 - e.clientY >= cell) {
      rotate(i, 1);
      y0 -= cell;
    }
    while (e.clientY - y0 >= cell) {
      rotate(i, -1);
      y0 += cell;
    }
  };
  reel.onpointerup = reel.onpointercancel = () => (y0 = null);
}

function open() {
  if (!game || game.status !== 'playing' || alreadyTried()) return;
  const result = puzzle.check(game.offsets);
  game.attempts.push(result);
  game.tried.push(game.offsets.join(''));
  fx.clack();
  if (result.every(Boolean)) finish(true);
  else if (game.attempts.length === MAX_ATTEMPTS) finish(false);
  saveGame(storage, lang, game);
  puzzle.rings.forEach((_, i) => renderRing(i, 0));
  renderStatus();
}

function finish(won) {
  game.status = won ? 'won' : 'lost';
  game.stats = recordResult(game.stats, game.day, won, game.attempts.length);
  if (won) fx.win();
  else {
    fx.lose();
    spinTo(puzzle.reveal().offsets);
  }
  setTimeout(showStats, 1500);
}

// Derrota: los anillos giran paso a paso hasta la solución (o saltan si se pidió menos movimiento).
async function spinTo(target) {
  while (game.offsets.some((o, i) => o !== target[i])) {
    game.offsets.forEach((o, i) => {
      if (o === target[i]) return;
      game.offsets[i] = (o + 1) % RING;
      renderRing(i, 1);
    });
    if (!calm) await new Promise(r => setTimeout(r, 90));
  }
}

function renderStatus() {
  const btn = $('#btn-open');
  btn.textContent = `${t(lang, 'open')} · ${MAX_ATTEMPTS - game.attempts.length}`;
  btn.disabled = game.status !== 'playing' || alreadyTried();
  $('#lock').classList.toggle('won', game.status === 'won');
  $('#lock').classList.toggle('lost', game.status === 'lost');
  $('#history').replaceChildren(
    ...game.attempts.map(a => {
      const li = document.createElement('li');
      li.setAttribute('aria-label', `${a.filter(Boolean).length}/${COLS}`);
      li.innerHTML = a.map(ok => `<span class="sq${ok ? ' ok' : ''}"></span>`).join('');
      return li;
    }),
  );
  const over = game.status !== 'playing';
  $('#message').textContent = over ? `${t(lang, game.status)} ${puzzle.reveal().words.join(' · ')}` : '';
}

function showStats() {
  if (!game) return;
  const s = game.stats;
  const cells = [[s.played, 'played'], [s.played ? Math.round((100 * s.won) / s.played) : 0, 'winPct'], [s.streak, 'streak'], [s.maxStreak, 'maxStreak']];
  $('#stats').innerHTML = cells.map(([n, key]) => `<div><b>${n}</b><small>${t(lang, key)}</small></div>`).join('');
  const max = Math.max(1, ...s.dist);
  const today = game.status === 'won' ? game.attempts.length - 1 : -1;
  $('#dist').innerHTML = s.dist
    .map((n, k) => `<div class="row"><span>${k + 1}</span><span class="bar${k === today ? ' today' : ''}" style="width:${(100 * n) / max}%">${n}</span></div>`)
    .join('');
  $('#btn-share').hidden = $('#next').hidden = game.status === 'playing';
  $('#dlg-stats').showModal();
}

async function share() {
  const url = `${location.origin}${location.pathname}?l=${lang}`;
  const text = shareText(lang, game.day + 1, game.attempts, game.status === 'won', url);
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
    prompt('', text); // sin portapapeles: que lo copie a mano
  }
}

function onKey(e) {
  if (!game || document.querySelector('dialog[open]') || e.target.tagName === 'SELECT') return;
  if (e.key === 'Enter' && e.target.tagName === 'BUTTON') return; // el botón ya recibe el click
  const actions = {
    ArrowLeft: () => ringEl((selected + COLS - 1) % COLS).focus(),
    ArrowRight: () => ringEl((selected + 1) % COLS).focus(),
    ArrowUp: () => rotate(selected, 1),
    ArrowDown: () => rotate(selected, -1),
    Enter: open,
  };
  if (!actions[e.key]) return;
  e.preventDefault();
  actions[e.key]();
}

function renderMute() {
  $('#btn-mute').textContent = fx.muted ? '🔇' : '🔊';
}

$('#lang').innerHTML = Object.entries(FLAGS).map(([l, flag]) => `<option value="${l}">${flag} ${l.toUpperCase()}</option>`).join('');
fx.setMuted(get(storage, 'wordini:muted') === true);
renderMute();
await start(pickLang());

$('#lang').onchange = e => start(e.target.value);
$('#btn-open').onclick = open;
$('#btn-help').onclick = () => $('#dlg-help').showModal();
$('#btn-stats').onclick = showStats;
$('#btn-share').onclick = share;
$('#btn-mute').onclick = () => {
  fx.setMuted(!fx.muted);
  set(storage, 'wordini:muted', fx.muted);
  renderMute();
};
document.addEventListener('keydown', onKey);
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, fx.unlock);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && game && dayNumber() !== game.day) start(lang); // pasó la medianoche con la pestaña abierta
});

if (!get(storage, 'wordini:help-seen')) {
  $('#dlg-help').showModal();
  set(storage, 'wordini:help-seen', true);
}
