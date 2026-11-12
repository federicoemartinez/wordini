// Meaning of the hint word, from the language's Wiktionary. Best effort: any failure gives null and the hint
// goes without it. The lists store words without accents (CAMION), so the page title is found by search first.
const SECTION = { es: 'Español', en: 'English', fr: 'Français' };
const MAX = 140;
const NOISE = /^Terms relating to /; // en: category label above the first sense

// Same normalization as the word lists (tools/build_words.py): no accents, ligatures split, Ñ kept in Spanish.
export function normalize(word, lang) {
  let w = word.toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  if (lang === 'es') w = w.replace(/ñ/g, '\0');
  return w.normalize('NFD').replace(/\p{M}/gu, '').replace(/\0/g, 'ñ').toUpperCase();
}

// First definition of `title` in its language's section of a plain-text extract, with the word itself hidden.
export function firstDefinition(lang, extract, title) {
  const start = extract.indexOf(`\n== ${SECTION[lang]} ==\n`);
  if (start < 0) return null;
  const end = extract.indexOf('\n== ', start + 1);
  const lines = extract.slice(start, end < 0 ? undefined : end).split('\n').map(l => l.trim());
  // es numbers its senses ("1" or "1 Transporte", text on the next line); en and fr follow the headword line
  const at = lang === 'es' ? lines.findIndex(l => /^1( |$)/.test(l)) : lines.findIndex(l => l === title || l.startsWith(`${title} `));
  const def = at < 0 ? undefined : lines.slice(at + 1).find(l => l && !l.startsWith('=') && !NOISE.test(l));
  if (!def) return null;
  const word = normalize(title, lang);
  const masked = def.replace(/\p{L}+/gu, w => (normalize(w, lang) === word ? '___' : w)); // árbol too for ARBOL
  return masked.length > MAX ? `${masked.slice(0, masked.lastIndexOf(' ', MAX))}…` : masked;
}

// Search titles that can be the word: lowercase (a capitalized one is a proper noun) and normalizing to it.
// Accented first: for ARBOL, "árbol" defines it and "arbol" only says it's an old spelling.
export const candidates = (titles, word, lang) =>
  titles.filter(t => t === t.toLowerCase() && normalize(t, lang) === word).sort((a, b) => (a === a.normalize('NFD')) - (b === b.normalize('NFD')));

const api = (lang, params) =>
  fetch(`https://${lang}.wiktionary.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: 2, origin: '*', ...params })}`).then(r => r.json());

export async function define(lang, word) {
  try {
    const found = await api(lang, { list: 'search', srsearch: `intitle:${word.toLowerCase()}`, srlimit: 10 });
    for (const title of candidates(found.query.search.map(s => s.title), word, lang)) {
      const page = await api(lang, { prop: 'extracts', explaintext: 1, exsectionformat: 'wiki', titles: title });
      const def = firstDefinition(lang, page.query.pages[0].extract ?? '', title);
      if (def) return def;
    }
  } catch {} // offline, rate-limited, unexpected answer: no meaning
  return null;
}
