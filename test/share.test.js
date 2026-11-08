import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText } from '../js/share.js';

const URL = 'https://example.com/?l=fr';
const row = s => [...s].map(c => c === 'G');

test('victoria en 1 intento', () => {
  assert.equal(shareText('fr', 42, [row('GGGGG')], true, URL), 'Wordini 🇫🇷 #42 1/6\n🟩🟩🟩🟩🟩\nhttps://example.com/?l=fr');
});

test('victoria en 3 intentos', () => {
  const attempts = [row('G..G.'), row('GG.G.'), row('GGGGG')];
  assert.equal(
    shareText('es', 7, attempts, true, URL),
    'Wordini 🇪🇸 #7 3/6\n🟩⬜⬜🟩⬜\n🟩🟩⬜🟩⬜\n🟩🟩🟩🟩🟩\nhttps://example.com/?l=fr',
  );
});

test('derrota muestra X/6 y los 6 intentos', () => {
  const attempts = Array(6).fill(row('G....'));
  const text = shareText('en', 1, attempts, false, URL);
  assert.ok(text.startsWith('Wordini 🇬🇧 #1 X/6\n'));
  assert.equal(text.split('\n').length, 8);
});
