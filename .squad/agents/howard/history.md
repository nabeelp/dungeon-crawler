# Howard — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Owner:** Nabeel
- **Stack:** JavaScript, HTML5 Canvas, browser-based
- **Description:** Procedural dungeon generation, permadeath, turn-based combat, fog of war, item identification system
- **My Role:** Rendering + fog of war developer. HTML5 Canvas, tilemap, raycasting visibility, game UI, main loop.

## Learnings

- **FOV Algorithm:** Recursive shadowcasting (8 octants) — fast, clean results. Returns Set of "x,y" string keys for O(1) visible-tile lookups. Updates `explored[][]` in floor data.
- **Renderer architecture:** Camera centered on player, only renders tiles in viewport range. Tile colors are simple filled rects, entities are colored squares with letter symbols. Fog of war uses 50% black overlay for explored-but-not-visible tiles.
- **HUD:** Drawn directly on same canvas after world render. Health/mana/stamina bars top-left, mini-map top-right, message log bottom, floor indicator center-top.
- **Game loop:** `requestAnimationFrame` with dirty flag (`needsRender`). Only redraws when state changes (turn-based, not continuous).
- **Input:** Keyboard-driven. Title screen has class selection (↑↓) and name input (TAB to toggle). In-game: WASD/arrows for movement, G pickup, >< stairs, 1-9 abilities, I inventory, space to wait.
- **Teammate API integration:** `MonsterFactory.spawnForFloor(floorIndex, rooms, rng)`, `ItemSystem.placeItemsOnFloor(floorIndex, rooms, rng)`, `CombatSystem.meleeAttack(attacker, defender)`, `CombatSystem.useAbility(abilityKey, user, target)`, `AISystem.processAllMonsters()`. All checked via `window.X &&` guards for graceful degradation.
- **Save/Load:** JSON to localStorage key `dc_save`, auto-saves on `beforeunload`. Permadeath deletes save on death. High scores stored in `dc_highscores`.
- **Script load order:** constants → utils → gameState → generator → fov → combat → ai → monsters → items → renderer → hud → main. FOV before combat (no dependency). Main must be last.
- **Key files:** `src/systems/fov.js`, `src/rendering/renderer.js`, `src/ui/hud.js`, `src/main.js`
- **Visual effects architecture:** Screen shake, floating damage numbers, and pulsing stairs all live in renderer.js. Shake uses a duration/intensity model that decays over 8 frames via linear interpolation — `triggerShake(intensity)` uses `Math.max` so concurrent shakes don't accumulate, the strongest wins. Damage number particles are stored in a flat array with `spawnTime` for time-based lifecycle (1 second, float up 40px, fade out). Stairs pulse uses stateless `Math.sin(Date.now() / 500)` for 0.7→1.0 opacity. Game loop in main.js checks `Renderer.hasActiveAnimations()` each frame to enable continuous rendering during effects, then returns to dirty-flag mode when idle. External systems call `Renderer.triggerShake(n)` and `Renderer.spawnDamageNumber(x, y, amount, type)` — type is one of `player_damage`, `enemy_damage`, `heal`, `critical`.

## Cross-Agent Updates (2026-02-25)

### Combat System Integration (from Leonard)
- **API:** `CombatSystem.processTurnStart(entity)` ticks status effects once per entity per turn
- **Status effects:** Entity has `statusEffects[]` array — display these in HUD entity tooltips/status bar
- **Damage resolution:** `CombatSystem.meleeAttack(attacker, defender)` and `CombatSystem.useAbility(abilityKey, user, target)` both resolve and return results
- **XP/leveling:** Player entity gains `xp` on kill; `CombatSystem.awardXp(entity, amount)` handles level-up messages and stat bumps

### ItemSystem Integration (from Raj)
- **Startup:** Call `ItemSystem.init(rng)` once during `newGame()` after `GameState.newGame(seed)`, before floor generation
- **Floor loot:** Call `ItemSystem.placeItemsOnFloor(floorIndex, rooms, rng)` after dungeon generation but before spawning monsters
- **Item display:** Use `ItemSystem.getDisplayName(item)` for all item names in UI (handles identification)
- **Inventory UI:** Wire to `ItemSystem.equipItem()`, `unequipItem()`, `useItem()`, `dropItem()`, `pickupItem()`
- **Buff system:** Call `ItemSystem.tickBuffs(entity)` once per turn for all entities (after status effect ticks)
- **Display:** Show buff/debuff icons and timers from `entity._buffs[]` in HUD

### Help Screen + Inventory UI + Title Controls (2026-02-25)
- **Help overlay:** Toggle via `?`/`h`/`H` during gameplay. Full-screen dark overlay with organized sections (Movement, Combat, Inventory, Game Info). Color-coded class abilities. Close with `?`/`h`/`Esc`. Uses boolean flag `showHelp` in hud.js — no game phase change needed.
- **Inventory UI:** Toggle via `i` during gameplay. Full-screen overlay listing all inventory items with ★ markers for equipped gear. Arrow keys navigate, `e` equip/unequip, `u` use consumables, `d` drop. Detail panel shows item stats, description, rarity, equipped status. Scrolling for large inventories. Uses `showInventory` + `inventoryIndex` state in hud.js.
- **Input interception pattern:** When help or inventory overlays are visible, `handleKeyDown` in main.js intercepts input before game input processing. Overlays are mutually exclusive (opening one closes the other).
- **Title screen controls:** Added a "Controls" quick-reference section between the start prompt and high scores, showing key bindings at a glance.
- **HUD API expansion:** Added `toggleHelp`, `isHelpVisible`, `toggleInventory`, `isInventoryVisible`, `getInventoryIndex`, `setInventoryIndex`, `closeInventory` to `window.HUD`.
- **ItemSystem integration:** Inventory UI uses `ItemSystem.getDisplayName()`, `equipItem()`, `unequipItem()`, `useItem()`, `dropItem()` with fallback guards for when ItemSystem isn't loaded.

## Cross-Agent Updates (2026-02-25)

### Visual Polish Integration (from Howard, combat-triggered effects)
- **Screen shake:** Combat system calls `Renderer.triggerShake(intensity)` on damage hits (light 2/medium 4/strong 6)
- **Floating damage numbers:** Combat system calls `Renderer.spawnDamageNumber(x, y, amount, type)` after combat resolution (type: player_damage/enemy_damage/heal/critical)
- **Animation loop:** `Renderer.hasActiveAnimations()` checked each frame in main.js; continuous rendering during effects, dirty-flag mode when idle
- **Guards:** Combat system wraps visual calls with `window.Renderer && Renderer.method()` for graceful degradation

### Sheldon & Leonard Integration Points
- **XP progression:** Sheldon's 1.25x XP curve + 0.3x floor scaling make end-game achievable; Leonard's combat correctly reads `victim.xpValue`
- **Monster stats:** Leonard's monsters spawn with Sheldon-computed XP values that scale by floor index
- **Combat feedback:** Leonard's attack messages show HP%, crits apply BLEED, status effects warn before expiring

### Raj Integration Points
- **Equipment:** Inventory UI wires to ItemSystem.equipItem/unequipItem which call applyEquipmentMods/removeEquipmentMods
- **Loot display:** Inventory shows items with ItemSystem.getDisplayName() for proper identification display
- **Item management:** Inventory UI calls ItemSystem.useItem(), dropItem(), pickupItem() for consumable handling

### Amy Integration Points
- **Test coverage:** 45+ new tests validate combat balance, item system, equipment stat application, loot drops, save/load
- **All passing:** Tests include edge cases (empty inventory, no drops, invalid equipment), state transitions, RNG determinism, multi-floor scaling
