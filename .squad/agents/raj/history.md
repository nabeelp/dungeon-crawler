# Raj — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Owner:** Nabeel
- **Stack:** JavaScript, HTML5 Canvas, browser-based
- **Description:** Procedural dungeon generation, permadeath, turn-based combat, fog of war, item identification system
- **My Role:** Items + loot developer. Weapons, armor, potions, scrolls, loot tables, identification system.

## Learnings

- **File created:** `src/items/items.js` → `window.ItemSystem` — complete item system with 50+ templates, loot tables, identification, and inventory management.
- **Architecture:** IIFE pattern matching Sheldon's modules. No import/export — everything on `window.ItemSystem`.
- **Dependencies:** Must load after `constants.js`, `utils.js`, `gameState.js`.
- **Identification system:** Per-run randomized mappings stored in module-scoped `_idMap`/`_reverseIdMap`. Initialized via `ItemSystem.init(rng)`.
- **Buff/debuff system:** Stored on `entity._buffs[]`. `tickBuffs()` must be called once per turn by the combat system.
- **Stat mods for equipment:** Applied/removed symmetrically via `_applyStatMods(entity, mods, direction)`. HP/mana/stamina mods affect both current and max values.
- **Potion/scroll `_defKey`:** Items store a `_defKey` property linking to their definition. This is a custom property passed through `GameState.createItem()` — it persists because `createItem` spreads opts.
- **Loot scaling:** Quantity and rarity both scale with floor index. Floor 10 drops only rare/epic/legendary.
- **Food items:** Instant use, always identified, provide HP/stamina restoration + temporary buffs.
- **Decision doc:** `.squad/decisions/inbox/raj-items-api.md` — full API reference for team integration.

## Cross-Agent Updates (2026-02-25)

### Rendering Integration (from Howard)
- **Startup:** Howard calls `ItemSystem.init(rng)` during new game setup
- **Display:** Howard uses `ItemSystem.getDisplayName(item)` for all item UI (handles unidentified appearance)
- **Inventory UI:** Howard wires class selection to inventory management methods
- **Buff display:** Howard renders `entity._buffs[]` in HUD as status icons with duration timers

### Combat Integration (from Leonard)
- **Turn ticking:** Leonard calls `ItemSystem.tickBuffs(entity)` once per turn for all entities
- **Buff effects:** Combat system applies buff stat bonuses from `entity._buffs[]` during damage calculation
- **Special items:** Combat checks `item.special === 'fire_dot'` (e.g., Flamebrand) for extra effects during ability resolution
- **Stat mods:** Leonard respects equipment stat mods that ItemSystem applies via `equipItem()`

### Dungeon/Loot Placement (from Sheldon)
- **Floor setup:** Sheldon calls `ItemSystem.placeItemsOnFloor(floorIndex, rooms, rng)` after dungeon generation
- **Room-based:** ItemSystem scatters loot into room interiors, avoiding walls and corridors
- **Quantity/rarity:** Scales per floor — deeper floors have more epic/legendary drops
