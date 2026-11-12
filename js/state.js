// localStorage persistence. Every access tolerates a missing or throwing storage (private mode).
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

// Saved game for `lang`: { level, sig, found, goldLeft, passed, ms }. Without `level` (old criptex format) it starts at 1.
export function loadGame(storage, lang) {
  const saved = get(storage, `wordini:${lang}`);
  return Number.isInteger(saved?.level) && saved.level >= 1 ? saved : { level: 1 };
}

export const saveGame = (storage, lang, game) => set(storage, `wordini:${lang}`, game);

// Saved progress only applies to the same board; if the word lists changed, the level starts over.
export const sigOf = board => board.letters.join('');
export const sameBoard = (game, board) =>
  game.sig === sigOf(board) && Array.isArray(game.found) && game.goldLeft?.length === board.gold.length;
