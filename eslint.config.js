import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['tools/.venv/'] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // `catch {}` is on purpose: storage, sound and Wiktionary are best effort
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
];
