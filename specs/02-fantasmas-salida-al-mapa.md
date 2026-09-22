# SPEC 02 — Fantasmas aparecen directamente en el mapa al liberarse

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-09-22
> **Objective:** Cuando un fantasma se libera del pen, teletransportarse a la celda (x, 11) sobre su columna de puerta, mirar hacia Pac-Man y empezar a moverse por su arquetipo, en lugar de pathfindear dentro del pen.

## Scope

**In:**

- En `moveGhost` (`src/js/game.js`): cuando un fantasma pasa de `released: false` a `released: true`, colocarlo instantáneamente en `(g.x, 11)` y asignarle `g.dir` hacia Pac-Man (distancia Manhattan mínima entre las direcciones válidas desde esa celda).
- En `moveGhost`: no avanzar la posición (`g.x += d.x * g.speed`, `g.y += d.y * g.speed`) mientras `released === false`. Los fantasmas en espera solo bobbean en el sitio.
- En `decideGhost` (`src/js/game.js`): eliminar el bloque "Dentro del pen (y > 12)" — ya no es necesario.
- En `moveGhost`: eliminar el bloque "Cola en la puerta" — los fantasmas ya no entran al pen por la puerta, así que no hay conflicto.
- `render.js` no cambia: el bobbing ya está condicionado a `!released` y sigue funcionando igual.
- `maze.js` no cambia: las posiciones de spawn (`GHOST_STARTS`) siguen siendo las mismas; los fantasmas nacen dentro del pen y animan ahí hasta liberarse.
- `MAZE`, `TUNNEL_ROW`, `PACMAN_START` no cambian.
- `resetPositions` no necesita cambios: sigue devolviendo a los fantasmas a `GHOST_STARTS[i]` con `released: false`. La próxima liberación los teletransportará igual que en el primer arranque.

**Out of scope (para specs futuras):**

- Animación de "ojos flotando de vuelta al pen" cuando un fantasma es comido.
- Power-ups, píldoras de energía, modo "frightened".
- Modificar el laberinto o la posición de la puerta.
- Cambiar la lógica de los arquetipos (cazador, emboscador, flanqueador, vagabundo).
- Liberar fantasmas por dots comidos en vez de por tiempo.
- Indicador visual del fantasma "a punto de salir" (cuenta atrás).
- Persistencia entre partidas.

## Data model

Esta spec no introduce estructuras nuevas. Reutiliza `game.ghosts[]` del SPEC 01 tal cual. Los campos siguen siendo:

```js
// game.ghosts[i]
{
  x, y,          // celda interior del pen mientras !released; (x, 11) una vez released
  dir,           // 'up' por spawn; al liberarse, dirección hacia Pac-Man
  speed,         // GHOST_SPEED
  kind,          // 'hunter' | 'ambusher' | 'flanker' | 'wanderer'
  released,      // false hasta releaseOrder * 90 frames; true en adelante
  releaseOrder,  // 0..3
  bobPhase,      // frames acumulados; el render lo usa si !released
}
```

Lo único que cambia es la **interpretación** de `x`, `y` en el frame de transición: el fantasma salta de su celda interior del pen a `(g.x, 11)`.

## Implementation plan

1. **Inmovilizar fantasmas no liberados en `moveGhost`.** Mover el bloque que avanza `g.x += d.x * g.speed; g.y += d.y * g.speed;` dentro de un `if (g.released) { ... }`. Verificación: al arrancar, los 4 fantasmas se ven en sus celdas del pen, bobbeando, sin avanzar.

2. **Teletransporte al liberarse.** Justo después de marcar `g.released = true`, detectar la transición con una bandera local `wasReleased = g.released` capturada antes de la asignación, y ejecutar:
   ```js
   if ( wasReleased === false && g.released === true ) {
     g.y = 11;
     // elegir dirección válida desde (g.x, 11) que minimice Manhattan a Pac-Man
   }
   ```
   Verificación: a los ~90 frames de cada fantasma, ese fantasma aparece visualmente en (x, 11).

3. **Dirección inicial hacia Pac-Man.** En el mismo bloque, calcular las direcciones válidas desde `(g.x, 11)` (todas excepto `OPPOSITE[dir]` inicial = `down`) y elegir la de menor Manhattan a Pac-Man con `pickByManhattan`. Verificación: un fantasma liberado con Pac-Man a su izquierda mira inicialmente hacia la izquierda; con Pac-Man a su derecha, hacia la derecha.

4. **Eliminar el pathfinding del pen.** En `decideGhost`, borrar el bloque `if (g.released && Math.round(g.y) > 12) { g.dir = pickByManhattan(choices, g, g.x, 12); return; }`. Verificación: el código sigue compilando; ningún fantasma liberado toma decisiones "rumbo a la puerta".

5. **Eliminar la cola en la puerta.** En `moveGhost`, borrar el bloque que comprueba si otro fantasma ocupa `(13, 12)` o `(14, 12)`. Verificación: ningún fantasma liberado intenta volver a entrar al pen, así que la cola nunca se activaría — el código se va para evitar deuda técnica.

6. **Verificar el flujo de reset.** Confirmar que `resetPositions` ya pone `released: false` y `dir: 'up'` para todos. Verificación: tras perder una vida, los 4 fantasmas vuelven al pen, bobbean, y se vuelven a liberar escalonadamente apareciendo en y=11.

## Acceptance criteria

- [ ] `game.ghosts` no introduce campos nuevos: sigue teniendo `x, y, dir, speed, kind, released, releaseOrder, bobPhase`.
- [ ] Al arrancar una partida, los 4 fantasmas están en `(13,13)`, `(14,13)`, `(13,15)`, `(14,15)`, **inmóviles**, con bobbing vertical.
- [ ] En t=0..1,5 s ningún fantasma ha cambiado de celda (siguen en sus posiciones iniciales).
- [ ] El primer fantasma (hunter, columna 13) aparece en `(13, 11)` alrededor de t≈1,5 s y empieza a moverse.
- [ ] El segundo (ambusher, columna 14) aparece en `(14, 11)` alrededor de t≈3 s.
- [ ] El tercero (flanker, columna 13) aparece en `(13, 11)` alrededor de t≈4,5 s.
- [ ] El cuarto (wanderer, columna 14) aparece en `(14, 11)` alrededor de t≈6 s.
- [ ] En t=6 s los 4 fantasmas están libres en el mapa, ninguno dentro del pen.
- [ ] Al liberarse, cada fantasma mira inicialmente hacia Pac-Man (la dirección es la de menor Manhattan a la celda de Pac-Man desde `(x, 11)`).
- [ ] Tras perder una vida, los 4 fantasmas vuelven al pen, bobbean, y se vuelven a liberar escalonadamente apareciendo en y=11.
- [ ] Ningún fantasma atraviesa paredes.
- [ ] Cada fantasma mantiene su color (rojo / cian / rosa / naranja) durante toda la partida.
- [ ] No hay errores en la consola del navegador.

## Decisions

- **Yes:** Teletransporte a `(x, 11)` en lugar de pathfinding desde `(x, 13)` o `(x, 15)`. Cumple literalmente "ponerlos en el mapa cuando empiezan a moverse"; ahorra la lógica de pen-exit y la cola en la puerta.
- **Yes:** Mientras `released === false`, los fantasmas no se desplazan. Solo bobbean. Evita que se cuelen por la puerta antes de tiempo (que era el bug original).
- **Yes:** Dirección inicial = Manhattan hacia Pac-Man desde la celda de spawn en el mapa. Coherente con los arquetipos y no añade estado nuevo.
- **Yes:** Eliminar el bloque "Dentro del pen" de `decideGhost` y la "Cola en la puerta" de `moveGhost`. Código muerto fuera.
- **Yes:** Mantener `GHOST_STARTS` en `maze.js` sin cambios. Los fantasmas nacen dentro del pen visualmente; el cambio es de salida, no de spawn.
- **No:** Animación de teletransporte (fundido, parpadeo, etc.). El salto es instantáneo. Si más adelante se quiere, va en otra spec.
- **No:** Liberar por dots comidos. Sigue siendo por tiempo (1,5 s escalonado).
- **No:** Cambiar la lógica de arquetipos (cazador / emboscador / flanqueador / vagabundo).
- **No:** Modificar el laberinto, la puerta, ni el orden de los `<script>`.

## Risks

| Riesgo | Mitigación |
|---|---|
| El teletransporte se ve como un salto visual brusco | El bobbing se desactiva en el mismo frame del teletransporte (`released: false → true` ya lo paraba en `render.js`); el fantasma aparece alineado en `(x, 11)` sin offset. Si en pruebas se ve mal, se puede añadir un fade-in en otra spec. |
| Si Pac-Man está justo encima de la puerta cuando se libera un fantasma, las direcciones válidas empatan en Manhattan | `pickByManhattan` devuelve la primera en orden de iteración (left, right, up, down filtrando OPPOSITE). Es determinista, no aleatorio, así que el comportamiento es reproducible. |
| Eliminar la cola en la puerta deja el código sin defensa si en el futuro alguien reintroduce pathfinding por el pen | Documentado en la sección de Decisions. Si vuelve el pathfinding, se reañade la cola. |

## What is **not** in this spec

- Animación de "ojos flotando de vuelta al pen" cuando un fantasma es comido.
- Power-ups, píldoras de energía, modo "frightened".
- Modificar el laberinto o la posición de la puerta.
- Cambiar la lógica de los arquetipos.
- Liberar fantasmas por dots comidos.
- Indicador visual de "a punto de salir".
- Persistencia entre partidas.

Cada uno, si entra, va en su propio spec.
