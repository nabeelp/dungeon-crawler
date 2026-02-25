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

### Help Screen Integration (from Howard, 2026-02-25)
- **Help overlay documents:** Full item list with types, rarities, stat mods, and slot assignments
- **Help key:** Press `?` or `h` in-game to see item templates and inventory controls
- **Inventory UI:** Interactive overlay (i key) shows equipped items (★), allows equip/unequip/use/drop actions
- **No action needed:** Raj's item system is already complete; help screen displays existing templates and loot data

### Equipment Stat Application Architecture
- **Public API:** `applyEquipmentMods(entity, item)` and `removeEquipmentMods(entity, item)` are clean wrappers around the internal `_applyStatMods(entity, mods, direction)` helper.
- **Stat categories:** `hp`/`mana`/`stamina` mods adjust both current and max values with clamping. All other stats (`attack`, `defense`, `speed`) are applied/removed additively.
- **Symmetry guarantee:** `equipItem()` calls `applyEquipmentMods` (+1 direction), `unequipItem()` calls `removeEquipmentMods` (-1 direction). When replacing an item in the same slot, `unequipItem` is called first to cleanly reverse old mods before applying new ones.
- **Monster loot drops:** `dropLoot(monster, floorIndex)` rolls for loot when a monster dies. 35% base drop chance for normal monsters, 100% for bosses. Normal monsters drop 1 item (15% chance of 2), bosses drop 2-4. Items are placed at the monster's position via `GameState.addGroundItem()`. Combat system should call `ItemSystem.dropLoot(victim, victim.floor)` in `onKill` when a monster dies.
