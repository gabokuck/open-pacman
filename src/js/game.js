// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    releaseTimer: 0,         // frames desde el inicio; libera fantasmas escalonadamente
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,        // 'hunter' | 'ambusher' | 'flanker' | 'wanderer'
      released: false,     // true cuando han pasado sus 1,5 s de releaseOrder * 90 frames
      releaseOrder: i,     // 0..3
      bobPhase: 0,         // contador de frames para el bobbing
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

function clamp( v, lo, hi ) {
  return Math.max( lo, Math.min( hi, v ) );
}

// De las direcciones validas en `choices`, elige la que minimiza la distancia
// Manhattan desde la celda destino (g + d) hasta el objetivo (tx, ty).
function pickByManhattan( choices, g, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const width = grid[ 0 ].length;
  const height = grid.length;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Dentro del pen (y > 12): todos los liberados van a su celda puerta (x, 12).
  if ( g.released && Math.round( g.y ) > 12 ) {
    g.dir = pickByManhattan( choices, g, g.x, 12 );
    return;
  }

  // Fuera del pen: despachar por arquetipo.
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'hunter' ) {
    g.dir = pickByManhattan( choices, g, px, py );
  } else if ( g.kind === 'ambusher' ) {
    // Apuntar a 4 celdas por delante de Pac-Man en su direccion actual.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const tx = clamp( px + d.x * 4, 0, width - 1 );
    const ty = clamp( py + d.y * 4, 0, height - 1 );
    g.dir = pickByManhattan( choices, g, tx, ty );
  } else if ( g.kind === 'flanker' ) {
    // Reflejar a Pac-Man sobre si mismo: target = 2*pac - ghost (clamp al grid).
    const tx = clamp( px * 2 - Math.round( g.x ), 0, width - 1 );
    const ty = clamp( py * 2 - Math.round( g.y ), 0, height - 1 );
    g.dir = pickByManhattan( choices, g, tx, ty );
  } else {
    // 'wanderer' y fallback: direccion al azar entre las validas.
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  // Bobbing: contador continuo (el render solo lo aplica si !released).
  g.bobPhase++;
  // Liberacion escalonada por tiempo: cada 1,5 s (90 frames) sale el siguiente.
  if ( !g.released && game.releaseTimer >= g.releaseOrder * 90 ) {
    g.released = true;
  }

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    // Cola en la puerta: si nuestro siguiente paso entra en la celda puerta
    // y ya hay otro fantasma liberado ahi, esperamos 1 frame.
    const dd = DIRS[ g.dir ];
    const nx = g.x + dd.x;
    const ny = g.y + dd.y;
    if (
      Math.round( g.y ) > 12 &&
      Math.round( ny ) === 12 &&
      ( nx === 13 || nx === 14 )
    ) {
      const blocked = game.ghosts.some( ( other ) =>
        other !== g &&
        other.released &&
        Math.round( other.x ) === nx &&
        Math.round( other.y ) === 12
      );
      if ( blocked ) return;
    }
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Volver a liberar los fantasmas desde cero (releaseTimer + released: false).
  game.releaseTimer = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = false;
    g.releaseOrder = i;
    g.bobPhase = 0;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.releaseTimer++;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
