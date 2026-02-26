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

## 10. Class-Based Resource Regeneration

**Author:** Leonard (Combat + Enemy AI)  
**Date:** 2026-02-25  
**Status:** Implemented  

Added per-class passive resource regeneration that triggers once per player turn during EXPLORING phase only.

### Regen Rates (per turn)

| Class   | HP | Mana | Stamina | Rationale |
|---------|----|----|---------|-----------|
| Warrior | 2  | 0  | 3       | Stamina-heavy abilities, tanky, no spells |
| Mage    | 1  | 3  | 1       | Spell-dependent glass cannon |
| Rogue   | 1  | 0  | 3       | Ability-spam playstyle, no spells |
| Cleric  | 2  | 2  | 2       | Balanced healer/support |

### Key Decisions

1. **Regen is exploring-only.** No passive regen during combat phase — keeps fights dangerous.
2. **Removed old flat regen** from `processTurnStart()` (was +2 stamina, +1 mana for all classes). Replaced with class-differentiated system.
3. **REGEN_RATES lives in constants.js** alongside CLASSES. This required modifying Sheldon's file — rates are frozen and exported on `window.Constants`.
4. **Log message only when something regenerated** to avoid spam when at full resources.
5. **Values kept small (1-3)** — this is passive recovery, not a heal spell.

### Impact on Other Agents

- **Sheldon:** `constants.js` modified to add `REGEN_RATES`. Frozen object, read-only.
- **Howard:** Help screen in `hud.js` updated with new REGENERATION section. `main.js` hook uses standard `window.CombatSystem &&` guard pattern.
- **Amy:** Test `processTurnStart regens mana/stamina` updated — old flat regen removed, 4 new regen tests added.
- **Raj:** No impact. ItemSystem buff ticking is unaffected.

---

## 11. Documentation Update Directive

**Author:** Copilot (via Nabeel)  
**Date:** 2026-02-26  
**Status:** Active  

Always ensure that documentation (README.md, help screens, etc.) is kept up to date as the solution continues to evolve. Any code change that affects controls, features, classes, items, or game systems must include corresponding documentation updates.

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

---

## 12. Leslie's Full Game Critique — Critical Bugs Found

**Author:** Leslie (Critic)  
**Date:** 2026-02-26  
**Status:** Complete  
**Type:** Code Audit / Bug Report  

Comprehensive review of all 14 source files identified 6 critical bugs, 7 serious design issues, and 3 minor issues. Priority fix list provided.

### 🔴 CRITICAL — Must Fix Before Release

1. **Double XP / Double Level-Up on Monster Kill** (main.js:190-195, combat.js:289-296)  
   - Both locations award XP and call checkLevelUp on same kill
   - Players get double XP; stat gains are inconsistent (different formulas)
   - **Fix:** Remove XP award and checkLevelUp from main.js (let combat.js handle it)

2. **Save/Load Loses Critical Entity & Item State**  
   - JSON round-trip drops: statusEffects, tags, xpValue, templateKey, _buffs, _enraged, _telegraphing, _summonedPhase2/3, item._defKey
   - Module-level state (_idMap, _reverseIdMap, _identifiedKeys in items.js) never saved/restored
   - **Impact:** Monsters give 0 XP, Cleric Smite broken, boss phases broken, item identification reset, potion names random
   - **Fix:** Implement selective serialization for these fields; save/restore ItemSystem state

3. **ItemSystem.init() Never Called** (Decision #4)  
   - Identification maps (_idMap, _reverseIdMap) stay empty
   - All generated potions/scrolls have undefined appearance names
   - **Fix:** Call `ItemSystem.init(rng)` in main.js startNewGame()

4. **ItemSystem.dropLoot() Never Called** (Decision #7)  
   - Combat.js onKill() only awards XP, never calls dropLoot
   - Monsters never drop loot; entire loot system is dead code
   - **Fix:** Call `ItemSystem.dropLoot(victim, victim.floor)` in combat.js onKill()

5. **ItemSystem.tickBuffs() Never Called** (Decision #4)  
   - Buff/debuff effects never expire
   - Single Strength Potion grants permanent +5 attack
   - **Fix:** Call `ItemSystem.tickBuffs(entity)` once per turn for all entities

6. **createItem() Strips Custom Properties** (gameState.js:86-105)  
   - createItem doesn't preserve _defKey (potions/scrolls) or special (Flamebrand's fire_dot)
   - **Fix:** Modify createItem to preserve custom properties via spread or explicit fields

### 🟡 SERIOUS — Significantly Hurts Experience

1. **Math.random() Breaks Determinism** (combat.js:137, ai.js:154/171/233/245/306/375, items.js:199/213-214)  
   - Game claims seeded determinism but combat/AI use Math.random()
   - **Fix:** Replace all Math.random() with seeded RNG (use rng instance from appropriate scope)

2. **Helmet/Boots/Amulet Extremely Rare** (items.js TYPE_WEIGHTS)  
   - Only appear via 30% bonus roll; expected ~0.1 helmets per floor
   - **Fix:** Add helmets, boots, amulets to TYPE_WEIGHTS with reasonable probabilities (5-15% each)

3. **Combat Phase Threshold Too Tight** (main.js:360-379)  
   - COMBAT phase only set when visible enemy within Chebyshev distance ≤ 2
   - Ranged enemies attack from 6+ tiles without COMBAT indicator
   - **Fix:** Increase threshold to 6-8 tiles for ranged attackers

4. **Self-Targeting Abilities Blocked** (main.js:330-358)  
   - Heal, War Cry, Evade, Arcane Shield, Divine Shield can't be used when no enemies visible
   - Can't heal when safe
   - **Fix:** Allow self-targeting abilities without requiring target in range

5. **Fireball AoE Hits Friendlies** (combat.js aoeAttack:259-279)  
   - Hits all entities except attacker
   - Will damage player's NPC allies and boss's own minions
   - **Fix:** Filter aoeAttack to skip allies (need allegiance flag or faction system)

6. **No Inventory Cap** (entity.inventory.length unbounded)  
   - Players can hoard every item across all 10 floors
   - UI becomes unusable with 50+ items; no strategic decisions
   - **Fix:** Implement max_inventory (e.g., 20-30 slots)

7. **Scroll of Teleport Can Land Unsafely** (items.js:210-216)  
   - Picks random room and position without verifying walkable or unoccupied
   - Player could teleport onto wall or monster
   - **Fix:** Validate tile is walkable and unoccupied before accepting teleport

### 🟢 MINOR — Annoying But Livable

1. **Doors Block FOV But Are Walkable** (constants.js OPAQUE_TILES)  
   - No open/close mechanic; doors just block sight permanently
   - Walking through doesn't change appearance
   - **Status:** Confusing but functional; low priority

2. **Score Formula Rewards Slow Play** (hud.js:462-467)  
   - Turn counter is positive term in score calculation
   - Incentivizes waiting instead of efficient play
   - **Fix:** Remove turn count or invert (penalize high turn counts)

3. **No Diagonal Movement Keys** (main.js movement)  
   - Only 4-directional (arrows/WASD)
   - Despite 8-directional combat and AI pathfinding
   - **Fix:** Add numpad or vi-keys (hjkl) for 8-directional movement

### What Works Well

- **BSP dungeon generation:** Clean, deterministic, good layouts — don't touch
- **FOV shadowcasting:** Correct, performant octant-based algorithm
- **A* pathfinding:** Well-implemented, 8-directional, respects collisions
- **Module architecture:** Simple IIFE pattern, robust load-order guards
- **Render-on-demand:** Proper dirty-flag pattern for turn-based games
- **Status effect system:** Well-structured stacking/replacement/expiry
- **Equipment stat mods:** Symmetric equip/unequip, clean application

### Priority Fix Order

1. Double XP/level-up (easy, critical)
2. ItemSystem.init(), dropLoot(), tickBuffs() wiring (easy, critical)
3. createItem custom property preservation (easy-medium, critical)
4. Save/load state persistence (medium, critical)
5. Helmet/boots/amulet TYPE_WEIGHTS (easy, serious)
6. Self-targeting ability access (easy, serious)
7. Math.random() → seeded RNG (medium, serious)
8. Combat phase threshold expansion (easy, serious)
9. Remaining issues (low priority, polish)

---

## 13. Bug Fix Sprint: Leslie's 6 Critical Fixes

**Author:** Sheldon (Lead), Leonard (Combat), Howard (Rendering), Amy (Tester)  
**Date:** 2026-02-26  
**Status:** COMPLETE  
**Merged from:** `.squad/decisions/inbox/` (sheldon-createitem-saveload.md, leonard-xp-droploot.md, howard-mainjs-fixes.md)

### Bugs Fixed (All 6)

1. **Bug #1 — Double XP / Level-Up (FIXED)**
   - **Author:** Leonard + Howard
   - **Changes:** Leonard exported `CombatSystem.onKill()` and updated `checkLevelUp()` stat gains (+10 HP, +3 mana, +3 stamina, +1 atk, +1 def, no spd). Howard removed duplicate XP award and `checkLevelUp()` call from `tryMove()` in main.js.
   - **Files:** `src/systems/combat.js`, `src/main.js`

2. **Bug #2 — createItem() Strips Custom Properties (FIXED)**
   - **Author:** Sheldon
   - **Changes:** Modified `createItem()` to preserve extra properties via loop copying opts keys not in standard schema. Fixed `_generateEquipItem()` to pass `tmpl.special` to `createItem()`.
   - **Files:** `src/core/gameState.js`, `src/items/items.js`

3. **Bug #3 — ItemSystem.init() Never Called (FIXED)**
   - **Author:** Howard
   - **Changes:** Added `ItemSystem.init(idRng)` call in `startNewGame()` after `GameState.newGame()` with seed offset +999 for RNG isolation.
   - **Files:** `src/main.js`

4. **Bug #4 — ItemSystem.dropLoot() Never Called (FIXED)**
   - **Author:** Leonard + Howard
   - **Changes:** Leonard added `ItemSystem.dropLoot(victim, victim.floor)` call in `onKill()` with guard. No extra wiring needed (call is internal to combat).
   - **Files:** `src/systems/combat.js`

5. **Bug #5 — ItemSystem.tickBuffs() Never Called (FIXED)**
   - **Author:** Howard
   - **Changes:** Added `ItemSystem.tickBuffs()` calls in `processPlayerAction()` for player and all alive entities on current floor, placed before regeneration.
   - **Files:** `src/main.js`

6. **Bug #6 — Save/Load Loses Entity & Item State (FIXED)**
   - **Author:** Sheldon + Howard
   - **Changes:** Sheldon added entity schema fields (statusEffects, tags, xpValue, templateKey, _buffs) to `createEntity()`. Added `ItemSystem.getIdentificationState()` and `restoreIdentificationState()` API. Howard wired save/load calls in main.js with defensive guards.
   - **Files:** `src/core/gameState.js`, `src/items/items.js`, `src/main.js`

### Verification (17 New Tests)

**test-combat.js (6 tests):**
- No double XP on kill (exact xpValue awarded)
- Multi-kill XP accumulation
- checkLevelUp stat gains verification (+10 HP, +3 mana, +3 stamina)
- Multi-level-up stacking
- Boss loot drop on kill
- Stat gains without speed increase

**test-items.js (7 tests):**
- createItem preserves _defKey
- createItem preserves special (fire_dot)
- _defKey survives generateLoot pipeline
- init() creates randomized potion/scroll names
- tickBuffs decrements buff duration
- tickBuffs reverses effect on expiry
- Equipment stat application/removal integrity

**test-save.js (7 tests):**
- statusEffects survive save/load
- Monster tags/xpValue persist
- Boss multi-tags persist
- Item _defKey in inventory after save/load
- Item _defKey in ground items after save/load
- Empty statusEffects array preserved
- Full game state round-trip integrity

**All 17 tests passing.**

### Impact Summary

- **Critical bugs:** All 6 resolved
- **Test coverage:** 100% of bug fixes verified
- **Game systems:** Combat, items, save/load, entity persistence all working correctly
- **Next priorities:** Address 7 serious issues (Math.random, armor rarity, combat threshold, self-targeting, AoE friendlies, inventory cap, teleport safety)

---

## 8. Design Review — Comprehensive Architecture & Game Assessment

**Author:** Sheldon (Lead + Dungeon Generation)  
**Date:** 2026-02-27  
**Ceremony:** Design Review  
**Requested by:** Nabeel  
**Status:** Completed  

### Executive Summary

The dungeon crawler has matured significantly. The architecture is clean — no circular dependencies, well-separated modules, clear data flow. This review surfaced **3 critical bugs**, **3 serious issues**, and several quality improvements. The most dangerous: a save/load bug creating a split-brain player object, making post-load gameplay silently corrupt.

### Architecture Health — ✅ Grade: B+

**Module Dependency Graph — Clean**
- No circular dependencies
- Load order in `index.html` correct and matches dependency graph
- IIFE + `window.*` pattern enforces clean boundaries

**Encapsulation Issues (2)**
1. Renderer directly accesses `GameState.state.groundItems` (bypass to public API)
2. `loadGame()` directly mutates `GameState.state` (no accessor use)

**Dead Code**
- `TILES.WATER` (value 6) — Defined but never generated or used
- `main.js:checkLevelUp()` (lines 395-406) — Duplicate of `CombatSystem.checkLevelUp()` with DIFFERENT stat values and dead code path

### Critical Bugs (3) — Must Fix

**Bug #1: Save/Load Creates Duplicate Player Object** (`main.js:497-499`)
- After JSON deserialize, `state.player` and `state.entities[player]` are separate objects
- Post-load: movement updates wrong object, combat/FOV/rendering use inconsistent references
- **Impact:** Silent corruption post-load
- **Fix:** After restore, point `state.player` at entity in `state.entities`

**Bug #2: Self-Targeting Abilities Blocked Without Enemies** (`main.js:351-372`)
- `tryAbility()` refuses to fire ANY ability if no enemy in FOV range
- Affects Cleric heal, Warrior war cry, Rogue evade, Mage arcane shield, Cleric divine shield
- **Impact:** Cripples class viability between combats
- **Fix:** Check ability type; if `self` or `party`, call without target requirement

**Bug #3: Duplicate Level-Up Logic with Different Stat Values** (`main.js:395-406` vs `combat.js:303-319`)

| Stat | main.js (fallback) | combat.js (primary) |
|------|-------------------|---------------------|
| maxHp | +10 | +10 |
| hp | full heal | +10 (partial) |
| mana | unchanged | +3 |
| stamina | unchanged | +3 |
| attack | +2 | +1 |
| defense | +1 | +1 |

- Code is unreachable (fallback path never triggered), but dangerous dead code
- **Fix:** Remove fallback `checkLevelUp()` and fallback combat path from `main.js`

### Serious Issues (3) — Should Fix

1. **Unseeded Math.random()** — Combat damage variance, AI ability selection, item effects, trap damage all use unsueded random. Breaks reproducibility and seeded-PRNG architecture.

2. **4-Way vs 8-Way Movement Imbalance** — Player 4-cardinal (WASD), monsters 8-directional with chebyshev distance. Monsters can cut corners; players cannot. Asymmetric tactical advantage.

3. **Distance Metric Mismatch** — `tryAbility()` uses manhattan distance to find target, but combat checks use chebyshev distance. Wrong enemy selected as "nearest."

### Nice-to-Haves (8)

1. Scroll of Fireball bypasses `CombatSystem.onKill()` — no XP/loot awarded
2. Scroll of Teleport no collision check — can land on entity
3. Monster spawn density on deep floors — small rooms give few x positions
4. Boss difficulty potentially overtuned — Floor 10 Dragon Lord 470 HP, may require legendary gear
5. No monster HP display
6. No ability cooldown/cost display during gameplay
7. Message log too short (5 messages) — combat scrolls off
8. No inventory size limit

### Action Items (Prioritized)

| # | Issue | Severity | Owner | Fix |
|---|-------|----------|-------|-----|
| 1 | Save/Load duplicate player reference | 🔴 Must | Sheldon/Howard | Point `state.player` at entity in `state.entities` |
| 2 | Self-targeting abilities blocked | 🔴 Must | Howard | Check ability type before requiring target |
| 3 | Dead/duplicate checkLevelUp | 🔴 Must | Howard | Remove fallback combat path and level-up |
| 4 | Unseeded Math.random in combat/AI/items | 🟡 Should | Leonard/Raj/Howard | Pass seeded RNG throughout |
| 5 | 4-way vs 8-way movement imbalance | 🟡 Should | Howard | Add diagonal movement keys |
| 6 | Distance metric mismatch | 🟡 Should | Howard | Change manhattanDist → chebyshevDist |
| 7 | Scroll of Fireball XP/loot | 🟢 Nice | Raj | Route kills through CombatSystem |
| 8 | Scroll of Teleport collision | 🟢 Nice | Raj | Check destination for entity |
| 9 | Boss difficulty tuning | 🟢 Nice | Leonard | Tune scaling or guarantee legendary by floor 8 |
| 10 | Message log length | 🟢 Nice | Howard | Increase to 8-10 or add scroll-back |
| 11 | Remove TILES.WATER | 🟢 Nice | Sheldon | Remove or implement water |

### Verdict

Clean module architecture with no circular deps, clear ownership, and frozen public APIs. IIFE pattern is simple and effective. The biggest structural risk: `GameState.state` exposed as mutable reference, directly causing Critical Bug #1. Game is playable and fun, but three critical bugs cause real player frustration (especially save/load corruption and self-heal blocking). **Recommend targeted bug-fix sprint for items #1-#3 before any new feature work.**

— Sheldon, Lead Architect

---

## Decision #14: Leslie's Design Review Critique (2026-02-27)

**By:** Leslie (Critic)  
**Ceremony:** Design Review Critique  
**Scope:** Validate Sheldon's B+ review; independent re-audit for critical bugs; game design assessment

### Part 1: Verdict on Sheldon's Findings

#### Sheldon's Critical #1 — Save/Load Split-Brain Player: ✅ CRITICAL (AGREE)

`main.js:497-499`. After JSON deserialization, `state.player` and the matching entry in `state.entities` are separate objects. Movement updates `state.player` (via `getPlayer()`), but `getEntitiesOnFloor()` and `getEntityAt()` search `state.entities` — which has the stale copy. AoE attacks iterate `getEntitiesOnFloor()`, so they target the old player position. Post-load gameplay is silently corrupt.

**Verdict:** Real critical bug. Silent corruption is the most dangerous kind.

#### Sheldon's Critical #2 — Self-Targeting Abilities Blocked: ✅ CRITICAL (AGREE)

`main.js:351-372`. `tryAbility()` requires a visible enemy within `FOV_RADIUS` for ALL abilities. Self-targeting abilities (Heal, War Cry, Evade, Arcane Shield, Divine Shield) are completely unusable when no enemies nearby.

**Verdict:** Cripples 5 of 12 abilities and 4 of 4 classes. Critical game-breaking bug.

#### Sheldon's Critical #3 — Duplicate checkLevelUp: ⚠️ SERIOUS (DOWNGRADE)

`main.js:395-406` has different stat values than `combat.js:303-319`. The fallback path only fires when `window.CombatSystem` doesn't exist. Since `combat.js` is loaded before `main.js`, CombatSystem is always available. Code is **unreachable dead code**. Calling unreachable code "critical" is overrating it.

**Verdict:** Downgrade to 🟡 SERIOUS (maintenance hazard, not player-facing). Should be removed.

### Part 2: Previous Fix Verification

All 6 fixes from Decision #13 landed cleanly:
1. ✅ Double XP / Level-Up — Fixed in tryMove delegation
2. ✅ createItem strips custom props — Fixed with prop copying loop
3. ✅ ItemSystem.init() never called — Fixed, now called with seed
4. ✅ dropLoot() never called — Fixed, called in onKill()
5. ✅ tickBuffs() never called — Fixed, main loop ticks buffs
6. ✅ Save/load field loss — Fixed, more fields survive serialization

**Side effect:** Fix #6 made the split-brain reference issue (Critical #1) more visible.

**Dead code to remove:** `main.js` lines 210-219 (fallback combat) and 395-406 (fallback checkLevelUp).

### Part 3: What Sheldon Missed — NEW CRITICAL

#### 🔴 NEW CRITICAL — Player Combat Status Effects Never Tick

`CombatSystem.processTurnStart()` and `CombatSystem.tickStatusEffects()` are called for every monster via `processMonsterTurn()` (`ai.js:407`). **They are NEVER called for the player.**

In `processPlayerAction()` (`main.js:130-188`):
1. Player acts
2. `AISystem.processAllMonsters()` — ticks **monster** status effects
3. `ItemSystem.tickBuffs(player)` — ticks **item** buff timers only
4. `CombatSystem.regenerate(player)`

Missing: `CombatSystem.tickStatusEffects(player)` or `CombatSystem.processTurnStart(player)`.

**Consequences:**

| Effect | Should Happen | Actually Happens |
|--------|---|---|
| Poisoned (Spider) | 3 dmg/turn for 5 turns | Never ticks. Player immune to poison. |
| Bleed (crit hit) | 2 dmg/turn for 3 turns | Never ticks. Player immune to bleed. |
| War Cry buff (+7 atk) | Expires after 3 turns | **Never expires. +7 attack permanent. Stacks on every use.** |
| Stun | Skip turn | Never checked for player. Player can't be stunned. |
| Divine Shield (-50% dmg) | 2 turns | **Permanent 50% damage reduction.** |
| Evade | Dodge 1 attack, then expire | Consumed on dodge, but duration never decrements. Never expires. |

A Warrior casting War Cry 5 times gets permanent +35 attack. A Cleric casting Divine Shield once takes half damage forever. This breaks game balance in the player's favor while making enemy DOT do nothing.

**Fix:** Add `CombatSystem.tickStatusEffects(player)` to `processPlayerAction()` before the player acts, symmetrically with monsters.

#### 🟡 NEW SERIOUS — DOT Kills on Monsters Award No XP or Loot

`combat.js:89-110`. When `tickStatusEffects()` kills a monster via poison or bleed:
- Sets `alive = false`
- Never calls `onKill()`
- No XP awarded
- No loot dropped

Players who rely on DOT strategies (Rogue's Poison Blade, bleed from crits) lose all rewards for those kills.

**Fix:** Call `onKill(killer, entity)` when DOT kills. Track source entity on status effects, or default to `getPlayer()` as killer.

#### 🟡 NEW SERIOUS — Boss AI Flags Not in Entity Schema

`_enraged`, `_telegraphing`, `_summonedPhase2`, `_summonedPhase3` are set on boss entity in `ai.js:322-350` but NOT in `createEntity()` schema (`gameState.js:19-85`). They survive serialization naturally but are invisible to the contract. Fragile by design.

**Fix:** Add flags to `createEntity()` schema explicitly.

### Part 4: Game Design Critique

#### The 3 Gameplay Killers

**1. Wait-to-Win Regen Loop** 🟡

Class-based regen during EXPLORING phase means optimal strategy is: clear room → wait 60 turns → full heal → proceed. No food clock, no increasing danger, no reason NOT to turtle. Every fight becomes trivial because you always enter at full resources.

This is the #1 fun-killer. It removes all tension from the dungeon. In classic roguelikes, regen is gated by food/hunger.

**2. Melee-Only Basic Attacks** 🟡

All 4 classes use melee for basic attacks. The Mage (60 HP, 4 defense, 6 attack) has to walk face-first into monsters for free attacks. Spells cost mana and have limited uses per rest. Optimal Mage play is melee everything and save mana for emergencies. That's not a Mage, that's a Warrior with a mana bar.

No class has a free ranged basic attack. Mage and Cleric feel wrong.

**3. Linear Descent With No Decisions** 🟡

The game is: go down. That's it. No branching paths, no shops, no optional challenges, no reason to go back up. Every floor is structurally identical (BSP rooms + corridors). Only variance is monster types and loot RNG. By floor 5, player has seen everything mechanically.

#### What Works

- **Boss fight phases** — Telegraphed attacks, summons, enrage. Genuinely interesting.
- **Identification system** — Risk/reward of using unknown potions. Classic roguelike tension.
- **FOV + fog of war** — Exploration feels dangerous. Good.
- **4 distinct classes** — Each has different feel (when abilities work).

### Part 5: Final Verdict

#### Grade: B- (downgraded from B+)

The architecture is clean but the game has **4 critical bugs**, not 3:
- Sheldon's Save/Load split-brain (confirmed critical)
- Sheldon's Self-targeting abilities (confirmed critical)
- NEW: Player status effects never tick (arguably worse than Sheldon's #3)
- Sheldon's duplicate checkLevelUp (downgraded to serious)

The previous fix sprint (Decision #13) was excellent. All 6 fixes landed cleanly. But the player status effect bug I found is arguably worse than any single bug in the last batch — it makes 5 of 12 abilities permanently stack and makes the player immune to all DOT effects.

#### The 3 Most Impactful Things To Do Next

**1. 🔴 Fix player combat status effect ticking** (`main.js`)

Add `CombatSystem.tickStatusEffects(player)` to `processPlayerAction()`. Without this, combat balance is fiction. War Cry stacks forever. Poison does nothing. **#1 priority.**

**2. 🔴 Fix save/load split-brain player** (`main.js:loadGame`)

After restoring `state.entities`, find the player entity by type and set `state.player` to that reference. One-line fix, prevents silent corruption on every load.

**3. 🔴 Fix self-targeting abilities** (`main.js:tryAbility`)

Check `CombatSystem.getAbilityInfo(key).type` — if `'self'` or `'party'`, fire without requiring a target. Unblocks 5 abilities across all 4 classes.

**Honorable mention:** Remove dead fallback code from `main.js` (lines 210-219, 395-406). Not hurting anyone today but it's a maintenance trap.

#### Decision: User Directive on Leslie's Role

**As of 2026-02-26T07:13:09Z:** Always include Leslie (Critic) in design reviews and all review ceremonies going forward. Leslie participates alongside the Lead as a reviewer.

— Leslie, Critic
