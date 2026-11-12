// Level stats for calibrating the knobs in js/board.js. Usage: node tools/levels.mjs es [from] [to]
import { readFileSync } from 'node:fs';
import { createBoard, points } from '../js/board.js';

const [lang = 'es', from = '1', to = '50'] = process.argv.slice(2);
const words = JSON.parse(readFileSync(new URL(`../words/${lang}.json`, import.meta.url), 'utf8'));
for (let level = +from; level <= +to; level++) {
  const t0 = performance.now();
  const b = createBoard(lang, level, words);
  const ms = performance.now() - t0;
  const common = b.missed([]);
  const total = common.reduce((n, w) => n + points(w), 0);
  const longest = common.reduce((a, w) => (w.length > a.length ? w : a), '');
  const gold = b.gold.map(g => `${b.letters[g.cell]}×${g.need}`).join(' ') || '-';
  console.log(`${String(level).padStart(3)}  ${b.size}×${b.size}  common ${String(b.commonCount).padStart(3)}  threshold ${String(b.threshold).padStart(3)}/${String(total).padEnd(4)} gold ${gold.padEnd(12)} ${longest.padEnd(12)} ${ms.toFixed(0)}ms`);
}
