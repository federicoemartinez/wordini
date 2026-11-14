// Game rules, no DOM: tracing, new words, gold tiles and threshold. Spec §2.
import { isValid, pathFor, points, TURN_FROM, turnCell } from './board.js';

export const newProgress = board => ({ found: [], goldLeft: board.gold.map(g => g.need), passed: false, ms: 0, hints: 0 });
export const score = found => found.reduce((n, w) => n + points(w), 0);
export const wordOf = (board, path) => path.map(i => board.letters[i]).join('');

const adjacent = (a, b, size) =>
  Math.abs((a % size) - (b % size)) <= 1 && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1;

// Tracing: adds `cell` if it neighbors the last one and is unused; going back to the second-to-last drops the last.
export function step(path, cell, size) {
  if (cell === path.at(-1) || (path.includes(cell) && cell !== path.at(-2))) return path;
  if (cell === path.at(-2)) return path.slice(0, -1);
  if (path.length && !adjacent(path.at(-1), cell, size)) return path;
  return [...path, cell];
}

// Plays a path. Returns 'short' | 'invalid' | 'dup' | 'ok' | 'cleared' ('cleared' = ok and the level was just cleared).
export function play(progress, board, words, path) {
  const word = wordOf(board, path);
  if (word.length < 3) return 'short';
  if (!isValid(words, word)) return 'invalid';
  if (progress.found.includes(word)) return 'dup';
  progress.found.push(word);
  if (progress.hint && wordOf(board, progress.hint.path) === word) delete progress.hint;
  board.gold.forEach((g, k) => {
    if (path.includes(g.cell) && progress.goldLeft[k] > 0) progress.goldLeft[k]--;
  });
  if (progress.passed || score(progress.found) < board.threshold || progress.goldLeft.some(n => n > 0)) return 'ok';
  progress.passed = true;
  return 'cleared';
}

// Hint: each call lights one more tile of a missed common word. Each lit tile points to the next one, so it
// stops 2 short of the end: the last letter is never shown. Picks a word through a pending gold tile if there
// is one, then the one closest to 5 letters. Returns false if there's nothing to light.
export function hint(progress, board) {
  const h = progress.hint;
  if (h) {
    if (h.shown >= h.path.length - 2) return false;
    h.shown++;
  } else {
    const pending = board.gold.filter((_, k) => progress.goldLeft[k] > 0).map(g => g.cell);
    const rank = p => (p.some(c => pending.includes(c)) ? 0 : 100) + Math.abs(p.length - 5);
    const paths = board.missed(progress.found).map(w => pathFor(w, board.letters, pending));
    if (!paths.length) return false;
    progress.hint = { path: paths.reduce((a, b) => (rank(b) < rank(a) ? b : a)), shown: 1 };
  }
  progress.hints++;
  return true;
}

// From TURN_FROM on, the first word that reaches half the target turns and/or mirrors the board, once, so a
// memorized layout stops helping. Picks the symmetry (turnCell) and moves the hint with the letters; the caller
// applies turnBoard. Returns whether it turned.
export function turn(game, board) {
  if (game.level < TURN_FROM || game.turn || game.passed || 2 * score(game.found) < board.threshold) return false;
  game.turn = 1 + Math.floor(Math.random() * 7);
  if (game.hint) game.hint.path = game.hint.path.map(turnCell(board.size, game.turn));
  return true;
}
