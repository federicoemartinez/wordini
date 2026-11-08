// Persistencia en localStorage. Todo acceso tolera storage ausente o que lance (modo privado).
export const emptyStats = () => ({ played: 0, won: 0, streak: 0, maxStreak: 0, lastWinDay: null, dist: [0, 0, 0, 0, 0, 0] });

export function get(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

export function set(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Partida de hoy en `lang`; si la guardada es de otro día se descarta, las estadísticas se conservan.
export function loadGame(storage, lang, day) {
  const saved = get(storage, `wordini:${lang}`);
  const stats = saved?.stats ?? emptyStats();
  if (saved?.day === day) return saved;
  return { day, offsets: null, attempts: [], tried: [], status: 'playing', stats };
}

export const saveGame = (storage, lang, game) => set(storage, `wordini:${lang}`, game);

export function recordResult(stats, day, won, nAttempts) {
  const s = { ...stats, dist: [...stats.dist], played: stats.played + 1 };
  if (!won) return { ...s, streak: 0 };
  s.won++;
  s.dist[nAttempts - 1]++;
  s.streak = stats.lastWinDay === day - 1 ? stats.streak + 1 : 1;
  s.maxStreak = Math.max(s.maxStreak, s.streak);
  s.lastWinDay = day;
  return s;
}
