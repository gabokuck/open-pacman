# SPEC 01 — Cuatro fantasmas con arquetipos distintos

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-09-22
> **Objective:** Poner 4 fantasmas con comportamientos diferenciados (cazador, emboscador, flanqueador, vagabundo) que nacen dentro del pen y salen uno cada 1,5 s, cada uno con color y lógica propia.

## Scope

**In:**

- Expandir `GHOST_STARTS` de 2 a 4 entradas con sus `kind` (`hunter`, `ambusher`, `flanker`, `wanderer`).
- Spawn dentro del pen (celdas 13,13 / 14,13 / 13,15 / 14,15) en lugar del túnel.
- Liberación escalonada por tiempo: cada 1,5 s un fantasma pasa a `released: true` (0 / 1,5 / 3 / 4,5 s).
- Pathfinding dentro del pen: el fantasma sube por su columna hasta la celda puerta (y=12, x=13 o 14) y desde ahí decide libremente por su `kind`.
- 4 comportamientos distintos en `decideGhost`:
  - **Cazador:** distancia Manhattan a Pac-Man.
  - **Emboscador:** objetivo = Pac-Man + 4 celdas en la dirección de Pac-Man.
  - **Flanqueador:** objetivo = Pac-Man + (Pac-Man − fantasma).
  - **Vagabundo:** dirección al azar entre las válidas.
- Bobbing vertical suave (±1 px cada ~10 frames) para los fantasmas aún no liberados.
- Cada fantasma mantiene el color fijo asignado en `render.js` (rojo / cian / rosa / naranja).
- Si la celda puerta está ocupada por otro fantasma, el siguiente espera fuera de ella (no se solapan).

**Out of scope (para specs futuras):**

- Power-ups, píldoras de energía, modo "frightened".
- Ojos flotando de vuelta al pen cuando un fantasma es comido.
- Modo scatter/chase con temporizadores globales.
- Animación de entrada por la puerta con ojos flotando.
- Liberación por dots comidos (siempre por tiempo).
- Nombres visibles en el HUD.
- Modificar el laberinto, la paleta, el orden de los `<script>` ni `index.html`.

## Data model

Cambios en `src/js/maze.js`:

```js
const GHOST_STARTS = [
  { x: 13, y: 13, kind: 'hunter'   }, // pen arriba-izquierda, sale el primero
  { x: 14, y: 13, kind: 'ambusher' }, // pen arriba-derecha
  { x: 13, y: 15, kind: 'flanker'  }, // pen abajo-izquierda
  { x: 14, y: 15, kind: 'wanderer' }, // pen abajo-derecha
];
```

Cambios en `game.ghosts` (devuelto por `createGame`):

```js
ghosts: GHOST_STARTS.map( ( g, i ) => ( {
  x: g.x,
  y: g.y,
  dir: 'up',
  speed: GHOST_SPEED,
  kind: g.kind,        // 'hunter' | 'ambusher' | 'flanker' | 'wanderer'
  released: false,     // true cuando han pasado sus 1,5 s de releaseOrder * 90 frames
  releaseOrder: i,     // 0..3
  bobPhase: 0,         // contador de frames para el bobbing
} ) )
```

No se añade nada nuevo a `MAZE`, `TUNNEL_ROW` ni `PACMAN_START`.

## Implementation plan

1. **Ampliar `GHOST_STARTS` en `src/js/maze.js`** a 4 entradas con sus `kind`. Verificación: la página sigue cargando sin errores.
2. **Ampliar `createGame` en `src/js/game.js`** para incluir `released`, `releaseOrder` y `bobPhase`. Verificación: el juego arranca; los 4 fantasmas aparecen dentro del pen y no se mueven (todos con `released: false`).
3. **Liberación por tiempo en `moveGhost`:** añadir un contador `game.releaseTimer` que se incrementa cada frame. Cuando `releaseTimer >= releaseOrder * 90` (1,5 s ≈ 90 frames a 60 fps), marcar `released: true`. Verificación: en t=0 sale el primero, en t=4,5 s el último; en t=6 s los 4 están en juego.
4. **Refactorizar `decideGhost` para despachar por `kind`:** cazador (Manhattan a Pac-Man, ya existe), emboscador (objetivo = `pacman + 4 * dir_pacman`, clamp dentro del laberinto), flanqueador (objetivo = `pacman + (pacman − fantasma)`, clamp), vagabundo (azar entre válidas, ya existe). Verificación visual: con Pac-Man quieto, los 4 fantasmas eligen direcciones claramente distintas en cada intersección.
5. **Pathfinding dentro del pen:** mientras `released === true` y `y > 12` (todavía dentro del pen), el fantasma decide siempre como cazador hacia la celda puerta `(13,12)` o `(14,12)` según su `x`. Al alcanzar `y === 12`, decide libremente por su `kind`. Verificación: el fantasma sube por su columna y entra al pasillo superior sin atravesar paredes.
6. **Cola en la puerta:** si la celda `(13,12)` o `(14,12)` está ocupada por otro fantasma `released` con `y === 12`, el siguiente espera 1 frame (no avanza a esa celda). Verificación: dos fantasmas nunca comparten la celda puerta.
7. **Bobbing en `drawGhost`:** mientras `released === false`, desplazar el fantasma ±1 px en y según `Math.sin(bobPhase * 0.3)`. Verificación: los 3 fantasmas en espera oscilan suavemente.
8. **Actualizar `resetPositions`:** los 4 vuelven a `(GHOST_STARTS[i].x, GHOST_STARTS[i].y)`, `released: false`, `releaseOrder` y `bobPhase` recalculados. Verificación: tras perder una vida, los 4 vuelven al pen y se vuelven a liberar escalonadamente.

## Acceptance criteria

- [ ] `GHOST_STARTS` tiene 4 entradas con `kind` ∈ {`hunter`, `ambusher`, `flanker`, `wanderer`}.
- [ ] Al arrancar, los 4 fantasmas aparecen dentro del pen (no en el túnel).
- [ ] El primer fantasma empieza a moverse en t=0; el último lo hace en t=4,5 s.
- [ ] En t=6 s los 4 fantasmas están libres en el laberinto.
- [ ] Con Pac-Man quieto, el cazador reduce la distancia Manhattan a Pac-Man en cada decisión.
- [ ] Con Pac-Man quieto, el vagabundo elige una dirección al azar distinta en cada intersección.
- [ ] Con Pac-Man mirando a la derecha, el emboscador intenta colocarse a la derecha de Pac-Man.
- [ ] Con un fantasma a la izquierda de Pac-Man quieto, el flanqueador intenta rodear por la derecha.
- [ ] Ningún fantasma atraviesa paredes.
- [ ] Los 3 fantasmas aún no liberados oscilan verticalmente (±1 px).
- [ ] Tras perder una vida, los 4 fantasmas vuelven al pen y se vuelven a liberar escalonadamente.
- [ ] Cada fantasma mantiene su color (rojo / cian / rosa / naranja) durante toda la partida.
- [ ] La puerta del pen no la atraviesan dos fantasmas a la vez.
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Yes:** 4 arquetipos simples (`hunter` / `ambusher` / `flanker` / `wanderer`) en lugar de los 4 clásicos del arcade (Blinky / Pinky / Inky / Clyde). Más fáciles de explicar y mantener, encajan con los 4 colores ya reservados.
- **Yes:** Spawn dentro del pen y salida por la puerta. Más fiel al arcade que la implementación actual (que los pone directamente en el túnel).
- **Yes:** Liberación por tiempo fijo (1,5 s), no por dots comidos. Más simple; se puede migrar a "por dots comidos" en otra spec.
- **Yes:** Dentro del pen, todos los fantasmas liberados usan la lógica de cazador hacia su columna de puerta. Evita un modo `pen` separado en `decideGhost`.
- **Yes:** Si la celda puerta está ocupada, el siguiente espera 1 frame. Implementación simple, sin cola explícita.
- **Yes:** `releaseTimer` global en `game` (no 4 timers independientes). Más fácil de razonar.
- **No:** Animación de ojos flotando hacia la puerta. Se delega a otra spec.
- **No:** Power-ups / píldoras / modo "frightened" / ojos que vuelven al pen. Cada uno en su propia spec.
- **No:** Modo scatter/chase global con cronómetro. Otra spec.
- **No:** Mostrar nombres en el HUD. Solo color + `kind` en código.
- **No:** Cambiar el orden de los `<script>` ni el laberinto.

## Risks

| Riesgo | Mitigación |
|---|---|
| 4 fantasmas a la vez saturan a Pac-Man y la partida se vuelve injugable | El stagger de 1,5 s da 6 s de respiro; el vagabundo se mueve al azar y no presiona tanto. Si la dificultad es alta, se puede añadir escalado por nivel en otra spec. |
| El pathfinding dentro del pen puede atascar a un fantasma si la puerta está bloqueada | La cola simple en la puerta (paso 6 del plan) garantiza que nunca se solapan. Documentado en el código. |
| El bobbing y el cambio `released: false → true` pueden producir un salto visual | El bobbing se desactiva en el mismo frame en que `released` pasa a `true`; el fantasma pasa a estar en `(x, y)` sin offset. Sin transición visible. |

## What is **not** in this spec

- Power-ups, píldoras de energía, modo "frightened".
- Ojos flotando de vuelta al pen cuando un fantasma es comido.
- Modo scatter/chase con temporizadores globales.
- Animación de entrada por la puerta con ojos flotando.
- Liberación por dots comidos.
- Nombres visibles en el HUD.
- Modificar el laberinto, la paleta de colores, ni el orden de los `<script>` en `index.html`.

Cada uno, si entra, va en su propio spec.
