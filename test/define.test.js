import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, firstDefinition, normalize } from '../js/define.js';

// Recortes reales de extractos de Wiktionary (prop=extracts, explaintext, exsectionformat=wiki)
const CASA = '\n== Español ==\n\n\n=== Etimología 1 ===\nDel latín casa (\'choza\'), de origen incierto.\n\n\n==== Sustantivo femenino ====\ncasa ¦ plural: casas\n\n1 Vivienda\nEdificación destinada a vivienda.\n2\nDomicilio.\n';
const COMIAMOS = '\n== Español ==\n\n\n=== Forma verbal ===\n1\nPrimera persona del plural (nosotros, nosotras) del pretérito imperfecto de indicativo de comer.\n\n\n== Referencias y notas ==';
const CAMION_FR = '\n== Francés ==\n\n\n=== Sustantivo masculino ===\ncamion ¦ plural: camions\n\n1\nCamión.\n';
const RUNNING = '\n== English ==\n\n\n=== Etymology ===\nBy surface analysis, run +‎ -ing.\n\n\n=== Verb ===\nrunning\n\npresent participle and gerund of run\n\n\n=== Adjective ===\nrunning (not comparable)\n\nMoving or advancing at a run.\n';
const ETE = '\n== Français ==\n\n\n=== Étymologie ===\n(Nom commun)  Du moyen français esté.\n\n\n=== Nom commun ===\n\nété \\e.te\\ masculin\n\nLa plus chaude des quatre saisons de l’année. Dans l’hémisphère nord, l’été astronomique s’étend du 7 mai au 7 août, le solstice d’été représentant le milieu de l’été.\n';

test('firstDefinition: español, con y sin rótulo después del número', () => {
  assert.equal(firstDefinition('es', CASA, 'casa'), 'Edificación destinada a vivienda.');
  assert.equal(firstDefinition('es', COMIAMOS, 'comíamos'), 'Primera persona del plural (nosotros, nosotras) del pretérito imperfecto de indicativo de comer.');
});

test('firstDefinition: inglés y francés, la línea que sigue a la de la palabra', () => {
  assert.equal(firstDefinition('en', RUNNING, 'running'), 'present participle and gerund of run');
  assert.match(firstDefinition('fr', ETE, 'été'), /^La plus chaude des quatre saisons/);
});

test('firstDefinition: sin sección del idioma no hay definición', () => {
  assert.equal(firstDefinition('es', CAMION_FR, 'camion'), null);
  assert.equal(firstDefinition('en', '', 'cat'), null);
});

test('firstDefinition: tapa la palabra (sin tocar otras que la contienen) y corta las largas', () => {
  const cat = '\n== English ==\n\n=== Noun ===\ncat (plural cats)\n\nA Cat, or a cat; not a category.\n';
  assert.equal(firstDefinition('en', cat, 'cat'), 'A ___, or a ___; not a category.');
  const ete = firstDefinition('fr', ETE, 'été');
  assert.ok(ete.length <= 141 && ete.endsWith('…'), ete);
  assert.ok(!ete.includes('été'), ete);
});

test('normalize: igual que tools/build_words.py', () => {
  assert.equal(normalize('Camión', 'es'), 'CAMION');
  assert.equal(normalize('ñandú', 'es'), 'ÑANDU');
  assert.equal(normalize('cœur', 'fr'), 'COEUR');
  assert.equal(normalize('été', 'fr'), 'ETE');
});

test('firstDefinition: tapa también la palabra con otras tildes (ARBOL -> árbol)', () => {
  const arbol = '\n== Español ==\n\n=== Sustantivo masculino ===\n1\nGrafía obsoleta de árbol.\n';
  assert.equal(firstDefinition('es', arbol, 'arbol'), 'Grafía obsoleta de ___.');
});

test('firstDefinition: en inglés saltea el rótulo de categoría', () => {
  const cat = '\n== English ==\n\n==== Noun ====\n\ncat (countable and uncountable, plural cats)\n\nTerms relating to animals.\n (countable) A mammal of the family Felidae.\n';
  assert.equal(firstDefinition('en', cat, 'cat'), '(countable) A mammal of the family Felidae.');
});

test('candidates: títulos en minúscula que normalizan a la palabra, primero los que llevan tilde', () => {
  assert.deepEqual(candidates(['arbol', 'Árbol', 'árbol', 'arbolito'], 'ARBOL', 'es'), ['árbol', 'arbol']);
  assert.deepEqual(candidates(['camion', 'camión', 'marcha camión'], 'CAMION', 'es'), ['camión', 'camion']);
});
