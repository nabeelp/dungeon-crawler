# Amy — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Owner:** Nabeel
- **Stack:** JavaScript, HTML5 Canvas, browser-based
- **Description:** Procedural dungeon generation, permadeath, turn-based combat, fog of war, item identification system
- **My Role:** Tester. Tests, edge cases, integration verification across all game systems.

## Learnings

### Test Suite Created (Initial Build)
- **85 tests across 3 modules, all passing.**
- **Files created:**
  - `tests/test-runner.js` → `window.TestRunner` — lightweight describe/it/expect framework with HTML rendering
  - `tests/test-utils.js` — 30 tests: seeded RNG determinism, randInt bounds, pick/shuffle, distance functions (manhattan/euclidean/chebyshev), inBounds edge cases, createGrid dimensions/independence, clamp, neighbour helpers, ID generation
  - `tests/test-gamestate.js` — 32 tests: newGame reset (phase, floor, turn, entities, player, items, messages, seed, floors), createEntity (fields, class stats, abilities, unique IDs, equipment slots), createItem (fields, unique IDs, defaults), entity CRUD (add/remove/getByFloor/getAtPosition/dead exclusion), player set/get, ground items (add/remove/multi-position/cross-floor), message log (add/get/ordering/cap/limit), phase transitions, floor data storage, turn counter
  - `tests/test-dungeon.js` — 23 tests: 50x50 grid for all 10 floors, tile validity, explored grid, room count (≥5), room bounds, room dimensions, stairs placement (floor 0 down-only, floors 1-8 both, floor 9 up-only), determinism (same seed = identical output, different seeds ≠ identical), BFS connectivity (all walkable tiles reachable, stairs reachable from room centers, path between any two rooms), room overlap (BSP prevents most)
  - `tests/index.html` — styled dark-theme test runner page
- **Key patterns:**
  - All modules use `window.X` exports, no bundler — tests load via `<script>` tags in dependency order
  - BFS connectivity test is the most valuable: it guarantees every walkable tile is reachable, which catches broken corridor carving
  - Determinism is rock-solid — Mulberry32 PRNG with seed-per-floor works correctly
  - GameState is a singleton with mutable internal state; `newGame()` must be called before each test group to reset
  - Tests can also run in Node.js with a minimal `window`/`document` shim for CI
