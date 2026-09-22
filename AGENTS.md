# AGENTS.md

## Project

Vanilla JS / HTML / CSS Pac-Man clone. No build system, no package manager, no test runner, no linter, no CI. Spanish-language UI and comments.

Entry point: `src/index.html` (open it directly in a browser, or serve `src/` with any static server).

## Run / verify

- **Run:** open `src/index.html` in a browser. No `npm install`, no dev server required.
- **Verify a change:** open the file, click Start, play. There are no automated tests.
- **Lint/typecheck:** none configured. If you add code, match the existing style (see below).

## Layout

```
src/
  index.html       <- entry; loads scripts in fixed order
  css/style.css
  js/maze.js       <- MAZE grid (read-only template) + starts/tunnel
  js/game.js       <- state, rules, collisions
  js/render.js     <- canvas drawing
  js/main.js       <- loop, keyboard, overlay screens
.agents/skills/    <- local skill copies (spec, spec-impl)
skills-lock.json   <- pinned versions of installed skills
```

## Code conventions (this repo)

- **No ES modules.** Files communicate via `window.*` globals. `index.html` loads scripts in this exact order — do not reorder:
  1. `maze.js` (defines `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`)
  2. `game.js` (defines `createGame`, `update`, `DIRS`)
  3. `render.js` (defines `draw`)
  4. `main.js` (uses all of the above)
- Maze coordinates: cell `(x, y)`, origin top-left, `x in [0,27]`, `y in [0,30]`. Tile codes: `0` empty, `1` wall, `2` dot, `3` ghost-door.
- `MAZE` is the pristine template; **`game.grid` is the mutable per-game copy**. Never mutate `MAZE` — copy via `MAZE.map(row => row.slice())` (see `createGame`).
- Canvas: 560×620, tile size 20 px, drawn walls connect right + down neighbors only (no duplicate strokes).
- Movement: sub-cell positions (`speed` units/frame). Actors only act on grid-aligned cells (`aligned()` check).
- Speed constants: `PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.1` — keep them as fractions so 8/10-frame alignment stays intact.
- Style: 4-space indentation, single quotes, no semicolons missing (match `src/js/*.js`).

## Spec-driven workflow

This repo exists to practice the spec-driven method. Use the local skills:

- **`/spec`** — design a feature first; produces a numbered spec under `specs/`. Asks clarifying questions; do not skip Phase 2.
- **`/spec-impl`** — implements an approved spec; creates a branch and walks through diffs.

Read existing specs in `specs/` (if any) before starting a new one — match their language and section wording. Specs are written in Spanish to match the UI.

Skills are pinned via `skills-lock.json`. Do not edit the skills folder by hand; if you need a change, update the lock and reinstall.

## Things agents get wrong

- Adding `npm`/build tooling — there is intentionally none. Don't introduce it without asking.
- Reordering `<script>` tags in `index.html` — globals won't be defined when later scripts run.
- Mutating `MAZE` directly — dots disappear from the template and the next game starts half-eaten.
- Writing new code in English while the UI/comments are in Spanish — keep strings Spanish.
- Regenerating the maze layout — it's hand-authored to match the original level 1. If you change it, preserve the 28×31 dimensions and the `--` pen door at `(13..14, 12)`.
