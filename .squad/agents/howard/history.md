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

## Leslie's Game Audit (2026-02-26)

### Critical Issues Found in Game Loop / Main
1. **Double XP / Level-Up on Kill** — main.js:190-195 AND combat.js:289-296 both award XP/call checkLevelUp; remove from main.js
2. **ItemSystem.init() Never Called** — Not called in startNewGame(); identification broken on all potions/scrolls
3. **ItemSystem.dropLoot() Never Called** — Combat's onKill() missing dropLoot call; no monsters drop loot
4. **ItemSystem.tickBuffs() Never Called** — Not called per turn; all buffs/debuffs permanent
5. **Save/Load Loses Critical Game State** — statusEffects, tags, xpValue, _buffs, _enraged, _telegraphing, _summonedPhase fields lost; monsters give 0 XP, boss phases broken, item identification reset

### Serious Issues Found
- **Combat Phase Threshold Too Tight** — Set to Chebyshev distance ≤ 2; ranged enemies at 6+ tiles attack without COMBAT indicator
- **Self-Targeting Abilities Blocked** — Can't use Heal/War Cry/Evade/Divine Shield when no enemies visible; can't heal when safe
- **No Inventory Cap** — Unbounded inventory UI breaks with 50+ items; no strategic weight decisions
- **Score Formula Rewards Slow Play** — Turn count is positive term; should penalize high turn counts

### Integration Notes for Howard
- Priority: (1) Wire ItemSystem.init() on new game, (2) Add ItemSystem.tickBuffs() call per turn, (3) Implement save/load state persistence for buffs/enraged/telegraphing/summons, (4) Fix double XP removal from main.js
- Next: Expand combat phase threshold; implement inventory cap; fix score formula

### Bug Fixes Applied (2026-02-26)
- **Bug #1 — Double XP removed:** Removed `player.xp += ...` and `checkLevelUp()` from `tryMove()` in main.js after CombatSystem.meleeAttack kills a target. CombatSystem.onKill() already handles XP award and leveling with proper formula. Kept the fallback path (no CombatSystem loaded) unchanged since it's the only XP path in that case.
- **Bug #3 — ItemSystem.init() wired:** Added `ItemSystem.init(idRng)` call in `startNewGame()` after `GameState.newGame()` and before monster/item spawning. Uses seed offset +999 to avoid colliding with other RNG streams.
- **Bug #5 — tickBuffs() wired per turn:** Added `ItemSystem.tickBuffs()` calls in `processPlayerAction()` after enemy turns. Ticks player first, then all alive non-player entities on the current floor. Placed before regeneration to ensure buff expiry happens before regen.
- **Bug #6 — Save/Load identification state:** Added `identificationState` field to save data (via `ItemSystem.getIdentificationState()` guard). On load, restores via `ItemSystem.restoreIdentificationState()` guard. Both use defensive `window.ItemSystem && method` checks so they degrade gracefully if Sheldon's API additions aren't merged yet.

### Leslie's Bug Fix Sprint (2026-02-26) — COMPLETE

- **Team:** Sheldon (Lead), Leonard (Combat), Howard (Rendering), Amy (Tester)
- **Scope:** All 6 critical bugs resolved
- **Bugs fixed:** Double XP (removed), createItem props (schema expanded), ItemSystem.init (wired), dropLoot (wired), tickBuffs (wired), save/load state (identification + entity fields preserved)
- **Test coverage:** 17 new regression tests — all passing
- **All .squad changes committed** with team signature

### Three Critical Bug Fixes (2026-02-26)

- **Bug #1 — Player status effects now tick:** Added `CombatSystem.processTurnStart(player)` call at the start of `processPlayerAction()`. This ticks poison, bleed, buff expiry, and stun for the player every turn. If the player is stunned, their action is skipped but the world still advances (enemies act, buffs tick, regen happens). Previously, War Cry and Divine Shield were permanent, poison/bleed never damaged the player, and stun had no effect.
- **Bug #2 — Save/load split-brain fixed:** After JSON deserialization in `loadGame()`, `state.player` and its matching entry in `state.entities` were separate objects. Added `Object.assign` + reference re-linking so `state.player` points to the same object in `state.entities`. Movement and combat now update both references consistently after a load.
- **Bug #3 — Self-targeting abilities work without enemies:** `tryAbility()` now checks the ability definition's `type` field from `CombatSystem.ABILITIES` before requiring an enemy target. Abilities with type `'self'`, `'party'`, or `'buff'` fire immediately with the player as both source and target. Heal, War Cry, Evade, Arcane Shield, and Divine Shield all work between fights now.
- **Dead code cleanup:** Removed the fallback combat path in `tryMove()` (unreachable since CombatSystem always loads) and the orphaned `checkLevelUp()` function in main.js. Removed unused `XP_PER_LEVEL` import.
- **README updated:** Ability keybind description now clarifies that self-targeting abilities work anywhere, while offensive abilities auto-target nearest visible enemy.

### P0/P1/P2 Fix Sprint (Howard)

- **P1 — Diagonal movement added:** Players now have 8-way movement matching monsters. Numpad 7/8/9/4/6/1/2/3 for full directional control (checked via `e.code` to avoid conflict with ability keys 1-9). Vi-keys Y/U/B/N for diagonal movement. Numpad 5 = wait. All diagonal moves go through the same `tryMove()` path (walkable check, bump-combat, traps, ground items).
- **P0 — Ability distance function fixed:** `tryAbility()` was using `Utils.manhattanDist` to find nearest enemy while all other systems (AI, combat phase) use `Utils.chebyshevDist`. Changed to `chebyshevDist` so ability targeting is consistent. Manhattan distance was overcounting diagonal distance (e.g. 2 tiles diagonal = manhattan 4 vs chebyshev 2), causing abilities to miss targets that should be in range.
- **P2 — Score formula fixed:** `calculateScore()` was adding `getTurnCounter()` as a positive term, rewarding slow play. Changed to subtract `Math.floor(turns / 10)` from base score, clamped to minimum 0. Base score remains `floor*100 + level*50 + xp`. Now faster clears score higher.
- **Documentation updated:** README controls table split into cardinal/diagonal rows. Title screen controls quick-reference updated. In-game help screen (hud.js) updated with diagonal key info.

### Serious Bug Fix Sprint (Howard)

- **Fix #1 — Combat phase threshold expanded:** `checkCombatPhase()` was using Chebyshev distance ≤ 2 to trigger COMBAT phase. Ranged enemies (Dark Mages, Liches) attack from 6+ tiles, so players were "exploring" under fire and abusing regen. Changed to trigger COMBAT if ANY visible enemy exists within FOV (checked via `visibleTiles.has()`). Since `visibleTiles` is already computed with `FOV_RADIUS`, any enemy the player can see puts them in combat — no regen while under ranged fire.
- **Fix #2 — regenCooldown persists across save/load:** Added `regenCooldown` (default 0) to `createEntity()` schema in gameState.js. Previously it was only dynamically set on the player entity when exiting combat, meaning fresh entities lacked the field. Now it's always present and serializes correctly with JSON.stringify on save and survives deserialization on load. No more save→load→instant regen exploit.
- **Fix #3 — Dead CombatSystem fallback code removed:** Removed all `window.CombatSystem &&` guards from CombatSystem calls throughout main.js (startNewGame, processPlayerAction, tryMove, tryAbility, loadGame). CombatSystem is a required dependency that always loads — the guards created implicit dead fallback paths that were maintenance traps. Direct calls: `CombatSystem.init()`, `.processTurnStart()`, `.regenerate()`, `.meleeAttack()`, `.useAbility()`. Also removed the trailing `return false` dead path in `tryAbility()` and simplified the ranged attack guard from `window.CombatSystem && player.classKey` to just `player.classKey`.

### Visual Feedback Wiring Sprint (Howard)

- **Problem:** `Renderer.triggerShake()` and `Renderer.spawnDamageNumber()` existed but were never called. Combat had zero visual feedback beyond the text log.
- **Fix — `postAttackMsg()` in combat.js:** Added damage number + screen shake calls after every attack message. Determines type automatically: `critical` for crits (gold), `player_damage` (red) when defender is player, `enemy_damage` (white) otherwise. Shake intensity scales with damage (`Math.min(dealt / 10, 5)`). This single hook covers melee, ranged, and most ability attacks since they all route through `postAttackMsg()`.
- **Fix — `aoeAttack()` in combat.js:** Added per-target damage numbers and player shake for AoE hits (Fireball). AoE doesn't use `postAttackMsg()` so needed its own hook.
- **Fix — `tickStatusEffects()` in combat.js:** Added damage numbers and shake for poison and bleed tick damage. Both DoT types now show floating numbers each turn.
- **Fix — `heal` ability in combat.js:** Added green heal damage number (`'heal'` type) when Cleric heals.
- **Fix — Trap damage in main.js `tryMove()`:** Added red damage number and screen shake when player triggers a trap.
- **Fix — Player death in main.js `handleDeath()`:** Added strong shake (intensity 8) on player death for dramatic effect.
- **Guard pattern:** All combat.js hooks use `window.Renderer &&` since combat.js loads before renderer.js. main.js hooks call Renderer directly since it's a hard dependency that's always loaded by that point.
