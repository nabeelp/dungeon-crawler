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

### XP Curve Fix (2025-07-16)

- **Problem:** XP_PER_LEVEL used `Math.pow(1.4, i)` which grew too aggressively. Level 10 needed 1,033 XP, level 20 needed 29,881 XP. Combined with weak monster XP scaling (0.1 per floor), leveling became impossible on deeper floors.
- **Fix 1 — constants.js:** Changed multiplier from 1.4 to 1.25. New curve: level 10 = 372 XP, level 20 = 3,469 XP. Smooth ramp that stays achievable with normal gameplay.
- **Fix 2 — monsters.js:** Changed floor XP scaling factor from 0.1 to 0.3. Floor 10 monsters now give ~3.7x their base XP (e.g., a Lich goes from 65 to 240 XP on floor 10). This keeps XP rewards proportional to the leveling curve.
- **Why 1.25 not 1.2:** 1.2 gives level 10 = 258 XP (too low, trivial grind) and level 20 = 1,597 XP (under target). 1.25 hits both target ranges: 300-500 for level 10, 2000-5000 for level 20.

## Cross-Agent Updates (2026-02-25)

### Raj: Equipment Stat Application & Monster Loot
- **New API:** ItemSystem now exposes `applyEquipmentMods(entity, item)` and `removeEquipmentMods(entity, item)` as public functions
- **Loot drops:** ItemSystem implements `dropLoot(monster, floorIndex)` for monster loot on death (35% normal, guaranteed boss)
- **Integration:** No action needed on Sheldon's side; `placeItemsOnFloor()` already called correctly from main.js

### Leonard: Combat Balance & Boss Mechanics
- **Class balance:** Cleric heal nerfed (30 mana/25 HP), Rogue evade to 1 turn, Warrior War Cry +7 ATK
- **Status effects:** New BLEED (stacking DoT on crits) and VULNERABLE (+25% damage) effects
- **Combat feedback:** All attacks show target HP%, crits auto-apply bleed, status effects warn before expiring
- **Dragon Lord boss:** Enrages at 25% HP, telegraphs heavy attacks, summons scale (2→3 more at phases, cap 4)
- **Integration:** Combat.js correctly reads `victim.xpValue` which Sheldon provides via monster XP scaling

### Howard: Visual Effects & Game Loop Integration
- **Screen shake:** `Renderer.triggerShake(intensity)` on damage hits
- **Floating damage:** `Renderer.spawnDamageNumber(x, y, amount, type)` displays damage/heal/crit
- **Pulsing stairs:** STAIRS_DOWN/UP pulse opacity when visible, helps player find stairs
- **Game loop:** `Renderer.hasActiveAnimations()` check enables continuous rendering during effects
- **Integration:** No core changes needed; visual effects fully self-contained in renderer.js

### Raj: Monster Loot Integration
- **Loot placement:** `ItemSystem.placeItemsOnFloor(floorIndex, rooms, rng)` already called from main.js after dungeon generation — works with Sheldon's floor data schema
- **Loot drops:** Leonard's combat system calls `ItemSystem.dropLoot(victim, victim.floor)` on monster death

### Amy: Comprehensive Tests
- **45+ new tests:** Combat abilities, item system, loot generation, equipment stats, save/load validation
- **All passing:** Coverage includes edge cases, state transitions, RNG determinism, multi-floor scaling
- **Test files:** test-combat.js, test-items.js, test-save.js in tests/ directory
