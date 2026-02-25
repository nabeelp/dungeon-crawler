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

## 5. Help Screen, Inventory UI, Title Controls

**Author:** Howard (Rendering + Fog of War)  
**Date:** 2026-02-25  
**Status:** Implemented

### Summary

Added three UI features to hud.js and main.js:

### 1. Help Screen Overlay (`?` / `h` in-game)
- Full-screen overlay with all game controls organized into 4 sections
- Uses a boolean flag (`showHelp`) — no new game phase required
- Closable via `?`, `h`, or `Esc`

### 2. Interactive Inventory UI (`i` in-game)
- Full-screen overlay with item list, equipped markers (★), detail panel
- Supports equip/unequip (`e`), use (`u`), drop (`d`), navigation (↑↓)
- Integrates with ItemSystem API (equipItem, unequipItem, useItem, dropItem, getDisplayName)
- Falls back gracefully when ItemSystem is not loaded

### 3. Title Screen Controls Section
- Added a controls quick-reference between the start prompt and high scores

### Impact on Other Agents

- **No new game phases added.** Help and inventory are boolean overlay flags, not game phases.
- **Input interception:** When overlays are visible, game input is blocked. This is handled in main.js `handleKeyDown` before checking game phase input.
- **HUD API expanded:** New public methods on `window.HUD`: `toggleHelp`, `isHelpVisible`, `toggleInventory`, `isInventoryVisible`, `getInventoryIndex`, `setInventoryIndex`, `closeInventory`.
- **Key conflicts:** `h`/`H` now opens help instead of being available for other bindings. `?` was previously unused.

---

## 6. XP Progression Curve Fix

**Author:** Sheldon (Lead + Dungeon Generation)  
**Date:** 2025-07-16  
**Status:** Implemented  

The XP leveling curve used `Math.pow(1.4, i)` which grew exponentially too fast. By level 20, a player needed 29,881 XP per level while floor 10 monsters (with the old 0.1 floor scaling) only gave ~120-950 XP. Leveling past floor 7 was effectively impossible.

### Changes

**XP_PER_LEVEL curve (constants.js):** Changed multiplier from **1.4** to **1.25**.

| Level | Old (1.4x) | New (1.25x) |
|-------|-----------|-------------|
| 1     | 50        | 50          |
| 5     | 192       | 122         |
| 10    | 1,033     | 372         |
| 15    | 5,556     | 1,136       |
| 20    | 29,881    | 3,469       |

**Monster XP floor scaling (monsters.js):** Changed floor multiplier from **0.1** to **0.3** in `createMonster()`. Formula: `xpValue * (1 + floorIndex * 0.3)`

### Rationale

- 1.25x was chosen because 1.2 undershoots target ranges. 1.25 lands level 10 at 372 XP and level 20 at 3,469 XP — both achievable with normal encounter rates.
- The 0.3 floor scaling ensures deeper floors feel rewarding. Players killing 10–15 late-game monsters per floor can realistically level up.

### Impact

- **combat.js** reads `victim.xpValue` on kill — benefits automatically.
- **hud.js** displays `XP_PER_LEVEL` — shows correct new values automatically.

---

## 7. Equipment Stats & Monster Loot Drops

**Author:** Raj (Items + Loot)  
**Date:** 2025-07-24  
**Status:** Implemented

Added public `applyEquipmentMods(entity, item)` and `removeEquipmentMods(entity, item)` functions to `ItemSystem`. These cleanly wrap the internal stat modifier logic and are now the sole path for equipment stat changes in `equipItem()` and `unequipItem()`.

Added `dropLoot(monster, floorIndex)` for monster loot drops on death.

### Decisions

1. **Equipment stat mods are applied via named public functions.** `applyEquipmentMods` and `removeEquipmentMods` are exported on `window.ItemSystem`. Other systems can call these directly if needed (e.g., cursed items, temporary equipment effects).

2. **Slot replacement is safe.** When equipping into an occupied slot, `unequipItem` is called first, which calls `removeEquipmentMods` on the old item before `applyEquipmentMods` is called on the new one. Stats are always consistent.

3. **Monster loot drops use `dropLoot(monster, floorIndex)`.** Returns an array of dropped items already placed on the ground. Drop chance: 35% for normal monsters, 100% for bosses. Normal monsters drop 1 item (15% chance of 2), bosses drop 2-4 items. Rarity scales with floor depth using existing loot tables.

### Integration Notes

- **Leonard (Combat):** Call `ItemSystem.dropLoot(victim, victim.floor)` inside `onKill()` when a monster dies (after XP award). The function handles ground item placement and loot messages automatically.
- **Howard (Rendering):** Dropped items appear as ground items at the monster's death position — no rendering changes needed.
- **Sheldon (Dungeon):** No changes needed. `dropLoot` reuses `_generateSingleItem` and existing loot table weights.

---

## 8. Combat Balance & Boss Mechanics Overhaul

**Author:** Leonard (Combat + Enemy AI)
**Date:** 2025-07-24
**Status:** Implemented

Major combat balance pass, combat feedback improvements, and boss mechanics enhancement across `combat.js` and `ai.js`.

### Changes

**Class Balance:**

| Change | Before | After | Rationale |
|--------|--------|-------|-----------|
| Cleric Heal cost | 20 mana | 30 mana | No-cooldown 40HP heal was OP sustain |
| Cleric Heal amount | 40 HP | 25 HP | Forces mana management |
| Rogue Evade duration | 2 turns | 1 turn | 2 free dodges for 15 stamina was too much |
| Warrior War Cry ATK | +5 | +7 | Compensates for melee-only risk |

**New Status Effects:**

- **BLEED**: Stacking DoT (2 dmg/turn, 3 turns). Triggered on critical hits. Multiple crits stack damage additively.
- **VULNERABLE**: Target takes +25% damage for 3 turns. Applied in `applyDamage()` before shield calculations.

**Combat Feedback:**

- All attack messages now include `[X% HP]` suffix showing target health percentage.
- Critical hits (dealt > 1.5x reference base damage) prefixed with `CRITICAL!` and auto-apply BLEED.
- Status effects display `"is fading! (1 turn left)"` warning before expiring.
- New `postAttackMsg()` helper exposed on `CombatSystem` for consistent formatting.
- New `hpPercent()` helper exposed on `CombatSystem`.

**Boss Mechanics (Dragon Lord):**

- **Enrage at 25% HP**: +2 speed, attacks twice per turn (calls `bossRegularAction` twice).
- **Telegraph**: 20% chance per turn below 50% HP to telegraph: `"Dragon Lord draws a deep breath..."`. Next turn executes 3x melee or 2.5x AoE fire breath.
- **Scaled summons**: 2 whelps at 50% HP, 3 more at 25% HP, hard cap of 4 active minions (`countActiveMinions` check).
- **Summon limit**: `_summonedPhase2` and `_summonedPhase3` flags prevent re-summoning. `Math.min(count, 4 - active)` enforces the cap.

### Impact on Other Agents

- **Howard (Rendering):** No HUD changes needed — status effects still live on `entity.statusEffects[]`. Two new types (`bleed`, `vulnerable`) may want visual indicators.
- **Raj (Items):** No changes needed. `ItemSystem.tickBuffs()` call order unchanged.
- **Sheldon (Core):** No core changes needed.

---

## 9. Visual Polish: Screen Shake, Damage Numbers, Pulsing Stairs

**Author:** Howard (Rendering + Fog of War)  
**Date:** 2025-07-17  
**Status:** Implemented

Added three visual juice systems to renderer.js with game loop integration in main.js.

### 1. Screen Shake

- `Renderer.triggerShake(intensity)` — intensity is pixel offset (2=light, 4=medium, 6=strong)
- Decays linearly over 8 frames, applies random offset to camera each frame
- Uses `Math.max` to prevent accumulation — strongest active shake wins
- Shake offset resets to zero cleanly when duration expires

### 2. Floating Damage Numbers

- `Renderer.spawnDamageNumber(x, y, amount, type)` — x/y in tile coords
- Types: `'player_damage'` (red), `'enemy_damage'` (white), `'heal'` (green), `'critical'` (yellow, larger font)
- Particles float upward 40px and fade out over 1 second
- Stored in a flat array, rendered on top of all tiles/entities, auto-removed when faded

### 3. Pulsing Stairs

- STAIRS_DOWN and STAIRS_UP tiles pulse opacity 0.7→1.0 when visible in FOV
- Uses stateless `Math.sin(Date.now() / 500)` — no per-tile state needed
- Only applies when tile is currently visible (not explored-but-fogged)

### Impact on Other Agents

- **Leonard (Combat/AI):** Can call `Renderer.triggerShake()` and `Renderer.spawnDamageNumber()` after combat resolution to add visual feedback. Guard with `window.Renderer && Renderer.triggerShake`.
- **Main.js game loop:** Now checks `Renderer.hasActiveAnimations()` each frame. When animations are active, rendering is continuous. When idle, returns to dirty-flag mode (zero CPU).
- **No new dependencies.** All effects are self-contained in renderer.js.
