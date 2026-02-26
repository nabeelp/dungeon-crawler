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

## Leslie's Game Audit (2026-02-26)

### Critical Issues Identified in Dungeon/Core
1. **Save/Load Loses Entity State** — JSON round-trip drops statusEffects, tags, xpValue, _buffs, _enraged, _telegraphing, _summonedPhase fields; also loses module-level ItemSystem state (_idMap, _reverseIdMap, _identifiedKeys)
   - **Impact:** Monsters give 0 XP, boss AI phases broken, item identification system reset, potions/scrolls unidentified after load
   - **Fix:** Extend save schema to include custom entity/item fields and ItemSystem state

### Serious Issues Found in XP System
- **Monster Spawning Silent Failures** — spawnForFloor() uses randInt(room.x+1, room.x+1) on tiny rooms (w=3), combined with collision overlap check, may produce fewer monsters than intended on deep floors

### Integration Notes for Sheldon
- Priority: (1) Implement save/load state persistence for entity custom fields (statusEffects, tags, xpValue, _buffs, _enraged, _telegraphing, _summonedPhase), (2) Save/restore ItemSystem identification state, (3) Verify monster spawn failures don't occur with current room sizing
- Blocking: Multiple systems (Leonard, Raj, Howard) depend on proper save/load
- Architecture: Consider revisiting entity schema to include all persistent fields; may require gameState.js createEntity() or save() function enhancement

### Bug #2 + Bug #6 Fixes (2026-02-26)

- **Bug #2 — createItem() extra properties:** Added a loop at the end of `createItem()` that copies any `opts` keys not in the standard schema into the returned item. This preserves `_defKey` (potions/scrolls) and `special` (Flamebrand fire_dot). Also fixed `_generateEquipItem()` in items.js to pass `tmpl.special` to `createItem()`.
- **Bug #6 — Entity schema expansion:** Added `statusEffects`, `tags`, `xpValue`, `templateKey`, and `_buffs` directly to the `createEntity()` return object. These were previously added ad-hoc by MonsterFactory/CombatSystem and would survive JSON serialization but weren't initialized as part of the schema, meaning loaded entities might lack them. Now they're always present with safe defaults.
- **Bug #6 — ItemSystem identification state:** Added `getIdentificationState()` and `restoreIdentificationState()` to ItemSystem's public API. These serialize/deserialize `_idMap`, `_reverseIdMap`, and `_identifiedKeys`. Howard wired these into `saveGame()`/`loadGame()` in main.js with defensive guards.

### Leslie's Bug Fix Sprint (2026-02-26) — COMPLETE

- **Team:** Sheldon (Lead), Leonard (Combat), Howard (Rendering), Amy (Tester)
- **Scope:** All 6 critical bugs resolved
- **Test coverage:** 17 new regression tests added across combat, items, save/load
- **Status:** All tests passing; decision docs merged into decisions.md

## Design Review (2026-02-27)

### Ceremony: Comprehensive Design Review

- **Requested by:** Nabeel
- **Scope:** Full architecture and game design review of all 14 source files
- **Verdict:** B+ overall architecture

### Critical Bugs Found

1. **Save/Load Duplicate Player Object (main.js:497-499)** — After JSON round-trip, `state.player` and the player entry in `state.entities` become separate objects. Player movement updates one copy but not the other, silently corrupting post-load gameplay. Fix: point `state.player` at the entity found in `state.entities` after deserialization.

2. **Self-Targeting Abilities Blocked (main.js:351-372)** — `tryAbility()` refuses to fire ANY ability if no enemy is in FOV range. This blocks Cleric heal, Warrior War Cry, Rogue Evade, and Mage Arcane Shield outside of combat. Fix: check ability type and allow self/party abilities without a target.

3. **Duplicate checkLevelUp() (main.js:395-406 vs combat.js:303-319)** — Two different level-up functions with inconsistent stat gains. The main.js version gives +2 ATK and full heal; combat.js gives +1 ATK and partial heal. Fix: remove the dead fallback path in main.js.

### Serious Issues Found

4. **Unseeded Math.random()** used in combat.js:137, ai.js (7 locations), items.js:199/213-214 — Breaks the seeded-PRNG architecture decision.
5. **4-way player movement vs 8-way monster movement** — Players can only move cardinally but monsters move diagonally.
6. **Distance metric mismatch** — tryAbility uses manhattanDist but combat uses chebyshevDist for range checks.

### Architecture Notes

- Module dependency graph: clean, no circular dependencies
- Two encapsulation violations: renderer directly accesses `GameState.state.groundItems`, `loadGame()` bypasses accessors
- Dead code: TILES.WATER never used, main.js fallback combat path unreachable
- Boss difficulty (Dragon Lord) potentially overtuned: 470 HP + enrage + minions vs ~230 HP player
- Written full findings to `.squad/decisions/inbox/sheldon-design-review.md`

## Retrospective (2026-02-27)

### Key Findings
- **9 critical bugs shipped in initial build** despite 85 passing tests. All were integration-layer failures (missing wiring, data model gaps, duplicate logic) invisible to unit tests.
- **"Never wired" pattern was the #1 failure mode:** 4 of 10 critical bugs were functions that existed and worked but were never called from main.js (init, dropLoot, tickBuffs, processTurnStart).
- **Parallel fan-out without integration gates** caused the bugs. Architecture defined interfaces but not wiring contracts (who calls what, when).
- **Defensive coding (`window.X && X.method`) masked failures** instead of surfacing them. Silent degradation hid missing integrations.
- **Adding Leslie (Critic) was the highest-impact change.** One critic review found more critical bugs than five builder sessions. Critic review is now a mandatory gate.
- **Root causes:** No integration tests, no code review before merge, informal/additive entity schema, no wiring manifest.

### Process Changes Committed
1. Integration wiring manifest required for all cross-module calls
2. Mandatory code review before merge (Lead reviews main.js changes)
3. Integration tests verifying actual wiring (not just module correctness)
4. Critic review as standard gate before milestones
5. Fail loudly on required integrations — ban silent guards for required calls
6. Centralize entity/item schema — no ad-hoc field additions outside factories

### Retrospective Document
- Written to `.squad/decisions/inbox/sheldon-retrospective.md`

## Design Review #2 (2026-02-27)

### Ceremony: Design Review
- **Scope:** Architecture health, dungeon gen, cross-module integration, code quality
- **Verdict:** B+ maintained. Previous critical bugs (duplicate player ref, self-targeting, duplicate checkLevelUp) were fixed. Remaining issues are Minor/Major severity.

### Issues Found
1. **[Major] Trap RNG uses Date.now() seed** — main.js:268. `Utils.createRNG(Date.now())` creates a new unseeded-quality RNG per trap. Breaks determinism and will produce similar damage on rapid successive traps.
2. **[Major] Monster spawn randInt on small rooms** — monsters.js:188-189. `randInt(room.x+1, room.x+room.w-2)` requires w≥4. FLOOR_PARAMS guarantees minRoomSize≥4, so currently safe, but no defensive guard if room sizing changes.
3. **[Minor] Math.random() fallback in combat/AI** — combat.js:34, ai.js:21. Fallback `Math.random()` only fires if init() wasn't called. Init is wired, so low risk, but violates "fail loudly" policy.
4. **[Minor] Renderer Math.random() for shake** — renderer.js:99-100. Acceptable for visual-only effect (no gameplay impact).
5. **[Minor] TILES.WATER defined but never generated** — constants.js:19, renderer.js:23 has color. Dead code.
6. **[Minor] Renderer accesses GameState.state.groundItems directly** — renderer.js:212. Encapsulation violation, but functional.

### What's Working Well
- BSP generator produces clean, connected dungeons across all 10 floors
- Integration manifest is comprehensive and accurate (73 entries, all ✅)
- Save/load re-links player reference correctly (line 540-544)
- Self-targeting abilities now properly handled (line 387-393)
- Single checkLevelUp in combat.js only (main.js duplicate removed)
- Module load order is correct; bootstrap verifies all 12 modules

## Arcane Bolt Fog Check Fix (2026-02-27)

- **Bug:** Mage's auto-ranged Arcane Bolt (main.js:247-264) scanned tiles in the movement direction and attacked enemies even if they were hidden in fog of war. This let the player hit enemies they couldn't see, pulling aggro blindly.
- **Fix:** Added `if (!visibleTiles.has(tx + ',' + ty)) break;` at main.js:257, before the `getEntityAt()` call. Uses the existing module-level `visibleTiles` Set (line 17), which is recomputed via `FOVSystem.compute()` on every move. Using `break` (not `continue`) because if a tile is outside FOV, all tiles further in that direction are also not visible.
- **Impact:** Minimal, single-line addition. No new APIs, no cross-module changes.
