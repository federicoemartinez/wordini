# Canchas grandes y con forma — Diseño

**Fecha:** 2026-11-19
**Estado:** diseño aprobado en la conversación el 2026-11-19; falta revisar esta spec.
**Revisa:** `2026-11-09-wordini-grilla-design.md` §2.1 ("5×5 es el tope"); ver §8.

## 1. Objetivo

Sumar variedad a la progresión, como las otras mecánicas por nivel (doradas desde el 4, candado desde el 15,
giro desde el 20, letras al revés desde el 30, ? desde el 35). Desde el **nivel 40**, algunas canchas son más
grandes o tienen forma. No todas: la mayoría sigue siendo el 5×5 de siempre.

**Criterio de éxito:**
- una cancha con forma se entiende sin explicación: se ve y se juega igual;
- en un celular de 360 px de ancho se pueden trazar diagonales en todas las formas;
- ninguna cancha cuadrada cambia: los niveles 1-39 y los 5×5 del 40 en adelante son idénticos a master.

## 2. Qué sale en cada nivel

Hasta el 39, nada cambia. Desde el 40 (`SHAPE_FROM = 40`), un sorteo **con su propio PRNG**
(`mulberry32(fnv1a(`${lang}:${level}:shape`))`) elige:

| Probabilidad | Cancha |
|---|---|
| 50% | 5×5, como hoy |
| 25% | 6×6 lleno |
| 25% | una de las 6 formas de §3, con la misma probabilidad cada una |

El PRNG aparte es lo que deja las demás canchas quietas. Si la forma se sorteara con el `rand` de las letras, se
correría toda la secuencia y cambiarían todas las canchas del 40 en adelante, también las 5×5; quien tuviera un
nivel a medio jugar perdería el progreso (la firma guardada ya no coincidiría).

## 3. Formas

Todas se dibujan como **máscara sobre una grilla cuadrada** (`#` casilla, `.` hueco) y son simétricas ante las 8
simetrías del cuadrado. Por eso la cancha gira (`turnCell`) sigue andando sin cambios.

| Nombre | Grilla | Casillas | Máscara |
|---|---|---|---|
| `tilt` (rombo girado) | 5×5 | 25 | lleno; en pantalla va girado 45° (§6.2) |
| `diamond` (rombo escalonado) | 7×7 | 25 | `...#...` `..###..` `.#####.` `#######` `.#####.` `..###..` `...#...` |
| `spikes` (picos en los costados) | 7×7 | 29 | `...#...` `.#####.` `.#####.` `#######` `.#####.` `.#####.` `...#...` |
| `cross` (cruz) | 6×6 | 20 | `..##..` `..##..` `######` `######` `..##..` `..##..` |
| `octagon` (octógono) | 6×6 | 24 | `..##..` `.####.` `######` `######` `.####.` `..##..` |
| `donut` (dona) | 6×6 | 32 | `######` `######` `##..##` `##..##` `######` `######` |

Mediana de 40 canchas al azar sin filtrar (palabras comunes / puntos de las comunes), para tener una idea:

| | 5×5 | 6×6 | diamond | spikes | cross | octagon | donut |
|---|---|---|---|---|---|---|---|
| es | 113 / 349 | 180 / 551 | 113 / 304 | 149 / 431 | 63 / 144 | 92 / 278 | 101 / 239 |
| en | 102 / 236 | 176 / 439 | 84 / 173 | 134 / 308 | 61 / 112 | 91 / 198 | 103 / 201 |

Resolver cualquiera tarda menos de 16 ms. La dona rinde menos que el 5×5 aunque tiene más casillas, porque el
hueco corta los caminos largos.

`tilt` usa las mismas letras que habría tenido el 5×5 de ese nivel: es la misma cancha dibujada de otra manera, y
conserva el progreso guardado.

## 4. Generación (`js/board.js`)

- El catálogo `SHAPES` va en `board.js`, escrito como en la tabla de §3 (arrays de strings).
- La cancha sigue teniendo `size` (el lado de la grilla) y `letters` de largo `size × size`, con **`null` en los
  huecos**. Se agrega `board.shape`: `'square'` o el nombre de la forma.
- Las letras se sortean con el `rand` de siempre, solo en las casillas de la máscara.
- `solve` no arranca recorridos desde un hueco (si no, haría `s += null` y buscaría "null…" en el diccionario).
  `pathFor` ya rechaza los huecos porque `null` no coincide con ninguna letra. `neighbors(size)` no cambia.
- `pickFlipped` saltea los huecos: hoy `flipsOf(null)` devolvería las dos formas de dar vuelta y un hueco podría
  salir "al revés". Doradas, ? y candado no necesitan cambios: un hueco tiene 0 comunes y nunca califica.
- `turnBoard` no cambia: como la máscara es simétrica, los huecos caen en huecos.

## 5. Umbral y mínimos

- **Mínimo de comunes:** 4×4 sigue en 25, y 5×5 y `tilt` en 50 (`tilt` es la misma cancha que el 5×5). El 6×6 y
  las formas con huecos piden `2 × casillas`.
- **Palabra larga:** 7 letras, igual que en 5×5.
- **Umbral:** `ceil(pct(level) × puntos de las comunes × min(1, √(25 / casillas)))`. Es un punto intermedio
  (decisión del usuario) entre pedir el mismo porcentaje y pedir el mismo esfuerzo que un 5×5. El 6×6 queda en
  ~1,3× un 5×5 (en vez de ~1,6×), los picos en ~1,15×, y todo lo de 25 casillas o menos queda como hoy.

## 6. Pantalla (`js/main.js`, `style.css`)

### 6.1 Huecos

- Cada hueco es un `<div class="hole">` vacío, sin `.tile`. La grilla CSS mantiene las posiciones sola, y como el
  toque busca `closest('.tile')`, un hueco no se puede marcar. `game.js` no cambia: `step()` usa adyacencia
  geométrica y un hueco nunca entra en un camino.
- Tamaño de casilla y de letra siguen saliendo de `--n` (el lado de la grilla). El espacio entre casillas pasa a
  `min(.5rem, 2.5rem / var(--n))`: en 4×4 y 5×5 queda igual, y se achica un poco en 6 y 7 de ancho.

### 6.2 Rombo girado (`tilt`)

- `#board.tilt` lleva la propiedad suelta `rotate: 45deg`, **no** `transform`. `fx.turn()` anima `transform` en el
  tablero y en cada casilla, y `.tile.on` usa `transform: scale()`. Las propiedades sueltas se componen con
  `transform` en vez de pisarlo.
- Todas las letras pasan a ir en un `<span>` (hoy solo las de "al revés"). En `tilt`, el span y la insignia de
  las doradas llevan `rotate: -45deg` para quedar derechos.
- El tablero se achica √2 y deja margen, para que las puntas no se salgan del lugar que ocupa hoy.
- La línea del trazo (SVG adentro de `#board`) y las flechas de la pista (por fila y columna, adentro de cada
  casilla) giran con el tablero sin cambios.

### 6.3 Toque

`tileAt()` mide el círculo de toque con `tile.offsetWidth` (el tamaño sin transformar) en vez de
`getBoundingClientRect().width`. En una casilla girada el rectángulo es √2 más grande y el círculo agarraría a las
vecinas. Con casillas normales da lo mismo.

### 6.4 Aviso

Las formas no cambian ninguna regla, así que **no hay aviso emergente**. Va una línea nueva en "Cómo se juega",
en es/en/fr: "Desde el nivel 40 la cancha puede ser más grande o tener forma."

## 7. Lo que no cambia

- `game.js` (trazado, jugadas, pista, giro).
- El duelo: usa el nivel `BIG_FROM`, que siempre es 5×5.
- El texto para compartir: no dibuja la cancha.
- Las canchas 1-39 y las 5×5 del 40 en adelante.

## 8. Riesgos

- **Diagonales en el celular.** La spec de la grilla había puesto el tope en 5×5 por esto. Con 7 de ancho (y en
  `tilt`), en 360 px las casillas quedan de ~40 px (hoy ~59 px). Se prueba con toque emulado (§9), pero la palabra
  final la tiene un celular real. Si no se puede jugar, se sacan `diamond` y `spikes` del sorteo.
- **Otra rama en curso.** `feat/candado-y-contramano` también toca `createBoard` y los sorteos de casillas
  especiales. Esto se implementa arriba de esa rama, o de master cuando se mergee. Al hacerlo, revisar que el
  contramano tampoco elija huecos.

## 9. Pruebas

- `test/board.test.js`:
  - cada forma de `SHAPES` es simétrica: `turnCell` lleva casillas a casillas en las 8 simetrías;
  - en las canchas con forma, los huecos no tienen letra ni son dorados, ?, al revés o candado;
  - `solve` en una grilla armada a mano con huecos;
  - el reparto aproximado del sorteo en los niveles 40-400 (cuántas 5×5, 6×6 y formas).
- Un script descartable compara las canchas 1-200 con master: las cuadradas tienen que dar idénticas.
- `tools/levels.mjs` muestra la forma de cada nivel, para calibrar.
- Recorrido en Chromium sin ventana, con toque emulado en pantalla de 360 px: trazar diagonales en `tilt` y en
  `spikes`, y ver que la cancha gira bien con forma.

## 10. Fuera de alcance

- Formas asimétricas: requerirían elegir solo las simetrías que conservan la máscara en el giro (y en el duelo).
- Grillas hexagonales u otras vecindades.
- Formas en el duelo.
