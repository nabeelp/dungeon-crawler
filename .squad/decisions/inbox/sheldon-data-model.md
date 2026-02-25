# Decision: Shared Data Model & Architecture

**Author:** Sheldon (Lead + Dungeon Generation)  
**Date:** 2025-01-20  
**Status:** Active  

---

## Summary

The foundational data model, game constants, and dungeon generator are now in place. All other agents must build against these interfaces.

## File Layout

```
index.html                  — Entry point, loads scripts in order, has <canvas id="game">
src/core/constants.js       — window.Constants (tile types, classes, items, phases)
src/core/utils.js           — window.Utils (seeded RNG, distance, grid helpers)
src/core/gameState.js       — window.GameState (state management, entity/item factories)
src/dungeon/generator.js    — window.DungeonGenerator (BSP dungeon gen)
```

## Script Load Order (mandatory)

1. `src/core/constants.js`
2. `src/core/utils.js`
3. `src/core/gameState.js`
4. `src/dungeon/generator.js`
5. _(rendering, entities, systems, UI, main — added by other agents)_

## Key Constants (from `window.Constants`)

| Constant | Value | Notes |
|----------|-------|-------|
| `TILES.WALL` | 0 | Blocks movement and sight |
| `TILES.FLOOR` | 1 | Walkable |
| `TILES.DOOR` | 2 | Walkable but blocks sight (closed) |
| `TILES.STAIRS_DOWN` | 3 | Walkable, triggers floor transition |
| `TILES.STAIRS_UP` | 4 | Walkable, triggers floor transition |
| `TILES.CORRIDOR` | 5 | Walkable (connects rooms) |
| `TILES.WATER` | 6 | Future use |
| `TILES.TRAP` | 7 | Walkable, triggers trap |
| `TILE_SIZE` | 32 | Pixels per tile |
| `MAP_WIDTH` | 50 | Grid width in tiles |
| `MAP_HEIGHT` | 50 | Grid height in tiles |
| `MAX_FLOORS` | 10 | Total dungeon depth |
| `FOV_RADIUS` | 8 | Field-of-view radius |
| `WALKABLE_TILES` | Set | Tiles the player/monsters can walk on |
| `OPAQUE_TILES` | Set | Tiles that block line of sight |

## Character Classes (`Constants.CLASSES`)

| Class | HP | Mana | Stamina | Attack | Defense | Speed | Abilities |
|-------|----|------|---------|--------|---------|-------|-----------|
| WARRIOR | 120 | 20 | 100 | 14 | 12 | 8 | power_strike, shield_bash, war_cry |
| MAGE | 60 | 120 | 60 | 6 | 4 | 10 | fireball, ice_shard, arcane_shield |
| ROGUE | 80 | 40 | 120 | 12 | 6 | 14 | backstab, evade, poison_blade |
| CLERIC | 90 | 80 | 80 | 8 | 10 | 9 | heal, smite, divine_shield |

## Entity Model (`GameState.createEntity(opts)`)

```js
{
  id, name, type ('player'|'monster'|'npc'),
  classKey, x, y, floor,
  hp, maxHp, mana, maxMana, stamina, maxStamina,
  attack, defense, speed,
  level, xp, abilities[],
  inventory[], equipment: { weapon, armor, helmet, boots, ring, amulet },
  ai, alive
}
```

## Item Model (`GameState.createItem(opts)`)

```js
{
  id, name, type ('weapon'|'armor'|'potion'|'scroll'|'ring'|'food'),
  slot, description, rarity ('common'|'uncommon'|'rare'|'epic'|'legendary'),
  floorLevel, identified (bool),
  statMods: { attack?, defense?, hp?, ... },
  x, y, floor  // null if in inventory
}
```

## Game State (`window.GameState`)

- **Phase control:** `getPhase()`, `setPhase(PHASES.X)` — phases: title, exploring, combat, inventory, dead, victory
- **Floor:** `getCurrentFloor()`, `setCurrentFloor(n)`, `getFloorData(n)`, `setFloorData(n, data)`
- **Turns:** `getTurnCounter()`, `advanceTurn()`
- **Entities:** `addEntity(e)`, `removeEntity(id)`, `getEntitiesOnFloor(f)`, `getEntityAt(x,y,f)`
- **Player:** `setPlayer(e)`, `getPlayer()`
- **Items:** `addGroundItem(i)`, `removeGroundItem(id)`, `getGroundItemsAt(x,y,f)`
- **Messages:** `addMessage(text, type)`, `getMessages(count)` — types: info, combat, loot, system
- **Lifecycle:** `newGame(seed)` — resets everything

## Dungeon Generator (`window.DungeonGenerator`)

```js
const floorData = DungeonGenerator.generate(floorIndex, seed);
// Returns:
// {
//   tiles: number[][]     — 50×50 grid of TILES.* values
//   rooms: {x,y,w,h}[]   — Room bounds for entity/item placement
//   stairs: { down: {x,y}|null, up: {x,y}|null }
//   explored: boolean[][] — Fog of war (all false initially)
// }
```

- BSP-based, deterministic (same seed → same dungeon)
- Floor difficulty ramps: tighter corridors, more complexity on deeper floors
- Use `rooms` array for spawning monsters and items (pick random room, random position inside it)

## Utilities (`window.Utils`)

- `createRNG(seed)` → `{ random(), randInt(min,max), pick(arr), shuffle(arr) }`
- `manhattanDist(x1,y1,x2,y2)`, `euclideanDist(...)`, `chebyshevDist(...)`
- `getCardinalNeighbours(x,y)`, `getAllNeighbours(x,y)`
- `inBounds(x,y,w?,h?)`, `createGrid(w,h,fill)`, `generateId()`, `clamp(val,min,max)`

## Rules for Other Agents

1. **Never modify constants.js, utils.js, gameState.js, or generator.js** without Sheldon's review.
2. **Use `GameState.createEntity()` and `GameState.createItem()`** — don't hand-roll entity/item objects.
3. **Always check `Constants.WALKABLE_TILES`** before allowing movement.
4. **Floor data must be stored via `GameState.setFloorData()`** so all systems can access it.
5. **Seeded RNG:** Use `Utils.createRNG(seed)` for anything that needs to be deterministic.
6. **Global namespace:** All modules export via `window.X`. No import/export, no bundler.
