# Decision: Four Critical Bug Fixes in main.js

**Author:** Howard (Rendering + Fog of War)  
**Date:** 2026-02-26  
**Status:** Implemented  
**File:** `src/main.js`

## Summary

Fixed four critical bugs identified by Leslie's audit, all in `src/main.js`.

## Changes

### Bug #1 — Remove Duplicate XP Award (lines 207-209)

**Before:** `tryMove()` awarded XP via `player.xp += (target.level || 1) * 10` and called its own `checkLevelUp()` after `CombatSystem.meleeAttack()` killed a target. This caused double XP and double level-ups with conflicting stat formulas (main.js: +10hp/+2atk/+1def vs combat.js: class-specific).

**After:** Removed the XP award and `checkLevelUp()` call from the CombatSystem branch. `CombatSystem.onKill()` is the single source of truth for XP and leveling. The fallback branch (no CombatSystem loaded) still awards XP since it's the only path in that case.

### Bug #3 — Wire ItemSystem.init() (lines 107-111)

**Before:** `ItemSystem.init(rng)` was never called. Identification maps stayed empty, breaking all potion/scroll display names.

**After:** Added `ItemSystem.init(idRng)` in `startNewGame()` after `GameState.newGame()` and before any item generation. Uses seed offset `+999` to avoid RNG stream collisions with monster spawning (seed) and item placement (seed+500).

### Bug #5 — Wire ItemSystem.tickBuffs() (lines 165-174)

**Before:** `ItemSystem.tickBuffs()` was never called. Buff/debuff timers never decremented, making all potion effects permanent.

**After:** Added `ItemSystem.tickBuffs(entity)` calls in `processPlayerAction()` after enemy turns and turn advance, for the player and all alive non-player entities on the current floor. Placed before regeneration so buff expiry happens first.

### Bug #6 — Save/Load Identification State (lines 448, 459, 503-506)

**Before:** ItemSystem's module-level identification state (`_idMap`, `_reverseIdMap`, `_identifiedKeys`) was lost on page reload.

**After:** `saveGame()` captures identification state via `ItemSystem.getIdentificationState()` into a new `identificationState` field. `loadGame()` restores it via `ItemSystem.restoreIdentificationState()`. Both use defensive guards so they degrade gracefully if Sheldon's API methods aren't merged yet.

## Impact on Other Agents

- **Sheldon (Raj):** Bug #6 depends on `getIdentificationState()` and `restoreIdentificationState()` being added to `items.js`. The guards ensure no breakage until those methods exist.
- **Leonard:** No impact. Combat system's `onKill()` is now the sole XP/leveling path (as intended).
- **Amy:** Existing save/load tests use local helper functions and are unaffected. New tests should verify: (1) no double XP on kill, (2) ItemSystem.init called on new game, (3) buff timers tick down each turn, (4) identification state survives save/load cycle.
