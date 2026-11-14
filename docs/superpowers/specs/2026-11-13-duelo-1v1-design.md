# Wordini — Duelo 1 contra 1 — Diseño

**Fecha:** 2026-11-13
**Estado:** aprobada el 2026-11-13. Ajustada con lo que mostraron el emulador de Firebase y un prototipo probado de punta a punta (§4.2, §4.4, §4.5). Ampliada el mismo día, a pedido del usuario, con la semilla que no se repite y el giro a los 2:30 (§2). Ajustada el 2026-11-14 después de que el usuario la probó: palabras al instante (§4.3), stream que se suelta con la pestaña oculta (§4.6b), sala de espera visible y botón para volver a la partida (§3).
**Se apoya en:** `2026-11-09-wordini-grilla-design.md`. La cancha, el trazado, el diccionario y los puntos son los mismos.

## 1. Objetivo

Dos amigos, cada uno con su celu, juegan la misma cancha durante 5 minutos. Cada palabra que marca uno queda bloqueada para el otro, y gana el que suma más puntos.

**Criterio de éxito:**
- Uno toca ⚔️ y le manda el link al otro por WhatsApp. En menos de 30 segundos están jugando.
- Anda con datos móviles, con wifi o con un celu en cada red.
- Si los dos marcan la misma palabra casi al mismo tiempo, gana uno solo y no hay discusión.
- En el repo no queda ninguna credencial de nadie, y nunca puede llegar una factura.

## 2. Reglas del duelo

- **Rival:** un amigo que entra por link. No hay "buscar rival" con desconocidos.
- **Cancha:** de 5×5, sin casillas doradas. Sale del código de la sala y de su hora de creación en el servidor (`duel:K7QX2:1794615810327`), así que es la misma para los dos y no se repite aunque un código se vuelva a usar después de barrer su sala vieja (§5).
- **Giro a los 2:30:** a mitad de partida la cancha gira o se espeja una vez, como desde el nivel 20 (`turnBoard` y `fx.turn`): misma animación, mismo sonido y el cartel "¡El tablero giró!". El giro sale de la sala (`1 + created % 7`), así que es el mismo para los dos y llega al mismo tiempo (hora del servidor). Si había un trazo en curso, se cancela, porque sus casillas cambiaron de lugar. Si el celu abre la sala después de la mitad, la cancha aparece ya girada, sin animación ni cartel.
- **Idioma:** el de quien crea la sala. El que entra juega en ese idioma.
- **Duración:** una cuenta regresiva de 3 s y después **5 minutos exactos**. El reloj no se pausa.
- **Las letras** están tapadas hasta que termina la cuenta regresiva: el que espera al rival no puede ir buscando palabras.
- **Palabras:** valen las mismas que en los niveles (`isValid`) y suman los mismos puntos (`points`). Mínimo 3 letras.
- **Bloqueo:** cada palabra la puede marcar **una sola persona**: la primera que la escribe en el servidor (§4.3).
  - Si intentás una que ya marcó el rival: "🔒 CASA · la marcó tu rival", con el sonido de error. No resta.
  - Si intentás una que ya marcaste vos: el aviso de siempre, "ya la encontraste".
- **Qué ves del rival durante la partida:** su puntaje en vivo (solo los puntos, que es lo que gana: con la cantidad de palabras al lado no se entendía), pero **no cuáles son**. Cuando marca una, su puntaje late y aparece "+N".
- **No hay:** pistas, umbral ni niveles.
- **Resultado:** ganaste, perdiste o empate, según los puntos. Recién ahí se ven las palabras de los dos.
- **Progreso de los niveles:** el duelo no lo toca. El cronómetro del nivel queda pausado mientras dura el duelo.

## 3. Flujo del jugador

1. **Desafiar.** En el header aparece el botón ⚔️, al lado de `?` y 🔊. Al tocarlo:
   - se barren salas viejas (§4.5) y se crea una sala nueva;
   - se abre un diálogo con el link `…/?vs=K7QX2`, el botón **Compartir** (`navigator.share`, con el portapapeles como plan B, igual que `share()` hoy) y, en su propia línea, **"⏳ Esperando a tu rival"** latiendo, con el tiempo que lleva esperando;
   - cuando entra el rival suena `fx.gold` y arranca el 3‑2‑1.
2. **Entrar.** El amigo abre el link:
   - se cargan las palabras del idioma de la sala, aunque su celu esté en otro idioma. Al volver a los niveles recupera el suyo;
   - no se abre la ayuda de la primera visita, porque taparía la cuenta regresiva;
   - si la sala ya tiene dos jugadores: "Esta partida ya empezó";
   - si no existe: "Ese desafío no existe o ya venció".
3. **3‑2‑1.** Apenas entra el segundo, los dos ven la cuenta regresiva en grande y la grilla todavía no responde.
4. **Partida.** El HUD del duelo reemplaza al de los niveles: `⏳ 4:12   TÚ 23   RIVAL 18` (los textos en español usan tú, como el resto del juego). Debajo de la grilla se ven tus palabras. No hay botón para abandonar: son 5 minutos, y para irse alcanza con salir de la página.
5. **Fin.** A los 5:00 la grilla deja de responder y se abre el diálogo de resultado:
   - "🏆 ¡Ganaste 48 a 31!" / "Perdiste 31 a 48" / "Empate 40 a 40";
   - tus palabras y las del rival;
   - botones **Revancha**, **Compartir resultado** y **Volver a los niveles**.
6. **Revancha:**
   - si la sala ya tiene `next`, entrás a esa sala;
   - si no, se crea una sala nueva y se escribe su código en `next` de la vieja. Si en ese instante el rival escribió `next` primero, gana la de él: entrás a la suya y la tuya queda vacía (se barre al día siguiente);
   - el otro, que sigue escuchando la sala vieja, ve "Tu rival quiere revancha → Jugar".
7. **Volver a los niveles:** se cierra la conexión, se saca `?vs=` de la URL (`history.replaceState`) y se vuelve al nivel guardado.
8. **Volver a la sala.** Si se sale por error (Volver, cerrar la pestaña, el sistema que mata la app al ir a WhatsApp), en los niveles aparece arriba **"⚔️ Volver a la partida"** mientras ese duelo esté esperando o en juego; también abrir el mismo link te devuelve a tu lugar: `localStorage["wordini:duel"] = { code: "K7QX2", me: "a" }`. Se guarda solo el último duelo, así no se acumula nada. El tiempo sigue corriendo mientras no estás.
9. **Esc** no cierra los diálogos del duelo: se sale con sus botones. El resultado vuelve a abrirse si se cierra igual, porque después del final no queda nada más por hacer.

## 4. Red: Firebase Realtime Database por REST

### 4.1 Por qué así

- **Firebase Realtime Database, plan Spark:** es gratis y no pide tarjeta. Tiene un tope de 100 conexiones a la vez (unas 50 partidas en simultáneo), 1 GB guardado y 10 GB de descarga por mes. Si se pasa del cupo, el servicio se corta hasta el mes siguiente y no se cobra nada.
- **Descartados:**
  - WebRTC directo (PeerJS o Trystero): con datos móviles y CGNAT falla entre el 20 y el 35% de las conexiones si no hay un TURN, y la partida se pierde si se cae la conexión;
  - Supabase: pausa los proyectos que pasan una semana sin uso.
- **Sin SDK:** escribimos con `fetch` (REST) y escuchamos con `EventSource`, porque Firebase acepta Server-Sent Events y manda eventos `put` y `patch` con `{path, data}`. No se agregan dependencias y se mantiene el sitio estático sin build.
- **Qué queda público:** solo la dirección de la base, en una constante al principio de `js/duel.js`. No hay `apiKey` ni credenciales. Lo que protege los datos son las reglas (§4.2).

### 4.2 Datos y reglas

```
rooms/
  K7QX2/                       código: 5 caracteres de ABCDEFGHJKMNPQRSTUVWXYZ23456789 (sin I, L, O, 0, 1)
    lang:    "es"
    created: <hora del servidor>
    joined:  <hora del servidor>   llegó el segundo jugador; la partida va de joined+3 s a joined+303 s
    t/a, t/b: <hora del servidor>  cada celu la escribe al entrar para calcular su diferencia de reloj (§4.4)
    words/
      CASA:  "a"
      PERRO: "b"
    next:    "M3PZ8"               sala de la revancha
sweep: <una hora de hace más de un día>   ticket para listar salas viejas (§4.5)
```

Las reglas están en `database.rules.json`, en la raíz del repo, y se pegan en la consola:

```json
{
  "rules": {
    "rooms": {
      ".indexOn": "created",
      ".read": "query.orderByChild === 'created' && query.endAt === root.child('sweep').val() && query.limitToFirst <= 20",
      "$code": {
        ".read": true,
        ".write": "data.exists() && !newData.exists() && data.child('created').val() < now - 86400000",
        "created": {
          ".write": "!data.exists()",
          ".validate": "newData.val() === now && $code.matches(/^[A-Z2-9]{5}$/)"
        },
        "lang": {
          ".write": "!data.exists()",
          ".validate": "newData.parent().child('created').exists() && (newData.val() === 'es' || newData.val() === 'en' || newData.val() === 'fr')"
        },
        "joined": {
          ".write": "!data.exists() && data.parent().child('created').exists()",
          ".validate": "newData.val() === now"
        },
        "t": {
          "$p": {
            ".write": "data.parent().parent().child('created').exists() && ($p === 'a' || $p === 'b')",
            ".validate": "newData.val() === now"
          }
        },
        "words": {
          "$w": {
            ".write": "!data.exists()",
            ".validate": "$w.length >= 3 && $w.length <= 25 && (newData.val() === 'a' || newData.val() === 'b') && now >= data.parent().parent().child('joined').val() + 3000 && now <= data.parent().parent().child('joined').val() + 305000"
          }
        },
        "next": {
          ".write": "!data.exists() && data.parent().child('created').exists()",
          ".validate": "newData.isString() && newData.val().matches(/^[A-Z2-9]{5}$/)"
        },
        "$other": {
          ".validate": false
        }
      }
    },
    "sweep": {
      ".write": true,
      ".validate": "newData.isNumber() && newData.val() <= now - 86400000"
    }
  }
}
```

Qué garantizan:
- **La primera escritura gana.** `lang`, `created`, `joined`, `next` y cada palabra se escriben una sola vez. Un tercer jugador no logra escribir `joined`.
- **Las horas las pone el servidor.** `=== now` obliga a mandar `{".sv": "timestamp"}`.
- **No hay palabras fuera de hora.** Se rechazan antes del arranque y después de los 5 minutos, con 2 s de margen para la latencia.
- **No se pueden listar las salas.** Solo las creadas antes del ticket `sweep`, que siempre es de hace más de un día, de a 20 como máximo, y solo para barrerlas (§4.5).
- **Toda sala tiene `created`.** Ningún otro campo se puede escribir sin él. Así no quedan salas sin hora de creación: Firebase las ordenaría primero y trabarían el barrido para siempre.
- **No se puede borrar una sala entera**, salvo que tenga más de un día. Ningún campo se puede pisar ni borrar, salvo `t/a` y `t/b`.

### 4.3 Marcar una palabra

**Suma al instante** (pedido del usuario: "mejor que el juego ande rápido", aunque haya una carrera; antes se esperaba al servidor y tardaba 440–790 ms por palabra, ahora 7–17 ms):

1. **Primero se valida en el celu**, como en los niveles: `short` o `invalid` no van a la red.
2. **Después se mira la sala que ya llegó por `EventSource`:** si `words[w]` es tuya, es repetida; si es del rival, sale 🔒.
3. **Si nadie la marcó todavía, suma ya:** se anota en la sala local, se festeja con `fx.good` y "+N", y por detrás va `PUT rooms/K/words/<w>.json` con el cuerpo `"a"` o `"b"` (la palabra va con `encodeURIComponent` por la Ñ).
   - **200:** listo.
   - **Rechazo de las reglas** (el rival la marcó un instante antes, dentro de lo que tarda el stream, o llegó fuera de hora): se descuenta y sale 🔒.
   - **Error de red o sin respuesta en 8 s:** se descuenta y sale "📶 sin conexión". No se reintenta.

### 4.4 Reloj

- Cada celu calcula una sola vez, al entrar a la sala, la diferencia entre su reloj y el del servidor:
  1. hace `PUT t/<yo>` con `{".sv":"timestamp"}`;
  2. calcula `offset = horaServidor − (envío + recepción) / 2`.
- **Verificado en el emulador:** la respuesta del `PUT` trae la hora ya resuelta.
- **Fases**, con `ahora = Date.now() + offset` y `start = joined + 3000`:
  - `waiting`: todavía no hay `joined`;
  - `countdown`: `ahora < start`;
  - `playing`: hasta `start + 300000`;
  - `over`: después.
- La autoridad es el servidor, que con `now` en las reglas rechaza lo que llega fuera de hora. El reloj del celu es solo para mostrar.

### 4.5 Limpieza de salas

Antes de crear una sala, el celu barre salas viejas:
1. `PUT sweep.json` con `antes = ahora − 1 día − 1 hora` (la hora de margen cubre un reloj adelantado). Las reglas solo aceptan un `sweep` de hace más de un día;
2. `GET rooms.json?orderBy="created"&endAt=<antes>&limitToFirst=20` trae hasta 20 salas viejas;
3. un `PATCH rooms.json` con `{K1: null, K2: null, …}` las borra.

- **Por qué el ticket:** las reglas de Firebase solo comparan `query.endAt` con `==`. Con `<=` rechazan siempre, verificado en el emulador. Por eso la regla de lectura exige `query.endAt === root.child('sweep').val()`, y la regla de `sweep` garantiza que ese valor sea viejo.
- Si dos celus barren al mismo tiempo, uno puede pisar el ticket del otro. Ese segundo `GET` se rechaza y ese barrido se saltea. No pasa nada.
- Las reglas solo permiten exactamente esa lectura y ese borrado.
- La limpieza va al ritmo del uso, así que la base queda acotada sin cron ni servidor.
- **Verificado en el emulador:** el `PATCH` se evalúa sala por sala. Si alguna no se puede borrar, se rechaza todo el `PATCH`.
- Si el barrido falla, no importa: la sala se crea igual.

### 4.6b Una conexión por pestaña visible

Firebase usa HTTP/1.1 y el navegador permite 6 conexiones por servidor, sumando todas las pestañas. Cada `EventSource` ocupa una para siempre: con 6 pestañas de duelos viejos abiertas, la siguiente no recibía nada y sus pedidos quedaban en cola (lo vio el usuario: "RIVAL 0 (0)" en una ventana mientras la otra veía bien; reproducido en Chromium). Por eso el stream se cierra cuando la pestaña queda oculta y se vuelve a abrir al mostrarse; Firebase manda la sala entera al reconectar.

### 4.6 Recortes a propósito

Van marcados con `ponytail:` en el código.
- **No hay login:** alguien con DevTools podría marcar palabras como si fuera el otro, o usar un bot que resuelva la cancha. Para un juego entre amigos se acepta; coincide con que "la solución no se puede ocultar del lado del cliente". Si algún día importa, la solución es el login anónimo de Firebase y las reglas con `auth.uid`.
- **Las palabras del rival viajan al celu** aunque no se muestren hasta el final. Con DevTools se pueden ver.
- **App Check (reCAPTCHA) no se usa.** El peor caso es que se corte el servicio un mes.

## 5. Código

| Archivo | Cambio |
|---|---|
| `js/board.js` | `createBoard(lang, level, words, seed = \`${lang}:${level}\`)`. Se exporta `BIG_FROM`. El duelo llama `{ ...createBoard(room.lang, BIG_FROM, words, \`duel:${code}:${room.created}\`), gold: [] }` y, a los 2:30, `turnBoard(board, turnOf(room))`. |
| `js/duel.js` (nuevo) | **Sin DOM, se puede probar:** `newCode(rand)`, `duelBoard(code, room, words)`, `applyEvent(room, type, {path, data})` (aplica `put` y `patch` sobre el objeto de la sala), `phase(room, now)`, `timeLeft(room, now)`, `halfway(room)` (hora del giro), `turnOf(room)` (simetría 1-7), `scores(room, me)` (devuelve `{mine, theirs}`), `wordsOf(room, who)`, `other(me)`. **Red:** `getRoom(code)`, `create(lang)` (barre y después crea, reintentando si el código ya existe), `join(code)` (devuelve la hora de `joined` o `null`), `clockOffset(code, me)`, `claim(code, word, me)`, `listen(code, onRoom)` (devuelve una función para cerrar el `EventSource`), `rematch(code, lang, next)`, y `setDB(url)` solo para correr el smoke test contra el emulador. |
| `js/main.js` | Estado `duel = { code, me, room, offset, pending }`, o `null` en los niveles. **Al entrar a un duelo:** `stopClock()` del nivel, se arma la cancha del duelo y se reutiliza `renderBoard()`. **Durante el duelo:** `submit()` va por §4.3; `render()` muestra `#duel-hud` y oculta el HUD de los niveles, las pistas y el selector de idioma; el trazado y el teclado no responden fuera de `playing`; `renderClock()` también maneja el 3‑2‑1, el tiempo que queda y el pase a `over`. **Al arrancar:** se lee `?vs=`. |
| `index.html`, `style.css` | El botón ⚔️ en el header, `#duel-hud`, `#dlg-duel` (link, Compartir, "Esperando rival…" y los errores), `#dlg-duel-end` (resultado, palabras de los dos y botones), y el estilo grande del 3‑2‑1 en `#word`. |
| `js/i18n.js` | Textos nuevos en es/en/fr: desafiar, esperando, sin sala, partida empezada, sin conexión, bloqueada, vos, rival, ganaste/perdiste/empate, revancha, el rival quiere revancha, jugar, volver, tus palabras, sus palabras. |
| `js/share.js` | `duelText(lang, mine, theirs, url)`: `Wordini ⚔️ 🇪🇸 · 🏆 48–31` (o 💀 / 🤝) y el link al juego, sin palabras. |
| `database.rules.json` (nuevo) | §4.2. |
| `tools/duel-smoke.mjs` (nuevo) | §7. |
| `README.md` | Cómo se crea la base y se publican las reglas (§8). |
| `sw.js` | Sin cambios: ya deja pasar los pedidos a otros dominios. |

**Convivencia con lo que entró a `master` mientras tanto** (mergeado en `feat/duelo`):
- La cancha que gira desde el nivel 20: el duelo reutiliza `turnBoard` y `fx.turn` para su giro a los 2:30, pero no `game.js turn`, que es por puntos y al azar.
- El reloj del nivel arranca cuando se muestra el tablero. Al salir del duelo se vuelve con `enterLevel`, que ya resuelve eso.
- ESLint y CI: la rama pasa `npm run lint` y `npm test`.

## 6. Errores

| Caso | Qué pasa |
|---|---|
| Falla `create` | En `#dlg-duel`: "No se pudo crear el desafío, revisá la conexión". |
| El código no existe | "Ese desafío no existe o ya venció" y un botón Volver. |
| `joined` ya escrito y no tengo lugar guardado | "Esta partida ya empezó" y un botón Volver. |
| Se corta la conexión | `EventSource` se reconecta solo y Firebase vuelve a mandar la sala entera con un `put` en `/`. |
| Firebase manda `cancel` (las reglas no dejan leer) | Se trata como "Ese desafío no existe o ya venció". |
| El rival nunca entra | Se cierra el diálogo y se vuelve a los niveles. La sala se barre al día siguiente. |
| Las palabras del idioma de la sala no cargan | El mismo `loadError` de hoy. |
| Se recarga en medio de la partida | Se vuelve a la sala como el mismo jugador (§3.8). Si ya terminó, se abre directo el resultado. |

## 7. Pruebas

- **Unitarias** (`node --test`, sin dependencias), en `test/duel.test.js`:
  - `applyEvent`: `put` en `/` (reemplaza la sala entera), `put` en `/words/CASA` y `patch` en `/words`;
  - `phase` y `timeLeft` en los bordes: justo en `start` y justo en `start + 300000`;
  - `scores` y `wordsOf`;
  - `newCode`: largo 5 y solo caracteres del alfabeto.

  En `test/board.test.js`: con el mismo código sale la misma cancha, de 5×5 y sin doradas, y con códigos distintos salen canchas distintas.
- **Contra la base** (`node tools/duel-smoke.mjs`, después de publicar las reglas; con la dirección del emulador como argumento corre contra el emulador):
  1. crear una sala;
  2. entrar como `b`;
  3. un tercer `joined` se rechaza;
  4. una palabra durante la cuenta regresiva se rechaza;
  5. después de 3 s, `CASA` como `a` pasa y `CASA` como `b` se rechaza;
  6. no se pueden listar las salas nuevas;
  7. no se puede borrar una sala nueva;
  8. que la respuesta del `PUT` traiga la hora del servidor.
- **Punta a punta:** dos pestañas de Chromium headless contra la base real. Verifica que A crea la sala y B entra, el 3‑2‑1, que una palabra de A le aparece a B como 🔒, que los puntajes se ven en vivo y, pasados los 5 minutos reales, el resultado en las dos pestañas.
- **Prueba final:** dos celus, uno con datos y otro con wifi, mandando el link por WhatsApp.

## 8. Puesta en marcha (una sola vez)

1. En console.firebase.google.com, el proyecto `wordini` (ya creado, sin Analytics).
2. Compilación → Realtime Database → Crear base de datos → `us-central1` → modo bloqueado.
3. Pestaña Reglas: pegar `database.rules.json` y publicar.
4. La dirección `https://…firebaseio.com` va en la constante `DB` de `js/duel.js`.

## 9. Fuera de alcance

- Buscar rival entre desconocidos.
- Más de dos jugadores.
- Login y protección contra trampas.
- Pistas o casillas doradas en el duelo.
- Historial de duelos.
- Avisos o notificaciones push.
- Elegir la duración de la partida.
