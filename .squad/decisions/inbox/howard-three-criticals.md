# Decision: Three Critical Bug Fixes in main.js

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
