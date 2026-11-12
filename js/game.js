// Game rules, no DOM: tracing, new words, gold tiles and threshold. Spec §2.
import { isValid, points } from './board.js';

export const newProgress = board => ({ found: [], goldLeft: board.gold.map(g => g.need), passed: false, ms: 0 });
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
  board.gold.forEach((g, k) => {
    if (path.includes(g.cell) && progress.goldLeft[k] > 0) progress.goldLeft[k]--;
  });
  if (progress.passed || score(progress.found) < board.threshold || progress.goldLeft.some(n => n > 0)) return 'ok';
  progress.passed = true;
  return 'cleared';
}
