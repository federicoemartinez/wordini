import { FLAGS } from './i18n.js';

// Texto para compartir sin spoilers. attempts: un array de 5 booleans por intento.
export function shareText(lang, n, attempts, won, url) {
  const grid = attempts.map(a => a.map(ok => (ok ? '🟩' : '⬜')).join('')).join('\n');
  return `Wordini ${FLAGS[lang]} #${n} ${won ? attempts.length : 'X'}/6\n${grid}\n${url}`;
}
