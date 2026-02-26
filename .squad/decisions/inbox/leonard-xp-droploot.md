# Decision: Canonical XP/Level-Up Path & Loot Drop Wiring

**Author:** Leonard (Combat + Enemy AI)  
**Date:** 2026-02-26  
**Status:** Implemented  
**Fixes:** Leslie's Bug #1 (Double XP), Bug #4 (dropLoot never called)

## Summary

`CombatSystem.onKill()` is now the single canonical handler for monster death. It awards XP, checks level-up, and drops loot. Both `onKill` and `checkLevelUp` are exported on `window.CombatSystem`.

## Changes

### 1. `onKill()` — now calls `ItemSystem.dropLoot()`

After awarding XP and checking level-up, `onKill()` calls:
```js
if (window.ItemSystem && ItemSystem.dropLoot) {
  ItemSystem.dropLoot(victim, victim.floor);
}
```
`dropLoot` handles ground item placement and loot messages internally.

### 2. `checkLevelUp()` — updated stat gains

| Stat | Old | New | Rationale |
|------|-----|-----|-----------|
| maxHP | +8 | +10 | Rounder number, partial heal (heal for amount gained) |
| maxMana | +4 | +3 | Slightly slower mana scaling keeps resource management meaningful |
| maxStamina | +4 | +3 | Same reasoning as mana |
| attack | +2 | +1 | +2 per level was too aggressive; equipment should be primary ATK source |
| defense | +1 | +1 | Unchanged |
| speed | +1 | 0 | Removed — speed should come from class base + equipment, not levels |

Partial heal: `entity.hp = Math.min(entity.hp + 10, entity.maxHp)` — heals for the amount of HP gained, not a full heal.

### 3. `onKill` exported on `CombatSystem`

Added to the public API so `main.js` can call `CombatSystem.onKill(killer, victim)` from the fallback combat path if needed.

## Impact on Other Agents

- **Howard (main.js):** Must remove the duplicate XP award and `checkLevelUp()` from `tryMove()` (lines 192-195 and 204-205). CombatSystem.meleeAttack already calls onKill internally. The fallback path (lines 197-206) should also call `CombatSystem.onKill()` instead of its own XP logic.
- **Amy (Tests):** Tests referencing old level-up stat gains (+8 HP, +4 mana, +4 stamina, +2 atk, +1 def, +1 spd) need updating to (+10 HP, +3 mana, +3 stamina, +1 atk, +1 def, no speed).
- **Raj (Items):** No changes needed. `dropLoot` is now called correctly.
- **Sheldon (Core):** No changes needed.
