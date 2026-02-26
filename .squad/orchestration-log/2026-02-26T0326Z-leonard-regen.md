# Orchestration Log: Leonard (Combat + Enemy AI)

**Timestamp:** 2026-02-26T03:26:18Z  
**Agent:** Leonard  
**Task:** Class-based resource regeneration system

## Summary

Leonard added per-class passive resource regeneration that triggers once per player turn during EXPLORING phase only. Replaced old flat +2 stamina/+1 mana regen with class-differentiated rates.

## Files Modified

- `src/core/constants.js` — Added `REGEN_RATES` object with per-class HP/mana/stamina rates
- `src/systems/combat.js` — Added `regenerate()` function, hooked into `processTurnStart()`
- `src/main.js` — Called `CombatSystem.regenerate()` during EXPLORING phase turn cycle
- `README.md` — Added REGENERATION section documenting regen rates and behavior
- `help.md` — Updated in-game help screen with REGENERATION section

## Tests Added

- `tests/combat.test.js`
  - ✓ Warrior regenerates 2 HP, 0 mana, 3 stamina per turn
  - ✓ Mage regenerates 1 HP, 3 mana, 1 stamina per turn
  - ✓ Rogue regenerates 1 HP, 0 mana, 3 stamina per turn
  - ✓ Cleric regenerates 2 HP, 2 mana, 2 stamina per turn

## Status

**DONE** — All changes implemented, tested, and documented.
