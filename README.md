# Wordini

Juego de palabras: se arrastra por letras vecinas para armar palabras y hay que llegar a los puntos de cada nivel. Los niveles son infinitos y el nivel N es el mismo para todos. Funciona en español, inglés y francés. Es un sitio estático, sin backend y sin build.

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
python3 -m venv tools/.venv && tools/.venv/bin/pip install wordfreq==3.1.1 spylls==0.1.7
tools/.venv/bin/python tools/build_words.py es en fr
```

Cambiar las listas cambia las canchas a partir de ese momento.

## Calibrar la dificultad

Las perillas están al principio de `js/board.js`. Para ver cómo quedan los niveles:

```bash
node tools/levels.mjs es 1 50   # idioma, desde, hasta
```

## Publicar

Subir el repo a cualquier hosting estático, como GitHub Pages o Cloudflare Pages. Se publica la raíz tal cual. Los dos sirven `words/*.json` comprimido (~1 MB en español).

## Ver las palabras de una cancha mientras se desarrolla

Abrir la consola de DevTools y ejecutar:

```js
const { createBoard } = await import('/js/board.js');
const words = await (await fetch('/words/es.json')).json();
createBoard('es', 1, words).missed([]); // todas las palabras comunes del nivel 1
```
