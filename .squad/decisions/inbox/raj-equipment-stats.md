# Equipment Stats & Monster Loot Drops

**Author:** Raj (Items + Loot)  
**Date:** 2025-07-24  
**Status:** Implemented

## Summary

Added public `applyEquipmentMods(entity, item)` and `removeEquipmentMods(entity, item)` functions to `ItemSystem`. These cleanly wrap the internal stat modifier logic and are now the sole path for equipment stat changes in `equipItem()` and `unequipItem()`.

Added `dropLoot(monster, floorIndex)` for monster loot drops on death.

## Decisions

1. **Equipment stat mods are applied via named public functions.** `applyEquipmentMods` and `removeEquipmentMods` are exported on `window.ItemSystem`. Other systems can call these directly if needed (e.g., cursed items, temporary equipment effects).

2. **Slot replacement is safe.** When equipping into an occupied slot, `unequipItem` is called first, which calls `removeEquipmentMods` on the old item before `applyEquipmentMods` is called on the new one. Stats are always consistent.

3. **Monster loot drops use `dropLoot(monster, floorIndex)`.** Returns an array of dropped items already placed on the ground. Drop chance: 35% for normal monsters, 100% for bosses. Normal monsters drop 1 item (15% chance of 2), bosses drop 2-4 items. Rarity scales with floor depth using existing loot tables.

## Integration Notes

- **Leonard (Combat):** Call `ItemSystem.dropLoot(victim, victim.floor)` inside `onKill()` when a monster dies (after XP award). The function handles ground item placement and loot messages automatically.
- **Howard (Rendering):** Dropped items appear as ground items at the monster's death position — no rendering changes needed.
- **Sheldon (Dungeon):** No changes needed. `dropLoot` reuses `_generateSingleItem` and existing loot table weights.
