# Canchas grandes y con forma: plan de implementación

> **Para agentes que lo ejecuten:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** desde el nivel 40, la mitad de las canchas sigue siendo 5×5, un cuarto es 6×6 y un cuarto tiene forma (rombo girado, rombo escalonado, picos, cruz, octógono, dona). Ninguna cancha cuadrada cambia.

**Arquitectura:**
- Una forma es una máscara sobre la grilla cuadrada: `letters` lleva `null` en los huecos.
- La forma se sortea en `board.js` con un PRNG propio. `game.js` no cambia.
- La pantalla dibuja cada hueco como un `<div class="hole">` vacío. El rombo girado es el 5×5 con `rotate: 45deg` en CSS.

**Tecnologías:** JS vanilla (módulos ES), `node --test`, ESLint, playwright-core + chrome-headless-shell (ya instalados, solo para el recorrido descartable).

**Spec:** `docs/superpowers/specs/2026-11-19-canchas-con-forma-design.md`

**Base:** la rama `feat/canchas-con-forma` (worktree `/home/fede/Documents/projects/wordini-formas`) está arriba de `origin/feat/candado-y-contramano` (483ab3a), que trae los candados. Todo se hace en ese worktree: en `/home/fede/Documents/projects/wordini` trabaja otra sesión.

## Restricciones globales

- `SHAPE_FROM = 40`. Desde ahí: 50% 5×5, 25% 6×6 y 25% una de las 6 formas, cada una con la misma probabilidad.
- PRNG de la forma: `mulberry32(fnv1a(`${lang}:${level}:shape`))`. Nunca se sortea con el `rand` de las letras.
- Las canchas 1-39 y las 5×5 y `tilt` del 40 en adelante dan exactamente lo mismo que en la base: letras, doradas, ?, al revés, candados, umbral y cantidad de comunes.
- Mínimo de comunes: 25 con 16 casillas y `2 × casillas` con el resto. Palabra larga: 6 letras con 16 casillas y 7 con el resto.
- Umbral: `Math.ceil(pct(level) * commonPoints * Math.min(1, Math.sqrt(25 / cells)))`.
- Comentarios de código en inglés, nombres de tests en español, mensajes de commit en español (`feat: ...`).
- Sin aviso emergente. Una línea nueva de ayuda, `help7`, en en/es/fr.

## Foco de revisión

Lo que la spec implica, los tests unitarios no cubren y más probablemente le pegue a un jugador:

1. Con huecos, el resaltado (`.on`) y la línea del trazo tienen que caer en las casillas tocadas, no corridas. `renderPath` hoy indexa `querySelectorAll('.tile')` por número de casilla, y con huecos eso se corre. Lo cubre el recorrido de la Tarea 2: lee `.tile.on` en pleno trazo.
2. Un trazo en diagonal en una cancha de 7 de ancho o en el rombo girado no tiene que agarrar a las vecinas. Lo cubre el recorrido: el trazo pasa por un paso en diagonal y se compara con las casillas prendidas.
3. Teclado y pista en canchas con huecos: `pathFor` nunca pasa por un hueco. Lo cubre el test "solve y pathFor saltean los huecos" (Tarea 1).
4. Una cancha con forma y progreso guardado ya girado (`game.turn`) se dibuja con los huecos en su lugar y se puede jugar. Lo cubre el recorrido con `nivel:t`, y en la Tarea 1 el test de `turnBoard` con una dona.
5. En 360 px no hay scroll horizontal (las puntas del rombo girado) y las filas con huecos tienen la misma altura. Lo cubre el recorrido.

---

### Tarea 1: forma, huecos, mínimos y umbral en `board.js`

**Archivos:**
- Modificar: `js/board.js` (constantes de arriba, `solve`, `pickFlipped`, `createBoard`; nuevos `SHAPES` y `pickShape`)
- Modificar: `test/board.test.js`
- Modificar: `tools/levels.mjs`

**Interfaces:**
- Produce: `export const SHAPES` (nombre → array de strings con `#` y `.`). La cancha (`createBoard`) suma `shape` (`'square'` o una clave de `SHAPES`). En los huecos, `letters[i] === null`. `size` sigue siendo el lado de la grilla.

- [ ] **Paso 1: escribir los tests que fallan**

En `test/board.test.js`, sumar `SHAPES` al import:

```js
import { closed, createBoard, isValid, neighbors, pathFor, points, shown, solve, SHAPES, turnBoard, turnCell } from '../js/board.js';
```

Agregar, después de `const adjacent = ...`:

```js
// Primer nivel desde el 40 cuya cancha tiene la forma `shape`.
function firstLevel(l, shape) {
  for (let level = 40; ; level++) if (createBoard(l, level, words[l]).shape === shape) return level;
}
```

Reemplazar el arranque del test `niveles 1-200` (desde `test('niveles 1-200` hasta la línea `assert.ok(b.threshold > 0 && b.threshold <= total, id);` inclusive) por:

```js
test('niveles 1-200: tamaño, forma, mínimos, umbral, doradas, ?, letras al revés y candados', () => {
  let withLocks = 0;
  const kinds = { 5: 0, 6: 0, shape: 0 };
  const shapes = new Set();
  for (const l of LANGS) {
    for (let level = 1; level <= 200; level++) {
      const b = createBoard(l, level, words[l]);
      const id = `${l}:${level}`;
      if (level < 40) assert.deepEqual([b.shape, b.size], ['square', level <= 10 ? 4 : 5], id);
      else kinds[b.shape === 'square' ? b.size : 'shape']++;
      if (b.shape !== 'square') shapes.add(b.shape);
      const mask = b.shape === 'square' ? Array(b.size).fill('#'.repeat(b.size)) : SHAPES[b.shape];
      assert.equal(b.letters.map(c => (c === null ? '.' : '#')).join(''), mask.join(''), `${id}: ${b.shape}`);
      const cells = b.letters.filter(c => c !== null).length;
      const common = b.missed([]);
      assert.equal(common.length, b.commonCount, id);
      assert.ok(common.length >= (cells === 16 ? 25 : 2 * cells), id);
      assert.ok(common.some(w => w.length >= (cells === 16 ? 6 : 7)), id);
      const total = common.reduce((n, w) => n + points(w), 0);
      assert.ok(b.threshold > 0 && b.threshold <= total, id);
      // Desde el 40, pct ya está en su tope (0.45): las canchas grandes piden un poco menos (spec §5)
      if (level >= 40) assert.equal(b.threshold, Math.ceil(0.45 * total * Math.min(1, Math.sqrt(25 / cells))), `${id}: umbral`);
      const special = [...b.gold.map(g => g.cell), ...b.hidden, ...b.flipped.map(f => f.cell), ...b.locks.map(k => k.cell)];
      assert.ok(special.every(c => b.letters[c] !== null), `${id}: casilla especial en un hueco`);
```

El resto del cuerpo del test queda igual. Al final, después de `assert.ok(withLocks > 100 && withLocks < 400, ...)` y antes del `});` que lo cierra, agregar:

```js
  // Del 40 al 200 (161 canchas por idioma): la mitad 5×5, un cuarto 6×6, un cuarto con forma, y salen todas las formas
  const n = 3 * 161;
  assert.ok(kinds[5] > 0.4 * n && kinds[5] < 0.6 * n, JSON.stringify(kinds));
  for (const k of [6, 'shape']) assert.ok(kinds[k] > 0.15 * n && kinds[k] < 0.35 * n, JSON.stringify(kinds));
  assert.deepEqual([...shapes].sort(), Object.keys(SHAPES).sort());
```

En el test `turnBoard: las 7 simetrías...`, cambiar las dos primeras líneas del cuerpo:

```js
  for (const l of LANGS) {
    const b = createBoard(l, 55, words[l]);
```

por las siguientes (y agregar una `}` más al cierre del `for` de idiomas, para cerrar el `for` de niveles):

```js
  for (const l of LANGS) {
    for (const level of [55, firstLevel(l, 'donut')]) {
    const b = createBoard(l, level, words[l]);
```

Después correr Prettier o reindentar a mano el cuerpo del `for` nuevo, para que ESLint y el ojo no se quejen.

Agregar al final del archivo:

```js
test('formas: cuadradas y simétricas ante las 8 simetrías del cuadrado (la cancha puede girar)', () => {
  for (const [name, rows] of Object.entries(SHAPES)) {
    const on = rows.join('');
    assert.ok(rows.every(r => r.length === rows.length) && /^[#.]+$/.test(on), name);
    for (let t = 1; t < 8; t++) {
      const to = turnCell(rows.length, t);
      for (let i = 0; i < on.length; i++) assert.equal(on[to(i)], on[i], `${name}: la simetría ${t} lleva ${i} a ${to(i)}`);
    }
  }
});

test('solve y pathFor saltean los huecos', () => {
  // C A ·
  // · S A      se arman CASA y SAC; los huecos (·) no tienen palabras
  // · · ·
  const letters = ['C', 'A', null, null, 'S', 'A', null, null, null];
  const { found, through } = solve(letters, tiny);
  assert.deepEqual([...found].sort(), ['CASA', 'SAC']);
  for (const i of [2, 3, 6, 7, 8]) assert.equal(through[i].size, 0, `hueco ${i}`);
  assert.deepEqual(pathFor('CASA', letters), [0, 1, 4, 5]);
  assert.equal(pathFor('CASAS', letters), null);
});
```

- [ ] **Paso 2: correr los tests y ver que fallan**

Correr: `cd /home/fede/Documents/projects/wordini-formas && node --test test/board.test.js`
Esperado: FAIL. `SHAPES` no existe en `board.js` (SyntaxError del import: "does not provide an export named 'SHAPES'").

- [ ] **Paso 3: implementar en `js/board.js`**

Reemplazar las dos líneas de `MIN_COMMON` y `LONG`:

```js
const MIN_COMMON = { 4: 25, 5: 50 }; // minimum common words per board
const LONG = { 4: 6, 5: 7 }; // minimum length of the "prize word"
```

por:

```js
const SHAPE_FROM = 40; // from this level on a board may be 6×6 or have a shape (pickShape)
const minCommon = cells => (cells === 16 ? 25 : 2 * cells); // minimum common words per board: 4×4 25, 5×5 50
const minLong = cells => (cells === 16 ? 6 : 7); // minimum length of the "prize word"
```

Debajo de `const flipsOf = ...`, agregar:

```js
// Boards with a shape: '#' a tile, '.' a hole. Each one looks the same after any of the 8 symmetries of the square,
// so the board can still turn (turnCell). `tilt` is the 5×5, drawn turned 45° (style.css).
export const SHAPES = {
  tilt: ['#####', '#####', '#####', '#####', '#####'],
  diamond: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  spikes: ['...#...', '.#####.', '.#####.', '#######', '.#####.', '.#####.', '...#...'],
  cross: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
  octagon: ['..##..', '.####.', '######', '######', '.####.', '..##..'],
  donut: ['######', '######', '##..##', '##..##', '######', '######'],
};
```

En `solve`, primera línea de `walk`:

```js
  const walk = (i, s) => {
    if (letters[i] === null) return; // a hole (SHAPES)
    s += letters[i];
```

En `pickFlipped`, el filtro de `options` saltea los huecos:

```js
    const options = letters.map((_, c) => c).filter(c => letters[c] && flipsOf(letters[c]).length && !taken.includes(c) && !flipped.some(f => f.cell === c));
```

Antes de `export function createBoard`, agregar:

```js
// From SHAPE_FROM on: half the boards 5×5, a quarter 6×6, a quarter with a shape. With its own generator: drawing
// from the letters' one would change every board from there on, the 5×5 ones too.
function pickShape(lang, level) {
  const square = size => ({ shape: 'square', rows: Array(size).fill('#'.repeat(size)) });
  if (level < SHAPE_FROM) return square(level < BIG_FROM ? 4 : 5);
  const rand = mulberry32(fnv1a(`${lang}:${level}:shape`));
  const x = rand();
  if (x < 0.5) return square(5);
  if (x < 0.75) return square(6);
  const names = Object.keys(SHAPES);
  const shape = names[Math.floor(rand() * names.length)];
  return { shape, rows: SHAPES[shape] };
}
```

En `createBoard`, reemplazar desde `const size = level < BIG_FROM ? 4 : 5;` hasta el `continue;` inclusive por:

```js
  const { shape, rows } = pickShape(lang, level);
  const size = rows.length;
  const mask = [...rows.join('')].map(c => c === '#');
  const cells = mask.filter(Boolean).length;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const letters = mask.map(on => (on ? weightedLetter(rand, d) : null)); // null: a hole
    const { found, through } = solve(letters, words);
    const common = [...found].filter(w => d.common.has(w)).sort();
    if (common.length < minCommon(cells) || !common.some(w => w.length >= minLong(cells))) continue;
```

En el objeto que devuelve, agregar `shape,` después de `size,` y cambiar `threshold`:

```js
    return {
      size,
      shape,
      letters,
      gold,
      hidden,
      flipped,
      locks: pickLocks(rand, level, through, [...gold.map(g => g.cell), ...hidden, ...flipped.map(f => f.cell)]),
      // Bigger boards ask for a bit less of what's there: halfway (in proportion) between the same share as a 5×5
      // and the same points
      threshold: Math.ceil(pct(level) * commonPoints * Math.min(1, Math.sqrt(25 / cells))),
      commonCount: common.length,
      missed: found => common.filter(w => !found.includes(w)),
    };
```

`turnBoard` no cambia: el `...board` copia `shape`, y `letters[to(i)] = c` también mueve los `null`.

- [ ] **Paso 4: correr los tests y ver que pasan**

Correr: `node --test`
Esperado: todos PASS, incluido `rendimiento: createBoard 5×5 tarda menos de 50 ms en promedio` (los niveles 40-60 ya traen 6×6 y formas). Si el de rendimiento falla, no se toca el umbral: avisar con el número que dio.

- [ ] **Paso 5: `tools/levels.mjs` muestra la forma**

En el `console.log`, reemplazar `${b.size}×${b.size}` por `${`${b.size}×${b.size} ${b.shape}`.padEnd(12)}`. Correr:

```bash
node tools/levels.mjs es 38 60
```

Esperado: hasta el 39, `5×5 square`; desde el 40, mezcla de `5×5 square`, `6×6 square` y formas, con `common` por encima del mínimo y tiempos chicos.

- [ ] **Paso 6: verificar contra la base que las cuadradas no cambiaron (descartable)**

```bash
S=/tmp/claude-1000/-home-fede-Documents-projects-wordini/9588e561-71d9-4c28-8e02-90367a9a518a/scratchpad
git show origin/feat/candado-y-contramano:js/board.js > $S/base-board.js
cat > $S/compare.mjs <<'EOF'
// Throwaway: square and tilt boards 1-200 must be the same as in the base branch.
import { readFileSync } from 'node:fs';
const W = '/home/fede/Documents/projects/wordini-formas';
const base = await import(new URL('./base-board.js', import.meta.url));
const head = await import(`${W}/js/board.js`);
const pick = b => JSON.stringify([b.letters, b.gold, b.hidden, b.flipped, b.locks, b.threshold, b.commonCount]);
let same = 0;
let other = 0;
for (const l of ['es', 'en', 'fr']) {
  const words = JSON.parse(readFileSync(`${W}/words/${l}.json`, 'utf8'));
  for (let level = 1; level <= 200; level++) {
    const a = base.createBoard(l, level, words);
    const b = head.createBoard(l, level, words);
    if (b.size !== a.size || !['square', 'tilt'].includes(b.shape)) other++;
    else if (pick(a) === pick(b)) same++;
    else throw new Error(`${l}:${level} (${b.shape}) cambió`);
  }
}
console.log({ same, other });
EOF
node $S/compare.mjs
```

Esperado: `{ same: ~480+, other: ~120 }`, sin error. Cualquier `cambió` es un bug: alguna llamada a `rand` se agregó o se movió en el camino de las cuadradas.

- [ ] **Paso 7: lint y commit**

```bash
npm ci --silent && npx eslint
git add js/board.js test/board.test.js tools/levels.mjs
git commit -m "feat: desde el nivel 40 un cuarto de las canchas es 6×6 y otro cuarto tiene forma (rombo, picos, cruz, octógono, dona), con umbral un poco menor en las grandes; las cuadradas no cambian"
```

---

### Tarea 2: huecos y rombo girado en pantalla, y línea de ayuda

**Archivos:**
- Modificar: `js/main.js` (`renderBoard`, `renderPath`, `tileAt`)
- Modificar: `style.css` (bloque `#board`, más dos reglas de `.tilt`)
- Modificar: `js/i18n.js` (`help7` en en/es/fr), `index.html` (un `<li>` en `#dlg-help`)
- Descartable (no se commitea): `$S/browser.mjs`

**Interfaces:**
- Consume: `board.shape`, `null` en `board.letters` (Tarea 1); `closed`, `createBoard`, `pathFor`, `turnBoard` de `board.js`.
- Produce: en el DOM, `#board` tiene un hijo por casilla en orden (`.tile` o `.hole`) y el SVG `#trail` último; `#board.tilt` en el rombo girado; cada `.tile` tiene su letra en un `<span>`.

- [ ] **Paso 1: escribir el recorrido en el navegador (descartable)**

```bash
S=/tmp/claude-1000/-home-fede-Documents-projects-wordini/9588e561-71d9-4c28-8e02-90367a9a518a/scratchpad
cat > $S/browser.mjs <<'EOF'
// Throwaway: on a 360 px wide phone, drags a word with a diagonal step on boards with a shape and checks what lights
// up and what counts. Usage: node browser.mjs 47 52:3 ...  ("52:3": saved as already turned with symmetry 3).
// Needs `python3 -m http.server 8123` running in the worktree.
import { readFileSync } from 'node:fs';
import { chromium } from '/tmp/claude-1000/-home-fede-Documents-projects-wordini/30057d8f-1871-4d2e-80a7-c5a878e57218/scratchpad/node_modules/playwright-core/index.mjs';
const W = '/home/fede/Documents/projects/wordini-formas';
const { closed, createBoard, pathFor, turnBoard } = await import(`${W}/js/board.js`);
const words = JSON.parse(readFileSync(`${W}/words/es.json`, 'utf8'));
const OUT = new URL('.', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell` });
let failed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  failed += !ok;
};
for (const arg of process.argv.slice(2)) {
  const [level, t] = arg.split(':').map(Number);
  const plain = createBoard('es', level, words);
  const b = t ? turnBoard(plain, t) : plain;
  const n = b.size;
  const diagonal = p => p.some((c, k) => k && ![1, n].includes(Math.abs(c - p[k - 1])));
  const [word, path] = plain.missed([]).sort((x, y) => y.length - x.length)
    .map(w => [w, pathFor(w, b.letters, [], closed(b, []))]).find(([, p]) => p && diagonal(p));
  const id = `${arg} ${b.shape} ${n}×${n} ${word}`;
  const game = { level, sig: plain.letters.join(''), found: [], goldLeft: plain.gold.map(g => g.need), passed: false, ms: 0, hints: 0, ...(t && { turn: t }) };
  const page = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  await page.addInitScript(g => {
    localStorage.setItem('wordini:help-seen', 'true');
    localStorage.setItem('wordini:lang', '"es"');
    localStorage.setItem('wordini:es', JSON.stringify(g));
  }, game);
  await page.goto('http://localhost:8123/');
  await page.waitForSelector('#board .tile');
  const info = await page.evaluate(() => {
    const kids = [...document.querySelectorAll('#board > :not(svg)')];
    return {
      holes: kids.map(e => e.classList.contains('hole')),
      heights: kids.filter(e => e.matches('.tile')).map(e => e.offsetHeight),
      scroll: document.documentElement.scrollWidth,
      centers: kids.map(e => {
        const r = e.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
      }),
    };
  });
  check(JSON.stringify(info.holes) === JSON.stringify(b.letters.map(c => c === null)), `${id}: huecos en su lugar`);
  check(Math.max(...info.heights) - Math.min(...info.heights) <= 1, `${id}: filas parejas`);
  check(info.scroll <= 360, `${id}: sin scroll horizontal (${info.scroll})`);
  await page.mouse.move(...info.centers[path[0]]);
  await page.mouse.down();
  for (const c of path.slice(1)) await page.mouse.move(...info.centers[c], { steps: 12 });
  const on = await page.$$eval('#board .tile.on', els => els.map(e => Number(e.dataset.i)));
  const sorted = p => JSON.stringify([...p].sort((x, y) => x - y));
  check(sorted(on) === sorted(path), `${id}: se prenden las casillas del trazo`);
  await page.screenshot({ path: `${OUT}${arg.replace(':', '-')}-${b.shape}.png` });
  await page.mouse.up();
  await page.waitForTimeout(300);
  check((await page.textContent('#found')).includes(word), `${id}: la palabra cuenta`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
EOF
```

Elegir los niveles: `node tools/levels.mjs es 40 200 | grep -E 'tilt|diamond|spikes|cross|octagon|donut|6×6'`. Tomar el primero de `tilt`, `spikes`, `diamond`, `donut` y `6×6 square`, más dos girados: `<nivel de tilt>:5` y `<nivel de donut>:3`.

- [ ] **Paso 2: correrlo y ver que falla**

```bash
cd /home/fede/Documents/projects/wordini-formas && (python3 -m http.server 8123 >/dev/null 2>&1 &) && sleep 1
node $S/browser.mjs <niveles elegidos>
```

Esperado: FAIL en "huecos en su lugar" de las formas con huecos (hoy un hueco se dibuja como `.tile` vacía), y probablemente en "se prenden las casillas del trazo".

- [ ] **Paso 3: `js/main.js`**

`renderBoard`, desde el comienzo hasta la línea de `board.flipped` inclusive:

```js
function renderBoard() {
  const el = $('#board');
  el.style.setProperty('--n', board.size);
  el.classList.toggle('tilt', board.shape === 'tilt');
  el.replaceChildren(
    ...shown(board).map((c, i) => {
      if (c === null) return Object.assign(document.createElement('div'), { className: 'hole' }); // keeps its place in the grid
      const tile = Object.assign(document.createElement('div'), { className: c === '?' ? 'tile mystery' : 'tile' });
      tile.dataset.i = i;
      // The letter in a span, so it can be flipped, or kept upright on the tilted board, without touching the tile
      // (fx.turn animates the tile, and the hint arrow goes in it)
      tile.append(Object.assign(document.createElement('span'), { textContent: c }));
      return tile;
    }),
    trail,
  );
  for (const f of board.flipped) el.children[f.cell].firstChild.className = f.flip;
```

(El resto de `renderBoard` queda igual. Las letras al revés nunca son `?`, así que el span ya tiene la letra real.)

`renderPath`, primera línea:

```js
  const tiles = [...$('#board').children]; // by cell number, holes included (the trail comes last)
```

`tileAt`, el comentario y el `return`:

```js
// Only each tile's central circle counts, so a diagonal doesn't grab a neighbor by mistake. Its radius comes from
// offsetWidth, the untransformed size: on the tilted board a tile's rect is √2 wider.
function tileAt(x, y) {
  const tile = document.elementFromPoint(x, y)?.closest('#board .tile');
  if (!tile) return null;
  const r = tile.getBoundingClientRect();
  const dx = x - (r.left + r.width / 2);
  const dy = y - (r.top + r.height / 2);
  return dx * dx + dy * dy <= (0.36 * tile.offsetWidth) ** 2 ? Number(tile.dataset.i) : null;
}
```

- [ ] **Paso 4: `style.css`**

En `#board`, reemplazar `grid-template-columns: repeat(var(--n), 1fr);` y `gap: .5rem;` por:

```css
  grid-template-columns: repeat(var(--n), 1fr);
  grid-template-rows: repeat(var(--n), 1fr);
  gap: min(.5rem, 2.5rem / var(--n)); /* .5rem up to 5×5, a bit tighter 6 and 7 wide */
```

Justo después del bloque `#board { ... }`:

```css
/* The diamond board (board.js SHAPES.tilt) is the 5×5 turned 45°, with letters and badges turned back. `rotate`, not
   `transform`: fx.turn animates the transform of the board and its tiles, and .tile.on sets it. √2 narrower and with
   room above and below, so its corners take the place of the usual square. */
#board.tilt { rotate: 45deg; width: min(70.7%, 17rem); margin-block: min(14.6%, 3.5rem); }
.tilt .tile > span, .tilt .badge { rotate: -45deg; }
```

- [ ] **Paso 5: línea de ayuda**

En `js/i18n.js`, después de cada `help6`:
- en: `help7: 'From level 40 on, the board can be bigger or come in a shape.',`
- es: `help7: 'Desde el nivel 40 el tablero puede ser más grande o tener forma.',` (la UI en español dice "tablero": `turned: '¡El tablero giró!'`)
- fr: `help7: 'À partir du niveau 40, la grille peut être plus grande ou avoir une forme.',`

En `index.html`, en `#dlg-help`, después de `<li data-t="help6"></li>`:

```html
      <li data-t="help7"></li>
```

- [ ] **Paso 6: correr todo**

```bash
node --test && npx eslint && node $S/browser.mjs <niveles elegidos>
```

Esperado: tests PASS, ESLint sin salida, y todas las líneas del recorrido `ok`. Mirar las capturas `$S/*.png`: el rombo derecho y entero en pantalla, letras derechas, huecos vacíos, la línea del trazo sobre las casillas prendidas. Mandárselas al usuario.

- [ ] **Paso 7: commit**

```bash
git add js/main.js style.css js/i18n.js index.html
git commit -m "feat: las canchas con forma se dibujan con huecos y el rombo girado 45° con las letras derechas; línea nueva en la ayuda"
```

Matar el server: `pkill -f 'http.server 8123'`.
