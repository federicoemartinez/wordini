import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, shareText } from '../js/share.js';

test('formatTime: minutos y segundos; horas solo si hacen falta', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(999), '0:00');
  assert.equal(formatTime(151_000), '2:31');
  assert.equal(formatTime(3_751_000), '1:02:31');
});

test('texto para compartir por idioma', () => {
  assert.equal(shareText('es', 14, 212, 151_000, 'https://example.com/?l=es'), 'Wordini 🇪🇸 · Nivel 14 ✅ · 212 pts · ⏱ 2:31\nhttps://example.com/?l=es');
  assert.equal(shareText('en', 3, 41, 59_000, 'https://example.com/?l=en'), 'Wordini 🇬🇧 · Level 3 ✅ · 41 pts · ⏱ 0:59\nhttps://example.com/?l=en');
  assert.equal(shareText('fr', 1, 9, 3_600_000, 'https://x/?l=fr'), 'Wordini 🇫🇷 · Niveau 1 ✅ · 9 pts · ⏱ 1:00:00\nhttps://x/?l=fr');
});
