# Wordini

A word game: drag across neighboring letters to spell words and reach each level's target score. Levels are endless, level N is the same board for everyone, and a stopwatch times how long each one takes. Plays in Spanish, English and French. It's a static site: no backend, no build step.

**Play it at https://federicoemartinez.github.io/wordini/** (add `?l=es`, `?l=en` or `?l=fr` to pick the language).

## Run locally

It doesn't work over `file://`, because the game loads `words/*.json` with `fetch`. Serve it over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Tests

```bash
npm test   # = node --test (Node ≥ 22), no dependencies
```

## Regenerate the word lists

```bash
python3 -m venv tools/.venv && tools/.venv/bin/pip install wordfreq==3.1.1 spylls==0.1.7
tools/.venv/bin/python tools/build_words.py es en fr
```

Changing the lists changes every board from then on.

## Tune the difficulty

The knobs live at the top of `js/board.js`. To see how the levels come out:

```bash
node tools/levels.mjs es 1 50   # language, from, to
```

## Deploy

The site is published with GitHub Pages from the root of `master`, so every push to `master` redeploys it. Any other static host works too (e.g. Cloudflare Pages): publish the repo root as is. Both serve `words/*.json` compressed (~1 MB for Spanish).

## See a board's words while developing

Open the DevTools console and run:

```js
const { createBoard } = await import('./js/board.js');
const words = await (await fetch('./words/es.json')).json();
createBoard('es', 1, words).missed([]); // every common word on level 1
```
