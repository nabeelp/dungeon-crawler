# Leslie — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Stack:** Vanilla JavaScript, HTML5 Canvas, no bundler — modules export via `window.X` globals
- **Owner:** Nabeel
- **Joined:** 2026-02-26

## Key Files

- `src/core/constants.js` — Tile types, classes (Warrior/Mage/Rogue/Cleric), item types, XP table, regen rates
- `src/core/utils.js` — Seeded PRNG, distance calcs, grid helpers
- `src/core/gameState.js` — State singleton, entity/item factories
- `src/dungeon/generator.js` — BSP dungeon generation, 50x50 grids
- `src/systems/combat.js` — Turn-based combat, 12 abilities, status effects, class-based regen
- `src/systems/ai.js` — A* pathfinding, 5 AI behaviors (aggressive, flanking, cautious, ranged, boss)
- `src/entities/monsters.js` — 13 monster types across 10 floors
- `src/items/items.js` — 50+ items, identification system, loot tables, equipment stat application
- `src/rendering/renderer.js` — Canvas tilemap, fog of war, screen shake, damage numbers
- `src/ui/hud.js` — HUD, minimap, title/death/victory/help/inventory screens
- `src/main.js` — Game loop, input handling, save/load, permadeath

## Learnings

- (none yet — just joined)
