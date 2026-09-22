# SPEC 03 — Power pellets y modo frightened con ojos flotantes

> **Status:** Implementado
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-09-22
> **Objective:** Añadir 4 power pellets en las esquinas del laberinto que activan un modo frightened de 6 s durante el cual Pac-Man puede comerse a los fantasmas, que vuelven al pen como ojos flotantes con una cadena de puntos 200/400/800/1600.

## Scope

**In:**

- Nuevo tile `4` (power pellet) en `src/js/maze.js`: char `'O'` en `MAZE_STR`, parseado por `parseTile`.
- Reemplazar los 4 dots de las esquinas por power pellets en `(1, 3)`, `(26, 3)`, `(1, 23)`, `(26, 23)`.
- Al comer un power pellet: +50 puntos, se vacía la celda (`grid[y][x] = 0`), se cuenta en `dotsRemaining`.
- Nuevo estado global en `game`:
  - `frightenedTimer`: frames restantes del modo frightened. Empieza en 0; se setea a 360 (6 s a 60 fps) al comer un power pellet.
  - `ghostChain`: número de fantasmas comidos en la fase frightened actual (se resetea a 0 cuando el timer expira; NO se resetea al comer otro power pellet).
- Nuevo campo en cada fantasma `g.mode` ∈ `'normal' | 'frightened' | 'eyes'`. Valor inicial `'normal'`.
- Al comer un power pellet: todos los fantasmas `released === true` y con `mode !== 'eyes'` pasan a `'frightened'`. Los `'eyes'` siguen su camino al pen.
- Cada frame, mientras `frightenedTimer > 0`, decrementar. Cuando llega a 0, todos los `'frightened'` vuelven a `'normal'` y `ghostChain = 0`.
- Comportamiento según `mode`:
  - `'normal'`: lógica actual (arquetipo + `GHOST_SPEED`).
  - `'frightened'`: `speed = GHOST_SPEED * 0.5`; dirección al azar entre válidas (mismo patrón que `'wanderer'`, sin arquetipo).
  - `'eyes'`: solo se dibujan los ojos; `speed = GHOST_SPEED * 2`; decisiones Manhattan hacia `(x, 11)`. Al llegar a `(x, 11)` pasa a `'normal'` (sigue como fantasma libre con su arquetipo).
- Colisiones Pac-Man ↔ fantasma (en `update`):
  - `mode === 'normal'`: comportamiento actual (`lives--` + `resetPositions`).
  - `mode === 'frightened'`: fantasma pasa a `'eyes'`, `score += 200 << ghostChain`, `ghostChain++`.
  - `mode === 'eyes'`: no pasa nada (los ojos no cuentan como amenaza).
- Visual en `src/js/render.js`:
  - `drawDots` añade el caso `tile === 4`: power pellet más grande (radio 6) en `DOT_COLOR`.
  - `drawGhost` distingue los tres modos: cuerpo normal / cuerpo azul con parpadeo blanco en últimos 120 frames / solo ojos.
- `resetPositions` resetea `frightenedTimer = 0`, `ghostChain = 0` y `mode = 'normal'` en cada fantasma.
- `createGame` añade los nuevos campos con sus valores iniciales.
- `main.js` e `index.html` no cambian.

**Out of scope (para specs futuras):**

- Distintos frightenedTimer por nivel.
- Frenesí / cadenas explosivas.
- Parpadeo del propio power pellet (latido).
- Sonidos (waka, fright-start, ghost-eaten).
- Bonus por comerse los 4 power pellets.
- High-score / persistencia entre partidas.
- Vida extra al alcanzar cierto score.
- Animación de Pac-Man brillando durante frightened.
- Cambiar el orden de los `<script>` ni el resto del laberinto.

## Data model

Cambios en `src/js/maze.js`:

```js
function parseTile( ch ) {
  if ( ch === '#' ) return 1;
  if ( ch === '.' ) return 2;
  if ( ch === 'O' ) return 4; // NUEVO
  if ( ch === '-' ) return 3;
  return 0;
}

// Fila 3 (antes '#.####.#####.##.#####.####.#'):
'#O####.#####.##.#####.####O#', // power pellets en (1,3) y (26,3)

// Fila 23 (antes '#...##................##...#'):
'#O..##................##..O#', // power pellets en (1,23) y (26,23)
```

`GHOST_STARTS`, `TUNNEL_ROW`, `PACMAN_START` y el resto de `MAZE_STR` no cambian.

Cambios en `src/js/game.js` — constantes y estado nuevo:

```js
const FRIGHTEN_DURATION = 360;  // 6 s a 60 fps
const FRIGHTEN_SPEED = GHOST_SPEED * 0.5;
const EYES_SPEED = GHOST_SPEED * 2;
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// En createGame, anadir al estado:
return {
  state: 'start',
  score: 0,
  lives: 3,
  dotsRemaining: dots,
  releaseTimer: 0,
  frightenedTimer: 0,   // NUEVO
  ghostChain: 0,        // NUEVO
  grid,
  pacman: { /* ... existente ... */ },
  ghosts: GHOST_STARTS.map( ( g, i ) => ( {
    x: g.x, y: g.y, dir: 'up', speed: GHOST_SPEED,
    kind: g.kind, released: false, releaseOrder: i, bobPhase: 0,
    mode: 'normal',     // NUEVO: 'normal' | 'frightened' | 'eyes'
  } ) ),
};
```

En `moveGhost` se ajusta la `speed` según `mode`:

```js
if ( g.mode === 'eyes' ) {
  g.speed = EYES_SPEED;
} else if ( game.frightenedTimer > 0 && g.mode === 'frightened' ) {
  g.speed = FRIGHTEN_SPEED;
} else {
  g.speed = GHOST_SPEED;
}
```

En `decideGhost` (nuevo switch por `mode`):

```js
if ( g.mode === 'eyes' ) {
  g.dir = pickByManhattan( choices, g, g.x, 11 );
} else if ( g.mode === 'frightened' ) {
  g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
} else {
  // 'normal': arquetipo, sin cambios
}
```

En `update` — colisión y timer:

```js
for ( const g of game.ghosts ) {
  if ( !collides( game.pacman, g ) ) continue;
  if ( g.mode === 'eyes' ) continue;
  if ( g.mode === 'frightened' ) {
    g.mode = 'eyes';
    game.score += GHOST_POINTS[ game.ghostChain ];
    if ( game.ghostChain < GHOST_POINTS.length - 1 ) game.ghostChain++;
    continue;
  }
  // 'normal'
  game.lives--;
  if ( game.lives <= 0 ) { game.state = 'lost'; return; }
  resetPositions( game );
  break;
}

if ( game.frightenedTimer > 0 ) {
  game.frightenedTimer--;
  if ( game.frightenedTimer === 0 ) {
    game.ghostChain = 0;
    for ( const g of game.ghosts ) if ( g.mode === 'frightened' ) g.mode = 'normal';
  }
}
```

Al comer un power pellet (en `movePacman`):

```js
if ( grid[ p.y ][ p.x ] === 4 ) {
  grid[ p.y ][ p.x ] = 0;
  game.score += 50;
  game.dotsRemaining--;
  game.frightenedTimer = FRIGHTEN_DURATION;
  // NO resetear game.ghostChain
  for ( const g of game.ghosts ) {
    if ( g.released && g.mode !== 'eyes' ) g.mode = 'frightened';
  }
}
```

`resetPositions` añade:

```js
game.frightenedTimer = 0;
game.ghostChain = 0;
game.ghosts.forEach( ( g, i ) => {
  /* ... existente ... */
  g.mode = 'normal';
} );
```

Cambios en `src/js/render.js`:

```js
// drawDots anade el caso tile === 4 (radio 6) ademas del dot normal (radio 2.5).
function drawDots( ctx, grid ) {
  ctx.fillStyle = DOT_COLOR;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      const v = grid[ y ][ x ];
      if ( v === 2 ) {
        const { cx, cy } = cellCenter( x, y );
        ctx.beginPath(); ctx.arc( cx, cy, 2.5, 0, Math.PI * 2 ); ctx.fill();
      } else if ( v === 4 ) {
        const { cx, cy } = cellCenter( x, y );
        ctx.beginPath(); ctx.arc( cx, cy, 6, 0, Math.PI * 2 ); ctx.fill();
      }
    }
  }
}

// drawGhost recibe mode y frightenedTimer; despacha por mode.
function drawGhost( ctx, g, color, mode, frightenedTimer, frame ) {
  const { cx, cy } = cellCenter( g.x, g.y );
  const r = TILE / 2 - 1;

  if ( mode === 'eyes' ) {
    drawGhostEyes( ctx, cx, cy, g.dir );
    return;
  }

  const bob = ( !g.released ) ? Math.sin( g.bobPhase * 0.3 ) : 0;
  const ocy = cy + bob;
  const flashing = mode === 'frightened' && frightenedTimer <= 120
                && Math.floor( frame / 10 ) % 2 === 0;
  const fillColor = flashing ? '#ffffff'
                  : mode === 'frightened' ? '#2121ff'
                  : color;

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc( cx, ocy - 1, r, Math.PI, 0, false );
  ctx.lineTo( cx + r, ocy + r );
  ctx.lineTo( cx + r * 0.34, ocy + r - 4 );
  ctx.lineTo( cx, ocy + r );
  ctx.lineTo( cx - r * 0.34, ocy + r - 4 );
  ctx.lineTo( cx - r, ocy + r );
  ctx.closePath();
  ctx.fill();

  drawGhostEyes( ctx, cx, ocy - 1, g.dir );
}
```

`main.js`, `index.html` y `css/style.css` no cambian.

## Implementation plan

1. Añadir el tile `4` a `parseTile` en `src/js/maze.js` (case para `'O'`). Verificación: la página sigue cargando sin errores.
2. Modificar `MAZE_STR` filas 3 y 23 para poner `'O'` en `(1, 3)`, `(26, 3)`, `(1, 23)`, `(26, 23)`. Verificación: se ven 4 círculos grandes en las esquinas.
3. Render del power pellet en `drawDots`: caso `tile === 4` con radio 6. Verificación: visualmente más grandes que los dots.
4. Estado `frightenedTimer`, `ghostChain` y `mode` en `createGame` (valores iniciales 0, 0, `'normal'`). Verificación: el juego arranca; sin errores en consola.
5. Comer power pellet en `movePacman`: +50 pts, vacía celda, `frightenedTimer = 360`, fantasmas `released` no-eyes → `'frightened'`. Verificación: el marcador sube 50 al pisar `(1, 3)`.
6. Decrementar timer y revertir al expirar en `update`. Verificación: a los 6 s los fantasmas vuelven a perseguir con su arquetipo.
7. Comportamiento `'frightened'` en `decideGhost`: `speed = 0.5 * GHOST_SPEED` + dirección al azar. Verificación: se mueven más lento y sin lógica de arquetipo.
8. Visual `'frightened'`: cuerpo azul; parpadeo blanco cada 10 frames en los últimos 120 frames. Verificación: visual azul + parpadeo final.
9. Colisión `'frightened'`: fantasma pasa a `'eyes'`, suma 200/400/800/1600 (`200 << ghostChain`). Verificación: comer un fantasma azul da 200, el segundo 400, etc.
10. Modo `'eyes'`: dibujo solo ojos, `speed = 2 * GHOST_SPEED`, `decideGhost` con Manhattan hacia `(x, 11)`. Al llegar, `mode = 'normal'`. Verificación: los ojos flotan rápido a la columna de puerta y al llegar reaparece el fantasma con su color.
11. Colisión `'eyes'`: ignorada. Verificación: Pac-Man puede cruzar los ojos sin daño.
12. `resetPositions` resetea `frightenedTimer = 0`, `ghostChain = 0` y `mode = 'normal'` en cada fantasma. Verificación: tras perder una vida no quedan fantasmas azules ni ojos volando.
13. Verificación end-to-end: comer un power pellet, comerse los 4 fantasmas en la fase frightened, observar la cadena 200/400/800/1600, esperar a que termine el modo, repetir con un segundo power pellet y comprobar que la cadena NO se resetea.

## Acceptance criteria

- [ ] `parseTile('O')` devuelve `4` y la página carga sin errores.
- [ ] Hay 4 power pellets en `(1, 3)`, `(26, 3)`, `(1, 23)`, `(26, 23)`, renderizados como círculos más grandes que los dots.
- [ ] `game.frightenedTimer`, `game.ghostChain` y `g.mode` existen en `createGame` con valores iniciales `0`, `0`, `'normal'`.
- [ ] Cuando Pac-Man come un power pellet: `score += 50`, `dotsRemaining--`, `frightenedTimer = 360`, todos los fantasmas `released` y no-eyes pasan a `mode = 'frightened'`.
- [ ] Durante los 6 s de frightened: los fantasmas se mueven a `GHOST_SPEED * 0.5`, eligen dirección al azar y se renderizan azules.
- [ ] En los últimos 120 frames de frightened: el cuerpo parpadea blanco cada 10 frames.
- [ ] Cuando Pac-Man toca un fantasma `'frightened'`: el fantasma pasa a `'eyes'`, `score += 200 << ghostChain` (200/400/800/1600), `ghostChain++`.
- [ ] Cuando Pac-Man toca un fantasma `'eyes'`: no pasa nada (la vida no baja).
- [ ] Un fantasma `'eyes'` se mueve a `GHOST_SPEED * 2` con Manhattan hacia `(x, 11)`; al llegar, vuelve a `'normal'` sin pasar por el pen.
- [ ] Un fantasma `'eyes'` se dibuja solo con los dos ojos (cuerpo invisible).
- [ ] Cuando `frightenedTimer` llega a 0: todos los `'frightened'` vuelven a `'normal'` y `ghostChain = 0`.
- [ ] Comer un segundo power pellet durante un frightened activo: `frightenedTimer` se reinicia a 360 y `ghostChain` NO se resetea (la cadena continúa desde donde estaba).
- [ ] `resetPositions` deja `frightenedTimer = 0`, `ghostChain = 0` y todos los fantasmas en `mode = 'normal'`.
- [ ] El laberinto (fuera de los 4 dots reemplazados), los 4 colores de los fantasmas, la liberación escalonada (SPEC 01+02) y el orden de los `<script>` siguen como antes.
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Yes:** Nuevo tile `4` con char `'O'` en `MAZE_STR`. Los dots siguen siendo `2`. Mantiene `parseTile` como única fuente de verdad.
- **Yes:** Power pellets en las 4 esquinas clásicas `(1, 3)`, `(26, 3)`, `(1, 23)`, `(26, 23)`, reemplazando los dots que ya había.
- **Yes:** Duración fija de 6 s (360 frames a 60 fps). Sin escalado por nivel; eso es otra spec.
- **Yes:** Velocidad reducida a `GHOST_SPEED * 0.5` durante frightened. Dirección al azar entre válidas (mismo patrón que `'wanderer'`). Sin mantener arquetipo porque el feel arcade es "fantasmas torpes".
- **Yes:** Modo `'eyes'` dedicado (campo `mode` en el fantasma). Evita enredos con la lógica de `released` de SPEC 02.
- **Yes:** Los ojos vuelven directamente a `(x, 11)` (la celda sobre su columna de puerta), sin pasar por el pen ni esperar al `releaseTimer`. Al llegar, reaparecen como `'normal'` y siguen con su arquetipo.
- **Yes:** Cadena 200/400/800/1600 con `score += 200 << ghostChain` clampeada al array. `ghostChain` se resetea a 0 solo cuando expira el timer.
- **Yes:** Comer un power pellet extra reinicia el timer pero NO la cadena. Equivale a extender la ventana "hambrienta" manteniendo la racha.
- **Yes:** Colisión con `'eyes'` ignorada. El fantasma-ojos no es amenaza y Pac-Man debe poder cruzarlo.
- **Yes:** Reset tras perder vida limpia `frightenedTimer`, `ghostChain` y `mode = 'normal'`. Evita fantasmas stuck-azules si Pac-Man muere con frightened activo.
- **No:** Distintos frightenedTimer por nivel. Va en otra spec.
- **No:** Frenesí ni cadenas explosivas. Otra spec.
- **No:** Parpadeo del propio power pellet en el render (latido). El radio fijo es suficiente para distinguirlo del dot.
- **No:** Sonidos. Otra spec.
- **No:** Bonus por comerse los 4 power pellets ni vida extra a cierto score. Otra spec cada uno.
- **No:** Cambiar el orden de los `<script>`, la paleta de colores de los fantasmas ni el resto del laberinto.

## Risks

| Riesgo | Mitigación |
|---|---|
| El parpadeo blanco en los últimos 2 s puede ser difícil de ver si los frames están desincronizados | Se usa `Math.floor(frame / 10) % 2 === 0`, determinista. El acceptance test lo verifica manualmente. |
| Al volver a `'normal'`, los fantasmas pueden estar en una celda donde el arquetipo dé una dirección inválida | `canMove` ya filtra las paredes; `pickByManhattan` solo opera sobre `choices` válidas. El fallback "callejón" sigue siendo `OPPOSITE[g.dir]`. |
| Solapamiento visual entre un `'eyes'` y un `'frightened'` en la misma celda | Se dibujan en orden (fantasma tras fantasma); el acceptance test verifica visualmente que no se pisan en celdas distintas. |
| Comer power pellet y fantasma en el mismo frame podría dar puntos incorrectos | `movePacman` (come pellet, setea mode) corre antes que el bucle de colisiones. Orden determinista. |
| `ghostChain` puede exceder el array si hay más de 4 fantasmas comidos en una fase | Se clampea con `if (game.ghostChain < GHOST_POINTS.length - 1) game.ghostChain++`. Los puntos del último escalón (1600) se siguen dando, simplemente no sube más. Aceptable. |

## What is **not** in this spec

- Distintos frightenedTimer por nivel.
- Frenesí (reducir timer por cada pellet comido en la fase).
- Parpadeo / animación del propio power pellet en el render.
- Sonidos de waka, fright-start, ghost-eaten.
- Bonus por comerse los 4 power pellets del nivel.
- High-score / persistencia entre partidas.
- Vida extra al alcanzar cierto score (10.000 pts clásico).
- Animación de Pac-Man brillando durante frightened.
- Modificar el orden de los `<script>`, el resto del laberinto ni la paleta de los fantasmas.

Cada uno, si entra, va en su propio spec.
