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

## Cross-Agent Updates (2026-02-25)

### Sheldon: XP Curve Fix & Monster XP Scaling
- **XP_PER_LEVEL:** Multiplier changed 1.4→1.25, making late-game progression achievable (level 20 = 3,469 XP instead of 29,881)
- **Monster XP:** Floor scaling multiplier 0.1→0.3, so floor 10 monsters reward ~3.7x base XP (Lich: 65→240 XP)
- **Impact on Raj:** No changes needed; ItemSystem.dropLoot() works correctly with Sheldon's updated monster XP values

### Leonard: Combat Balance & Boss Mechanics
- **Class balance:** Cleric heal 20→30 mana/40→25 HP, Rogue evade 2→1 turn, Warrior War Cry +5→+7 ATK
- **New status effects:** BLEED (stacking DoT on crits), VULNERABLE (+25% damage for 3 turns)
- **Combat feedback:** All attacks show target HP%, crits auto-apply BLEED, status effects warn before expiring
- **Dragon Lord boss:** Enrages at 25% HP (+2 speed, double attacks), telegraphs heavy attacks 1 turn in advance, summons scale 2→3 more, hard cap 4 minions
- **Loot integration:** Leonard's `onKill` handler calls `ItemSystem.dropLoot(victim, victim.floor)` to drop loot when monsters die

### Howard: Visual Effects & Game Loop
- **Screen shake:** Implemented `Renderer.triggerShake(intensity)` on damage hits (light/medium/strong)
- **Floating damage:** Implemented `Renderer.spawnDamageNumber(x, y, amount, type)` for damage/heal/crit display
- **Pulsing stairs:** STAIRS_DOWN/UP now pulse 0.7→1.0 opacity when visible, helps player discovery
- **Game loop integration:** `Renderer.hasActiveAnimations()` check enables continuous rendering during effects, then returns to dirty-flag mode when idle
- **Combat integration:** Combat system guards calls with `window.Renderer && Renderer.triggerShake()` and `Renderer.spawnDamageNumber()`

### Amy: Comprehensive Testing (2026-02-25)
- **Combat tests:** 15+ tests covering all 12 abilities, status effect application/ticking, damage variance, boss behavior
- **Item tests:** 15+ tests for equipment stat application/removal, loot generation, drop chance and rates, identification system, inventory management
- **Save/load tests:** 15+ tests for full game state serialization, equipment persistence, inventory integrity, entity state preservation, permadeath behavior
- **All passing:** 45+ new tests with edge case coverage (empty inventories, no drops, invalid equipment, state transitions, RNG determinism, multi-floor scaling)
- **Files:** test-combat.js, test-items.js, test-save.js in tests/ directory; tests/index.html updated
