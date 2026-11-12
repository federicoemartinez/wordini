import { FLAGS, t } from './i18n.js';

// Play time: 2:31, or 1:02:31 from one hour on.
export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const pad = n => String(n).padStart(2, '0');
  const [h, m] = [Math.floor(s / 3600), Math.floor(s / 60) % 60];
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Level result, in the cleared dialog and the share text: points, time and hints used (0 too).
export const levelResult = (lang, level, pts, ms, hints) =>
  `${t(lang, 'level')} ${level} · ${pts} pts · ⏱ ${formatTime(ms)} · 💡${hints}`;

// Share text: the level result with ✅ after the level, no spoilers.
export const shareText = (lang, level, pts, ms, hints, url) =>
  `Wordini ${FLAGS[lang]} · ${levelResult(lang, level, pts, ms, hints).replace(' · ', ' ✅ · ')}\n${url}`;
