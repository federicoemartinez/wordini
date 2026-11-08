import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAGS, STRINGS, t } from '../js/i18n.js';

test('todos los idiomas tienen exactamente las claves del inglés', () => {
  const keys = Object.keys(STRINGS.en).sort();
  for (const lang of Object.keys(STRINGS)) assert.deepEqual(Object.keys(STRINGS[lang]).sort(), keys, lang);
});

test('cada idioma con textos tiene bandera y viceversa', () => {
  assert.deepEqual(Object.keys(FLAGS).sort(), Object.keys(STRINGS).sort());
});

test('t cae al inglés si el idioma no existe', () => {
  assert.equal(t('es', 'open'), 'ABRIR');
  assert.equal(t('xx', 'open'), 'OPEN');
});
