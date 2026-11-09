# Wordini con grilla: plan de implementación

> **Para agentes que lo ejecuten:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** reemplazar la cerradura criptex por un juego de grilla. Se arman palabras arrastrando por letras vecinas, cada palabra suma puntos y cada nivel tiene un umbral. Un cronómetro mide cuánto se tarda en pasar cada nivel. Los niveles son infinitos y el nivel N es igual para todos. Funciona en es, en y fr.

**Arquitectura:**
- **Datos:** un script de Python genera `words/{lang}.json` con dos listas. `valid` son todas las formas que genera el diccionario Hunspell de LibreOffice; `common` son las 20.000 más frecuentes según `wordfreq`.
- **`js/board.js`:** genera cada cancha de forma determinista (semilla = idioma + nivel). La resuelve con una búsqueda en profundidad que poda por prefijos, buscados por bisección en `valid`, y calcula el umbral y las casillas doradas.
- **`js/game.js`:** aplica las reglas de la partida, sin DOM.
- **`js/main.js`:** maneja la interfaz.
- **Guardado:** el estado vive en `localStorage`.

**Stack:**
- Sitio: HTML, CSS y JS (ES2022, módulos nativos).
- Tests: `node --test` (Node ≥ 22; probado con v24.13.0).
- Datos: Python 3.12 + `wordfreq` 3.1.1 + `spylls` 0.1.7, solo para generarlos.
- Confetti: `canvas-confetti` 1.9.4 desde jsDelivr.
- Fuente: Bungee, de Google Fonts.

**Spec:** `docs/superpowers/specs/2026-11-09-wordini-grilla-design.md`. Leerla antes de empezar; este plan la implementa.

**Estado del código:** todo el código de este plan ya se ejecutó en un prototipo:
- los 29 tests pasan en unos 4 s;
- se recorrió en Chromium headless a 390 px y 320 px: ayuda, trazado, palabra válida, repetida e inválida, teclado, nivel superado, faltantes, siguiente nivel, doradas y error de carga, sin errores de consola y sin scroll horizontal en 320 px;
- el cronómetro se probó en el mismo navegador: no arranca sin tocar nada, se pausa con la pestaña oculta, retoma al volver, sigue después de recargar y queda congelado al pasar el nivel.

Copiarlo tal cual. Si algo no anda, es una diferencia de entorno, no un error del plan.

**Punto de partida:** la rama `feat/wordini-grilla`, creada desde `feat/wordini-v1` (el criptex), con la spec y este plan ya commiteados. Hasta la Tarea 5 la interfaz vieja queda rota (`js/main.js` importa `js/puzzle.js`, que se borra en la Tarea 1). Los tests pasan en cada tarea.

## Restricciones globales

- **Dependencias:**
  - sin bundler, sin build y sin dependencias npm. `package.json` no cambia;
  - `wordfreq==3.1.1` y `spylls==0.1.7` viven solo en `tools/.venv/`, que está en `.gitignore` junto con `tools/sources/`.
- **Cancha:**
  - 4×4 en los niveles 1 a 10 y 5×5 desde el 11;
  - vecinas en 8 direcciones, sin repetir casilla;
  - palabras de 3 a 12 letras.
- **Puntos:** 3 letras = 1, 4 = 2, 5 = 4, 6 = 7, 7 = 11, 8 o más = 16.
- **Idiomas:** `es` (alfabeto `ABCDEFGHIJKLMNÑOPQRSTUVWXYZ`), `en` y `fr` (`ABCDEFGHIJKLMNOPQRSTUVWXYZ`). Las tildes se quitan; la Ñ se conserva en `es`.
- **Listas:** `words/{lang}.json` = `{ alphabet, valid, common }`. Las dos listas están ordenadas por punto de código, que coincide con `<` de JS. El solver depende de ese orden.
- **Azar:** `js/board.js` nunca usa `Math.random`. Todo el azar sale de `` mulberry32(fnv1a(`${lang}:${level}`)) `` y se consume en un orden fijo.
- **Perillas:** los números de dificultad viven en un solo bloque al principio de `js/board.js`.
- **Paleta:** `--bg #0b0b14`, `--cyan #00e5ff`, `--magenta #ff2bd6`, `--green #39ff88`, `--gold #ffd23f`, `--dim #3a3a55`. Fuente Bungee.
- **Ancho:** mínimo 320 px y máximo 480 px de contenido.
- **Textos de la interfaz:**
  - solo a través de `js/i18n.js`;
  - el español usa "tú", como el criptex.
- **Datos guardados:** lo que vuelve de `localStorage` nunca se inserta con `innerHTML`.
- **`prefers-reduced-motion: reduce`:** sin animaciones ni confetti.
- **Commits:** en español, con prefijos `feat:`, `test:`, `docs:` o `chore:`.

## Foco de revisión

Estos casos no los cubre ningún test automático y son los que más probablemente le fallen a un jugador. Cada uno tiene una verificación en el Paso 7 de la Tarea 5.

1. **Trazar diagonales con el dedo en un celular real.** No se agarra una vecina por error y la página no se desplaza mientras se traza.
2. **Cambiar de idioma mientras cargan las palabras o justo después de pasar un nivel.**
   - No se guarda progreso con la clave de otro idioma.
   - El modal de nivel superado no se abre sobre el otro idioma.
3. **El archivo de palabras no carga** (404 o sin conexión). Se ve el mensaje de error y la página no se rompe.
4. **Teclado:**
   - É escribe E y, en `es`, Ñ escribe Ñ;
   - Backspace y Escape borran;
   - Enter sobre un botón enfocado no envía una palabra;
   - Ctrl+R y Ctrl+L siguen funcionando.
5. **Recargar o cambiar de pestaña.**
   - Recargar a mitad de un nivel o después de pasarlo: se sigue en ese nivel, con el progreso y el tiempo intactos. Si ya se pasó, **Siguiente nivel** está visible.
   - Con la pestaña oculta, el cronómetro no avanza.

## Estructura de archivos

```
tools/build_words.py      # T1: reescrito, expansión Hunspell + comunes
words/{es,en,fr}.json     # T1: regenerados, { alphabet, valid, common }
test/words.test.js        # T1: NUEVO, formato y orden de las listas
CREDITS.md                # T1: atribuciones nuevas
js/puzzle.js, test/puzzle.test.js   # T1: SE BORRAN
js/board.js               # T2: NUEVO, PRNG, solver, createBoard, pathFor, points
test/board.test.js        # T2: NUEVO
tools/levels.mjs          # T2: NUEVO, estadísticas para calibrar
js/game.js                # T3: NUEVO, reglas sin DOM
test/game.test.js         # T3: NUEVO
js/state.js, js/share.js, js/i18n.js           # T4: adaptados
test/state.test.js, test/share.test.js, test/i18n.test.js   # T4
js/fx.js, js/main.js, index.html, style.css    # T5: interfaz
README.md                 # T1 (sección de datos) y T5 (el resto)
```

---

### Task 1 (Tarea 1): Listas de palabras con todas las formas

**Archivos:**
- Reescribir: `tools/build_words.py`, `CREDITS.md`
- Crear: `test/words.test.js`
- Regenerar: `words/{es,en,fr}.json`
- Borrar: `js/puzzle.js`, `test/puzzle.test.js`
- Modificar: `README.md` (sección "Regenerar las listas de palabras")

**Interfaces:**
- Produce `words/{lang}.json` = `{ "alphabet": string, "valid": string[], "common": string[] }`:
  - palabras de 3 a 12 letras en MAYÚSCULAS, sin tildes, con la `Ñ` conservada en `es`;
  - las dos listas ordenadas por punto de código;
  - `common` ⊆ `valid`, con unas 20.000 palabras.

  Las Tareas 2 a 5 lo consumen.

- [ ] **Paso 1: escribir el test de formato (falla con las listas viejas)**

`test/words.test.js`:

```js
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
```

- [ ] **Paso 2: correrlo y ver que falla**

Run: `node --test test/words.test.js`
Esperado: FAIL. Las listas viejas no tienen `common` (`TypeError` al recorrerla).

- [ ] **Paso 3: sumar `spylls` al entorno virtual**

```bash
test -d tools/.venv || python3 -m venv tools/.venv
tools/.venv/bin/pip install -q wordfreq==3.1.1 spylls==0.1.7
tools/.venv/bin/python -c "from spylls.hunspell import Dictionary; print('ok')"
```

Esperado: `ok`.

- [ ] **Paso 4: reescribir `tools/build_words.py`**

```python
#!/usr/bin/env python3
"""Genera words/{lang}.json: todas las formas de Hunspell (LibreOffice) + las comunes según wordfreq.

Uso: tools/.venv/bin/python tools/build_words.py es en fr
"""
import json
import sys
import unicodedata
import urllib.request
from pathlib import Path

import wordfreq
from spylls.hunspell import Dictionary
from spylls.hunspell.algo.capitalization import Type

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / 'tools' / 'sources'
LIBRE = 'https://raw.githubusercontent.com/LibreOffice/dictionaries/master/'
# idioma: (alfabeto, diccionario sin extensión, tienen que entrar, tienen que quedar afuera)
LANGS = {
    'es': ('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', 'es/es_ES', ['CASAS', 'COMI', 'DAMELO', 'ÑANDU'], ['NUGENT', 'KWH', 'PARTY']),
    'en': ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'en/en_US', ['CATS', 'RUNNING', 'QUIZZES'], ['NUGENT', 'KWH', 'GPS']),
    'fr': ('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'fr_FR/dictionaries/fr', ['CHEVAUX', 'MANGEAIENT', 'ETE'], ['NUGENT', 'KWH', 'PARTY']),
}
MIN_LEN, MAX_LEN = 3, 12
N_COMMON = 20_000
TOP_FREQ = 300_000  # palabras de wordfreq que se recorren para ordenar las comunes


def normalize(word, lang):
    word = word.lower()
    if lang == 'es':
        word = word.replace('ñ', '\0')
    word = ''.join(c for c in unicodedata.normalize('NFD', word) if not unicodedata.combining(c))
    return word.replace('\0', 'ñ').upper()


def dictionary(path):
    base = SOURCES / Path(path).name
    for ext in ('.dic', '.aff'):
        local = base.with_suffix(ext)
        if not local.exists():
            SOURCES.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(LIBRE + path + ext, local)
    return Dictionary.from_files(str(base))


def apply_sfx(word, s):
    if s.cond_regexp.search(word) and word.endswith(s.strip):
        return word[:len(word) - len(s.strip)] + s.add


def apply_pfx(word, p):
    if p.cond_regexp.search(word) and word.startswith(p.strip):
        return p.add + word[len(p.strip):]


def expand(d):
    """Todas las formas del diccionario: raíz, +sufijo, +sufijo encadenado, +prefijo y prefijo×sufijo."""
    aff = d.aff
    skip = {f for f in (aff.FORBIDDENWORD, aff.ONLYINCOMPOUND) if f}
    needs_affix = lambda flags: aff.NEEDAFFIX and aff.NEEDAFFIX in flags
    for w in d.dic.words:
        if w.captype != Type.NO or w.flags & skip:  # con mayúscula = nombre propio
            continue
        if not needs_affix(w.flags):
            yield w.stem
        suffixed = []
        for flag in w.flags:
            for s in aff.SFX.get(flag, []):
                form = apply_sfx(w.stem, s)
                if form is None:
                    continue
                if not needs_affix(s.flags):
                    yield form
                suffixed.append((form, s))
                for flag2 in s.flags:  # sufijo encadenado: enclíticos del español (DAME -> DAMELO)
                    for s2 in aff.SFX.get(flag2, []):
                        if form2 := apply_sfx(form, s2):
                            yield form2
        for flag in w.flags:
            for p in aff.PFX.get(flag, []):
                if form := apply_pfx(w.stem, p):
                    yield form
                if p.crossproduct:
                    for form, s in suffixed:
                        if s.crossproduct and (form2 := apply_pfx(form, p)):
                            yield form2


def build(lang):
    alphabet, dic, must_in, must_out = LANGS[lang]
    ok = lambda w: MIN_LEN <= len(w) <= MAX_LEN and all(c in alphabet for c in w)

    blocklist = (ROOT / 'tools' / 'blocklist' / f'{lang}.txt').read_text(encoding='utf-8')
    blocked = {normalize(l.strip(), lang) for l in blocklist.splitlines() if l.strip()}

    valid = {n for form in expand(dictionary(dic)) if ok(n := normalize(form, lang)) and n not in blocked}

    common = {}  # dict: conserva el orden de frecuencia
    for w in wordfreq.top_n_list(lang, TOP_FREQ):
        n = normalize(w, lang)
        if n in valid:
            common.setdefault(n)
            if len(common) == N_COMMON:
                break

    data = {'alphabet': alphabet, 'valid': sorted(valid), 'common': sorted(common)}
    blob = json.dumps(data, ensure_ascii=False, separators=(',', ':'))

    assert all(ok(w) for w in valid), 'palabra con largo o letras inválidas'
    assert set(common) <= valid, 'common no está incluida en valid'
    assert not valid & blocked, 'palabra bloqueada'
    assert len(common) >= 10_000, f'muy pocas comunes: {len(common)}'
    assert len(blob.encode()) < 8_000_000, f'JSON demasiado grande: {len(blob.encode())} bytes'
    assert all(w in valid for w in must_in), [w for w in must_in if w not in valid]
    assert not any(w in valid for w in must_out), [w for w in must_out if w in valid]

    out = ROOT / 'words' / f'{lang}.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(blob, encoding='utf-8')
    print(f'{lang}: {len(valid)} válidas, {len(common)} comunes -> {out.relative_to(ROOT)}')


if __name__ == '__main__':
    langs = sys.argv[1:]
    assert langs and all(l in LANGS for l in langs), f'uso: build_words.py {" ".join(LANGS)}'
    for lang in langs:
        build(lang)
```

- [ ] **Paso 5: regenerar las listas**

Se borran los `.dic` en caché para que el `.dic` y el `.aff` bajen juntos y sean de la misma versión:

```bash
rm -f tools/sources/*.dic tools/sources/*.aff
tools/.venv/bin/python tools/build_words.py es en fr
ls -la words/
```

Esperado (los números pueden variar un poco si LibreOffice actualizó sus diccionarios):

```
es: 484641 válidas, 20000 comunes -> words/es.json
en: 72725 válidas, 20000 comunes -> words/en.json
fr: 329737 válidas, 20000 comunes -> words/fr.json
```

Pesos aproximados: `es.json` 6,3 MB, `fr.json` 4,3 MB y `en.json` 1,0 MB. Si un `assert` del final del script falla, el mensaje dice cuál y por qué.

- [ ] **Paso 6: borrar el motor del criptex**

Leían `answers`, que ya no existe:

```bash
git rm -q js/puzzle.js test/puzzle.test.js
```

- [ ] **Paso 7: correr todos los tests**

Run: `npm test`
Esperado: PASS. Pasan los 2 tests de `words.test.js` y los de `i18n`, `share` y `state`, que todavía son los del criptex y no dependen de las listas.

- [ ] **Paso 8: actualizar `CREDITS.md` y el README**

`CREDITS.md` completo:

```markdown
# Créditos

- **Diccionarios:** diccionarios Hunspell de [LibreOffice/dictionaries](https://github.com/LibreOffice/dictionaries): `es/es_ES`, `en/en_US` y `fr_FR/fr`. La lista `valid` de `words/*.json` se genera expandiendo esos diccionarios y se distribuye bajo sus licencias, que están en ese repositorio.
- **Frecuencia de palabras:** [wordfreq](https://github.com/rspeer/wordfreq) de Robyn Speer. Datos bajo CC BY-SA 4.0. La lista `common` de `words/*.json` deriva de esos datos y se distribuye bajo la misma licencia, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Expansión de diccionarios:** [spylls](https://github.com/zverok/spylls), MPL 2.0. Se usa solo en el script de datos; no forma parte del sitio.
- **Lista de bloqueo:** [List of Dirty, Naughty, Obscene and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), CC BY 4.0.
- **Confetti:** [canvas-confetti](https://github.com/catdad/canvas-confetti), licencia ISC.
- **Fuente:** [Bungee](https://fonts.google.com/specimen/Bungee) de David Jonathan Ross, SIL Open Font License.
```

En `README.md`, reemplazar la sección "Regenerar las listas de palabras" por:

````markdown
## Regenerar las listas de palabras

```bash
python3 -m venv tools/.venv && tools/.venv/bin/pip install wordfreq==3.1.1 spylls==0.1.7
tools/.venv/bin/python tools/build_words.py es en fr
```

Cambiar las listas cambia las canchas a partir de ese momento.
````

- [ ] **Paso 9: commit**

```bash
git add tools/build_words.py words/ test/words.test.js CREDITS.md README.md
git commit -m "feat: listas con todas las formas de Hunspell y palabras comunes"
```

---

### Task 2 (Tarea 2): Motor de canchas (`js/board.js`)

**Archivos:**
- Crear: `js/board.js`, `test/board.test.js`, `tools/levels.mjs`

**Interfaces:**
- Consume `words/{lang}.json` (Tarea 1).
- Produce, en `js/board.js`:
  - `createBoard(lang, level, words)` → `{ size, letters: string[], gold: {cell, need}[], threshold, commonCount, missed(found: string[]) → string[] }`. `missed` devuelve las comunes no encontradas en orden alfabético;
  - `solve(letters, words)` → `{ found: Set<string>, through: Set<string>[] }`;
  - `pathFor(word, letters, prefer = [])` → `number[] | null`;
  - `neighbors(size)` → `number[][]`;
  - `points(word)` → `number`;
  - `isValid(words, word)` → `boolean`.

  Las Tareas 3 y 5 los usan.

- [ ] **Paso 1: escribir los tests**

`test/board.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoard, isValid, neighbors, pathFor, points, solve } from '../js/board.js';

const LANGS = ['es', 'en', 'fr'];
const words = Object.fromEntries(
  LANGS.map(l => [l, JSON.parse(readFileSync(new URL(`../words/${l}.json`, import.meta.url), 'utf8'))]),
);
const tiny = { alphabet: 'ACMORS', valid: ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC'], common: ['AMOR', 'CASA', 'ROMA'] };
const adjacent = (a, b, size) => a !== b && Math.abs((a % size) - (b % size)) <= 1 && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1;

// Otra implementación, sin poda ni bisección: ¿se puede armar `word` en la grilla?
function onBoard(letters, word) {
  const size = Math.sqrt(letters.length);
  const from = (i, k, used) => {
    if (letters[i] !== word[k] || used.includes(i)) return false;
    if (k === word.length - 1) return true;
    return letters.some((_, j) => adjacent(i, j, size) && from(j, k + 1, [...used, i]));
  };
  return letters.some((_, i) => from(i, 0, []));
}

test('puntos por largo', () => {
  assert.deepEqual(['SOL', 'CASA', 'PERRO', 'CAMION', 'ESCALON', 'COLEGIOS', 'PERIODICAS'].map(points), [1, 2, 4, 7, 11, 16, 16]);
});

test('isValid busca por bisección en valid', () => {
  assert.ok(isValid(tiny, 'CASA'));
  assert.ok(!isValid(tiny, 'CAS'));
  assert.ok(!isValid(tiny, 'ZZZ'));
});

test('vecinas: esquina, borde y centro en 4×4', () => {
  const n = neighbors(4);
  assert.deepEqual(n[0], [1, 4, 5]);
  assert.deepEqual(n[1], [0, 2, 4, 5, 6]);
  assert.deepEqual(n[5], [0, 1, 2, 4, 6, 8, 9, 10]);
});

test('solve en una grilla armada a mano', () => {
  // C A S A
  // M O R S
  // . . . .   (Z no está en el alfabeto chico: nunca forma nada)
  const letters = [...'CASAMORSZZZZZZZZ'];
  const { found, through } = solve(letters, tiny);
  assert.deepEqual([...found].sort(), ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC']);
  assert.deepEqual([...through[0]].sort(), ['CASA']); // la C solo sirve para CASA entre las comunes
  assert.deepEqual([...through[5]].sort(), ['AMOR', 'ROMA']); // la O
  assert.equal(through[8].size, 0);
});

test('mismo idioma y nivel dan la misma cancha; otro nivel da otra', () => {
  const a = createBoard('es', 7, words.es);
  const b = createBoard('es', 7, words.es);
  assert.deepEqual([a.letters, a.gold, a.threshold], [b.letters, b.gold, b.threshold]);
  assert.notDeepEqual(createBoard('es', 8, words.es).letters, a.letters);
});

test('niveles 1-200: tamaño, mínimos, umbral y doradas', () => {
  for (const l of LANGS) {
    for (let level = 1; level <= 200; level++) {
      const b = createBoard(l, level, words[l]);
      const id = `${l}:${level}`;
      const size = level <= 10 ? 4 : 5;
      assert.equal(b.size, size, id);
      assert.equal(b.letters.length, size * size, id);
      const common = b.missed([]);
      assert.equal(common.length, b.commonCount, id);
      assert.ok(common.length >= (size === 4 ? 25 : 50), id);
      assert.ok(common.some(w => w.length >= (size === 4 ? 6 : 7)), id);
      const total = common.reduce((n, w) => n + points(w), 0);
      assert.ok(b.threshold > 0 && b.threshold <= total, id);
      const maxGold = level < 4 ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : 3;
      assert.ok(b.gold.length <= maxGold, id);
      assert.equal(new Set(b.gold.map(g => g.cell)).size, b.gold.length, `${id}: doradas repetidas`);
      if (b.gold.length) {
        const { through } = solve(b.letters, words[l]);
        for (const g of b.gold) {
          assert.ok(g.need >= 1 && g.need <= 3, id);
          assert.ok(through[g.cell].size >= 3 * g.need, `${id}: dorada ${g.cell} sin margen`);
        }
      }
    }
  }
});

test('las comunes del solver coinciden con una búsqueda independiente', () => {
  for (const l of LANGS) {
    for (const level of [1, 6, 15, 42]) {
      const b = createBoard(l, level, words[l]);
      const expected = words[l].common.filter(w => onBoard(b.letters, w));
      assert.deepEqual(b.missed([]), expected, `${l}:${level}`);
    }
  }
});

test('pathFor: camino válido o null si no se puede armar', () => {
  const b = createBoard('es', 3, words.es);
  for (const w of b.missed([]).slice(0, 30)) {
    const p = pathFor(w, b.letters);
    assert.equal(p.map(i => b.letters[i]).join(''), w);
    assert.equal(new Set(p).size, p.length);
    for (let k = 1; k < p.length; k++) assert.ok(adjacent(p[k - 1], p[k], b.size), w);
  }
  assert.equal(pathFor('QQQQ', b.letters), null);
  assert.equal(pathFor('', b.letters), null);
});

test('pathFor prefiere el camino que pasa por las casillas pedidas', () => {
  // A S A
  // Z A Z      "ASA" se arma terminando en la A de la esquina (2) o en la del centro (4)
  // Z Z Z
  const letters = [...'ASAZAZZZZ'];
  assert.ok(pathFor('ASA', letters, [4]).includes(4));
  assert.ok(pathFor('ASA', letters, [2]).includes(2));
  assert.equal(pathFor('ASAS', letters), null); // hay una sola S
});

test('rendimiento: createBoard 5×5 tarda menos de 50 ms en promedio', () => {
  for (const l of LANGS) {
    const t0 = performance.now();
    for (let level = 11; level <= 60; level++) createBoard(l, level, words[l]);
    const avg = (performance.now() - t0) / 50;
    assert.ok(avg < 50, `${l}: ${avg.toFixed(1)} ms promedio`);
  }
});
```

- [ ] **Paso 2: correrlos y ver que fallan**

Run: `node --test test/board.test.js`
Esperado: FAIL con `Cannot find module '.../js/board.js'`.

- [ ] **Paso 3: escribir `js/board.js`**

```js
// Canchas deterministas: el mismo (idioma, nivel) da la misma cancha en cualquier navegador. Spec §4.

// Perillas de dificultad (spec §4.6). Se calibran con `node tools/levels.mjs <lang>`.
const BIG_FROM = 11; // desde este nivel la grilla es 5×5
const MIN_COMMON = { 4: 25, 5: 50 }; // palabras comunes mínimas por cancha
const LONG = { 4: 6, 5: 7 }; // largo mínimo de la "palabra premio"
const GOLD_FROM = 4;
const MAX_TRIES = 500;
const POINTS = [0, 0, 0, 1, 2, 4, 7, 11]; // por largo; 8 o más = 16

const pct = level => (level < BIG_FROM ? 0.2 + 0.025 * (level - 1) : Math.min(0.45, 0.25 + 0.01 * (level - BIG_FROM)));
const maxGold = level => (level < GOLD_FROM ? 0 : level <= 10 ? 1 : level <= 20 ? 2 : 3);

export const points = word => POINTS[word.length] ?? 16;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Primera posición de `list` (ordenada) con un valor >= s.
function lowerBound(list, s) {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export const isValid = (words, w) => words.valid[lowerBound(words.valid, w)] === w;
const isPrefix = (words, p) => words.valid[lowerBound(words.valid, p)]?.startsWith(p) ?? false;

// Vecinas de cada casilla (8 direcciones) en una grilla size×size numerada por filas.
export function neighbors(size) {
  return Array.from({ length: size * size }, (_, i) => {
    const r = Math.floor(i / size);
    const c = i % size;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < size && cc >= 0 && cc < size) out.push(rr * size + cc);
      }
    }
    return out;
  });
}

// `common` como Set y pesos de letras, una vez por lista.
const prepared = new WeakMap();
function prepare(words) {
  if (prepared.has(words)) return prepared.get(words);
  const counts = {};
  for (const w of words.common) for (const c of w) counts[c] = (counts[c] ?? 0) + 1;
  const letters = [...words.alphabet].filter(c => counts[c]);
  let total = 0;
  const cumulative = letters.map(c => (total += counts[c]));
  const d = { common: new Set(words.common), letters, cumulative, total };
  prepared.set(words, d);
  return d;
}

function weightedLetter(rand, d) {
  const x = rand() * d.total;
  return d.letters[d.cumulative.findIndex(c => x < c)];
}

// Todas las palabras de `valid` que se pueden armar, y por casilla las comunes que pueden pasar por ella.
export function solve(letters, words) {
  const d = prepare(words);
  const adj = neighbors(Math.sqrt(letters.length));
  const found = new Set();
  const through = letters.map(() => new Set());
  const path = [];
  const walk = (i, s) => {
    s += letters[i];
    if (!isPrefix(words, s)) return;
    path.push(i);
    if (s.length >= 3 && isValid(words, s)) {
      found.add(s);
      if (d.common.has(s)) for (const c of path) through[c].add(s);
    }
    for (const j of adj[i]) if (!path.includes(j)) walk(j, s);
    path.pop();
  };
  letters.forEach((_, i) => walk(i, ''));
  return { found, through };
}

// Camino para `word` que pase por la mayor cantidad posible de casillas de `prefer`; null si no se puede armar.
export function pathFor(word, letters, prefer = []) {
  const adj = neighbors(Math.sqrt(letters.length));
  let best = null;
  let bestScore = -1;
  const path = [];
  const walk = i => {
    if (letters[i] !== word[path.length] || path.includes(i)) return;
    path.push(i);
    if (path.length === word.length) {
      const score = path.filter(c => prefer.includes(c)).length;
      if (score > bestScore) [best, bestScore] = [[...path], score];
    } else {
      for (const j of adj[i]) walk(j);
    }
    path.pop();
  };
  if (word) letters.forEach((_, i) => walk(i));
  return best;
}

// Doradas: casillas por las que pasan al menos 3×need comunes. Si no alcanzan, baja need o pone menos.
function pickGold(rand, level, through) {
  const n = maxGold(level) && rand() < 0.5 ? 1 + Math.floor(rand() * maxGold(level)) : 0;
  const gold = [];
  for (let g = 0; g < n; g++) {
    let need = 1 + Math.floor(rand() * 3);
    const free = through.map((_, c) => c).filter(c => !gold.some(x => x.cell === c));
    let options;
    while (need > 0 && !(options = free.filter(c => through[c].size >= 3 * need)).length) need--;
    if (need) gold.push({ cell: options[Math.floor(rand() * options.length)], need });
  }
  return gold;
}

export function createBoard(lang, level, words) {
  const rand = mulberry32(fnv1a(`${lang}:${level}`));
  const d = prepare(words);
  const size = level < BIG_FROM ? 4 : 5;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const letters = Array.from({ length: size * size }, () => weightedLetter(rand, d));
    const { found, through } = solve(letters, words);
    const common = [...found].filter(w => d.common.has(w)).sort();
    if (common.length < MIN_COMMON[size] || !common.some(w => w.length >= LONG[size])) continue;
    const commonPoints = common.reduce((n, w) => n + points(w), 0);
    return {
      size,
      letters,
      gold: pickGold(rand, level, through),
      threshold: Math.ceil(pct(level) * commonPoints),
      commonCount: common.length,
      missed: found => common.filter(w => !found.includes(w)),
    };
  }
  throw new Error(`no board for ${lang}:${level}`);
}
```

- [ ] **Paso 4: correr los tests**

Run: `node --test test/board.test.js`
Esperado: PASS, 10 tests, en unos 4 s. "niveles 1-200" es el más lento, con unos 3 s.

- [ ] **Paso 5: escribir `tools/levels.mjs` y mirar los primeros niveles**

`tools/levels.mjs`:

```js
// Estadísticas de niveles para calibrar las perillas de js/board.js. Uso: node tools/levels.mjs es [desde] [hasta]
import { readFileSync } from 'node:fs';
import { createBoard, points } from '../js/board.js';

const [lang = 'es', from = '1', to = '50'] = process.argv.slice(2);
const words = JSON.parse(readFileSync(new URL(`../words/${lang}.json`, import.meta.url), 'utf8'));
for (let level = +from; level <= +to; level++) {
  const t0 = performance.now();
  const b = createBoard(lang, level, words);
  const ms = performance.now() - t0;
  const common = b.missed([]);
  const total = common.reduce((n, w) => n + points(w), 0);
  const longest = common.reduce((a, w) => (w.length > a.length ? w : a), '');
  const gold = b.gold.map(g => `${b.letters[g.cell]}×${g.need}`).join(' ') || '-';
  console.log(`${String(level).padStart(3)}  ${b.size}×${b.size}  comunes ${String(b.commonCount).padStart(3)}  umbral ${String(b.threshold).padStart(3)}/${String(total).padEnd(4)} doradas ${gold.padEnd(12)} ${longest.padEnd(12)} ${ms.toFixed(0)}ms`);
}
```

Run: `node tools/levels.mjs es 1 12`
Esperado, una línea por nivel con este formato (los valores dependen de las listas):

```
  1  4×4  comunes  83  umbral  41/205  doradas -            COLEGIO      14ms
  ...
 11  5×5  comunes 126  umbral 104/413  doradas -            PERIODICA    6ms
```

- [ ] **Paso 6: commit**

```bash
git add js/board.js test/board.test.js tools/levels.mjs
git commit -m "feat: generador de canchas determinista con solver, umbral y casillas doradas"
```

---

### Task 3 (Tarea 3): Reglas de la partida (`js/game.js`)

**Archivos:**
- Crear: `js/game.js`, `test/game.test.js`

**Interfaces:**
- Consume `isValid(words, word)` y `points(word)` de `js/board.js` (Tarea 2).
- Produce, en `js/game.js`:
  - `newProgress(board)` → `{ found: [], goldLeft: number[], passed: false, ms: 0 }`. `ms` es el tiempo de juego acumulado, que maneja la interfaz;
  - `step(path, cell, size)` → `number[]`. Devuelve **el mismo array** si no hay cambios, así la interfaz detecta los cambios con `===`;
  - `play(progress, board, words, path)` → `'short' | 'invalid' | 'dup' | 'ok' | 'cleared'`. Modifica `progress` cuando la palabra es nueva;
  - `score(found)` → `number`;
  - `wordOf(board, path)` → `string`.

  La Tarea 5 los usa.

- [ ] **Paso 1: escribir los tests**

`test/game.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, play, score, step, wordOf } from '../js/game.js';

// C A S A
// M O R S
// Z Z Z Z
// Z Z Z Z
const words = { valid: ['AMOR', 'CASA', 'CASAS', 'MAS', 'ROMA', 'SAC'] };
const board = (gold = [], threshold = 100) => ({ letters: [...'CASAMORSZZZZZZZZ'], gold, threshold });
const CASA = [0, 1, 2, 3];
const ROMA = [6, 5, 4, 1];

test('step: suma vecinas, ignora lejanas y repetidas, vuelve atrás', () => {
  assert.deepEqual(step([], 5, 4), [5]);
  assert.deepEqual(step([5], 10, 4), [5, 10]); // diagonal
  assert.deepEqual(step([5], 7, 4), [5]); // no es vecina
  assert.deepEqual(step([5, 10], 10, 4), [5, 10]); // la misma de nuevo
  assert.deepEqual(step([5, 10, 9], 5, 4), [5, 10, 9]); // ya usada y no es la anteúltima
  assert.deepEqual(step([5, 10, 9], 10, 4), [5, 10]); // vuelve a la anteúltima: borra la última
  assert.deepEqual(step([3], 4, 4), [3]); // 3 y 4 no son vecinas (fin de fila / principio de la siguiente)
});

test('newProgress: nada encontrado, doradas completas, reloj en 0', () => {
  assert.deepEqual(newProgress(board([{ cell: 5, need: 2 }])), { found: [], goldLeft: [2], passed: false, ms: 0 });
});

test('wordOf y score', () => {
  assert.equal(wordOf(board(), CASA), 'CASA');
  assert.equal(score(['CASA', 'MAS', 'CASAS']), 2 + 1 + 4);
});

test('play: corta, inválida, repetida y nueva', () => {
  const b = board();
  const p = newProgress(b);
  assert.equal(play(p, b, words, [0, 1]), 'short');
  assert.equal(play(p, b, words, [0, 1, 4]), 'invalid'); // CAM
  assert.equal(play(p, b, words, CASA), 'ok');
  assert.equal(play(p, b, words, CASA), 'dup');
  assert.equal(play(p, b, words, [2, 1, 0]), 'ok'); // SAC: mismas casillas, otra palabra
  assert.deepEqual(p.found, ['CASA', 'SAC']);
});

test('play: la misma palabra por otro camino no vuelve a sumar', () => {
  const b = { ...board(), letters: [...'CASACASAZZZZZZZZ'] };
  const p = newProgress(b);
  assert.equal(play(p, b, words, [0, 1, 2, 3]), 'ok');
  assert.equal(play(p, b, words, [4, 5, 6, 7]), 'dup');
});

test('play: las doradas se descuentan solo si el camino pasa por ellas y no bajan de 0', () => {
  const b = board([{ cell: 5, need: 1 }, { cell: 0, need: 2 }]);
  const p = newProgress(b);
  assert.deepEqual(p.goldLeft, [1, 2]);
  play(p, b, words, CASA); // pasa por 0
  assert.deepEqual(p.goldLeft, [1, 1]);
  play(p, b, words, ROMA); // pasa por 5
  assert.deepEqual(p.goldLeft, [0, 1]);
  play(p, b, words, [5, 6, 4, 1]); // ORMA: inválida, no descuenta
  play(p, b, words, [1, 4, 5, 6]); // AMOR: pasa por 5, que ya está en 0
  assert.deepEqual(p.goldLeft, [0, 1]);
});

test('play: el nivel se pasa una sola vez, con umbral y doradas en 0', () => {
  const b = board([{ cell: 0, need: 1 }], 4);
  const p = newProgress(b);
  assert.equal(play(p, b, words, ROMA), 'ok'); // 2 pts, falta la dorada
  assert.equal(play(p, b, words, [1, 4, 5, 6]), 'ok'); // AMOR: 4 pts, la dorada sigue pendiente
  assert.equal(p.passed, false);
  assert.equal(play(p, b, words, CASA), 'cleared');
  assert.equal(p.passed, true);
  assert.equal(play(p, b, words, [0, 1, 2, 3, 7]), 'ok'); // CASAS después de pasar: suma, sin otro festejo
});
```

- [ ] **Paso 2: correrlos y ver que fallan**

Run: `node --test test/game.test.js`
Esperado: FAIL con `Cannot find module '.../js/game.js'`.

- [ ] **Paso 3: escribir `js/game.js`**

```js
// Reglas de la partida, sin DOM: trazado, palabras nuevas, doradas y umbral. Spec §2.
import { isValid, points } from './board.js';

export const newProgress = board => ({ found: [], goldLeft: board.gold.map(g => g.need), passed: false, ms: 0 });
export const score = found => found.reduce((n, w) => n + points(w), 0);
export const wordOf = (board, path) => path.map(i => board.letters[i]).join('');

const adjacent = (a, b, size) =>
  Math.abs((a % size) - (b % size)) <= 1 && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1;

// Trazado: suma `cell` si es vecina de la última y no está usada; volver a la anteúltima borra la última.
export function step(path, cell, size) {
  if (cell === path.at(-1) || (path.includes(cell) && cell !== path.at(-2))) return path;
  if (cell === path.at(-2)) return path.slice(0, -1);
  if (path.length && !adjacent(path.at(-1), cell, size)) return path;
  return [...path, cell];
}

// Juega un camino. Devuelve 'short' | 'invalid' | 'dup' | 'ok' | 'cleared' ('cleared' = ok y recién pasó el nivel).
export function play(progress, board, words, path) {
  const word = wordOf(board, path);
  if (word.length < 3) return 'short';
  if (!isValid(words, word)) return 'invalid';
  if (progress.found.includes(word)) return 'dup';
  progress.found.push(word);
  board.gold.forEach((g, k) => {
    if (path.includes(g.cell) && progress.goldLeft[k] > 0) progress.goldLeft[k]--;
  });
  if (progress.passed || score(progress.found) < board.threshold || progress.goldLeft.some(n => n > 0)) return 'ok';
  progress.passed = true;
  return 'cleared';
}
```

- [ ] **Paso 4: correr los tests**

Run: `node --test test/game.test.js`
Esperado: PASS, 7 tests.

- [ ] **Paso 5: commit**

```bash
git add js/game.js test/game.test.js
git commit -m "feat: reglas de la partida: trazado, palabras, doradas y nivel superado"
```

---

### Task 4 (Tarea 4): Guardado, compartir y textos

**Archivos:**
- Reescribir: `js/state.js`, `js/share.js`, `js/i18n.js`, `test/state.test.js`, `test/share.test.js`
- Modificar: `test/i18n.test.js` (el último test)

**Interfaces:**
- Produce, en `js/state.js`:
  - `get(storage, key)` y `set(storage, key, value)`, sin cambios;
  - `loadGame(storage, lang)` → la partida guardada `{ level, sig, found, goldLeft, passed, ms }`, o `{ level: 1 }`;
  - `saveGame(storage, lang, game)`;
  - `sigOf(board)` → `string`;
  - `sameBoard(game, board)` → `boolean`.
- Produce, en `js/share.js`:
  - `formatTime(ms)` → `string` (`2:31`, o `1:02:31` desde la hora);
  - `shareText(lang, level, pts, ms, url)` → `string`.
- Produce, en `js/i18n.js`: `FLAGS`, `STRINGS` y `t(lang, key)`, con las claves nuevas que usa la Tarea 5.

- [ ] **Paso 1: escribir los tests**

`test/state.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get, loadGame, sameBoard, saveGame, set, sigOf } from '../js/state.js';

const memory = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
const board = { letters: [...'CASAMORSZZZZZZZZ'], gold: [{ cell: 0, need: 2 }] };

test('sin nada guardado se arranca en el nivel 1', () => {
  assert.deepEqual(loadGame(memory(), 'es'), { level: 1 });
});

test('guardar y restaurar; cada idioma tiene su partida', () => {
  const st = memory();
  const game = { level: 7, sig: sigOf(board), found: ['CASA'], goldLeft: [1], passed: false };
  saveGame(st, 'es', game);
  assert.deepEqual(loadGame(st, 'es'), game);
  assert.deepEqual(loadGame(st, 'fr'), { level: 1 });
});

test('el formato del criptex o un nivel inválido se descartan', () => {
  const st = memory();
  set(st, 'wordini:es', { day: 3, offsets: [1, 2, 3, 4, 5], attempts: [], tried: [], status: 'won', stats: {} });
  assert.deepEqual(loadGame(st, 'es'), { level: 1 });
  set(st, 'wordini:es', { level: 0 });
  assert.deepEqual(loadGame(st, 'es'), { level: 1 });
  set(st, 'wordini:es', { level: '4' });
  assert.deepEqual(loadGame(st, 'es'), { level: 1 });
});

test('sameBoard: misma cancha sí; otras letras, otras doradas o datos rotos no', () => {
  const game = { level: 7, sig: sigOf(board), found: [], goldLeft: [2], passed: false };
  assert.ok(sameBoard(game, board));
  assert.ok(!sameBoard({ ...game, sig: 'OTRA' }, board));
  assert.ok(!sameBoard({ ...game, goldLeft: [] }, board));
  assert.ok(!sameBoard({ level: 7 }, board));
});

test('storage roto o ausente: nada lanza y se arranca de cero', () => {
  for (const st of [broken, undefined]) {
    assert.doesNotThrow(() => saveGame(st, 'es', { level: 3 }));
    assert.doesNotThrow(() => set(st, 'wordini:lang', 'es'));
    assert.equal(get(st, 'wordini:lang'), null);
    assert.deepEqual(loadGame(st, 'es'), { level: 1 });
  }
});
```

`test/share.test.js`:

```js
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
```

En `test/i18n.test.js`, el último test usa la clave `open`, que desaparece. Reemplazarlo por:

```js
test('t cae al inglés si el idioma no existe', () => {
  assert.equal(t('es', 'share'), 'COMPARTIR');
  assert.equal(t('xx', 'share'), 'SHARE');
});
```

- [ ] **Paso 2: correrlos y ver que fallan**

Run: `node --test test/state.test.js test/share.test.js`
Esperado: FAIL. `sameBoard`, `sigOf` y `formatTime` no existen.

- [ ] **Paso 3: reescribir los tres módulos**

`js/state.js`:

```js
// Persistencia en localStorage. Todo acceso tolera storage ausente o que lance (modo privado).
export function get(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

export function set(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Partida guardada de `lang`: { level, sig, found, goldLeft, passed }. Sin `level` (formato del criptex) se arranca de 1.
export function loadGame(storage, lang) {
  const saved = get(storage, `wordini:${lang}`);
  return Number.isInteger(saved?.level) && saved.level >= 1 ? saved : { level: 1 };
}

export const saveGame = (storage, lang, game) => set(storage, `wordini:${lang}`, game);

// El progreso guardado vale solo para la misma cancha; si cambiaron las listas de palabras, el nivel arranca de cero.
export const sigOf = board => board.letters.join('');
export const sameBoard = (game, board) =>
  game.sig === sigOf(board) && Array.isArray(game.found) && game.goldLeft?.length === board.gold.length;
```

`js/share.js`:

```js
import { FLAGS, t } from './i18n.js';

// Tiempo de juego: 2:31, o 1:02:31 desde la hora.
export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const pad = n => String(n).padStart(2, '0');
  const [h, m] = [Math.floor(s / 3600), Math.floor(s / 60) % 60];
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

// Texto para compartir: nivel superado, puntos y tiempo, sin spoilers.
export const shareText = (lang, level, pts, ms, url) =>
  `Wordini ${FLAGS[lang]} · ${t(lang, 'level')} ${level} ✅ · ${pts} pts · ⏱ ${formatTime(ms)}\n${url}`;
```

`js/i18n.js`:

```js
// Textos de la interfaz. Una clave que falte en un idioma cae al inglés.
export const FLAGS = { es: '🇪🇸', en: '🇬🇧', fr: '🇫🇷' };

export const STRINGS = {
  en: {
    level: 'Level',
    helpTitle: 'How to play',
    help1: 'Drag across touching letters (diagonals too) to spell words of 3 letters or more.',
    help2: 'Longer words score way more. Each word counts once.',
    help3: 'Reach the target score to clear the level. Gold tiles must be used in as many words as their number.',
    example: 'On a computer you can also type the word and press Enter.',
    common: 'common',
    found: 'Found',
    short: 'Too short',
    invalid: 'Not a word',
    dup: 'Already found',
    clearedTitle: 'Level cleared!',
    missedBtn: 'Show missed words',
    keepPlaying: 'Keep playing',
    nextLevel: 'Next level',
    share: 'SHARE',
    copied: 'COPIED!',
    close: 'Close',
    credits: 'Credits',
    language: 'Language',
    help: 'How to play',
    mute: 'Sound',
    loading: 'Loading…',
    loadError: 'Could not load the words. Check your connection and reload.',
  },
  es: {
    level: 'Nivel',
    helpTitle: 'Cómo se juega',
    help1: 'Arrastra por letras vecinas (también en diagonal) para formar palabras de 3 letras o más.',
    help2: 'Las palabras largas valen mucho más. Cada palabra cuenta una sola vez.',
    help3: 'Llega a los puntos del nivel para pasarlo. Las casillas doradas tienen que usarse en tantas palabras como indica su número.',
    example: 'En la compu también puedes escribir la palabra y apretar Enter.',
    common: 'comunes',
    found: 'Encontradas',
    short: 'Muy corta',
    invalid: 'No vale',
    dup: 'Ya la encontraste',
    clearedTitle: '¡Nivel superado!',
    missedBtn: 'Ver las que faltaron',
    keepPlaying: 'Seguir jugando',
    nextLevel: 'Siguiente nivel',
    share: 'COMPARTIR',
    copied: '¡COPIADO!',
    close: 'Cerrar',
    credits: 'Créditos',
    language: 'Idioma',
    help: 'Cómo se juega',
    mute: 'Sonido',
    loading: 'Cargando…',
    loadError: 'No se pudieron cargar las palabras. Revisa tu conexión y recarga.',
  },
  fr: {
    level: 'Niveau',
    helpTitle: 'Comment jouer',
    help1: 'Glisse sur des lettres voisines (en diagonale aussi) pour former des mots de 3 lettres ou plus.',
    help2: 'Les mots longs rapportent beaucoup plus. Chaque mot compte une seule fois.',
    help3: 'Atteins le score du niveau pour le réussir. Les cases dorées doivent servir dans autant de mots que leur nombre.',
    example: 'Sur ordinateur, tu peux aussi taper le mot et appuyer sur Entrée.',
    common: 'courants',
    found: 'Trouvés',
    short: 'Trop court',
    invalid: 'Mot inconnu',
    dup: 'Déjà trouvé',
    clearedTitle: 'Niveau réussi !',
    missedBtn: 'Voir les mots manqués',
    keepPlaying: 'Continuer',
    nextLevel: 'Niveau suivant',
    share: 'PARTAGER',
    copied: 'COPIÉ !',
    close: 'Fermer',
    credits: 'Crédits',
    language: 'Langue',
    help: 'Comment jouer',
    mute: 'Son',
    loading: 'Chargement…',
    loadError: 'Impossible de charger les mots. Vérifie ta connexion et recharge.',
  },
};

export const t = (lang, key) => STRINGS[lang]?.[key] ?? STRINGS.en[key];
```

- [ ] **Paso 4: correr todos los tests**

Run: `npm test`
Esperado: PASS, 29 tests (`words` 2, `board` 10, `game` 7, `i18n` 3, `share` 2, `state` 5).

- [ ] **Paso 5: commit**

```bash
git add js/state.js js/share.js js/i18n.js test/state.test.js test/share.test.js test/i18n.test.js
git commit -m "feat: progreso por nivel, tiempo, texto para compartir y textos de la grilla"
```

---

### Task 5 (Tarea 5): Interfaz de grilla neón

**Archivos:**
- Reescribir: `index.html`, `style.css`, `js/main.js`, `js/fx.js`, `README.md`

**Interfaces:**
- Consume todo lo anterior: `createBoard`, `pathFor` y `points` de `board.js`; `newProgress`, `play`, `score`, `step` y `wordOf` de `game.js`; `formatTime` y `shareText`; `FLAGS` y `t`; `get`, `set`, `loadGame`, `saveGame`, `sameBoard` y `sigOf`.
- Produce, en `js/fx.js`: `tick(n)`, `good(len)`, `gold()`, `bad()`, `win()`, `unlock()`, `muted` y `setMuted`. `clack` y `lose` desaparecen.

- [ ] **Paso 1: `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0b0b14">
  <title>Wordini</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&display=swap">
  <link rel="stylesheet" href="style.css">
  <script type="module" src="js/main.js"></script>
</head>
<body>
  <header>
    <h1>WORDINI</h1>
    <select id="lang" data-label="language"></select>
    <button id="btn-help" class="icon" data-label="help">?</button>
    <button id="btn-mute" class="icon" data-label="mute">🔊</button>
  </header>

  <main>
    <div id="hud">
      <div id="lvl"><span id="level"></span><span id="time"></span></div>
      <div id="bar"><div id="fill"></div><span id="score"></span></div>
      <span id="common"></span>
    </div>
    <p id="word" aria-live="polite"></p>
    <div id="board"></div>
    <button id="btn-next" data-t="nextLevel" hidden></button>
    <details id="found-box">
      <summary id="found-title"></summary>
      <div id="found"></div>
    </details>
  </main>

  <footer><a href="CREDITS.md" data-t="credits"></a></footer>

  <dialog id="dlg-help">
    <h2 data-t="helpTitle"></h2>
    <ol>
      <li data-t="help1"></li>
      <li data-t="help2"></li>
      <li data-t="help3"></li>
    </ol>
    <p class="example" data-t="example"></p>
    <form method="dialog"><button data-t="close"></button></form>
  </dialog>

  <dialog id="dlg-clear">
    <h2 data-t="clearedTitle"></h2>
    <p id="clear-score"></p>
    <div class="row">
      <button id="btn-share" data-t="share"></button>
      <button id="btn-missed" data-t="missedBtn"></button>
    </div>
    <p id="missed" hidden></p>
    <form method="dialog">
      <button data-t="keepPlaying"></button>
      <button id="btn-next-dlg" data-t="nextLevel"></button>
    </form>
  </dialog>
</body>
</html>
```

- [ ] **Paso 2: `style.css`**

```css
:root {
  --bg: #0b0b14;
  --cyan: #00e5ff;
  --magenta: #ff2bd6;
  --green: #39ff88;
  --gold: #ffd23f;
  --dim: #3a3a55;
  --muted: #9a9ac0;
  --text: #ecebff;
  color-scheme: dark;
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }

body {
  margin: 0;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: radial-gradient(ellipse at top, #1d1036, var(--bg) 60%) fixed;
  color: var(--text);
  font-family: 'Bungee', system-ui, sans-serif;
}

header, main, footer { width: 100%; max-width: 480px; padding: 0 1rem; }

header { display: flex; align-items: center; gap: .5rem; padding-top: 1rem; }

h1 {
  margin: 0 auto 0 0;
  font-size: clamp(1.1rem, 6vw, 1.6rem);
  color: var(--magenta);
  text-shadow: 0 0 4px var(--magenta), 0 0 12px var(--magenta), 0 0 28px var(--magenta);
}

button, select {
  font: inherit;
  color: var(--text);
  background: transparent;
  border: 2px solid var(--cyan);
  border-radius: .5rem;
  box-shadow: 0 0 8px var(--cyan);
  cursor: pointer;
}

select { height: 2.5rem; background: var(--bg); }
.icon { flex: 0 1 2.5rem; min-width: 2rem; height: 2.5rem; padding: 0; }

main { display: flex; flex-direction: column; align-items: center; gap: 1rem; margin-top: 1.5rem; }

/* Nivel, barra de puntos hacia el umbral y contador de comunes */
#hud { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .6rem; font-size: .8rem; }
#lvl { display: flex; flex-direction: column; gap: .15rem; }
#level { color: var(--cyan); text-shadow: 0 0 8px var(--cyan); }
#time { font-size: .7rem; color: var(--muted); font-variant-numeric: tabular-nums; }
#common { font-family: system-ui, sans-serif; color: var(--muted); }

#bar { position: relative; height: 1.5rem; border: 2px solid var(--magenta); border-radius: 1rem; box-shadow: 0 0 8px var(--magenta); }
#fill {
  height: 100%;
  width: 0;
  border-radius: 1rem;
  background: linear-gradient(90deg, var(--magenta), var(--cyan));
  box-shadow: 0 0 12px var(--magenta);
  transition: width .3s;
}
#bar.done { border-color: var(--green); box-shadow: 0 0 10px var(--green); }
#bar.done #fill { background: var(--green); box-shadow: 0 0 14px var(--green); }
#score { position: absolute; inset: 0; display: grid; place-items: center; font-size: .75rem; text-shadow: 0 0 3px #000, 0 0 6px #000; }

.pop { position: absolute; right: .5rem; top: -.3rem; color: var(--green); text-shadow: 0 0 10px var(--green); animation: rise .9s forwards; pointer-events: none; }
@keyframes rise { to { transform: translateY(-2rem); opacity: 0; } }

/* Palabra en curso y resultado al soltar */
#word { min-height: 1.6em; margin: 0; font-size: 1.5rem; letter-spacing: .1em; text-align: center; }
#word.live { color: var(--cyan); text-shadow: 0 0 10px var(--cyan); }
#word.good { color: var(--green); text-shadow: 0 0 12px var(--green); animation: pulse .4s; }
#word.dup { color: var(--gold); text-shadow: 0 0 10px var(--gold); font-size: 1.1rem; }
#word.invalid, #word.short { color: var(--magenta); text-shadow: 0 0 10px var(--magenta); font-size: 1.1rem; animation: shake .3s; }
@keyframes pulse { 50% { transform: scale(1.15); } }
@keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }

/* La grilla: el tamaño de letra sigue al ancho de la grilla (unidades de contenedor) */
#board {
  --n: 4;
  position: relative;
  width: min(100%, 24rem);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  gap: .5rem;
  container-type: inline-size;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.tile {
  position: relative;
  display: grid;
  place-items: center;
  border: 2px solid var(--cyan);
  border-radius: .7rem;
  background: #15152c;
  box-shadow: 0 0 6px var(--cyan), inset 0 0 10px #00e5ff33;
  font-size: calc(100cqi / var(--n) * .42);
  text-shadow: 0 0 6px var(--cyan);
  cursor: pointer;
  transition: transform .08s;
}
.tile.on { border-color: var(--magenta); box-shadow: 0 0 10px var(--magenta), 0 0 22px var(--magenta); transform: scale(1.06); }
.tile.gold { border-color: var(--gold); color: var(--gold); box-shadow: 0 0 8px var(--gold), 0 0 18px var(--gold); text-shadow: 0 0 8px var(--gold); }
.tile.gold.done { border-color: var(--green); color: var(--green); box-shadow: 0 0 8px var(--green); text-shadow: 0 0 8px var(--green); }
.tile.gold.on { border-color: var(--magenta); }

.badge {
  position: absolute;
  top: -.5rem;
  right: -.5rem;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 .3rem;
  display: grid;
  place-items: center;
  border-radius: 1rem;
  font-size: .75rem;
  text-shadow: none;
  color: var(--bg);
  background: var(--gold);
  box-shadow: 0 0 8px var(--gold);
}
.done .badge { background: var(--green); box-shadow: 0 0 8px var(--green); }

#trail { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
#trail polyline {
  fill: none;
  stroke: var(--magenta);
  stroke-width: 10;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: .55;
  filter: drop-shadow(0 0 6px var(--magenta));
}

#btn-next, #btn-share {
  color: var(--green);
  border-color: var(--green);
  box-shadow: 0 0 6px var(--green), 0 0 20px var(--green);
  text-shadow: 0 0 8px var(--green);
}
#btn-next { padding: .7rem 2rem; font-size: 1.1rem; }

#found-box { width: 100%; font-size: .8rem; }
#found-box summary { cursor: pointer; color: var(--cyan); }
#found p, #missed { margin: .3rem 0; font-family: system-ui, sans-serif; letter-spacing: .05em; line-height: 1.5; }
#found b { margin-right: .4rem; color: var(--magenta); }

footer { margin-top: auto; padding: 2rem 1rem 1rem; text-align: center; font-size: .7rem; }
footer a { color: var(--dim); }

dialog {
  width: min(92vw, 420px);
  background: #12122a;
  color: var(--text);
  border: 2px solid var(--magenta);
  border-radius: 1rem;
  box-shadow: 0 0 24px var(--magenta);
}
dialog::backdrop { background: #000b; }
dialog h2 { margin-top: 0; color: var(--cyan); text-shadow: 0 0 10px var(--cyan); }
dialog li, dialog p { font-family: system-ui, sans-serif; line-height: 1.4; }
dialog .row { display: flex; flex-wrap: wrap; gap: .5rem; }
dialog .row button, dialog form button { padding: .4rem 1rem; }
dialog form { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1rem; }
#clear-score { font-family: inherit; font-size: 1.1rem; color: var(--green); text-shadow: 0 0 8px var(--green); }
#missed { font-size: .8rem; color: var(--muted); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

- [ ] **Paso 3: `js/fx.js`**

```js
// Efectos: sonido chiptune sintetizado (sin archivos), vibración y confetti. Si algo falla, el juego sigue.
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CONFETTI = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/+esm';
let ctx;

export let muted = false;
export const setMuted = m => (muted = m);

// Los navegadores solo dejan sonar audio creado o reanudado durante un gesto del usuario.
export function unlock() {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') ctx.resume();
  } catch {}
}

function beep(freq, duration, type, delay = 0, volume = 0.06) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration);
  } catch {}
}

// Un "tic" por casilla, cada vez más agudo a medida que la palabra se alarga.
export function tick(n) {
  beep(440 + 90 * n, 0.04, 'square', 0, 0.03);
  navigator.vibrate?.(10);
}

export function good(len) {
  [523, 659, 784, 1047].slice(0, Math.min(4, len - 1)).forEach((f, k) => beep(f, 0.14, 'triangle', k * 0.05, 0.06));
}

export function gold() {
  beep(1568, 0.2, 'triangle', 0.12, 0.06);
  beep(2093, 0.3, 'triangle', 0.2, 0.05);
}

export function bad() {
  beep(150, 0.15, 'sawtooth', 0, 0.05);
}

export function win() {
  [523, 659, 784, 1047].forEach((f, k) => beep(f, 0.25, 'triangle', 0.15 + k * 0.09, 0.08));
  if (calm) return;
  import(CONFETTI)
    .then(m => m.default({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ['#00e5ff', '#ff2bd6', '#39ff88', '#ffd23f'] }))
    .catch(() => {});
}
```

- [ ] **Paso 4: `js/main.js`**

```js
import { createBoard, pathFor, points } from './board.js';
import { newProgress, play, score, step, wordOf } from './game.js';
import { formatTime, shareText } from './share.js';
import { FLAGS, t } from './i18n.js';
import { get, set, loadGame, saveGame, sameBoard, sigOf } from './state.js';
import * as fx from './fx.js';

const $ = sel => document.querySelector(sel);
const SVG = 'http://www.w3.org/2000/svg';
const trail = document.createElementNS(SVG, 'svg');
const line = trail.appendChild(document.createElementNS(SVG, 'polyline'));
trail.id = 'trail';

let storage;
try {
  storage = localStorage;
} catch {} // bloqueado: el juego funciona sin persistencia

let lang, words, board, game;
let path = []; // camino en curso, con el dedo o el teclado
let typed = ''; // palabra escrita con el teclado
let tracing = false;
let since = null; // performance.now() desde que el reloj corre; null = parado
let loadSeq = 0; // solo la última carga pedida puede tocar la pantalla

function pickLang() {
  const wanted = [new URLSearchParams(location.search).get('l'), get(storage, 'wordini:lang'), navigator.language?.slice(0, 2)];
  return wanted.find(l => Object.hasOwn(FLAGS, l ?? '')) ?? 'en';
}

async function start(newLang) {
  const seq = ++loadSeq;
  if (game) stopClock(); // guarda el tiempo con la clave del idioma que se deja
  lang = newLang;
  board = game = undefined; // mientras carga no hay partida: nada puede guardarse con la clave de otro idioma
  $('#board').replaceChildren();
  $('#hud').hidden = $('#found-box').hidden = $('#btn-next').hidden = true;
  set(storage, 'wordini:lang', lang);
  document.documentElement.lang = lang;
  $('#lang').value = lang;
  renderTexts();
  say(t(lang, 'loading'));
  let loaded;
  try {
    const res = await fetch(`words/${lang}.json`);
    if (!res.ok) throw new Error(res.status);
    loaded = await res.json();
  } catch {
    if (seq === loadSeq) say(t(lang, 'loadError'));
    return;
  }
  if (seq !== loadSeq) return; // el jugador cambió de idioma mientras cargaba
  words = loaded;
  enterLevel(loadGame(storage, lang));
}

function enterLevel(saved) {
  board = createBoard(lang, saved.level, words);
  game = sameBoard(saved, board) ? saved : { level: saved.level, sig: sigOf(board), ...newProgress(board) };
  game.ms ??= 0; // partidas guardadas antes del reloj
  saveGame(storage, lang, game);
  path = [];
  typed = '';
  since = null;
  if (game.ms > 0) startClock(); // venía jugando este nivel: retoma
  renderBoard();
  render();
  say('');
}

// El reloj corre desde la primera letra del nivel hasta pasarlo, y solo con la pestaña a la vista.
const elapsed = () => game.ms + (since === null ? 0 : performance.now() - since);

function startClock() {
  if (since === null && !game.passed && !document.hidden) since = performance.now();
}

// Pasa lo corrido a game.ms (lo que se guarda) sin parar el reloj.
function syncClock() {
  if (since === null) return;
  const now = performance.now();
  game.ms += now - since;
  since = now;
}

function stopClock() {
  syncClock();
  since = null;
  saveGame(storage, lang, game);
}

function renderClock() {
  if (game) $('#time').textContent = `⏱ ${formatTime(elapsed())}`;
}

function renderTexts() {
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(lang, el.dataset.t);
  for (const el of document.querySelectorAll('[data-label]')) {
    el.title = t(lang, el.dataset.label);
    el.setAttribute('aria-label', el.title);
  }
}

function say(text, cls = '') {
  $('#word').textContent = text;
  $('#word').className = cls;
}

function renderBoard() {
  const el = $('#board');
  el.style.setProperty('--n', board.size);
  el.replaceChildren(
    ...board.letters.map((c, i) => {
      const tile = Object.assign(document.createElement('div'), { className: 'tile', textContent: c });
      tile.dataset.i = i;
      return tile;
    }),
    trail,
  );
  for (const g of board.gold) {
    el.children[g.cell].classList.add('gold');
    el.children[g.cell].append(Object.assign(document.createElement('b'), { className: 'badge' }));
  }
  line.setAttribute('points', '');
}

function render() {
  const pts = score(game.found);
  $('#hud').hidden = $('#found-box').hidden = false;
  $('#level').textContent = `${t(lang, 'level')} ${game.level}`;
  $('#score').textContent = `${pts} / ${board.threshold}`;
  $('#fill').style.width = `${Math.min(100, (100 * pts) / board.threshold)}%`;
  $('#bar').classList.toggle('done', pts >= board.threshold);
  $('#common').textContent = `${board.commonCount - board.missed(game.found).length}/${board.commonCount} ${t(lang, 'common')}`;
  board.gold.forEach((g, k) => {
    const tile = $('#board').children[g.cell];
    tile.classList.toggle('done', game.goldLeft[k] === 0);
    tile.querySelector('.badge').textContent = game.goldLeft[k] || '✓';
  });
  const lengths = [...new Set(game.found.map(w => w.length))].sort((a, b) => b - a);
  $('#found-title').textContent = `${t(lang, 'found')} (${game.found.length})`;
  $('#found').replaceChildren(
    ...lengths.map(n => {
      const p = document.createElement('p');
      p.append(Object.assign(document.createElement('b'), { textContent: n }), game.found.filter(w => w.length === n).sort().join(' '));
      return p;
    }),
  );
  $('#btn-next').hidden = !game.passed;
  renderClock();
}

// Resalta el camino, dibuja la línea entre los centros de las casillas y muestra la palabra en curso.
function renderPath() {
  const tiles = [...$('#board').querySelectorAll('.tile')];
  tiles.forEach((tile, i) => tile.classList.toggle('on', path.includes(i)));
  const centers = path.map(i => `${tiles[i].offsetLeft + tiles[i].offsetWidth / 2},${tiles[i].offsetTop + tiles[i].offsetHeight / 2}`);
  line.setAttribute('points', centers.join(' '));
  if (path.length || typed) say(typed || wordOf(board, path), 'live');
}

function pop(text) {
  const el = Object.assign(document.createElement('span'), { className: 'pop', textContent: text });
  $('#bar').append(el);
  setTimeout(() => el.remove(), 900);
}

const pendingGold = () => board.gold.filter((_, k) => game.goldLeft[k] > 0).map(g => g.cell);

function submit(p) {
  const word = wordOf(board, p);
  const goldBefore = game.goldLeft.join();
  const result = play(game, board, words, p);
  path = [];
  typed = '';
  renderPath();
  if (result === 'short') {
    say(p.length > 1 ? t(lang, 'short') : '', 'short');
    return;
  }
  if (result === 'invalid' || result === 'dup') {
    say(`${word} · ${t(lang, result)}`, result);
    fx.bad();
    return;
  }
  if (result === 'cleared') stopClock();
  else syncClock();
  saveGame(storage, lang, game);
  say(word, 'good');
  pop(`+${points(word)}`);
  fx.good(word.length);
  if (game.goldLeft.join() !== goldBefore) fx.gold();
  render();
  if (result === 'cleared') {
    fx.win();
    const g = game;
    setTimeout(() => game === g && showCleared(), 900); // si cambió de idioma mientras tanto, no se abre
  }
}

// Solo cuenta el círculo central de cada casilla: así una diagonal no agarra por error una vecina.
function tileAt(x, y) {
  const tile = document.elementFromPoint(x, y)?.closest('#board .tile');
  if (!tile) return null;
  const r = tile.getBoundingClientRect();
  const dx = x - (r.left + r.width / 2);
  const dy = y - (r.top + r.height / 2);
  return dx * dx + dy * dy <= (0.36 * r.width) ** 2 ? Number(tile.dataset.i) : null;
}

function onPointerDown(e) {
  const tile = e.target.closest('.tile');
  if (!board || !tile) return;
  $('#board').setPointerCapture(e.pointerId);
  tracing = true;
  typed = '';
  path = [Number(tile.dataset.i)];
  startClock();
  fx.tick(1);
  renderPath();
}

function onPointerMove(e) {
  if (!tracing) return;
  const i = tileAt(e.clientX, e.clientY);
  if (i === null) return;
  const next = step(path, i, board.size);
  if (next === path) return;
  if (next.length > path.length) fx.tick(next.length);
  path = next;
  renderPath();
}

function onPointerUp(e) {
  if (!tracing) return;
  tracing = false;
  if (e.type === 'pointercancel') {
    path = [];
    renderPath();
    say('');
  } else submit(path);
}

const letterOf = key => {
  if (key.length !== 1) return null;
  const up = key.toUpperCase();
  const c = up === 'Ñ' ? up : up.normalize('NFD')[0]; // É -> E, pero la Ñ queda
  return words.alphabet.includes(c) ? c : null;
};

function onKey(e) {
  if (!board || tracing || document.querySelector('dialog[open]') || e.target.tagName === 'SELECT') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Enter' && e.target.closest('a, button, summary')) return; // ya reciben su click
  if (e.key === 'Enter') {
    if (!typed) return;
    const p = pathFor(typed, board.letters, pendingGold());
    if (p) submit(p);
    else {
      say(`${typed} · ${t(lang, typed.length < 3 ? 'short' : 'invalid')}`, 'invalid');
      fx.bad();
      typed = '';
      path = [];
      renderPath();
    }
  } else if (e.key === 'Backspace') typed = typed.slice(0, -1);
  else if (e.key === 'Escape') typed = '';
  else if (letterOf(e.key)) {
    typed += letterOf(e.key);
    startClock();
  } else return;
  e.preventDefault();
  if (e.key === 'Enter') return;
  path = pathFor(typed, board.letters, pendingGold()) ?? [];
  renderPath();
  if (!typed) say('');
}

function showCleared() {
  const missed = board.missed(game.found);
  $('#clear-score').textContent = `${t(lang, 'level')} ${game.level} · ${score(game.found)} pts · ⏱ ${formatTime(game.ms)}`;
  $('#missed').textContent = missed.join(' ');
  $('#missed').hidden = true;
  $('#btn-missed').hidden = !missed.length;
  $('#dlg-clear').showModal();
}

function nextLevel() {
  if (!game?.passed) return;
  $('#dlg-clear').close();
  enterLevel({ level: game.level + 1 });
}

async function share() {
  const url = `${location.origin}${location.pathname}?l=${lang}`;
  const text = shareText(lang, game.level, score(game.found), game.ms, url);
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    $('#btn-share').textContent = t(lang, 'copied');
    setTimeout(() => ($('#btn-share').textContent = t(lang, 'share')), 1500);
  } catch {
    prompt('', text); // sin portapapeles: que lo copie a mano
  }
}

function renderMute() {
  $('#btn-mute').textContent = fx.muted ? '🔇' : '🔊';
}

$('#lang').innerHTML = Object.entries(FLAGS).map(([l, flag]) => `<option value="${l}">${flag} ${l.toUpperCase()}</option>`).join('');
fx.setMuted(get(storage, 'wordini:muted') === true);
renderMute();
await start(pickLang());

$('#lang').onchange = e => start(e.target.value);
$('#board').onpointerdown = onPointerDown;
$('#board').onpointermove = onPointerMove;
$('#board').onpointerup = $('#board').onpointercancel = onPointerUp;
$('#btn-next').onclick = $('#btn-next-dlg').onclick = nextLevel;
$('#btn-missed').onclick = () => ($('#missed').hidden = false);
$('#btn-help').onclick = () => $('#dlg-help').showModal();
$('#btn-share').onclick = share;
$('#btn-mute').onclick = () => {
  fx.setMuted(!fx.muted);
  set(storage, 'wordini:muted', fx.muted);
  renderMute();
};
document.addEventListener('keydown', onKey);
for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, fx.unlock);
document.addEventListener('visibilitychange', () => {
  if (!game) return;
  if (document.hidden) stopClock();
  else if (game.ms > 0) startClock();
});
addEventListener('pagehide', () => game && stopClock()); // respaldo: algunos navegadores no avisan al cerrar
setInterval(renderClock, 250);

if (!get(storage, 'wordini:help-seen')) {
  $('#dlg-help').showModal();
  set(storage, 'wordini:help-seen', true);
}
```

Decisiones que no se ven en el código y conviene no "arreglar":
- **Puntero:** el `pointerdown` acepta toda la casilla. El `pointermove` solo acepta el círculo central (`0.36 × ancho`), para que una diagonal no agarre una vecina.
- **Captura:** `setPointerCapture` va sobre `#board`, no sobre la casilla, para que el `pointermove` siga llegando aunque el dedo salga de la casilla donde empezó.
- **`dataset`:** no se puede asignar con `Object.assign`, porque es de solo lectura. Por eso `tile.dataset.i = i` va aparte.
- **Reloj:** se mide con `since` (`performance.now()` mientras corre) más `game.ms` (lo acumulado, que es lo que se guarda). `syncClock` pasa lo corrido a `game.ms` sin parar el reloj; así cada palabra guarda el tiempo. En `start()`, `stopClock()` va **antes** de cambiar `lang`, para guardar con la clave del idioma que se deja.

- [ ] **Paso 5: `README.md`**

````markdown
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
````

- [ ] **Paso 6: tests**

Run: `npm test`
Esperado: PASS, 29 tests.

- [ ] **Paso 7: probarlo en el navegador (Foco de revisión)**

```bash
python3 -m http.server 8000   # http://localhost:8000/?l=es ; desde el celu: http://<IP de la compu>:8000/?l=es
```

Revisar, con DevTools abiertas en la pestaña Console (no tiene que aparecer ningún error):

- [ ] **Primera visita:** se abre la ayuda. Al cerrarla se ve "NIVEL 1", la barra `0 / N`, el contador de comunes y una grilla 4×4.
- [ ] **Trazar una palabra:**
  - mientras se arrastra, se ve la línea magenta y la palabra arriba;
  - al soltar se ve la palabra en verde y "+N" sube desde la barra;
  - la palabra aparece en "Encontradas".
- [ ] **Repetida y que no existe:** repetir la misma palabra muestra "Ya la encontraste" en amarillo; una que no existe muestra "No vale" con temblor.
- [ ] **Foco 1 (diagonales en un celular real):** trazar varias palabras en diagonal y en zigzag. No se agrega ninguna casilla vecina sin querer y la página no se desplaza.
- [ ] **Foco 4 (teclado):**
  - escribir una palabra resalta su camino y Enter la envía;
  - É escribe E y, en `es`, Ñ escribe Ñ;
  - Backspace y Escape borran;
  - con el foco en ? (Tab), Enter abre la ayuda y no envía nada;
  - Ctrl+R recarga la página.
- [ ] **Nivel superado:**
  - en la consola: `localStorage.setItem('wordini:es', JSON.stringify({level: 13}))` y recargar. Se ve una grilla 5×5;
  - con `const { createBoard } = await import('/js/board.js'); const w = await (await fetch('/words/es.json')).json(); createBoard('es', 13, w).missed([])` se obtienen palabras para pasarlo;
  - al llegar al umbral con las doradas en 0: confetti, sonido y el modal con Compartir, "Ver las que faltaron", "Seguir jugando" y "Siguiente nivel".
- [ ] **Cronómetro:**
  - al entrar a un nivel marca `⏱ 0:00` y no avanza hasta tocar o escribir la primera letra;
  - al pasar el nivel se congela y el modal muestra el mismo tiempo.
- [ ] **Foco 5:**
  - a mitad de un nivel, cambiar a otra pestaña 10 s y volver: el tiempo no avanzó;
  - recargar: el tiempo sigue desde donde estaba;
  - pasar el nivel, cerrar el modal con "Seguir jugando" y recargar: se sigue en el mismo nivel, con el mismo progreso, el tiempo congelado y **Siguiente nivel** visible.
- [ ] **Foco 2:**
  - cambiar de idioma y volver enseguida, varias veces: cada idioma conserva su nivel;
  - pasar un nivel y cambiar de idioma antes de 1 segundo: el modal no aparece en el otro idioma.
- [ ] **Foco 3:** en DevTools → Network, bloquear `words/es.json` ("Block request URL") y recargar. Aparece "No se pudieron cargar las palabras…" y nada se rompe.
- [ ] **320 px:** en el modo responsive de DevTools, con 320 px de ancho, no hay scroll horizontal y la grilla 5×5 entra.
- [ ] **Movimiento reducido:** con "Emulate CSS prefers-reduced-motion: reduce" no hay confetti ni temblor.

- [ ] **Paso 8: commit**

```bash
git add index.html style.css js/main.js js/fx.js README.md
git commit -m "feat: interfaz de grilla neón con trazado, teclado, doradas, niveles y cronómetro"
```

---

## Después del plan (fuera de este alcance)

- **Calibrar las perillas jugando:** el umbral varía mucho entre canchas ricas y pobres. El nivel 1 quizás convenga más fácil (15%).
- **Inglés:** si faltan palabras, pasar a una lista SCOWL más grande.
- Estrellas por nivel, pistas, desafío diario y PWA (spec §10).
