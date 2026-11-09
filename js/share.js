import { FLAGS, t } from './i18n.js';

// Tiempo de juego: 2:31, o 1:02:31 desde la hora.
export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const pad = n => String(n).padStart(2, '0');
  const [h, m] = [Math.floor(s / 3600), Math.floor(s / 60) % 60];
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Texto para compartir: nivel superado, puntos y tiempo, sin spoilers.
export const shareText = (lang, level, pts, ms, url) =>
  `Wordini ${FLAGS[lang]} · ${t(lang, 'level')} ${level} ✅ · ${pts} pts · ⏱ ${formatTime(ms)}\n${url}`;
