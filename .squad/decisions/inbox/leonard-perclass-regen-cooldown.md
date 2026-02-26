# Decision: Per-Class Regen Cooldowns (Option E)

**Date:** 2026-02-27
**Author:** Leonard (Combat + Enemy AI)
**Requested by:** Nabeel
**Status:** Implemented

## Context

The flat 5-turn regen cooldown created a mana deficit for Mage and Cleric — classes that depend on mana for their core identity. Leslie proposed per-class cooldown durations (Option E) as a minimal, surgical fix that doesn't change regen rates or introduce new mechanics.

## Decision

Added `REGEN_COOLDOWN` to `constants.js` with per-class values:

| Class | Cooldown (turns) | Total Regen |
|-------|-----------------|-------------|
| Warrior | 5 | 15 stamina, 10 HP |
| Rogue | 5 | 15 stamina, 5 HP |
| Cleric | 7 | 14 mana, 14 HP, 14 stamina |
| Mage | 8 | 24 mana, 8 HP, 8 stamina |

Warrior/Rogue unchanged. Mage gets +60% mana recovery per encounter. Cleric gets +40%.

## Files Changed

- `src/core/constants.js` — Added `REGEN_COOLDOWN` frozen object, exported on Constants
- `src/systems/combat.js` — `regenerate()` uses per-class cooldown with fallback to 5
- `src/main.js` — `checkCombatPhase()` COMBAT→EXPLORING reset uses per-class cooldown
- `src/ui/hud.js` — Help screen updated with per-class cooldown info
- `README.md` — Post-Combat Cooldown section updated with table

## Rationale

- Smallest possible change: no new mechanics, no new input handlers, no rate changes
- Directly addresses mana deficit without re-introducing wait-to-win exploit
- Follows existing pattern (REGEN_RATES uses same key structure)
- Fallback to 5 ensures unknown/future classes degrade gracefully
