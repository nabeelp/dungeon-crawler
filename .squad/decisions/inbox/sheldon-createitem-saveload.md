# Decision: createItem/createEntity Schema Fix + Save/Load Identification State

**Author:** Sheldon (Lead + Dungeon Generation)  
**Date:** 2026-02-26  
**Status:** Implemented (partially — needs Howard wiring)  
**Fixes:** Bug #2 (createItem drops extra props), Bug #6 (save/load loses entity/item state)

## Changes Made

### 1. `createItem()` now preserves extra properties (gameState.js)

Any properties passed in `opts` that aren't part of the standard item schema are automatically copied to the returned item object. This means `_defKey` (potions/scrolls) and `special` (Flamebrand's `fire_dot`) now survive item creation.

Standard keys (`id`, `name`, `type`, `slot`, `description`, `rarity`, `floorLevel`, `identified`, `statMods`, `x`, `y`, `floor`) are handled by the existing fixed logic. Everything else passes through.

### 2. `_generateEquipItem()` now passes `special` from templates (items.js)

The equipment generator explicitly checks for `tmpl.special` and includes it in the `createItem()` opts. Combined with change #1, Flamebrand's `fire_dot` now works end-to-end.

### 3. `createEntity()` schema expanded (gameState.js)

Five fields are now part of the entity schema (not ad-hoc additions):

| Field | Default | Purpose |
|-------|---------|---------|
| `statusEffects` | `[]` | Combat status effects (bleed, vulnerable, etc.) |
| `tags` | `[]` | Monster tags (undead, boss) |
| `xpValue` | `0` | XP reward on kill |
| `templateKey` | `null` | Monster template reference |
| `_buffs` | `[]` | Item buff/debuff tracking |

These are now initialized in the factory, meaning they survive JSON round-trip (save/load). MonsterFactory still overwrites them after creation, which is fine.

### 4. ItemSystem identification state API (items.js)

Two new exported methods:

- `ItemSystem.getIdentificationState()` — Returns `{ idMap, reverseIdMap, identifiedKeys }` snapshot
- `ItemSystem.restoreIdentificationState(saved)` — Restores from snapshot

Both are JSON-serializable. The `identifiedKeys` Set is converted to/from an array.

## ⚠️ ACTION REQUIRED: Howard — Wire Save/Load in main.js

Howard needs to make two changes in `main.js`:

### In `saveGame()`:
```js
// After building saveData, add:
if (window.ItemSystem && ItemSystem.getIdentificationState) {
  saveData.itemIdentificationState = ItemSystem.getIdentificationState();
}
```

### In `loadGame()`:
```js
// After restoring entities/items, add:
if (window.ItemSystem && ItemSystem.restoreIdentificationState && data.itemIdentificationState) {
  ItemSystem.restoreIdentificationState(data.itemIdentificationState);
}
```

This ensures potion/scroll identification mappings and which items have been identified survive save/load.

## Impact on Other Agents

- **Howard:** Must wire the save/load calls above in main.js
- **Leonard:** No changes needed. `statusEffects`, `tags` now in schema — existing code that sets them post-creation still works
- **Raj:** No changes needed. `_defKey` and `special` now preserved by createItem. `_buffs` in schema
- **Amy:** Existing tests should pass. New tests recommended for extra-property preservation and identification state round-trip
