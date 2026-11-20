# Contramano — Diseño

**Fecha:** 2026-11-19
**Estado:** el usuario acordó el diseño el 2026-11-19. Todavía no está implementado.
**Base:** rama `feat/contramano`, que sale de `feat/candado-y-contramano` (candados; el PR se mergeaba el mismo día — si master ya lo tiene, da igual). Usa `closed`, `pathFor(..., avoid)` y el mensaje de evento de `submit` que agregó el candado.

## 1. Qué es

Durante unas pocas palabras de algunas canchas, toda la cancha se pone **de contramano**: la próxima palabra que vale se lee de atrás para adelante. Para armar SOL hay que trazar L→O→S. Apenas se encuentra esa palabra, todo vuelve a la normal.

Sale del pedido del usuario ("tenés que armar la palabra de atrás para adelante") con dos decisiones suyas. Primero, el modo dura **una palabra y después vuelve**, y **puede tocar varias veces** en una misma cancha. Segundo, los colores tienen que **mostrar que estás en ese modo, sin pasar a negativo ni nada violento para los ojos**.

En el código se llama `wrongWay` para no confundirlo con las "letras al revés" (`flipped`), que ya existen desde el nivel 30 y son otra cosa: solo se dibujan dadas vuelta.

## 2. Reglas

- **Cuándo:** desde el nivel 25 (`WRONG_FROM`), en la mitad de las canchas. Ese nivel queda entre el giro (20) y las letras dadas vuelta (30).
- **Cuántas veces:** de 1 a 3 por cancha. La primera vez es después de la palabra 3 a 6 y cada una de las siguientes llega 4 a 8 palabras después de la anterior. `board.wrongWay` es la lista de esas cantidades, por ejemplo `[4, 10]`.
- **Activo** cuando `board.wrongWay.includes(found.length)`, es decir, después de tantas palabras encontradas.
  - El camino trazado se lee al revés.
  - Las palabras inválidas o repetidas no lo gastan.
  - Al encontrar una palabra que vale, `found.length` sube en uno y el modo se apaga solo.
  - **No hay que guardar nada:** sale de las palabras encontradas, igual que el candado, y sobrevive a una recarga.
- **No traba:** el camino al revés de cualquier camino también es un camino, así que las palabras que se pueden armar son las mismas. Además, un candado se esquiva igual en los dos sentidos.
- **No coincide con un candado:** si una cantidad de `wrongWay` es igual al `at` de un candado, se corre a la palabra siguiente. Así no se juntan dos sorpresas en la misma palabra.
- **Teclado:** se escribe en el orden en que se traza. Para SOL se escribe "LOS". No hace falta código nuevo para esto: el camino del texto escrito pasa por `read()` igual que el trazado con el dedo.
- **Pista:** no cambia. Muestra la palabra al derecho y el jugador la traza desde el final. Como siempre, nunca pasa por candados que no estén abiertos.
- Puede tocar también después de pasar el nivel. No molesta: el reloj ya paró.

## 3. Cómo se ve

- **Color:** mientras dura el modo, el brillo cian de las casillas pasa en 0,6 s a un **coral neón** `#ff8a3d`, con el mismo brillo y sin parpadeo. Al terminar vuelve al cian con la misma transición.
  - Solo cambia `#board`: los botones, el nivel y la barra siguen en cian.
  - Las doradas, los ?, los candados y el trazo (magenta) mantienen su color.
  - La variable se registra con `@property --cyan { syntax: '<color>'; inherits: true; initial-value: #00e5ff; }` y la transición va en `#board`. Así se anima la variable y no las propiedades de cada casilla, y el resaltado del trazo sigue siendo inmediato.
  - El brillo interior de `.tile` está escrito a mano en cian (`inset 0 0 10px #00e5ff33`). Hay que pasarlo a `color-mix(in srgb, var(--cyan) 20%, transparent)` para que también cambie.
- **Mensaje:** al empezar el modo aparece `PALABRA · ↩ ¡Contramano!`, cada vez, como el "¡El tablero giró!".
  - Tiene que ser corto: con el candado vimos que un texto largo ocupa tres líneas y empuja el tablero hacia abajo.
  - en: `↩ Wrong way!` · fr: `↩ À contresens !`
- **Sonido:** `fx.wrongWay()`, el arpegio de `good()` pero bajando.
- **Palabra en vivo:** mientras se traza, la palabra de arriba se muestra en orden de lectura (`read(path)`), así que se va armando de derecha a izquierda.
- **Ayuda** (`help7`; también va un `<li data-t="help7">` en `index.html`):
  - es: "A veces la cancha se pone de contramano ↩ y cambia de color: la próxima palabra se traza de atrás para adelante, empezando por la última letra. Después vuelve a la normal."
  - en: "Sometimes the board goes wrong way ↩ and changes color: trace the next word backwards, starting from its last letter. Then it's back to normal."
  - fr: "Parfois la grille passe à contresens ↩ et change de couleur : trace le mot suivant à l'envers, en partant de la dernière lettre. Ensuite tout redevient normal."
- No hace falta un aviso aparte que salga una sola vez: el mensaje de cada vez ya cumple ese papel, y la explicación larga queda en la ayuda.

## 4. Código

- **`js/board.js`**
  - `const WRONG_FROM = 25;`.
  - `pickWrongWay(rand, level, lockAts)` se llama **después** de `pickLocks`. Solo usa `rand` desde `WRONG_FROM`; de esa forma no cambia ninguna cancha anterior y las letras, doradas, ?, letras dadas vuelta y candados quedan iguales.
  - El campo nuevo es `wrongWay: number[]`. `turnBoard` no se toca, porque son cantidades y no casillas.
- **`js/game.js`**
  - `export const read = (board, found, path) => (board.wrongWay.includes(found.length) ? [...path].reverse() : path);`
  - `play()` arma la palabra con `wordOf(board, read(board, progress.found, path))`. Las doradas se cuentan con `path` y dan lo mismo, porque son las mismas casillas.
- **`js/main.js`**
  - En `submit`: la palabra y `shownWord` se calculan con `read` **antes** de `play`, porque `play` cambia `found.length`.
  - Después de `play`: `started = board.wrongWay.includes(game.found.length)`. Si empezó, se agrega `t(lang, 'wrongWay')` al mensaje del evento (va con los otros, unidos con `' · '`) y suena `fx.wrongWay()`.
  - En `render()`: `$('#board').classList.toggle('wrong-way', board.wrongWay.includes(game.found.length))`.
  - En `renderPath()`: la palabra en vivo es `shownWord(read(board, game.found, path))`.
- **`style.css`**
  - `--coral: #ff8a3d` en `:root`.
  - `@property --cyan`.
  - `#board { transition: --cyan .6s; }` y `#board.wrong-way { --cyan: var(--coral); }`.
  - El brillo interior con `color-mix`.
- **`js/i18n.js`:** las claves `wrongWay` y `help7` en los 3 idiomas. `test/i18n.test.js` ya controla que estén en todos.

## 5. Tests y verificación

- **`test/board.test.js`**, en el test de niveles 1-200:
  - antes del 25, `wrongWay` está vacío;
  - después tiene de 1 a 3 valores en orden creciente: el primero entre 3 y 6 y la distancia entre uno y el siguiente entre 4 y 8, o hasta 9 si hubo que correrlo por un candado;
  - ningún valor coincide con el `at` de un candado;
  - tiene contramano más o menos la mitad de las canchas desde el 25.
- **`test/game.test.js`**, con el tablero de prueba (CASA / MORS):
  - `read` da vuelta el camino solo cuando el modo está activo;
  - con `wrongWay: [0]`, el camino de ROMA `[6, 5, 4, 1]` encuentra **AMOR**, y después el mismo camino da ROMA;
  - una palabra inválida en contramano no gasta el modo.
- **Que ninguna cancha cambie:** comparar las canchas 1-200 de es/en/fr contra master. Un script chico que llame a `createBoard` y guarde `letters`, `gold`, `hidden`, `flipped`, `locks`, `threshold` y `commonCount` en JSON, uno antes y otro después; tienen que dar iguales.
- **En el navegador** (Chromium headless con playwright-core, o a mano):
  - buscar con `node` un nivel en español que tenga `wrongWay`;
  - jugar hasta esa cantidad de palabras y comprobar que el tablero toma la clase `wrong-way` y cambia de color, que aparece el mensaje, que la palabra en vivo se lee al revés, que vale una palabra trazada desde el final y que el color vuelve al cian.
  - Para saltar a un nivel hay una página auxiliar **fuera del repo**, que se sirve junto al juego en el mismo origen: guarda `localStorage['wordini:es'] = '{"level":N}'` y `wordini:lang`, y redirige a `./`. Además hay que marcar `wordini:help-seen`, porque si no el diálogo de ayuda se queda con el teclado.

## 6. Fuera de alcance

- **Sílaba** (QUE, LA, ON en una casilla) y **comodín**: descartados por ahora, porque cambian las letras y con eso las canchas desde su nivel.
- Idea para cuando haya 3 o 4 rarezas: que cada cancha sortee 1 o 2 de las que ya se desbloquearon en vez de acumularlas todas.
