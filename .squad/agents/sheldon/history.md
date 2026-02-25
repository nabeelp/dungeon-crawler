# Sheldon — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Owner:** Nabeel
- **Stack:** JavaScript, HTML5 Canvas, browser-based
- **Description:** Procedural dungeon generation, permadeath, turn-based combat, fog of war, item identification system
- **My Role:** Lead architect + dungeon generation developer. Responsible for shared data model and procedural gen.

## Learnings

### Architecture Decisions (2025-01-20)

- **No bundler.** All modules use IIFEs exporting to `window.*`. Load order in `index.html` matters: constants → utils → gameState → generator → (everything else).
- **Seeded PRNG (Mulberry32)** via `Utils.createRNG(seed)`. Every system that needs randomness should use this for reproducibility. The dungeon generator derives per-floor seeds as `baseSeed + floorIndex * 1000`.
- **BSP dungeon generation** chosen over cellular automata. Gives guaranteed connected rooms with clean corridor topology. Each floor has its own `FLOOR_PARAMS` entry controlling room count, room sizes, and corridor width — difficulty scales by tightening corridors and adding extra loop corridors on deeper floors.
- **Entity/item creation** is centralized in `GameState.createEntity()` / `GameState.createItem()`. Other agents must use these factories — never hand-construct entity objects.
- **Tile types are integers** (0–7) for fast grid operations. `Constants.WALKABLE_TILES` and `Constants.OPAQUE_TILES` are Sets for O(1) lookup.
- **Floor data schema:** `{ tiles: number[][], rooms: {x,y,w,h}[], stairs: {down,up}, explored: bool[][] }`. Stored via `GameState.setFloorData(index, data)`.

### Key File Paths

- `index.html` — Entry point, canvas element, script loading
- `src/core/constants.js` — `window.Constants` (tiles, classes, items, phases, directions, XP table)
- `src/core/utils.js` — `window.Utils` (seeded RNG, distance, grid helpers, ID generation)
- `src/core/gameState.js` — `window.GameState` (state singleton, entity/item factories, message log)
- `src/dungeon/generator.js` — `window.DungeonGenerator` (BSP generator, returns tiles + rooms + stairs)
