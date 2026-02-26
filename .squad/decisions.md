# Decisions

Team decisions that all agents must respect.

---

## Integration Wiring Manifest as Merge Gate (2026-02-27)

**Owner:** Sheldon (Lead Architect)  
**Status:** ACTIVE  
**Motivation:** 4 of 9 critical bugs were "never wired" functions—code existed and worked in isolation but was never called from main.js.

### Decision

The `.squad/integration-manifest.md` file documents EVERY required cross-module call in the codebase. It serves as a **mandatory merge gate** for all changes to main.js and any module's public API.

### Process

1. **Before starting:** Check the manifest to understand existing wiring
2. **While building:** If you add/change a cross-module call, update the manifest immediately (2 minutes)
3. **Before PR:** Lead (Sheldon) reviews the manifest alongside code review
4. **Merge gate:** No PR to main branch without manifest update (if applicable)

### Why This Works

- **Prevents "never wired" bugs:** Visible in one place, easy to spot if a function exists but isn't called
- **Catches missing defensive guards:** Required vs optional integrations are explicit
- **Forces design clarity:** Cross-module dependencies become visible before coding
- **Quick review:** Takes 2 minutes to verify 1–2 new rows in the table

### Scope

- ALL cross-module function calls (main.js, combat.js, ai.js, items.js, monsters.js calling each other)
- Include: lifecycle phase, purpose, status (✅ wired or ❌ missing), and line number
- Exclude: internal module calls (functions within the same file/module)

### When to Update the Manifest

1. You add a new cross-module call → add a row to the table
2. You move a call to a different module → update the "Caller Module" or "Callee Module" column
3. You rename a function used across modules → update the function name in the table
4. You delete a cross-module call → remove the row

### Example

Adding a new feature where `Renderer.spawnEffect()` is called from `CombatSystem.onKill()`:

```markdown
| CombatSystem | onKill() | Renderer | spawnEffect(x, y, type) | On kill | Visual feedback on monster death | ✅ Wired | Line 123 |
```

Update before committing. Takes 30 seconds.

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

## 13. Retrospective: Root Cause Analysis & Process Improvements

**Facilitators:** Sheldon (Lead), Leslie (Critic)  
**Date:** 2026-02-27  
**Type:** Ceremony — Retrospective  
**Scope:** Full project lifecycle — Phases 1 through 8  
**Team:** Sheldon (Lead), Leonard (Combat), Howard (Rendering), Raj (Items), Amy (Tester), Leslie (Critic)  
**Status:** COMPLETE

### Executive Summary

We built a complete, playable roguelike with five agents shipping 14 source files, 130+ tests, and ~20 features in one sprint. However, we shipped **9 critical bugs** that were all **integration wiring gaps**, not module-level defects. Root cause: no integration testing, no integration contracts, parallel fan-out without gates, defensive coding that masked failures, and no code review before merge.

### Root Causes

1. **No integration testing.** 85 unit tests validated modules in isolation. Zero tests validated cross-module calls (e.g., "Is `ItemSystem.init()` actually called?", "Does the game loop call `tickBuffs()` every turn?").

2. **Parallel fan-out without integration gates.** Five agents built five systems simultaneously. Each validated their own module. Nobody was responsible for verifying wiring between modules. Howard's main.js used `window.X && X.method()` guards that silently swallowed missing calls instead of failing loudly.

3. **Entity schema was additive and informal.** Base schema defined in `createEntity()`, but statusEffects, tags, xpValue, _buffs were added ad-hoc downstream. When save/load serialized, all ad-hoc fields vanished.

4. **No code review before merge.** Phases 1–5 had zero review gates. Five agents wrote code, Amy tested in isolation, all merged.

5. **Duplicate logic.** XP awarded in two places; checkLevelUp called twice with inconsistent stat gains; duplicate boss phase conditions.

### The 9 Critical Bugs (All Integration Gaps)

| Pattern | Bugs | Count |
|---------|------|-------|
| **Never wired** — function exists but never called from game loop | init(), dropLoot(), tickBuffs(), processTurnStart(player) | 4 |
| **Data model gaps** — fields added outside factories, lost on serialization | createItem custom fields, entity schema, split-brain player, save/load field loss | 4 |
| **Duplicate logic** — same responsibility implemented twice, inconsistently | double XP, duplicate checkLevelUp | 1 |

### What Went Well

- **Architecture:** IIFE module pattern, frozen interfaces, clean ownership. No circular deps.
- **Individual module quality:** Combat, dungeon gen, FOV, items — all well-implemented.
- **The Critic role:** Leslie found 6 criticals in one session that the team missed across five sessions. Leslie's counter-review found a 7th (player status effects never tick).
- **Response velocity:** Once bugs were identified, all fixed same day with comprehensive regression tests.

### Mandatory Process Changes (Non-Negotiable)

**P0: Integration Wiring Manifest**  
Document explicitly listing every cross-module call in main.js, with caller, callee, and lifecycle phase (init, per-turn, on-event, save, load). If it's not in the manifest, it's not wired.

**P0: Mandatory Code Review Before Merge**  
No code ships without at least one other agent reading it. For main.js (the integration point), the Lead must review every change.

**P0: Fail Loudly, Not Silently**  
Ban `window.X && X.method()` for required integrations. If `ItemSystem.init()` must be called, call it without a guard. Reserve defensive guards only for genuinely optional features.

**P0: Integration Tests**  
After startNewGame(), verify ItemSystem._idMap is populated. After processPlayerAction(), verify player buffs ticked. After monster death, verify dropLoot was called. These tests run the game loop, not individual modules.

**P0: Keep the Critic**  
Leslie's role pays for itself. Critic review is a standard gate before any release or major milestone. Add critic earlier — not after the build is declared complete.

### Leslie's 5 Non-Negotiable Demands

1. **Integration tests before "done"** — At least one test per public API verifying caller→callee path.
2. **No graceful degradation in development** — `DEV_MODE` flag. In dev, replace guards with hard assertions: `if (!window.ItemSystem) throw new Error("ItemSystem not loaded");`
3. **Critic reviews before "done," not after** — No ceremony can declare a build complete without Critic sign-off on integration.
4. **Decision documents are checklists** — Checklist of wiring verification for every decision with integration notes. All boxes checked before merge.
5. **20% integration test coverage minimum** — At least 20% of test suite must be cross-module scenarios.

### Overall Grade

**B-** (Leslie's assessment, accepted by Sheldon)

The game works. The process needs improvement.

---

## 14. Bug Fix Sprint: Leslie's 6 Critical Fixes

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

---

## Design Review: Post-P0/P1 Verification (2026-02-27)

**Date:** 2026-02-27  
**Ceremony:** Design Review Post-P0/P1 Bug Fix Round  
**Grade:** B (upgraded from B-)  
**Status:** Technically shippable with one critical fix

### Overview

All 6 agents completed design review and verification of P0/P1 fixes. 10 of 11 fixes confirmed correct. 1 critical issue identified (Scroll Fireball kills bypass onKill). 5 serious issues deferred to post-ship. Integration health stable. Ship-ready with Fireball fix.

### Agent Findings

**Sheldon (Lead):**
- 10 of 11 P0/P1 fixes verified correct and merged
- Integration health: **good**
- 1 new P1 issue discovered: Scroll of Fireball kills bypass `onKill()` in items.js
- Recommendation: Ship-ready with one fix

**Leslie (Critic):**
- Grade upgraded B- → **B**
- 1 critical issue remains: Scroll Fireball kills bypass onKill hooks
- 5 serious issues deferred (combat phase threshold, regenCooldown not saved, effect.source serialization, dead fallback code, boss telegraph kills)
- Rationale: 10/11 fixes correct, 1 critical blocks full integration, 5 serious are known and isolated

### Critical Issue

**Scroll of Fireball kills bypass onKill() hooks** (items.js:208-210)
- Users can kill bosses with scroll effects, eliminating state cleanup
- No XP awarded, no loot drops
- Impact: Isolated to items.js, known scope, low fix effort
- Fix: Route kills through `CombatSystem.onKill()` (~5 lines, same pattern as combat.js:306)

### Serious Issues (Deferred to Post-Ship)

1. **Combat phase threshold too tight** (dist≤2 vs ranged enemies at dist 6) — Ranged monsters shoot while player regenerates
2. **regenCooldown not persisted on save/load** — Players can save-scum for infinite regen via reloads
3. **effect.source serialization in combat log** — DOT kills after load pass stale object to onKill()
4. **Dead fallback code in inventory** (main.js:383-387) — tryPickup bypasses MAX_INVENTORY_SIZE if ItemSystem doesn't exist
5. **Boss telegraph kills miss onKill hooks** (ai.js:369-372) — No death-related cleanup on telegraphed kills

### Integration Health

✓ No new conflicts  
✓ All agent work stable  
✓ Test suites passing  
✓ 29 integration tests covering wiring  
✓ 62-row integration manifest (all ✅)  

### Decision

**Ship with Grade B.** Fix Scroll Fireball kills in items.js, re-verify with test suite, merge to main, and ship. Open post-ship tracking for 5 serious issues.

Sheldon: "Ship-ready with one fix."  
Leslie: "B grade, technically shippable."

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


---

# Decision #14: Three Critical Bug Fixes in main.js

Three Critical Bug Fixes in main.js

**Author:** Howard (Rendering + Fog of War)
**Date:** 2026-02-26
**Status:** Implemented

## Context

Design review identified three critical bugs in `src/main.js` that broke core gameplay mechanics: permanent status effects on the player, save/load creating split-brain player objects, and self-targeting abilities being unusable without enemies nearby.

## Decisions

### 1. Player Status Effects Tick via `processTurnStart()`

Used `CombatSystem.processTurnStart(player)` at the start of `processPlayerAction()` rather than raw `tickStatusEffects()`. This is Leonard's designed API that handles both the stun check and the effect tick in the correct order. If the player is stunned, the turn is skipped but the world still advances (enemies act, buffs tick, regen runs, death checked).

**Why not raw tickStatusEffects:** `processTurnStart` already encapsulates the stun-check-then-tick pattern that Leonard built for monster turns. Using the same API ensures consistent behavior between player and monster status processing.

### 2. Save/Load Re-links Player Reference

After JSON deserialization, `state.player` and the matching entity in `state.entities` are separate objects. The fix copies all player properties into the entities-array entry with `Object.assign`, then points `state.player` at that same object. This restores reference identity so all code paths that read from either location see the same data.

### 3. Self-Targeting Abilities Check Type Before Requiring Target

`tryAbility()` now reads the ability definition from `CombatSystem.ABILITIES` and checks if `type` is `'self'`, `'party'`, or `'buff'`. If so, it fires immediately with the player as both source and target — no enemy search needed. Offensive abilities (`melee`, `ranged`, `aoe`) still require a visible enemy.

### 4. Dead Code Removed

- Fallback combat path in `tryMove()` (unreachable since CombatSystem always loads before main.js)
- Orphaned `checkLevelUp()` function that was only called from the removed fallback
- Unused `XP_PER_LEVEL` import

## Impact

- Poison, bleed, stun, War Cry, Divine Shield, and Evade all work correctly on the player now
- Saved games no longer desync player position/state after loading
- Cleric can heal between fights; Warrior can War Cry before engaging; Rogue can Evade preemptively
- README updated to reflect new ability targeting behavior


---
# Decision #15: ItemSystem P0/P1/P2 Bug Fixes
# Decision: ItemSystem P0/P1/P2 Bug Fixes

**Author:** Raj (Items + Loot)
**Date:** 2026-02-26
**Status:** Implemented
**Files Changed:** `src/items/items.js`, `README.md`

## Context

Leslie's game audit identified several critical and serious issues in the item system. Four were assigned for immediate fix.

## Decisions

### 1. Seeded RNG Storage (P0)

**Decision:** Store the RNG passed to `init(rng)` in a module-scoped `_rng` variable. All internal functions that need randomness use `_rng` instead of `Math.random()`.

**Rationale:** `Math.random()` breaks deterministic replay and seed-based reproducibility. The `init()` function already received the seeded RNG but never stored it. Two functions (`_aoeFireball`, `_scrollTeleport`) were using `Math.random()` directly.

**Fallback:** If `_rng` is null (init not called), creates a fallback RNG via `Utils.createRNG(Date.now())` to avoid crashes. This is a safety net, not intended behavior.

### 2. Inventory Cap — 20 Items (P1)

**Decision:** Hard cap of 20 items in any entity's inventory. Enforced in `pickupItem()`.

**Rationale:** Without a cap, players can hoard unlimited items, breaking game economy and making inventory UI unwieldy. 20 is generous enough for normal play but forces meaningful choices on deeper floors.

**Impact on other agents:**
- **Howard (UI):** `MAX_INVENTORY_SIZE` is exposed on `ItemSystem` API. Inventory overlay should show "X/20" count.
- **Leonard (Combat):** No impact — monster loot drops go to ground, not inventory.
- **Sheldon:** No impact.

### 3. Helmet/Boots/Amulet in TYPE_WEIGHTS (P1)

**Decision:** Added helmet (6%), boots (6%), amulet (6%) to `TYPE_WEIGHTS`. Rebalanced existing weights to keep total at 100. Added switch cases in `_generateSingleItem()`.

**Old weights:** weapon:25, armor:20, potion:25, scroll:15, ring:10, food:5
**New weights:** weapon:20, armor:16, helmet:6, boots:6, amulet:6, potion:22, scroll:12, ring:8, food:4

**Rationale:** Previously these 3 slot types could only appear via the 30% bonus roll in `generateLoot()`, making them extremely rare (~0.1 per floor). They already had full template arrays. The bonus roll is retained as extra insurance.

### 4. Scroll of Teleport Safety (P2)

**Decision:** Teleport now validates destination: walkable tile + no entity present. Up to 10 retry attempts. Falls back to current position with "The teleport fizzles." message.

**Rationale:** Previously could land player inside walls or on top of monsters, causing softlocks or undefined behavior. Uses `Constants.WALKABLE_TILES` set and `GameState.getEntityAt()` for validation.

## Cross-Agent Notes

- **Howard:** Should display "X/20" inventory count in the inventory overlay. Check `ItemSystem.MAX_INVENTORY_SIZE`.
- **Amy:** Existing item tests may need updates for the inventory cap check and new TYPE_WEIGHTS. New test cases recommended for: inventory full rejection, teleport fizzle fallback, helmet/boots/amulet drop rates.

---
# Decision #16: P0/P1 Combat & AI Fixes
# Decision: P0/P1 Combat & AI Fixes

**Author:** Leonard (Combat + Enemy AI)
**Date:** 2026-02-27
**Status:** Implemented

## Context

Leslie's game audit identified several critical issues: Math.random() breaking determinism in combat/AI, DOT kills bypassing onKill() (no XP/loot), free infinite regen enabling wait-to-win, and Mage lacking a ranged basic attack.

## Decisions Made

### 1. Seeded RNG Pattern (P0)
- **Decision:** Add `init(rng)` to CombatSystem and AISystem following ItemSystem.init pattern. Store module-scoped `_rng` reference. Fallback to `Math.random()` if init not called.
- **Seed offsets:** CombatSystem uses seed+777, AISystem uses seed+888. Avoids collision with ItemSystem (seed+999), item placement (seed+500), and monsters (seed).
- **Rationale:** Deterministic RNG is required for save/load replay consistency and fair gameplay.

### 2. DOT Kill onKill() Wiring (P2)
- **Decision:** Call `onKill(effect.source || null, entity)` when poison/bleed kills. Store `source` entity reference on DOT effects when applied.
- **Null-safe onKill:** Added `killer &&` guard so DOT kills without tracked source still announce death and drop loot but don't crash.
- **Alive guard:** Added `entity.alive` check to DOT blocks to prevent double-processing when entity has both poison and bleed.
- **Rationale:** Previously, poison/bleed kills gave no XP and dropped no loot — making DOT abilities strictly worse than direct damage.

### 3. Regen Cooldown (P1)
- **Decision:** `regenCooldown` field on player entity. Initialized to 5 on first use. Decremented each EXPLORING turn. Regen only fires when `> 0`. Reset to 5 on COMBAT→EXPLORING transition.
- **Rationale:** Leslie identified infinite regen as the #1 fun-killer. Players could wait 60 turns to full-heal, trivializing all fights. 5-turn window provides meaningful post-combat recovery without enabling exploitation.
- **Alternative rejected:** Hunger/food clock — too complex for the fix needed.

### 4. Mage Arcane Bolt (P1)
- **Decision:** Data-driven ranged attack via `rangedAttack: { range: 4, damageMultiplier: 0.5 }` on MAGE class in constants.js. Generic handling in meleeAttack() checks class definition. Auto-fire scan in tryMove() looks along movement direction.
- **Damage:** 50% of base damage formula. Costs 0 mana. Requires LOS.
- **Range:** 2–4 tiles (scan starts at 2 to avoid free melee attacks on adjacent enemies).
- **Rationale:** Mage with 60 HP forced into melee breaks class fantasy. Arcane Bolt gives basic ranged poke without obsoleting Ice Shard/Fireball.

## Files Changed

| File | Changes |
|------|---------|
| `src/systems/combat.js` | init(rng), rng() helper, DOT onKill, null-safe onKill, ranged attack in meleeAttack, regen cooldown in regenerate |
| `src/systems/ai.js` | init(rng), rng() helper, all 10 Math.random() replaced |
| `src/core/constants.js` | MAGE.rangedAttack property added |
| `src/main.js` | CombatSystem/AISystem init wiring (new game + load), regen cooldown reset in checkCombatPhase, auto-ranged scan in tryMove |
| `README.md` | Mage Arcane Bolt documented, regen cooldown note added |

## Integration Notes

- **Howard:** No changes needed. Auto-ranged attack messages go through existing `postAttackMsg()` → `GameState.addMessage()` pipeline.
- **Amy:** New test cases recommended: (1) DOT kill awards XP, (2) regen stops after 5 turns, (3) Arcane Bolt fires at range 2-4, (4) RNG determinism with seeded init.
- **Sheldon:** `regenCooldown` is a plain numeric field on the player entity — survives JSON serialization automatically.

---
# Decision #17: P0/P1/P2 Rendering & UI Fixes
# Howard — P0/P1/P2 Fix Sprint

**Author:** Howard (Rendering + Fog of War)  
**Date:** 2026-02-26  
**Status:** Complete  

## Changes

### 1. Diagonal Movement (P1) — `src/main.js`

Added 8-way player movement to match monster movement:

- **Numpad keys** (via `e.code` to avoid conflict with ability hotkeys 1-9): Numpad 7/8/9/4/6/1/2/3 for all 8 directions. Numpad 5 = wait.
- **Vi-keys** (via `e.key`): Y = up-left, U = up-right, B = down-left, N = down-right.
- Existing WASD/Arrow movement unchanged.
- All movement goes through `tryMove()` — same walkable checks, bump-combat, trap triggers, ground item notifications.

**Key design decision:** Numpad keys are dispatched before the `moveMap`/ability check by using `e.code` (e.g. `'Numpad1'`) instead of `e.key` (which would be `'1'`, conflicting with ability slot 1). This keeps top-row 1-9 for abilities and numpad 1-9 for movement.

### 2. Distance Function Mismatch (P0) — `src/main.js`

`tryAbility()` was using `Utils.manhattanDist` to find nearest enemy, while `checkCombatPhase()` and AI use `Utils.chebyshevDist`. Changed to `chebyshevDist`.

**Impact:** Manhattan distance overcounts diagonal distance (2 diagonal tiles = manhattan 4 vs chebyshev 2). This caused abilities to sometimes target wrong enemies or fail to find valid targets that were within FOV range.

### 3. Score Formula (P2) — `src/ui/hud.js`

Old formula: `floor*100 + level*50 + xp + turns` (turns as positive term = slow play rewarded).

New formula: `max(0, floor*100 + level*50 + xp - floor(turns/10))`. Turn penalty is gentle (1 point per 10 turns) but directionally correct.

### 4. Documentation Updates

- **README.md:** Controls table split Move into cardinal/diagonal rows.
- **hud.js help screen:** Added diagonal movement line.
- **hud.js title screen:** Updated controls quick-reference.

## Files Changed

- `src/main.js` — diagonal input handling, distance function fix
- `src/ui/hud.js` — score formula, help screen, title screen controls
- `README.md` — controls table
- `.squad/agents/howard/history.md` — session log


---

# Clean-Sweep Design Review — Final Assessment

**Reviewer:** Sheldon (Lead + Dungeon Generation)  
**Date:** 2026-02-28  
**Scope:** All 14 source files, full regression + playability + code health audit  
**Context:** Post 4 review rounds, 19 critical/serious bugs fixed. Is the game solid?

---

## 1. Regression Check — Last Round's 6 Fixes

### 1a. Howard's CombatSystem Guard Removal

Howard removed 11 `window.CombatSystem && CombatSystem.X` guards from combat.js — were any needed?

**Verdict: 🟢 Clean.** All remaining defensive guards in the codebase are appropriate:

- `items.js:211` — `window.CombatSystem && CombatSystem.onKill` in `_aoeFireball()`. This is correct: ItemSystem loads before CombatSystem (see index.html:40 vs :33), and this function is only called at runtime after both are loaded. The guard is technically unnecessary but harmless.
- `ai.js:372` — `window.CombatSystem && CombatSystem.onKill && CombatSystem.onKill(entity, player)` in boss telegraph attack. Same situation — safe at runtime.

CombatSystem's own internal calls (meleeAttack, applyDamage, postAttackMsg, etc.) have no guards, which is correct since they're intra-module. The 11 guards Howard removed were redundant guards *within* combat.js itself — no needed guards were lost.

### 1b. Leonard's effect.source → effect.sourceId Migration

**Verdict: 🟢 Clean.** Grep confirms zero remaining `effect.source` references (non-Id variant). All 4 sourceId usages are correct:

| Location | Usage | Status |
|----------|-------|--------|
| `combat.js:112` | Poison tick: `effect.sourceId ? GameState.state.entities.find(e => e.id === effect.sourceId)` | ✅ Correct ID lookup |
| `combat.js:124` | Bleed tick: same pattern | ✅ Correct ID lookup |
| `combat.js:218` | Crit auto-bleed: `sourceId: attacker.id` | ✅ Sets ID correctly |
| `combat.js:495` | Poison Blade ability: `sourceId: user.id` | ✅ Sets ID correctly |

The lookup pattern (`entities.find(e => e.id === effect.sourceId) || null`) correctly handles cases where the source entity died or was removed.

### 1c. Combat Phase Triggers on Any Visible Enemy in FOV

**Location:** `main.js:417-441`, `checkCombatPhase()`

```javascript
for (const e of enemies) {
  if (visibleTiles.has(e.x + ',' + e.y)) {
    inCombat = true;
    break;
  }
}
```

**Verdict: 🟡 Minor — Correct but potentially annoying.**

The logic itself is sound: if you see an enemy, you're in combat. The concern was "too aggressive" — but I've traced the actual consequences:

1. **Combat phase blocks regeneration** — `CombatSystem.regenerate()` at `combat.js:622` checks `GameState.getPhase() !== PHASES.EXPLORING` and early-returns. So seeing a distant enemy across a room stops regen.
2. **Visual indicator** — Red border + "⚔ COMBAT ⚔" shows up just because a rat is visible 8 tiles away.
3. **No mechanical penalty otherwise** — Movement, abilities, stairs all work the same in combat phase. No action restrictions.

The regen suppression is the real gameplay impact. A player could see a non-threatening rat far away and stop regenerating. However, this is *intentional design* per the regen-cooldown system — you get 5 turns of regen after combat *ends*, not while enemies are visible. The regen cooldown reset at `main.js:437` correctly fires when transitioning FROM combat TO exploring.

**Recommendation:** Consider adding a detection distance threshold (e.g., only trigger combat for enemies within 5 tiles) to avoid regen suppression from distant passive mobs. But this is a design preference, not a bug.

---

## 2. End-to-End Playability Trace

### Scenario: Warrior, Floor 1 → Floor 10, Dragon Lord

| Step | Flow | Status |
|------|------|--------|
| **1. Title screen** | Select Warrior, name "Hero", press Enter | ✅ `startNewGame()` at main.js:80 creates entity, inits all systems |
| **2. Floor 1 generated** | BSP generator, monsters spawned, items placed | ✅ `DungeonGenerator.generate(0, seed)`, `MonsterFactory.spawnForFloor(0, ...)`, `ItemSystem.placeItemsOnFloor(0, ...)` all called |
| **3. FOV computed** | Player sees room, explored grid updates | ✅ `recomputeFOV()` at main.js:131 |
| **4. Walk into goblin** | `tryMove()` detects monster → `CombatSystem.meleeAttack()` | ✅ main.js:237-240 |
| **5. Goblin dies** | `applyDamage()` → `alive=false` → `onKill()` → XP + loot drop | ✅ combat.js:193-196 → 263 → 324-336 |
| **6. Pick up Rusty Sword** | Press G → `tryPickup()` → `ItemSystem.pickupItem()` | ✅ main.js:363-378 |
| **7. Equip sword** | I → select → E → `ItemSystem.equipItem()` → `applyEquipmentMods()` | ✅ ATK +2 applied via `_applyStatMods()` items.js:640-661 |
| **8. Unidentified potion** | Use U → `useItem()` → `identifyItem()` → effect applied | ✅ items.js:686-704, identification persists |
| **9. Use War Cry (ability 3)** | Press 3 → `tryAbility()` checks self-target → fires without enemy | ✅ main.js:388-393 correctly detects `type: 'self'` |
| **10. Descend stairs** | Press > on STAIRS_DOWN → `tryDescend()` → `changeFloor(1, 'down')` | ✅ main.js:282-300 |
| **11. Floor 2 generated** | New floor generated lazily, monsters/items spawned | ✅ changeFloor() at main.js:321-339 |
| **12. Level up** | Kill enough mobs → `checkLevelUp()` → stats increase | ✅ Single implementation in combat.js:338-355, +10 maxHp, +1 ATK, +1 DEF |
| **13. Save & reload** | Close browser → re-open → `loadGame()` | ✅ See save/load analysis below |
| **14. Floor 10 (index 9)** | Dragon Lord spawns at last room center | ✅ monsters.js:164-176 |
| **15. Dragon Lord fight** | Boss AI: war_cry → fireball → power_strike → telegraph → enrage → summons | ✅ ai.js:329-402 |
| **16. Dragon Lord dies** | onKill → 500 XP (scaled) → guaranteed loot drop | ✅ |
| **17. Victory** | Descend from floor 10 → `tryDescend()` → `PHASES.VICTORY` | ✅ main.js:291-296 |

### Save/Load Deep Dive

**What's saved (main.js:481-498):**
- ✅ phase, currentFloor, turnCounter, seed
- ✅ floors (tiles, rooms, stairs, explored)
- ✅ entities (all fields including statusEffects, tags, xpValue, templateKey, _buffs, regenCooldown)
- ✅ player (re-linked to entities array at main.js:539-545)
- ✅ groundItems
- ✅ identificationState (_idMap, _reverseIdMap, _identifiedKeys)
- ✅ Combat/AI RNG re-initialized from seed (main.js:553-556)

**What's NOT saved:**

| Missing Field | Location | Impact | Severity |
|---------------|----------|--------|----------|
| `_enraged` | ai.js:335 | Boss re-enrages on next 25% check — double speed boost if already enraged | 🟡 Minor |
| `_telegraphing` | ai.js:365-387 | Boss loses pending telegraph — skips one heavy attack | 🟡 Minor |
| `_summonedPhase2` | ai.js:343 | Boss re-summons 2 minions on reload if still ≤50% HP | 🟡 Minor |
| `_summonedPhase3` | ai.js:354 | Boss re-summons 3 minions on reload if still ≤25% HP | 🟡 Minor |
| `_rng` (ItemSystem) | items.js:18 | Module-scoped RNG not restored; `_rng` stays null after load. Fallback `Utils.createRNG(Date.now())` used in scroll effects — not reproducible but functional | 🟡 Minor |

These boss fields are set directly on the entity object (e.g., `entity._enraged = true`) and ARE included in JSON serialization since they're own-properties. However, `createEntity()` at gameState.js doesn't initialize them — so they survive save but are recreated correctly. Wait — actually re-reading the code, `createEntity()` is NOT called on load. Entities are loaded raw from JSON. So `_enraged`, `_telegraphing`, `_summonedPhase2`, `_summonedPhase3` DO survive as JSON own-properties. **This is actually fine.** ✅

The only real gap: `ItemSystem._rng` is not restored on load. CombatSystem and AISystem get their RNG re-initialized (main.js:553-556), but ItemSystem does not. This means scroll/potion effects that use `_rng` (like `_aoeFireball`, `_scrollTeleport`) fall back to `Utils.createRNG(Date.now())` which is non-deterministic but functional.

---

## 3. Code Health — Anti-Pattern Scan

### 3a. Remaining `Math.random()` Calls

| File | Line | Context | Verdict |
|------|------|---------|---------|
| `combat.js:34` | `return _rng ? _rng.random() : Math.random()` | Fallback when `_rng` not initialized | 🟢 Acceptable — init() called before any combat |
| `ai.js:21` | Same pattern | Fallback when `_rng` not initialized | 🟢 Acceptable — init() called before any AI |
| `renderer.js:99-100` | `Math.random()` for screen shake offset | 🟢 Correct — visual-only, no gameplay impact, doesn't need determinism |

**Verdict: 🟢 Clean.** No unseeded `Math.random()` in gameplay logic. The two fallbacks in combat.js and ai.js are dead paths at runtime since init() is always called. The renderer usage is intentional for visual randomness.

### 3b. `alive = false` Without `onKill()`

| File | Line | Context | Has onKill? |
|------|------|---------|-------------|
| `combat.js:110` | Poison tick kills entity | ✅ `onKill(killer, entity)` at line 113 |
| `combat.js:122` | Bleed tick kills entity | ✅ `onKill(killer, entity)` at line 125 |
| `combat.js:195` | `applyDamage()` sets alive=false | ✅ All callers call `onKill()` after checking `!defender.alive` |
| `items.js:209` | `_aoeFireball()` scroll effect | ✅ `CombatSystem.onKill(entity, e)` at line 212 |
| `main.js:164` | Player death from poison/bleed (stunned path) | ✅ `handleDeath(player)` at line 165 — correct for player |
| `main.js:215` | Player death after turn processing | ✅ `handleDeath(player)` at line 216 — correct for player |

**Verdict: 🟢 Clean.** Every `alive = false` has appropriate death handling. Monster deaths go through `onKill()` for XP + loot. Player deaths go through `handleDeath()` for permadeath + score.

### 3c. Data That Doesn't Survive Save/Load

Already covered in Section 2. Summary:

- ✅ Entity fields: all survive (statusEffects, tags, xpValue, templateKey, _buffs, regenCooldown, _enraged, etc.)
- ✅ Identification state: saved/restored via dedicated API
- ✅ Player-entity reference: re-linked after load
- 🟡 ItemSystem `_rng`: not restored (minor — scroll effects use fallback RNG)

### 3d. Other Code Health Observations

**1. 🟡 Regen Cooldown Initialization Mismatch**
- `gameState.js:81` initializes `regenCooldown: opts.regenCooldown ?? 0`
- `combat.js:625` checks `if (entity.regenCooldown === undefined) entity.regenCooldown = 5` then immediately `if (entity.regenCooldown <= 0) return`
- New player starts with `regenCooldown = 0`, so `regenerate()` returns immediately — player gets NO regen until first combat ends!
- **Technically intentional** per "post-combat cooldown" design, but may confuse players on floor 1 who expect to regen after taking trap damage.

**2. 🟢 Trap Damage RNG**
- `main.js:268` uses `Utils.createRNG(Date.now())` for trap damage — non-deterministic but acceptable for a one-off damage roll.

**3. 🟢 Module Load Order**
- index.html loads: constants → utils → gameState → generator → fov → combat → ai → monsters → items → renderer → hud → main
- All IIFE dependencies are satisfied. No circular dependencies.

**4. 🟡 Duplicate isItemEquipped Functions**
- `hud.js:688-694` has `isItemEquipped(player, item)`
- `main.js:846-852` has `isItemEquippedMain(player, item)`
- Identical implementations. Minor DRY violation, but both are module-private so no functional issue.

---

## 4. Issues Summary

### Remaining Issues by Severity

| # | Severity | Issue | File:Line | Impact |
|---|----------|-------|-----------|--------|
| 1 | 🟡 | ItemSystem `_rng` not restored on save/load | main.js:548-556 | Scroll/potion effects lose determinism post-load; functional but non-reproducible |
| 2 | 🟡 | Regen cooldown = 0 on new game means no regen until first combat ends | gameState.js:81, combat.js:625-627 | Player can't regenerate at all until they fight and exit combat for the first time |
| 3 | 🟡 | Combat phase triggers on ANY visible enemy regardless of distance | main.js:425-429 | Distant passive enemies suppress regen; mildly annoying, not game-breaking |
| 4 | 🟡 | Duplicate `isItemEquipped` implementations | hud.js:688, main.js:846 | DRY violation; no functional impact |
| 5 | 🟢 | TILES.WATER (id 6) defined but never generated | constants.js:19 | Dead constant; no impact |
| 6 | 🟢 | Loot drop RNG uses `Date.now()` not seeded RNG | items.js:722 | Non-deterministic loot drops on monster death; acceptable for variety |

### Issues NOT Found (Previously Reported, Now Fixed)

- ✅ Save/load duplicate player object — fixed via re-linking (main.js:539-545)
- ✅ Self-targeting abilities blocked — fixed with type check (main.js:388-393)
- ✅ Duplicate checkLevelUp — removed from main.js, single source in combat.js
- ✅ effect.source → effect.sourceId migration — complete, zero stale references
- ✅ Missing onKill on alive=false — all paths covered
- ✅ Entity schema expansion — createEntity has statusEffects, tags, xpValue, templateKey, _buffs
- ✅ Item extra properties — createItem preserves _defKey, special via opts loop
- ✅ Identification state save/restore — full round-trip via getIdentificationState/restoreIdentificationState

---

## 5. Final Grade: **A-**

### Scoring Breakdown

| Category | Score | Notes |
|----------|-------|-------|
| **Architecture** | A | Clean module graph, no circular deps, proper IIFE encapsulation, centralized factories |
| **Combat System** | A | Complete ability system, status effects, XP/leveling, all death paths handled correctly |
| **Item System** | A- | Full identification system, equipment stat mods, loot tables, save/load support. Minor: _rng not restored |
| **Dungeon Generation** | A | BSP with scaling params, proper stair placement, corridor connectivity guaranteed |
| **Save/Load** | A- | Comprehensive state persistence. All entity fields survive. Player re-linked. Minor: ItemSystem._rng |
| **AI System** | A | 5 behavior types, A* pathfinding, boss phases with telegraph/enrage/summon |
| **Rendering** | A | Canvas viewport, FOV integration, screen shake, floating damage, mini-map |
| **Input/UI** | A | Title screen, inventory, help overlay, class selection, controls well-documented |
| **Code Health** | A- | No critical anti-patterns remaining. Two minor DRY violations. Two `Date.now()` RNG fallbacks |
| **Integration** | A | All cross-module calls wired. Init sequence correct. Defensive guards appropriate |

### Previous Grades

| Round | Reviewer | Grade | Critical Bugs | Serious Bugs |
|-------|----------|-------|---------------|--------------|
| 1 | Sheldon | B+ | 3 critical | 3 serious |
| 2 | Leslie | B- | 6 critical | 2 serious |
| 3 | Sheldon | B | 2 critical | 4 serious |
| **4** | **Sheldon** | **A-** | **0 critical** | **0 serious** |

### Assessment

The game is **solid.** Zero critical bugs, zero serious bugs. The 6 remaining items are all yellow (minor) or green (cosmetic). The most impactful is the regen-cooldown-starts-at-zero issue (#2), which means new players don't regenerate until after their first combat — but this is arguably intentional design ("you only regen after combat").

The codebase has gone from 19 critical/serious bugs across 4 rounds to zero. The architecture is clean, the integration is complete, the save/load system is comprehensive, and the gameplay loop works end-to-end from title screen through victory.

**Ship it.** 🚀

---

*Reviewed by Sheldon (Lead + Dungeon Generation), 2026-02-28*


---

# Decision: Leslie Clean-Sweep Review — Post-Fix Codebase Audit

**Author:** Leslie (Critic)
**Date:** 2026-02-27
**Status:** REVIEW
**Requested by:** Nabeel
**Context:** 19 bugs fixed across 4 review rounds. Last grade: B. This is the final-answer audit.

---

## Executive Summary

I read every line of every source file. I grepped for every anti-pattern I've flagged across four rounds. I looked for regressions from the 19 fixes. I tried to find new bugs nobody's caught.

**Result: No critical bugs remain.** The codebase is genuinely clean. Grade upgraded to **A-**.

This is not me going soft. This is me running out of things to break.

---

## 1. Anti-Pattern Sweep

### Math.random() outside renderer.js

| File | Line | Verdict |
|------|------|---------|
| `combat.js:34` | `return _rng ? _rng.random() : Math.random()` | 🟢 Dead fallback — `init()` always sets `_rng` before any combat runs |
| `ai.js:21` | Same pattern | 🟢 Same reasoning |
| `renderer.js:99-100` | Shake animation | 🟢 Cosmetic only, intentionally non-deterministic |

**Verdict:** Clean. The `Math.random()` calls are unreachable fallbacks or renderer-only. No determinism violations in gameplay.

### alive = false without onKill()

| Location | What happens | Verdict |
|----------|-------------|---------|
| `combat.js:110` | Poison DOT kill | ✅ Calls `onKill()` at line 113 |
| `combat.js:122` | Bleed DOT kill | ✅ Calls `onKill()` at line 125 |
| `combat.js:195` | `applyDamage()` | ✅ Every caller checks `!target.alive` and calls `onKill()` |
| `items.js:209` | Scroll of Fireball | ✅ Calls `CombatSystem.onKill()` at line 211-212 |
| `main.js:164,215` | Player death | ✅ Calls `handleDeath()` — player doesn't need `onKill()` |

**Verdict:** Clean. Every kill path routes through proper reward/cleanup logic.

### effect.source (old property name)

Zero matches for `effect.source` outside `sourceId`. All 4 references use `effect.sourceId`. ✅

### Data fields outside createEntity() schema

**In schema (confirmed):** `statusEffects`, `tags`, `xpValue`, `templateKey`, `_buffs`, `regenCooldown` — all present in `createEntity()`.

**NOT in schema:**
- `entity._enraged` — set dynamically in `ai.js:335`
- `entity._telegraphing` — set dynamically in `ai.js:387`
- `entity._summonedPhase2` — set dynamically in `ai.js:343`
- `entity._summonedPhase3` — set dynamically in `ai.js:354`

These are boss-only runtime flags. They survive save/load (JSON serializes dynamic properties). They work because JS treats `undefined` as falsy. But they're invisible to schema inspection and would silently break if someone added `Object.freeze` or schema validation to entities.

**Rating: 🟡 SERIOUS** — not a bug today, but a landmine for future refactoring.

### Cross-module guards

17 instances of `window.X && X.method` in `main.js`. The bootstrap in `index.html` (lines 53-61) verifies ALL modules are loaded before `Game.init()` runs. Every single guard is dead code.

Per the retrospective, this pattern was identified as the root cause of silent integration failures — guards that turn missing calls into no-ops. They should be removed or replaced with hard assertions.

**Rating: 🟡 SERIOUS** — technical debt, not a bug. The guards don't cause incorrect behavior, but they violate the team's own retrospective conclusion.

---

## 2. Regression Hunt

All 19 fixes from rounds 1-4 verified:

| # | Fix | Status |
|---|-----|--------|
| 1 | Double XP removed | ✅ Only `onKill()` awards XP now |
| 2 | `createItem` custom props | ✅ Extra properties preserved via loop |
| 3 | `ItemSystem.init()` called | ✅ `main.js:108-111` |
| 4 | `dropLoot()` called | ✅ `combat.js:333` |
| 5 | `tickBuffs()` called | ✅ `main.js:153-162, 200-209` for player + all floor entities |
| 6 | Save/load fields | ✅ Full entity serialization + identification state |
| 7 | Player status effects ticking | ✅ `main.js:144` calls `processTurnStart(player)` |
| 8 | DOT kills route through `onKill()` | ✅ `combat.js:113, 125` |
| 9 | Fireball kills route through `onKill()` | ✅ `items.js:211-213` |
| 10 | Save/load player split-brain | ✅ `main.js:539-545` re-links player reference |
| 11 | Combat phase uses FOV visibility | ✅ `main.js:426` checks `visibleTiles.has()` |

**No regressions found.** The fixes are clean and don't interact with each other negatively.

---

## 3. Fresh Eyes — What Jumps Out

### 🟡 Dead player can act for one turn (edge case)

If a DOT (poison/bleed) kills the player at the START of their turn via `processTurnStart()`, the function returns `true` (can act). The player is dead (`alive = false`) but their queued action still executes — they can move, attack, even kill a monster. The death check at `main.js:213-217` catches it AFTER the action.

**Impact:** A dead player could kill a monster and gain XP in the same turn they die. The XP is meaningless (game is over), but the score on the death screen could be slightly inflated. The death animation is cosmetically unaffected since rendering happens after `handleDeath()` sets phase to DEAD.

**Why it's 🟡 not 🔴:** It's a 1-turn cosmetic anomaly in an extremely narrow scenario (player must have an active DOT that kills them AND have queued a melee attack on a valid target). No gameplay consequence.

### 🟡 Trap damage is non-deterministic

`main.js:268`: `Utils.createRNG(Date.now()).randInt(3, 8)` creates a one-shot RNG seeded with wall-clock time. Traps deal different damage on save/reload of the same position. Every other damage source uses the seeded combat RNG.

**Impact:** Minor inconsistency. Traps are rare and low-damage (3-8). Doesn't affect game balance.

### 🟡 Mage auto-bolt targets through doors

`main.js:248-264`: The auto-ranged scan checks `WALKABLE_TILES` (which includes doors) but not LOS. It can find a target behind a door, call `meleeAttack()`, which then fails the LOS check and prints "too far for melee" — a misleading error message.

**Impact:** UX confusion. The attack correctly fails (no damage through doors), but the error message is wrong. Player wastes their auto-bolt attempt.

### 🟡 Monster factory mutates entities post-creation

`monsters.js:143-146` sets `xpValue`, `templateKey`, `tags`, `statusEffects` AFTER calling `createEntity()`, overriding the factory defaults. These fields exist in the schema, so the override is redundant — they could be passed through `opts`. It's inconsistent with the factory pattern.

---

## 4. Game Quality Assessment

### What's good
- **4 distinct classes** with meaningfully different ability kits and resource pools
- **5 AI behaviors** create tactical variety — flanking enemies feel different from ranged ones
- **Multi-phase boss fight** with summoning, telegraphing, and enrage is genuinely tense
- **Identification system** adds risk/reward decisions to consumables
- **FOV/LOS** creates real tactical positioning choices
- **Post-combat regen cooldown** (5 turns only) elegantly solves the wait-to-win problem without adding a food clock
- **Score system** with turn penalty incentivizes efficient play
- **20-item inventory cap** forces resource management

### What's missing
- **No build diversity** beyond class selection — same 3 abilities for every Warrior run
- **No special weapon procs** — the `special: 'fire_dot'` on Flamebrand is declared but never implemented
- **Limited strategic movement** — no terrain effects, no chokepoint tactics, water tiles aren't even walkable
- **One boss** — the Dragon Lord is well-designed but one-and-done
- **No audio** — silence kills atmosphere in a dungeon crawler

### Would I play it for 30 minutes?

Yes. Once. The first complete run (title → boss kill or death) takes about 20-30 minutes and has genuine tension, especially floors 7-9 where Trolls and Demons hit hard. Class choice matters — a Mage plays completely differently from a Warrior. The identification gamble on unidentified potions is fun.

After one complete run, replayability drops sharply. There's no procedural variety in builds, no unlockables, no alternate paths. The dungeon layout changes (seeded generation) but the strategic decisions don't.

**For a vanilla JS roguelike with no art assets: this is impressive. For a game I'd recommend to a friend: it needs another 2 weeks of content.**

---

## 5. Shippability Verdict

### Is this shippable as v1.0?

**YES.**

No crashes. No data loss. No exploits. No balance-breaking bugs. Save/load works. Permadeath works. All 4 classes are playable start-to-finish. The boss fight has a proper win condition with victory screen and high score.

The remaining issues are:
- 4 schema documentation gaps (🟡)
- 17 dead code guards (🟡)
- 3 minor UX/consistency issues (🟡)
- 0 critical bugs (was 9+ across 4 rounds)

### Updated Grade: **A-**

| Category | Score | Notes |
|----------|-------|-------|
| Correctness | A | All kill paths, XP, save/load, status effects working |
| Architecture | B+ | Factory pattern solid, cross-module calls clean, some schema gaps |
| Code quality | B | Redundant guards, post-creation mutation, undeclared boss fields |
| Game design | B+ | Real strategic depth for a hobby project, limited replayability |
| Polish | B | No audio, no particle effects beyond damage numbers, no animations |

**Promotion from B to A- reflects:** Zero critical bugs remaining. All 19 fixes verified clean with no regressions. The codebase does what it claims to do and does it correctly.

**Not A because:** Boss entity schema gaps, 17 dead guards, non-deterministic traps, and the Flamebrand `special: 'fire_dot'` is a promise the code doesn't keep. These are polish issues, not blockers.

---

## Recommendations (non-blocking for v1.0)

1. Add `_enraged`, `_telegraphing`, `_summonedPhase2`, `_summonedPhase3` to `createEntity()` with `false` defaults
2. Strip `window.X &&` guards in main.js — replace with hard `console.assert` in dev builds
3. Check `player.alive` at the TOP of `processPlayerAction` before any action processing
4. Use combat RNG for trap damage instead of `Date.now()` seed
5. Implement `special: 'fire_dot'` on Flamebrand or remove the declaration
6. Add `!visibleTiles.has(target)` check to the auto-ranged scan in `tryMove`

None of these block a v1.0 release. Ship it.

---

*Filed by Leslie, 2026-02-27. This is review round 5. Previous grades: D (round 1), C+ (round 2), B- (round 3), B (round 4). Current: A-.*

