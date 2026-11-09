// Persistencia en localStorage. Todo acceso tolera storage ausente o que lance (modo privado).
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

// Partida guardada de `lang`: { level, sig, found, goldLeft, passed }. Sin `level` (formato del criptex) se arranca de 1.
export function loadGame(storage, lang) {
  const saved = get(storage, `wordini:${lang}`);
  return Number.isInteger(saved?.level) && saved.level >= 1 ? saved : { level: 1 };
}

export const saveGame = (storage, lang, game) => set(storage, `wordini:${lang}`, game);

// El progreso guardado vale solo para la misma cancha; si cambiaron las listas de palabras, el nivel arranca de cero.
export const sigOf = board => board.letters.join('');
export const sameBoard = (game, board) =>
  game.sig === sigOf(board) && Array.isArray(game.found) && game.goldLeft?.length === board.gold.length;
