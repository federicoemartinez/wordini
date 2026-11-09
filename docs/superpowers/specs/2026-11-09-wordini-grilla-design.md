# Wordini (grilla) — Diseño

**Fecha:** 2026-11-09
**Estado:** aprobada el 2026-11-09. Ajustada con lo que mostró el prototipo del plan (`pathFor` como función exportada, módulo `js/game.js`).
**Reemplaza a:** `2026-11-08-wordini-design.md` (cerradura criptex, descartada)

## 1. Objetivo

Juego de palabras adictivo y multiidioma (es, en, fr), 100% estático y sin backend.
- Hay una grilla de letras. Se arman palabras arrastrando por letras vecinas y cada palabra suma puntos.
- Cada nivel ("cancha") tiene un umbral de puntos que hay que superar para pasar al siguiente.
- Los niveles son infinitos y el nivel N es el mismo para todos los jugadores de un idioma.

**Criterio de éxito:**
- un jugador nuevo entiende cómo se juega en el nivel 1, sin leer la ayuda;
- quiere jugar "un nivel más";
- compartir "llegué al nivel N" tiene sentido porque los demás jugaron la misma cancha.

## 2. Reglas del juego

### 2.1 La cancha

- La grilla es de **4×4 en los niveles 1 a 10** y de **5×5 desde el 11**. 5×5 es el tope: en 6×6 las casillas quedan demasiado chicas para trazar diagonales con el dedo en el celular.
- Se arma una palabra arrastrando por casillas **vecinas**, incluidas las diagonales, sin repetir casilla dentro de la palabra. Al soltar, la palabra se evalúa.
- **Mínimo 3 letras.**
- Los acentos se ignoran: COMÍ se arma con C-O-M-I. En español, la Ñ es una letra propia.

### 2.2 Puntos

| Letras | 3 | 4 | 5 | 6 | 7 | 8 o más |
|---|---|---|---|---|---|---|
| Puntos | 1 | 2 | 4 | 7 | 11 | 16 |

- Cada palabra suma **una sola vez**, sin importar desde qué casillas se arme. Los anagramas son palabras distintas: ROMA y AMOR suman las dos.
- Una palabra que no existe, o que ya se encontró, no resta. Solo se muestra un aviso: "no vale" o "ya la encontraste".

### 2.3 Casillas doradas

- Aparecen desde el nivel 4. Algunas casillas son **doradas** y muestran un número k ∈ {1, 2, 3}.
- Cada palabra **nueva y válida** cuyo camino pasa por una dorada le descuenta 1. Al llegar a 0, la casilla muestra ✓.
- Lo que cuenta es el camino que trazó el jugador. Si una palabra se puede armar por más de un camino, solo descuenta la dorada si el camino elegido pasa por ella.

### 2.4 Pasar de nivel

- Para pasar de nivel hay que **llegar al umbral y dejar todas las doradas en 0**.
- No se pierde nunca.

### 2.4.1 Cronómetro

- Arranca con la primera letra que se toca o se escribe en el nivel. Cargar las palabras o leer la ayuda no cuenta.
- Se frena al pasar el nivel. Si después se sigue jugando, queda fijo en el tiempo que se tardó en pasarlo.
- Se pausa mientras la pestaña no está a la vista.
- El tiempo se guarda con la partida: al recargar sigue desde donde estaba, y cada idioma conserva el suyo.
- Se muestra como `⏱ 2:31`, o `⏱ 1:02:31` desde la hora.
- No hay mejores tiempos ni récords: no se guarda historial de niveles anteriores.
- **Al pasar:**
  - hay festejo, con confetti y sonido;
  - se abre el modal de nivel superado, con el nivel, los puntos y el tiempo (las encontradas siguen debajo de la grilla);
  - un botón muestra las palabras comunes que faltaron (§3.3);
  - se puede compartir.
- **Después del festejo** se puede **seguir jugando** esa cancha para sumar puntos o tocar **Siguiente nivel**.
- No se puede volver a niveles anteriores ni saltear niveles.

### 2.5 Compartir

```
Wordini 🇪🇸 · Nivel 14 ✅ · 212 pts · ⏱ 2:31
https://<origen>/?l=es
```

- El link lleva el idioma. Quien lo abre juega **su** nivel actual, no el 14.
- En celular se usa `navigator.share`. Donde no existe, se copia con `navigator.clipboard.writeText` y aparece "¡Copiado!". Es lo mismo que hace el criptex.

## 3. Idiomas y datos

### 3.1 Idiomas

Siguen `es`, `en` y `fr`, con los mismos alfabetos y la misma normalización que el criptex (spec anterior, §3.1 y §3.3), salvo que ahora se aceptan **palabras de 3 a 12 letras**.

### 3.2 Fuentes

- **Diccionario:** Hunspell de `LibreOffice/dictionaries`, ahora `.dic` **y** `.aff`:
  - `es/es_ES` (GPL/LGPL/MPL);
  - `en/en_US`;
  - `fr_FR/dictionaries/fr` (MPL 2.0).
- **Expansión:** `spylls` (Hunspell en Python puro, MPL 2.0). Se usa solo para leer los `.dic`/`.aff`. Vive en `tools/.venv` y el sitio no lo carga.
- **Frecuencia:** `wordfreq` 3.x. Se usa **solo** para decidir qué palabras son comunes.
- **Bloqueo:** `tools/blocklist/{lang}.txt`, igual que ahora, con los agregados a mano.

### 3.3 Listas

- **`valid` (aceptadas):** todas las formas que genera el diccionario Hunspell.
  - Para cada entrada del `.dic` cuya raíz va toda en minúscula, se toman:
    - la raíz;
    - la raíz con cada sufijo;
    - la raíz con sufijo y un segundo sufijo encadenado (así se generan los enclíticos del español: DÁMELO);
    - la raíz con cada prefijo, y con prefijo y sufijo cuando ambos permiten combinarse.
  - Las raíces con mayúscula, que son los nombres propios, quedan afuera.
  - Se normaliza, se filtra el largo (3 a 12) y el alfabeto, y se saca lo bloqueado.
- **`common` (comunes):** las 20.000 palabras de `valid` con mayor frecuencia en `wordfreq`. Con ellas se calculan el umbral y las doradas, y se arma la lista de "te faltaron".
- **Salida:** `words/{lang}.json` = `{ "alphabet": "...", "valid": [...], "common": [...] }`.
  - Las dos listas van ordenadas por punto de código. El solver depende de ese orden (§4.2).
  - Si cambian las listas, cambian los niveles. Se acepta: lo que pasó, pasó.

### 3.4 Lo que midió la prueba (2026-11-09)

| Idioma | `valid` | JSON | gzip |
|---|---|---|---|
| es | 484.697 | 6,1 MB | 1,1 MB |
| fr | 329.816 | 4,1 MB | 0,8 MB |
| en | 72.862 | 0,8 MB | 0,2 MB |

- **Exactitud:** en 2.000 formas tomadas al azar por idioma, el corrector rechazó 0, así que la expansión no inventa palabras. De las frecuentes que el corrector acepta, se perdieron 0 en `es` y `en`, y 5 de 23.260 en `fr` (plurales de unidades como "grammes").
- **Ruido:** quedan afuera NUGENT, KWH, PARTY y ODRIOZOLA. Entran COMIÉSEMOS, DÁMELO, ÑANDÚ y QUIZZES.
- **Costo en el browser** (lista `es`, Node en la compu):
  - `JSON.parse` tarda 123 ms y ocupa 18 MB de memoria;
  - el solver tarda 0,7 ms por cancha 4×4 y 1,8 ms por 5×5.
- **Inglés:** `en_US` de LibreOffice es chico (73.000 formas). Si faltan palabras, la perilla es cambiar a una lista SCOWL más grande.

### 3.5 Script de datos

`tools/build_words.py <lang>`:
1. Descarga `.dic`, `.aff` y la lista de bloqueo, o los lee de `tools/sources/`.
2. Expande el diccionario, cruza con `wordfreq` y escribe `words/{lang}.json`.
3. Tarda segundos por idioma.

Al final corre un **autochequeo con `assert`**:
- todas las palabras tienen de 3 a 12 letras del alfabeto;
- `common` está incluida en `valid` y ninguna de las dos tiene palabras bloqueadas;
- las dos listas están ordenadas;
- `len(common) >= 10000`;
- el JSON pesa menos de 8 MB;
- **muestras por idioma:** las que tienen que entrar entran (en `es`: CASAS, COMI, DAMELO, ÑANDU) y las que no, no (NUGENT, KWH, PARTY).

## 4. Generación de canchas (en el navegador)

### 4.1 Azar determinista

Se reutilizan `fnv1a` y `mulberry32` del criptex, con la semilla `` `${lang}:${level}` ``. Todo el azar se consume en un orden fijo y `Math.random` no se usa nunca.

### 4.2 Solver

Es una búsqueda en profundidad desde cada casilla, con vecinas en 8 direcciones y sin repetir casilla.
- **Poda:** cada camino se corta cuando sus letras no son prefijo de ninguna palabra de `valid`. Para saberlo se hace una **bisección** sobre `valid`, que viene ordenada: `p` es prefijo si la primera palabra ≥ `p` empieza con `p`.
- No hay `Set` de prefijos: con 485.000 palabras serían varios millones de strings.

**Devuelve:**
- `words`: el conjunto de palabras de `valid` que se pueden armar;
- `through[cell]`: las palabras **comunes** que se pueden armar con algún camino que pase por esa casilla.

### 4.3 Armado de la cancha

1. Se sortea cada casilla con peso según la frecuencia de cada letra en `common`.
2. Se resuelve la cancha.
3. Se acepta solo si se cumplen dos condiciones:
   - hay suficientes palabras comunes: ≥ 25 en 4×4, ≥ 50 en 5×5;
   - hay al menos una común larga: 6 letras o más en 4×4, 7 o más en 5×5.
4. Si no se cumplen, se sortea otra cancha. Con 500 rechazos en total se lanza un error; los tests (§8) garantizan que no ocurra.

### 4.4 Umbral

`threshold = ceil(pct(level) × commonPoints)`. `commonPoints` es la suma de los puntos de las palabras comunes de la cancha.
- **En 4×4:** `pct` va de 20% en el nivel 1 a ~42% en el 10.
- **En 5×5:** baja a ~25% en el nivel 11 y sube despacio hasta un techo de 45%.

### 4.5 Casillas doradas

- Aparecen desde el nivel 4. El PRNG decide si el nivel las tiene (más o menos 1 de cada 2) y cuántas tiene:

  | Niveles | Doradas |
  |---|---|
  | 4 a 10 | 1 |
  | 11 a 20 | 1 o 2 |
  | 21 en adelante | 1 a 3 |

- A cada dorada le toca un k del 1 al 3.
- Una casilla solo puede ser dorada con número k si `through[cell]` tiene **≥ 3×k** palabras comunes. El margen evita exigir palabras rebuscadas.
- Si no alcanzan las casillas que cumplen, se baja k o se ponen menos doradas, sin volver a sortear la cancha.

### 4.6 Perillas

Todos los números de §4.3 a §4.5 son constantes en un solo bloque al principio de `js/board.js`. `tools/levels.mjs` imprime las estadísticas de los niveles 1 a 50 de un idioma (palabras comunes, `commonPoints`, umbral y doradas) para calibrar.

### 4.7 API

```js
// js/board.js
createBoard(lang, level, words) → {
  size,                       // 4 o 5
  letters: string[],          // size×size, por filas
  gold: { cell, need }[],
  threshold,
  commonCount,                // palabras comunes de la cancha
  missed(found) → string[],   // comunes no encontradas, en orden alfabético
}
solve(letters, words) → { found: Set<string>, through: Set<string>[] }
pathFor(word, letters, prefer = []) → number[] | null // para el teclado; prefiere pasar por `prefer`
neighbors(size) → number[][]
points(word) → number
isValid(words, word) → boolean // bisección en words.valid

// js/game.js: reglas de la partida, sin DOM
newProgress(board) → { found: [], goldLeft: number[], passed: false, ms: 0 }
step(path, cell, size) → number[]   // trazado: suma vecina, ignora lejana o usada, vuelve atrás
play(progress, board, words, path) → 'short' | 'invalid' | 'dup' | 'ok' | 'cleared'
score(found) → number
wordOf(board, path) → string

// js/share.js
formatTime(ms) → string             // 2:31 o 1:02:31
shareText(lang, level, pts, ms, url) → string
```

## 5. Que no se vea la lista de soluciones

Es igual que en el criptex, sin intentar ocultarla de verdad: la lista de palabras de la cancha vive en el closure de `createBoard` y no se guarda en `localStorage`. Igual cualquiera podría usar un solver externo; es un juego sin ranking.

## 6. Interfaz

### 6.1 Pantalla

- **Encabezado:** "WORDINI", selector de idioma, ayuda y silencio, como ahora. Se va el botón de estadísticas.
- **Barra de nivel:**
  - "NIVEL 14" con el cronómetro debajo (`⏱ 2:31`), y una barra neón de progreso hacia el umbral, por ejemplo `132 / 180`;
  - al pasar el umbral, la barra se pone verde y los puntos siguen sumando;
  - al lado, el contador "comunes 12/48", para saber cuánto queda cuando uno se traba.
- **Palabra en curso:**
  - arriba de la grilla, en grande, se ve la palabra mientras se traza;
  - al soltar:
    - si vale: destello verde y un "+7" que sube;
    - si ya estaba: aviso amarillo;
    - si no vale: temblor en rojo.
- **Grilla:**
  - casillas cuadradas con borde neón;
  - las doradas brillan en dorado y tienen un globito con el número que falta;
  - un `<svg>` encima dibuja la línea brillante que une los centros de las casillas del camino.
- **Encontradas:** debajo de la grilla, agrupadas por largo. Se pueden plegar.
- **Modales:**
  - ayuda: se abre sola en la primera visita, con 3 pasos y un ejemplo animado;
  - nivel superado (§2.4).

### 6.2 Controles

- **Trazado con pointer events:**
  - `pointerdown` sobre una casilla arranca la palabra;
  - en `pointermove`, `document.elementFromPoint` dice qué casilla está bajo el dedo;
  - solo cuenta el círculo central de cada casilla (~70%), para que las diagonales no agarren por error la vecina;
  - volver a la casilla anterior borra la última letra;
  - `pointerup` envía la palabra.
- **Scroll:** `touch-action: none` en la grilla, para que no se mueva la página mientras se traza.
- **Teclado (escritorio y accesibilidad):**
  - se escribe la palabra y Enter la envía;
  - `pathFor` busca un camino y prefiere el que pasa por más doradas pendientes;
  - Escape borra.

### 6.3 Estética y efectos

- La paleta, la fuente Bungee y los brillos son los del criptex.
- **Sonidos sintetizados (`js/fx.js`):**
  - un "tic" por casilla, con un tono que sube a medida que la palabra se alarga;
  - un acorde al aceptar una palabra;
  - una campanita al descontar una dorada;
  - un arpegio y confetti al pasar de nivel.
- **Vibración:** `navigator.vibrate(10)` al sumar una casilla.
- **`prefers-reduced-motion`:** sin confetti, sin temblor y sin "+N" animado.
- **Responsive:** diseñado primero para celular (≥ 320 px). La grilla ocupa el ancho disponible, hasta 480 px.

### 6.4 Carga

- **Al cambiar de idioma:** aparece "cargando…" mientras se baja y se parsea `words/{lang}.json` (~1 MB comprimido en `es`).
- **Caché:** la caché HTTP del navegador lo guarda para las visitas siguientes.

## 7. Estado (`localStorage`)

| Clave | Contenido |
|---|---|
| `wordini:lang`, `wordini:muted`, `wordini:help-seen` | igual que ahora |
| `wordini:{lang}` | `{ level, sig, found: string[], goldLeft: number[], passed: boolean, ms: number }` |

- **`sig`:** las letras de la cancha concatenadas. Si al cargar no coincide con la cancha generada (porque cambiaron las listas), se reinicia el progreso del nivel y se conserva el número de nivel.
- **Puntos:** se calculan a partir de `found`; no se guardan.
- **`ms`:** tiempo de juego acumulado del nivel (§2.4.1). Se guarda con cada palabra nueva, al ocultarse la pestaña (`visibilitychange`), al cerrar (`pagehide`) y al cambiar de idioma. Si una partida guardada no lo tiene, arranca en 0.
- **Formato del criptex:** si el objeto guardado no tiene `level`, se descarta.
- **Fallas:** se mantiene el acceso tolerante a fallos (`try/catch`, juego sin persistencia).

## 8. Tests

Se corren con `node --test`, sin dependencias.

- **`test/board.test.js`:**
  - **Determinismo:** el mismo `(lang, level)` da letras, doradas y umbral idénticos.
  - **Generación:** los niveles 1 a 200 de cada idioma se generan sin agotar los rechazos y cumplen los mínimos de §4.3.
  - **Solver con verificación independiente:** en una muestra de canchas, se busca cada palabra de `common` con una búsqueda letra por letra (otra implementación) y el resultado tiene que coincidir con las comunes del solver.
  - **Doradas:** cada dorada tiene ≥ 3×k comunes que pasan por ella.
  - **Umbral:** `0 < threshold ≤ commonPoints`.
  - **`pathFor`:**
    - devuelve un camino de vecinas sin casillas repetidas;
    - pasa por la dorada cuando hay una alternativa que la incluye;
    - devuelve `null` si la palabra no se puede armar.
  - **Rendimiento:** `createBoard` tarda < 50 ms en promedio en los niveles 11 a 60.
  - **Puntos:** la tabla de §2.2.
- **`test/game.test.js`:** trazado (`step`), palabra corta, inválida, repetida (también por otro camino), descuento de doradas y nivel superado una sola vez.
- **`test/words.test.js`:** cada lista del JSON está ordenada según `<` de JS (Ñ incluida), tiene palabras de 3 a 12 letras del alfabeto y `common` está incluida en `valid`.
- **`test/state.test.js`:**
  - guardar y restaurar;
  - `sig` distinta;
  - formato del criptex;
  - `localStorage` roto.
- **`test/share.test.js`:** `formatTime` (0:00, 2:31, 1:02:31) y el texto de §2.5.
- **`test/i18n.test.js`:** igual que ahora.
- **Interfaz:** se prueba jugando en celular y en escritorio. Hay que probar especialmente las diagonales con el dedo.

## 9. Archivos

```
index.html, style.css     # reescritos sobre la base neón actual
js/board.js               # NUEVO: PRNG, solver, createBoard, pathFor, points (reemplaza js/puzzle.js)
js/game.js                # NUEVO: reglas de la partida sin DOM (step, play, score)
js/main.js                # reescrito: trazado, teclado, modales
js/state.js               # adaptado: progreso por nivel; se van rachas y estadísticas
js/share.js               # adaptado: texto por nivel
js/fx.js                  # se reutiliza y se agregan tic con tono, campanita de dorada y acorde
js/i18n.js                # textos nuevos, mismas reglas
tools/build_words.py      # reescrito: expansión Hunspell + comunes
tools/levels.mjs          # NUEVO: estadísticas de niveles para calibrar
test/board.test.js        # reemplaza puzzle.test.js
test/game.test.js, test/words.test.js   # NUEVOS
```

- Se borran `js/puzzle.js`, `test/puzzle.test.js`, `dayNumber` y `LAUNCH_DATE`.
- **`CREDITS.md`:** `valid` es una derivación directa de los diccionarios Hunspell, así que se citan sus licencias (además de `wordfreq` CC BY-SA 4.0 por `common`).

## 10. Fuera de alcance (v1)

- Estrellas por nivel.
- Pistas.
- Volver a niveles anteriores.
- Desafío diario.
- Ranking o backend.
- PWA u offline.
- Más idiomas.
