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
- **Files:** test-combat.js, test-items.js, test-save.js in tests/ directory; tests/index.html updated

## Leslie's Game Audit (2026-02-26)

### Critical Issues Found in ItemSystem
1. **ItemSystem.init() Never Called** — Identification maps (_idMap, _reverseIdMap) stay empty; all generated potions/scrolls have undefined appearance names
2. **ItemSystem.dropLoot() Never Called** — Combat system missing call in onKill(); monsters never drop loot; entire loot system is dead code
3. **ItemSystem.tickBuffs() Never Called** — Buff/debuff effects never expire; single Strength Potion grants permanent +5 attack
4. **createItem() Strips Custom Properties** — Custom fields like _defKey (potions/scrolls) and special (Flamebrand's fire_dot) lost during creation
5. **Save/Load Loses Item State** — item._defKey, _identifiedKeys module state never persisted; item identification system reset on load

### Serious Issues Found
- **Helmet/Boots/Amulet Extremely Rare** — Only appear via 30% bonus roll in generateLoot(); expect ~0.1 per floor
- **Scroll of Teleport Unsafe** — items.js:210-216 doesn't verify target tile is walkable or unoccupied; can land on walls/monsters

### Integration Notes for Raj
- Priority: (1) Ensure createItem preserves _defKey and custom properties, (2) Save/restore _identifiedKeys and potion/scroll identification state in save/load, (3) Implement ItemSystem state serialization
- Blocking: Leonard needs ItemSystem.dropLoot() wired; tickBuffs() called per turn; init() called on new game
- Next: Add helmets/boots/amulets to TYPE_WEIGHTS; validate Scroll of Teleport destination

## P0/P1/P2 Bug Fixes (2026-02-26)

### Changes Made to `src/items/items.js`

1. **P0 — Replaced all Math.random() with seeded RNG**
   - Added module-scoped `_rng` variable, stored during `init(rng)`.
   - `_aoeFireball()` and `_scrollTeleport()` now use `_rng` (with `Utils.createRNG(Date.now())` fallback if init wasn't called).
   - Zero remaining `Math.random()` calls in items.js. All randomness is now deterministic/reproducible.

2. **P1 — Inventory cap: 20 items max**
   - Added `MAX_INVENTORY_SIZE = 20` constant.
   - `pickupItem()` checks `entity.inventory.length >= MAX_INVENTORY_SIZE` before adding; returns false with "Your inventory is full! Drop something first." message if full.
   - Exposed `MAX_INVENTORY_SIZE` on the public `ItemSystem` API for UI reference.
   - Updated README.md with inventory cap info.

3. **P1 — Helmet/boots/amulet now drop normally**
   - Added `helmet: 6`, `boots: 6`, `amulet: 6` to `TYPE_WEIGHTS` (rebalanced other weights to keep total at 100).
   - Added `helmet`, `boots`, `amulet` cases to `_generateSingleItem()` switch — they route through `_generateEquipItem()` which already handles all equipment types.
   - The 30% bonus roll in `generateLoot()` remains as extra insurance.

4. **P2 — Scroll of Teleport now validates destination**
   - After picking a random room position, verifies tile is walkable (`WALKABLE_TILES.has(tile)`) and no entity exists there (`GameState.getEntityAt()`).
   - Retries up to 10 attempts on invalid positions.
   - Falls back to current position with "The teleport fizzles." message if all attempts fail.

### Weight Rebalancing Detail
Old: weapon:25, armor:20, potion:25, scroll:15, ring:10, food:5 (total:100)
New: weapon:20, armor:16, helmet:6, boots:6, amulet:6, potion:22, scroll:12, ring:8, food:4 (total:100)

## Critical Bug Fix — Scroll of Fireball onKill (2026-02-26)

### Problem
`_aoeFireball()` in items.js set `e.alive = false` when AoE fire damage killed an enemy, but never called `CombatSystem.onKill()`. Kills from Scroll of Fireball awarded no XP and dropped no loot.

### Fix
Added `window.CombatSystem && CombatSystem.onKill && CombatSystem.onKill(entity, e)` after the kill in `_aoeFireball()`, mirroring the pattern used in `combat.js:aoeAttack()`. The guard ensures no crash if CombatSystem hasn't loaded yet.

### Audit
Full grep of items.js confirmed this was the **only** site where `alive = false` is set. No other scroll effects, potion effects, or damage-dealing items directly kill entities — `_aoeFireball()` was the sole offender.
