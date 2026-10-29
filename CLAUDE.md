# CLAUDE.md

Guidance for Claude Code (and anyone else) working on this repo.

## Project

**Starfence** is the owner's own territory-claiming arcade game, inspired by the Amiga game Volfied (and Qix before it). It's an original game in that style: its own enemies, sectors and procedurally drawn pictures. Don't copy Volfied's sprites, bosses, level names or artwork. It runs locally on Windows by opening `index.html`; it isn't hosted anywhere. The player is an adult with a keyboard; it's a classic arcade game with lives and game over.

## Running and testing

- **Play:** double-click `index.html`. No server, build step or install.
- **Test:** `npm install` once, then `npm test`. This runs `tests/smoke.js` with puppeteer-core and the installed Chrome (`C:/Program Files/Google/Chrome/...`), using `?seed=1` so runs repeat. It checks the core rules, screenshots every sector and picture, runs a fast random "monkey" player through all sectors checking the field stays consistent, and plays to game over. Screenshots go to `tests/shots/` (gitignored). Look at them after visual changes.
- `package.json` exists only for test tooling. The game must keep working with no npm install.

## Architecture

Plain scripts loaded with `<script>` tags (no modules, so `file://` works), all on the global `SF` namespace. `SF.game` is exposed for the console and the test.

- `js/util.js`: sizes (160x120 cells of 4px, HUD bar, margin), cell values (`UNCLAIMED`/`CLAIMED`/`TRAIL`), seeded RNG, safe `localStorage`.
- `js/field.js`: the grid. Edge cells are claimed cells 8-adjacent to non-claimed ones, and the ship and sparks move only on these. `close()` claims the trail plus every unclaimed pocket except the one holding the boss. `scan()` does circle-vs-cell collision.
- `js/entities.js`: small enemies, bosses, bullets, sparks, power-up table. `moveCircle()` bounces off claimed cells but lets an entity left overlapping a wall after a claim wriggle free.
- `js/levels.js`: the 8 sector definitions; `levelFor()` loops them with more speed and higher targets.
- `js/pictures.js`: one canvas painter per hidden picture (no image files).
- `js/render.js`: all drawing. The claimed picture plus edge line is cached in an offscreen canvas and rebuilt only when the field changes.
- `js/game.js`: states (`title`, `intro`, `play`, `paused`, `dying`, `clear`, `over`), fixed 60Hz update, player movement and rules, input.
- `js/sound.js`: Web Audio sound effects.

## Rules decisions

- Classic strict rules: enemies touching the ship or the line while drawing cost a life; no reversing over your own line. On the edge you're safe from everything except sparks.
- Being trapped by your own line always costs a life, even with a shield (otherwise you'd be stuck forever).
- The pocket the boss is in stays unclaimed; everything else is claimed.

## Git

Commit straight to `main`. Don't add a `Co-Authored-By` or other Claude attribution lines to commits.
