# Wordini

Puzzle diario de palabras: una cerradura de 5 anillos que hay que girar hasta que 3 filas formen 3 palabras. Funciona en español, inglés y francés. Es un sitio estático, sin backend y sin build.

## Jugar en local

Con `file://` no anda, porque el juego carga `words/*.json` con `fetch`. Hay que servirlo por HTTP:

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

## Tests

```bash
npm test   # = node --test (Node ≥ 22), sin dependencias
```

## Regenerar las listas de palabras

```bash
python3 -m venv tools/.venv && tools/.venv/bin/pip install wordfreq==3.1.1
tools/.venv/bin/python tools/build_words.py es en fr
```

Cambiar las listas cambia los puzzles a partir de ese momento.

## Publicar

1. En `js/puzzle.js`, poner en `LAUNCH_DATE` la fecha del primer deploy público, como `[año, mes 0-11, día]`. Ese día es el puzzle #1.
2. Subir el repo a cualquier hosting estático, como GitHub Pages o Cloudflare Pages. Se publica la raíz tal cual.

## Ver la solución mientras se desarrolla

Abrir la consola de DevTools y ejecutar:

```js
const { createPuzzle, dayNumber } = await import('/js/puzzle.js');
const words = await (await fetch('/words/es.json')).json();
createPuzzle('es', dayNumber(), words).reveal(); // { offsets, words }
```
