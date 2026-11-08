# Wordini — Diseño

**Fecha:** 2026-11-08
**Estado:** aprobado en brainstorming, pendiente de revisión escrita

## 1. Objetivo

Puzzle diario de palabras, adictivo y compartible, con el formato que hizo exitoso a Wordle: un puzzle por día, el mismo para todos, partidas de pocos minutos y un resultado compartible sin spoilers. La mecánica es propia: una **cerradura tipo criptex**. El jugador elige el idioma (español, inglés, francés al lanzar). Sitio 100% estático, sin backend.

**Criterio de éxito:** un jugador nuevo entiende las reglas en una partida, termina en menos de 5 minutos y quiere compartir el resultado.

## 2. Reglas del juego

### 2.1 La cerradura

- 5 anillos (columnas). Cada anillo tiene 10 letras en orden cíclico: `L[0..9]`.
- Cada anillo tiene un **offset** `o ∈ [0, 10)`. La ventana muestra 3 filas: `L[o]`, `L[(o+1)%10]`, `L[(o+2)%10]`.
- Se ven además `L[(o-1)%10]` arriba y `L[(o+3)%10]` abajo, atenuadas. Las otras 5 letras del anillo no se ven.
- Girar hacia arriba: `o = (o+1)%10`. Girar hacia abajo: `o = (o+9)%10`.

### 2.2 Solución

- Hay exactamente **una** combinación de offsets en la que las 3 filas de la ventana forman 3 palabras de la lista `valid` del idioma. El generador lo garantiza (§4.4).
- En esa combinación, las 3 palabras salen de la lista `answers`.
- Si el jugador alinea 3 palabras válidas, es la solución.

### 2.3 Intentos

- El jugador gira libremente y toca **Abrir**. Cada anillo en su offset correcto se pone verde y **queda trabado**: ya no se puede girar.
- Máximo 6 intentos.
- **Abrir** está deshabilitado si la combinación actual es idéntica a la de un intento anterior.
- **Victoria:** todos los anillos verdes. Se muestran las 3 palabras.
- **Derrota:** 6 intentos sin abrir. Los anillos se animan hasta la solución y se muestran las 3 palabras.
- **Estado inicial:** ningún anillo arranca en su offset correcto.

### 2.4 Puzzle diario

- Hay un puzzle por par (idioma, día).
- El día es el número de días transcurridos desde `LAUNCH_DATE` según la fecha **local** del jugador. Cambia a medianoche local.
- El número visible es `#N = día + 1`.

### 2.5 Compartir

Texto, con un ejemplo de victoria en 3 intentos:

```
Wordini 🇫🇷 #42 3/6
🟩⬜⬜🟩⬜
🟩🟩⬜🟩⬜
🟩🟩🟩🟩🟩
https://<origen>/?l=fr
```

- En caso de derrota, el encabezado dice `X/6`.
- Cada línea es un intento: 🟩 si el anillo estaba correcto en ese intento, ⬜ si no.
- La URL lleva el idioma, así quien la abre juega el mismo puzzle. `<origen>` es `location.origin + location.pathname`.
- En móvil se usa `navigator.share`. Donde no exista, `navigator.clipboard.writeText` con el aviso "¡Copiado!".

## 3. Idiomas y datos

### 3.1 Idiomas al lanzar

| Código | Alfabeto | Bandera |
|---|---|---|
| `es` | A–Z + Ñ (27 letras) | 🇪🇸 |
| `en` | A–Z (26) | 🇬🇧 |
| `fr` | A–Z (26) | 🇫🇷 |

Para agregar un idioma: correr el script de datos con sus fuentes, agregar sus textos en `i18n.js` y sumarlo al selector. El motor no cambia.

### 3.2 Fuentes

- **Frecuencia:** paquete Python `wordfreq` 3.x (código Apache-2.0, datos CC BY-SA 4.0). Se usa solo en el script de datos, no en el sitio.
- **Diccionario:** Hunspell `.dic` del repo `LibreOffice/dictionaries`:
  - `es/es_ES.dic` (licencias GPL/LGPL/MPL);
  - `en/en_US.dic`;
  - `fr_FR/dictionaries/fr.dic` (MPL 2.0).
- **Lista de bloqueo:** "List of Dirty, Naughty, Obscene and Otherwise Bad Words" (LDNOOBW, CC BY 4.0), archivos `es`, `en`, `fr`. Se guarda en `tools/blocklist/{lang}.txt` y se puede editar a mano.
- Las atribuciones de licencias van en `CREDITS.md` y en un enlace del pie del sitio.

### 3.3 Normalización (por palabra)

1. Pasar a minúsculas. En `es`, reemplazar `ñ` por un marcador temporal.
2. Normalizar a NFD y eliminar las marcas diacríticas combinantes. `é` pasa a `e`, `ç` a `c`.
3. Restaurar `ñ` en `es` y pasar a mayúsculas.
4. Descartar la palabra si tiene caracteres fuera del alfabeto del idioma (por ejemplo `œ`, `ß`, guiones o apóstrofos).
5. Eliminar duplicados.

### 3.4 Listas resultantes

- **`valid`:** palabras de 5 letras, ya normalizadas, que estén entre las 200.000 más frecuentes de `wordfreq`, más todas las de `answers`.
  - Solo se usa para verificar que la solución sea única. El jugador nunca escribe palabras.
  - Si incluye palabras raras o ruido, el generador se vuelve más estricto. Ese error es el seguro.
- **`answers`:** palabras de 5 letras, normalizadas, que cumplan tres condiciones:
  - aparecen como raíz en minúscula en el `.dic` de Hunspell (se toma la parte antes de `/` en cada línea). Así quedan afuera los nombres propios, que en el `.dic` van con mayúscula, y la mayoría de los plurales y conjugaciones, igual que en las respuestas de Wordle;
  - no están en la lista de bloqueo;
  - están en `valid`.

  De las candidatas que cumplen esas condiciones se toman las 2.000 con mayor frecuencia en `wordfreq`. La raíz se normaliza antes de comparar.
- **Salida:** `words/{lang}.json` = `{ "alphabet": "...", "answers": [...], "valid": [...] }`, con las listas ordenadas alfabéticamente.
  - El orden importa: el generador depende de él para ser determinista.
  - Cambiar las listas cambia los puzzles futuros. Se acepta: los puzzles pasados no importan.

### 3.5 Script de datos

`tools/build_words.py <lang>`:
- descarga el `.dic` y la lista de bloqueo, o los lee de `tools/sources/` si ya están;
- consulta `wordfreq` y escribe `words/{lang}.json`;
- se corre una vez por idioma, o cuando se quiera cambiar las listas;
- `wordfreq` se instala en un entorno virtual (`tools/.venv`), que no se commitea.

## 4. Generación del puzzle (en el navegador)

Todo vive en `js/puzzle.js`. Se generan en el cliente los puzzles de cualquier fecha.

### 4.1 Azar determinista

- La semilla es el hash FNV-1a de 32 bits del texto `` `${lang}:${day}` ``.
- El generador es `mulberry32(seed)`, que devuelve floats en `[0, 1)`.
- `Math.random` no se usa nunca.
- Todo el azar se consume siempre en el mismo orden, así que la misma (idioma, día) produce el mismo puzzle en cualquier navegador.

### 4.2 Elección de palabras

Se eligen 3 índices al azar en `answers`. Si un índice repite uno ya elegido, se vuelve a sortear.

### 4.3 Armado de anillos

- Para cada columna `i`, el anillo recibe el trío `w1[i], w2[i], w3[i]` en posiciones consecutivas `p, p+1, p+2` (módulo 10), con `p` al azar en `[0, 10)`.
- Las otras 7 posiciones se rellenan con letras del alfabeto, sorteadas con peso según la frecuencia de cada letra en `valid`. La frecuencia se calcula una vez por idioma.
- El offset correcto del anillo `i` es `p`.

### 4.4 Control de solución única

- Se recorren las combinaciones de offsets anillo por anillo, en profundidad.
- Cada rama se poda cuando alguna de las 3 filas parciales no es prefijo de ninguna palabra de `valid`. Para eso se precalcula un `Set` de prefijos por idioma.
- Se cuentan las combinaciones completas en las que las 3 filas están en `valid`. El conteo es por **offsets**, no por palabras, así que un trío repetido dentro de un anillo cuenta como una segunda solución.
- El puzzle se acepta solo si el conteo es exactamente 1.
- **Reintentos:**
  - Si el conteo no es 1, se sortea de nuevo el relleno, hasta 20 veces por cada terna de palabras.
  - Agotados esos 20, se eligen otras 3 palabras.
  - Con 200 ternas fallidas en total, se lanza un error. Los tests (§8) garantizan que no ocurra.

### 4.5 Posición inicial

Cada anillo `i` arranca en un offset sorteado entre los 9 incorrectos.

### 4.6 Número de día

```js
dayNumber(date) = (Date.UTC(y, m, d) - Date.UTC(LAUNCH_Y, LAUNCH_M, LAUNCH_D)) / 86400000
```

- `y, m, d` son el año, el mes y el día **locales** de `date`.
- Pasar por `Date.UTC` evita el error de los días de 23 o 25 horas por cambio de horario.
- `LAUNCH_DATE` es una constante en `js/puzzle.js`. Su valor es la fecha del primer deploy público.
- Para fechas anteriores al lanzamiento, el día es 0.

### 4.7 API del módulo

```js
createPuzzle(lang, day, words) → {
  rings: string[][],          // 5 × 10 letras
  start: number[],            // 5 offsets iniciales
  check(offsets) → boolean[], // 5 bools: anillo correcto
  reveal() → { offsets: number[], words: string[] } // solo tras fin de partida
}
dayNumber(date) → number
```

La solución vive en el closure. No se exporta como dato.

## 5. Interfaz

### 5.1 Pantalla (una sola página)

- **Encabezado:** logo "WORDINI", selector de idioma (`<select>` con banderas), botón de estadísticas, botón de ayuda y botón de silencio.
- **Cerradura:** 5 anillos lado a lado, con la ventana de 3 filas marcada por un marco con brillo.
- **Historial:** una fila 🟩⬜ por intento.
- **Botón Abrir:** indica los intentos restantes ("ABRIR · 4").
- **Modales:**
  - Ayuda: se abre sola en la primera visita. Tiene 3 pasos y un ejemplo.
  - Estadísticas: se abre al terminar la partida. Muestra jugadas, % de victorias, racha actual, mejor racha, distribución de intentos 1–6 y el botón Compartir.

### 5.2 Controles

- **Arrastre vertical** sobre un anillo, con pointer events. Cada vez que el arrastre recorre la altura de una letra, el anillo avanza un paso. Al soltar, el anillo encaja en la letra más cercana.
- **Botones ▲▼** en cada anillo.
- **Teclado:**
  - ←/→ eligen el anillo, que se marca con foco visible;
  - ↑/↓ lo giran;
  - Enter es Abrir.
- Los anillos trabados ignoran todos los controles.

### 5.3 Estética: arcade neón

- **Paleta** (como variables CSS en `:root`):

  | Variable | Valor | Uso |
  |---|---|---|
  | `--bg` | `#0b0b14` | fondo |
  | `--cyan` | `#00e5ff` | acento |
  | `--magenta` | `#ff2bd6` | acento |
  | `--green` | `#39ff88` | anillo correcto |
  | `--dim` | `#3a3a55` | ⬜ e inactivos |

- **Fuente:** Bungee, desde Google Fonts.
- **Brillo:** `text-shadow` y `box-shadow` apilados: 2–3 sombras del mismo color, cada una más difusa.
- **Anillos:**
  - son tiras 2D movidas con `transform: translateY` y una transición con un leve rebote;
  - `mask-image: linear-gradient(transparent, #000 30%, #000 70%, transparent)` desvanece las filas de los extremos;
  - un degradado superpuesto simula la curvatura de un cilindro.
- **Anillo trabado:** borde y letras en `--green` con brillo, y un ícono 🔒 sobre el anillo. El estado no depende solo del color.
- **Victoria:**
  - los anillos se iluminan en secuencia;
  - suena la apertura;
  - `canvas-confetti` 1.9.4 (ISC) dispara confetti con los colores de la paleta. Se importa como módulo ES desde jsDelivr, con la versión fijada.
- **Sonidos:**
  - clic al pasar cada letra, clack al tocar Abrir, apertura al ganar;
  - archivos `.ogg` del pack "Interface Sounds" de Kenney (CC0), en `sounds/`;
  - se reproducen con `new Audio()`;
  - el botón de silencio guarda su estado.
- **Vibración:** `navigator.vibrate(10)` al pasar cada letra, solo donde existe (Android).
- **`prefers-reduced-motion: reduce`:** sin confetti, sin rebote y sin animación de la derrota (los anillos saltan directo a la solución).
- **Responsive:**
  - diseñado primero para celular (≥ 320 px de ancho);
  - en escritorio, centrado con un ancho máximo de 480 px.

### 5.4 Textos de la interfaz

- `js/i18n.js` exporta `{ es: {...}, en: {...}, fr: {...} }`.
- Si falta una clave en un idioma, se usa la del inglés.

### 5.5 Elección de idioma

Prioridad:
1. el parámetro `?l=`;
2. `wordini:lang` guardado;
3. `navigator.language` si es un idioma soportado;
4. `en`.

Al cambiar de idioma:
- se carga `words/{lang}.json` con `fetch`;
- se carga el estado de ese idioma;
- se re-renderiza la pantalla.

## 6. Estado (`localStorage`)

| Clave | Contenido |
|---|---|
| `wordini:lang` | último idioma elegido |
| `wordini:muted` | `true`/`false` |
| `wordini:help-seen` | `true` después de la primera visita |
| `wordini:{lang}` | `{ day, offsets, attempts: boolean[][], status: "playing"\|"won"\|"lost", stats }` |

- **`stats`:** `{ played, won, streak, maxStreak, lastWinDay, dist: [6 números] }`.
- **Racha:**
  - una victoria en el día `d` con `lastWinDay === d-1` suma 1 a la racha; si no, la racha pasa a 1;
  - una derrota la pone en 0.
- **Partida guardada:** si su `day` no es el de hoy, se descarta la partida pero se conservan las estadísticas.
- **La solución no se guarda nunca.**
- Todo acceso a `localStorage` va en `try/catch`. En modo privado o si falla, el juego funciona sin persistencia.

## 7. Que la solución no quede a la vista

Es imposible ocultar la solución de verdad en un juego que corre en el navegador, y no se intenta. Se evita solo que alguien la vea por casualidad:

- en el HTML, nada indica qué anillo u offset es correcto;
- no aparece en `localStorage`;
- no hay variables globales con la solución, que vive en el closure de `createPuzzle`.

Un modo competitivo con ranking requeriría validar en un servidor. Queda fuera de alcance (§9).

## 8. Tests

Se corren con `node --test` (incluido en Node, sin dependencias):

- **`test/puzzle.test.js`:**
  - **Determinismo:** dos llamadas a `createPuzzle` con el mismo idioma y día dan anillos y posición inicial idénticos.
  - **Generación sin errores:** los días 0–364 de `es`, `en` y `fr` se generan sin agotar los reintentos.
  - **Solución única (verificación independiente):** para los días 0–29 de cada idioma, una búsqueda por fuerza bruta **sin poda** sobre los 10⁵ offsets encuentra exactamente una solución, y coincide con `reveal().offsets`. Se limita a una muestra porque la fuerza bruta cuesta alrededor de 0,1 s por puzzle.
  - **Posición inicial:** `check(start)` devuelve los 5 valores en `false`.
  - **Respuestas:** las 3 palabras de `reveal().words` están en `answers`.
  - **Rendimiento:** `createPuzzle` tarda menos de 100 ms, con un promedio sobre 365 días.
  - **`dayNumber`:**
    - fechas consecutivas dan días consecutivos, también alrededor de los cambios de horario (se prueba con `TZ=America/New_York` y `TZ=Europe/Paris`);
    - 23:59 y 00:01 caen en días distintos.
- **`test/share.test.js`:** el texto para compartir es el esperado para una victoria en 1 intento, una en 3 y una derrota.
- **`tools/build_words.py`:** autochequeo con `assert` al final de cada ejecución:
  - todas las palabras tienen 5 letras del alfabeto del idioma;
  - `answers` está incluido en `valid`;
  - no hay palabras bloqueadas en `answers`;
  - `len(answers) >= 500`.
- **Interfaz:** se prueba jugando el prototipo en celular y escritorio.

Para que la lógica del texto compartido se pueda testear sin el DOM, `js/share.js` exporta la función pura `shareText(lang, n, attempts, won, url)`.

## 9. Fuera de alcance (v1)

- Backend, estadísticas globales, ranking, cuentas.
- Modo difícil (feedback "solo cantidad"), temas y pistas.
- Más idiomas, aunque la arquitectura los soporta sin cambiar el motor.
- Archivo de puzzles pasados y "retá a un amigo" con palabra propia.
- PWA y uso offline.

## 10. Archivos

```
index.html
style.css
js/main.js        # UI, eventos, estado, sonido, modales
js/puzzle.js      # PRNG, generación, check/reveal, dayNumber
js/share.js       # shareText (pura)
js/i18n.js        # textos de la interfaz
words/{es,en,fr}.json
sounds/*.ogg
tools/build_words.py
tools/blocklist/{es,en,fr}.txt
test/puzzle.test.js
test/share.test.js
CREDITS.md
```

Sin bundler ni build: módulos ES nativos. Se publica en cualquier hosting estático (GitHub Pages o Cloudflare Pages).
