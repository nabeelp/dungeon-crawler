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

## New Test Additions (2026-02-25)

### Combat Tests (test-combat.js, ~15 new tests)
- All 12 class abilities resolve correctly (power_strike, shield_bash, war_cry, fireball, ice_shard, arcane_shield, backstab, evade, poison_blade, heal, smite, divine_shield)
- Damage calculation includes RNG variance (-2 to +2 range)
- Status effect application: stunned, slowed, poisoned, shielded, buffed, evading, divine_shield
- New status effects: BLEED (stacking DoT on crits), VULNERABLE (+25% damage)
- Critical hit detection (>1.5x reference damage) and auto-apply BLEED
- XP/leveling: correct XP per level with 1.25x multiplier, level-up stat bumps
- Boss behavior: Dragon Lord enrage at 25% HP, telegraph detection, summon cap enforcement

### Item System Tests (test-items.js, ~15 new tests)
- Equipment stat application: `applyEquipmentMods(entity, item)` correctly modifies all stat types
- Equipment stat removal: `removeEquipmentMods(entity, item)` cleanly reverses mods
- Slot replacement: unequipping old item before equipping new one preserves stat consistency
- Loot generation: `ItemSystem.generateLoot(floorIndex, rng)` scales quantity (3-5 floor 1, 6-10 floor 10) and rarity
- Monster drops: `ItemSystem.dropLoot(monster, floorIndex)` with 35% normal / 100% boss drop chance
- Drop counts: normal 1 item (15% chance 2), bosses 2-4 items
- Rarity scaling: deeper floors shift toward epic/legendary
- Identification system: consumables unidentified by default, equipment always identified
- Inventory management: pickup, drop, equip, unequip, use actions

### Save/Load Tests (test-save.js, ~15 new tests)
- Full game state serialization to localStorage (JSON format)
- Equipment persistence: equipped items survive save/load cycle
- Inventory integrity: all items preserved with correct counts and types
- Entity state preservation: HP, mana, stamina, XP, level, status effects, buffs
- Multi-floor state: player position, explored map state, monster states
- Permadeath behavior: save deleted on player death, high scores preserved
- Class selection state: correct character class loaded on new game
- RNG state: deterministic floor generation with same seed produces identical layout

### Coverage Summary
- **45+ new tests total** across combat, items, and save/load
- **Edge cases:** Empty inventories, no loot drops, invalid equipment, negative stat mods
- **State transitions:** Creating entity → equipping item → taking damage → death → restart
- **RNG determinism:** Same seed produces identical monster spawns, same loot rolls produce same items
- **Multi-floor scaling:** XP, item rarity, monster difficulty all scale correctly by floor depth
- **All passing:** 100% pass rate on new test suite

## Cross-Agent Context (2026-02-25)

### Sheldon's XP Curve (1.4→1.25, floor scaling 0.1→0.3)
- Tests verify level 10 achievable at 372 XP, level 20 at 3,469 XP
- Monster XP scaling verified: floor 10 monsters award 2-4x more XP than floor 1

### Leonard's Combat Balance (Cleric -15 HP, Rogue -1 turn, Warrior +2 ATK)
- Tests verify all 12 abilities resolve with correct cooldowns, costs, and effects
- Status effects (BLEED, VULNERABLE) apply correctly and tick down
- Boss mechanics: enrage, telegraph, summon caps all verified to work

### Raj's Equipment System (new public API for stat mods, monster loot)
- Tests verify equipment stat application doesn't double-apply on re-equip
- Monster drops verified: 35% normal / 100% boss, correct item counts and rarity
- Item serialization verified: equipment persists across save/load

### Howard's Visual Effects (screen shake, floating damage, pulsing stairs)
- No test coverage for visual rendering (out of scope for unit tests)
- Tests focus on system state (damage numbers, shake triggers, animation flags)

### Bug Fix Verification Tests (2026-02-26) — COMPLETE

- **17 new tests** added across combat, items, and save/load files to verify Leslie's 6 critical bugs are fixed
- **test-combat.js:** 6 new tests — no double XP on kill (exact xpValue awarded), multi-kill XP accumulation, checkLevelUp stat gains (+10 HP, +3 mana, +3 stamina per level), multi-level-up stacking, boss loot drop on kill via meleeAttack, stat gains without speed increase
- **test-items.js:** 7 new tests — createItem preserves _defKey, createItem preserves special (fire_dot), _defKey survives generateLoot pipeline, init() creates randomized potion/scroll display names, tickBuffs decrements duration, tickBuffs reverses effect on expiry, equipment stat application integrity
- **test-save.js:** 7 new tests — statusEffects survive save/load cycle (populated and empty), monster tags/xpValue persist, boss multi-tags persist, item _defKey preserved in inventory and ground items after save/load, full game state round-trip integrity
- **All 17 tests passing** ✓
- **Coverage:** Bugs #1 (double XP), #2 (createItem props), #3 (init wiring), #4 (dropLoot wiring), #5 (tickBuffs wiring), #6 (save/load state)

### Leslie's Bug Fix Sprint (2026-02-26) — COMPLETE

- **Team:** Sheldon (Lead), Leonard (Combat), Howard (Rendering), Amy (Tester)
- **All 6 critical bugs fixed and verified**
- **17 regression tests added**
- **All changes committed with team signature**
