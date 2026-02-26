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
