# Decisions

Team decisions that all agents must respect.

---

## 1. Shared Data Model & Architecture

**Author:** Sheldon (Lead + Dungeon Generation)  
**Date:** 2025-01-20  
**Status:** Active  

The foundational data model, game constants, and dungeon generator are now in place. All other agents must build against these interfaces.

### File Layout

```
index.html                  — Entry point, loads scripts in order, has <canvas id="game">
src/core/constants.js       — window.Constants (tile types, classes, items, phases)
src/core/utils.js           — window.Utils (seeded RNG, distance, grid helpers)
src/core/gameState.js       — window.GameState (state management, entity/item factories)
src/dungeon/generator.js    — window.DungeonGenerator (BSP dungeon gen)
```

### Script Load Order (mandatory)

1. `src/core/constants.js`
2. `src/core/utils.js`
3. `src/core/gameState.js`
4. `src/dungeon/generator.js`
5. _(rendering, entities, systems, UI, main — added by other agents)_

### Key Constants (from `window.Constants`)

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

### Character Classes (`Constants.CLASSES`)

| Class | HP | Mana | Stamina | Attack | Defense | Speed | Abilities |
|-------|----|------|---------|--------|---------|-------|-----------|
| WARRIOR | 120 | 20 | 100 | 14 | 12 | 8 | power_strike, shield_bash, war_cry |
| MAGE | 60 | 120 | 60 | 6 | 4 | 10 | fireball, ice_shard, arcane_shield |
| ROGUE | 80 | 40 | 120 | 12 | 6 | 14 | backstab, evade, poison_blade |
| CLERIC | 90 | 80 | 80 | 8 | 10 | 9 | heal, smite, divine_shield |

### Entity Model (`GameState.createEntity(opts)`)

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

### Item Model (`GameState.createItem(opts)`)

```js
{
  id, name, type ('weapon'|'armor'|'potion'|'scroll'|'ring'|'food'),
  slot, description, rarity ('common'|'uncommon'|'rare'|'epic'|'legendary'),
  floorLevel, identified (bool),
  statMods: { attack?, defense?, hp?, ... },
  x, y, floor  // null if in inventory
}
```

### Game State (`window.GameState`)

- **Phase control:** `getPhase()`, `setPhase(PHASES.X)` — phases: title, exploring, combat, inventory, dead, victory
- **Floor:** `getCurrentFloor()`, `setCurrentFloor(n)`, `getFloorData(n)`, `setFloorData(n, data)`
- **Turns:** `getTurnCounter()`, `advanceTurn()`
- **Entities:** `addEntity(e)`, `removeEntity(id)`, `getEntitiesOnFloor(f)`, `getEntityAt(x,y,f)`
- **Player:** `setPlayer(e)`, `getPlayer()`
- **Items:** `addGroundItem(i)`, `removeGroundItem(id)`, `getGroundItemsAt(x,y,f)`
- **Messages:** `addMessage(text, type)`, `getMessages(count)` — types: info, combat, loot, system
- **Lifecycle:** `newGame(seed)` — resets everything

### Dungeon Generator (`window.DungeonGenerator`)

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

### Utilities (`window.Utils`)

- `createRNG(seed)` → `{ random(), randInt(min,max), pick(arr), shuffle(arr) }`
- `manhattanDist(x1,y1,x2,y2)`, `euclideanDist(...)`, `chebyshevDist(...)`
- `getCardinalNeighbours(x,y)`, `getAllNeighbours(x,y)`
- `inBounds(x,y,w?,h?)`, `createGrid(w,h,fill)`, `generateId()`, `clamp(val,min,max)`

### Rules for Other Agents

1. **Never modify constants.js, utils.js, gameState.js, or generator.js** without Sheldon's review.
2. **Use `GameState.createEntity()` and `GameState.createItem()`** — don't hand-roll entity/item objects.
3. **Always check `Constants.WALKABLE_TILES`** before allowing movement.
4. **Floor data must be stored via `GameState.setFloorData()`** so all systems can access it.
5. **Seeded RNG:** Use `Utils.createRNG(seed)` for anything that needs to be deterministic.
6. **Global namespace:** All modules export via `window.X`. No import/export, no bundler.

---

## 2. Combat & AI Architecture

**Author:** Leonard  
**Date:** 2025-01-20  
**Status:** Implemented

Built the full combat + enemy AI stack. Key decisions other agents need to know:

### Decisions

1. **Status effects live on `entity.statusEffects[]`** — an array of `{ type, duration, ...params }` objects. Other systems creating entities should initialize this as `[]`. `CombatSystem.processTurnStart(entity)` must be called each turn to tick effects.

2. **Monster spawning API:** Call `MonsterFactory.spawnForFloor(floorIndex, rooms, rng)` after generating a floor. It handles entity creation and registration via `GameState.addEntity()`. Skip room[0] for spawning (player spawn room).

3. **AI processing:** Call `AISystem.processAllMonsters()` once per player turn. It handles initiative ordering, status effect ticks, and behavior dispatch for all living monsters on the current floor.

4. **Monster `tags` array** — monsters may have tags like `['undead']` or `['boss']`. The Cleric's Smite checks for `target.tags.includes('undead')`. Other systems should preserve this field.

5. **`entity.xpValue`** — monsters have this extra field for XP rewards on kill. Not part of the base `createEntity` schema but added by MonsterFactory.

6. **Script load order:** `combat.js` → `monsters.js` → `ai.js` (after `generator.js`, before `main.js`).

---

## 3. Rendering & Game Loop

**Author:** Howard  
**Date:** 2025-02-25  
**Status:** Implemented

### Script Load Order (Canonical)
1. `constants.js`, `utils.js`, `gameState.js` (core)
2. `generator.js` (dungeon)
3. `fov.js` (systems — no combat dependency)
4. `combat.js`, `ai.js` (systems — Leonard)
5. `monsters.js` (entities — Leonard)
6. `items.js` (items — Raj)
7. `renderer.js` (rendering — Howard)
8. `hud.js` (UI — Howard)
9. `main.js` (game loop — Howard, must be last)

### Teammate Module Guards
`main.js` guards all teammate module calls with `window.X && X.method` checks. This means the game runs even if combat/ai/monsters/items haven't loaded — it degrades gracefully to basic melee and no spawning.

### Render-on-Demand
The game loop uses a dirty flag (`needsRender`). It only redraws when player acts or state changes. This keeps CPU usage near zero between turns.

### FOV as String Set
`FOVSystem.compute()` returns a `Set<string>` of `"x,y"` keys. All systems (renderer, HUD mini-map, combat phase check) use this format for O(1) visibility lookups.

### Canvas-Only UI
All UI (HUD, title screen, death/victory screens) is drawn on the same `<canvas id="game">`. No DOM overlays. This keeps things simple and avoids z-index/event conflicts.

### Save Format
LocalStorage key `dc_save` stores JSON of the full game state. Key `dc_highscores` stores top-10 high scores. Permadeath deletes save on player death.

---

## 4. ItemSystem API

**Author:** Raj (Items + Loot)  
**Date:** 2025-02-25  
**File:** `src/items/items.js` → `window.ItemSystem`

### Summary

Complete item system with templates, loot tables, identification, and inventory management. Depends on `constants.js`, `utils.js`, `gameState.js` (load order matters).

### Public API

#### Initialization
- `ItemSystem.init(rng)` — Must be called once per new game after `GameState.newGame()`. Pass a seeded RNG (`Utils.createRNG(seed)`). Randomizes potion/scroll identification mappings.

#### Loot Generation
- `ItemSystem.generateLoot(floorIndex, rng)` — Returns `item[]` for a floor (0-indexed). Quantity scales 3-5 (floor 1) to 6-10 (floor 10). Rarity weights shift toward epic/legendary on deeper floors.
- `ItemSystem.placeItemsOnFloor(floorIndex, rooms, rng)` — Generates loot and scatters items into room interiors. Calls `GameState.addGroundItem()` for each.

#### Inventory Management
- `ItemSystem.pickupItem(entity, item)` — Removes from ground, adds to `entity.inventory`. Posts message.
- `ItemSystem.dropItem(entity, item)` — Removes from inventory, places at entity's position. Posts message.
- `ItemSystem.equipItem(entity, item)` — Equips item to matching slot. Auto-unequips current. Applies stat mods. Posts message.
- `ItemSystem.unequipItem(entity, slot)` — Unequips from slot string (e.g. `'weapon'`). Reverses stat mods. Returns item to inventory.
- `ItemSystem.useItem(entity, item)` — Consumes potions/scrolls/food. Applies effects. Identifies consumable type for rest of run. Removes from inventory.

#### Identification
- `ItemSystem.identifyItem(item)` — Reveals true name. Marks type as known for the run.
- `ItemSystem.isIdentified(item)` — Returns `true` if item (or its type) is identified. Equipment always returns `true`.
- `ItemSystem.getDisplayName(item)` — Returns the display name: real name if identified, randomized appearance if not.

#### Buff System
- `ItemSystem.tickBuffs(entity)` — Call once per turn. Decrements buff/debuff timers. Reverses effects when expired. Operates on `entity._buffs[]`.

#### Exposed Templates (read-only arrays for UI/tooltips)
`WEAPON_TEMPLATES`, `ARMOR_TEMPLATES`, `HELMET_TEMPLATES`, `BOOTS_TEMPLATES`, `RING_TEMPLATES`, `AMULET_TEMPLATES`, `FOOD_TEMPLATES`, `POTION_DEFS`, `SCROLL_DEFS`

### Key Patterns

- Items created via `GameState.createItem(opts)` — items store `_defKey` for potion/scroll linking.
- Consumables start with `identified: false`. Equipment is always identified.
- Stat mods on equipment change entity stats on equip/unequip (hp mod changes both `hp` and `maxHp`).
- Food applies instant healing + temporary buffs. Potions/scrolls trigger their `effect` function.
- Messages posted via `GameState.addMessage(text, type)` with types: `'loot'`, `'combat'`, `'system'`.

### Integration Notes

- **Howard (UI):** Use `ItemSystem.getDisplayName(item)` for all item display. Call `ItemSystem.init(rng)` during game startup. Wire inventory UI to `equipItem`, `unequipItem`, `useItem`, `dropItem`.
- **Leonard (Combat):** Call `ItemSystem.tickBuffs(entity)` once per turn for all entities. Check `item.special === 'fire_dot'` on Flamebrand for extra combat effects.
- **Sheldon (Dungeon):** Call `ItemSystem.placeItemsOnFloor(floorIndex, rooms, rng)` after floor generation.

---
