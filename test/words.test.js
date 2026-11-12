import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const LANGS = ['es', 'en', 'fr'];
const load = l => JSON.parse(readFileSync(new URL(`../words/${l}.json`, import.meta.url), 'utf8'));

test('listas ordenadas según < de JS (el solver busca por bisección), Ñ incluida', () => {
  for (const l of LANGS) {
    const w = load(l);
    for (const key of ['valid', 'common']) {
      const list = w[key];
      for (let i = 1; i < list.length; i++) assert.ok(list[i - 1] < list[i], `${l}.${key}: ${list[i - 1]} >= ${list[i]}`);
    }
  }
});

test('palabras de 3 a 12 letras del alfabeto; common incluida en valid', () => {
  for (const l of LANGS) {
    const w = load(l);
    const re = new RegExp(`^[${w.alphabet}]{3,12}$`);
    for (const word of w.valid) assert.match(word, re, l);
    const valid = new Set(w.valid);
    for (const word of w.common) assert.ok(valid.has(word), `${l}: ${word} no está en valid`);
    assert.ok(w.common.length >= 10000, l);
  }
});

test('español: sin lista de bloqueo, con argentinismos (es_AR) y los agregados a mano', () => {
  const valid = new Set(load('es').valid);
  const missing = ['ASNO', 'COGER', 'COGIMOS', 'MARTILLOS', 'LABURO', 'BOLUDO', 'BONDI', 'PIBES'].filter(w => !valid.has(w));
  assert.deepEqual(missing, []);
});

test('inglés: los insultos que Hunspell marca NOSUGGEST siguen afuera', () => {
  const valid = new Set(load('en').valid);
  assert.deepEqual(['NIGGERS', 'NIGGAS', 'CUNTS', 'KRAUTS', 'WOPS'].filter(w => valid.has(w)), []);
});

test('francés: las palabras con œ se juegan con OE', () => {
  const valid = new Set(load('fr').valid);
  const missing = ['COEUR', 'SOEUR', 'OEIL', 'OEUF', 'OEUVRE', 'VOEU', 'NOEUD'].filter(w => !valid.has(w));
  assert.deepEqual(missing, []);
});
