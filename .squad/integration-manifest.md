# Integration Wiring Manifest

**Purpose:** Document every required cross-module call in the dungeon-crawler codebase. This manifest is the #1 gate for declaring any work "done" — all cross-module integrations must be checked against it before closing issues.

**Last Updated:** 2026-02-27  
**Owner:** Sheldon (Lead Architect)

---

## Integration Matrix

| Caller Module | Caller Function | Callee Module | Callee Function | Lifecycle Phase | Purpose | Status | Notes |
|---------------|-----------------|---------------|-----------------|-----------------|---------|--------|-------|
| main.js | startNewGame() | DungeonGenerator | generate(floor, seed) | Game start | Generate floor 0 dungeons | ✅ Wired | Line 88 |
| main.js | startNewGame() | GameState | setFloorData(floor, data) | Game start | Store generated floor data | ✅ Wired | Line 89 |
| main.js | startNewGame() | GameState | createEntity(opts) | Game start | Create player entity | ✅ Wired | Line 96 |
| main.js | startNewGame() | GameState | addEntity(entity) | Game start | Add player to state | ✅ Wired | Line 104 |
| main.js | startNewGame() | GameState | setPlayer(entity) | Game start | Set active player reference | ✅ Wired | Line 105 |
| main.js | startNewGame() | ItemSystem | init(rng) | Game start | Initialize identification maps | ✅ Wired | Line 110 |
| main.js | startNewGame() | MonsterFactory | spawnForFloor(floor, rooms, rng) | Game start | Spawn monsters on floor 0 | ✅ Wired | Line 116 |
| main.js | startNewGame() | ItemSystem | placeItemsOnFloor(floor, rooms, rng) | Game start | Generate and place loot on floor 0 | ✅ Wired | Line 122 |
| main.js | startNewGame() | FOVSystem | (via recomputeFOV) | Game start | Compute initial field of view | ✅ Wired | Line 125 |
| main.js | changeFloor() | DungeonGenerator | generate(floor, seed) | Floor transition | Generate next floor if not cached | ✅ Wired | Line 310 |
| main.js | changeFloor() | GameState | setFloorData(floor, data) | Floor transition | Store generated floor data | ✅ Wired | Line 311 |
| main.js | changeFloor() | MonsterFactory | spawnForFloor(floor, rooms, rng) | Floor transition | Spawn monsters on new floor | ✅ Wired | Line 316 |
| main.js | changeFloor() | ItemSystem | placeItemsOnFloor(floor, rooms, rng) | Floor transition | Generate and place loot on new floor | ✅ Wired | Line 320 |
| main.js | processPlayerAction() | CombatSystem | processTurnStart(player) | Per turn | Tick status effects & check stun | ✅ Wired | Line 139 |
| main.js | processPlayerAction() | AISystem | processAllMonsters() | Per turn | Execute all monster turns | ✅ Wired | Line 143, 187 |
| main.js | processPlayerAction() | ItemSystem | tickBuffs(entity) | Per turn | Tick buff/debuff timers for all entities | ✅ Wired | Lines 149, 199 |
| main.js | processPlayerAction() | CombatSystem | regenerate(player) | Per turn | Restore health/mana/stamina in exploring phase | ✅ Wired | Lines 158, 209 |
| main.js | processPlayerAction() | CombatSystem | meleeAttack(player, target) | Player move action | Execute melee attack on adjacent monster | ✅ Wired | Line 240 |
| main.js | tryAbility() | CombatSystem | useAbility(abilityKey, user, target) | Ability use | Execute ability with target | ✅ Wired | Line 376, 393 |
| main.js | tryPickup() | ItemSystem | pickupItem(entity, item) | Pickup action | Pick up ground item into inventory | ✅ Wired | Line 355 |
| main.js | handleInventoryInput() | ItemSystem | equipItem(entity, item) | Equip action | Equip item from inventory | ✅ Wired | Line 744 |
| main.js | handleInventoryInput() | ItemSystem | unequipItem(entity, slot) | Unequip action | Remove equipped item back to inventory | ✅ Wired | Line 738 |
| main.js | handleInventoryInput() | ItemSystem | useItem(entity, item) | Use action | Activate consumable (potion/scroll/food) | ✅ Wired | Line 757 |
| main.js | handleInventoryInput() | ItemSystem | dropItem(entity, item) | Drop action | Drop item from inventory to ground | ✅ Wired | Line 772 |
| main.js | saveGame() | ItemSystem | getIdentificationState() | Save | Serialize identification state | ✅ Wired | Line 464 |
| main.js | loadGame() | ItemSystem | restoreIdentificationState(state) | Load | Restore identification state from save | ✅ Wired | Line 530 |
| main.js | recomputeFOV() | FOVSystem | compute(x, y, radius, tiles) | FOV update | Compute visible tiles from player position | ✅ Wired | Line 75 |
| main.js | recomputeFOV() | FOVSystem | updateExplored(explored, visible) | FOV update | Mark newly explored tiles | ✅ Wired | Line 76 |
| CombatSystem | meleeAttack() | ItemSystem | dropLoot(victim, floor) | On kill | Generate loot drop from dead monster | ✅ Wired | Line 299 |
| CombatSystem | onKill() | ItemSystem | dropLoot(victim, floor) | On kill | Generate loot drop from dead monster | ✅ Wired | Line 299 |
| CombatSystem | aoeAttack() | ItemSystem | (none, damage only) | AoE damage | Apply damage to entities in radius | ✅ Wired | Line 272-273 (calls onKill) |
| CombatSystem | processTurnStart() | CombatSystem | tickStatusEffects(entity) | Status tick | Tick status effects at turn start | ✅ Wired | Line 574, 579 |
| CombatSystem | tickStatusEffects() | GameState | addMessage(text, type) | Status tick | Log status effect damage/expiry | ✅ Wired | Lines 96, 106, 121, 130 |
| AISystem | behaviorAggressive() | CombatSystem | useAbility(abilityKey, entity, player) | AI turn | Use ability if available | ✅ Wired | Line 156 |
| AISystem | behaviorAggressive() | CombatSystem | meleeAttack(entity, player) | AI turn | Execute melee attack on player | ✅ Wired | Line 158 |
| AISystem | behaviorFlanking() | CombatSystem | useAbility(abilityKey, entity, player) | AI turn | Use ability if available | ✅ Wired | Line 173 |
| AISystem | behaviorFlanking() | CombatSystem | meleeAttack(entity, player) | AI turn | Execute melee attack on player | ✅ Wired | Line 175 |
| AISystem | behaviorCautious() | CombatSystem | useAbility(abilityKey, entity, player) | AI turn | Use heal or combat ability | ✅ Wired | Line 196, 212 |
| AISystem | behaviorCautious() | CombatSystem | meleeAttack(entity, player) | AI turn | Execute melee attack on player | ✅ Wired | Line 214 |
| AISystem | behaviorRanged() | CombatSystem | hasLineOfSight(x1, y1, x2, y2, tiles) | AI turn | Check LOS for ranged attacks | ✅ Wired | Line 223 |
| AISystem | behaviorRanged() | CombatSystem | useAbility(abilityKey, entity, player) | AI turn | Use ranged ability | ✅ Wired | Lines 234, 247 |
| AISystem | behaviorRanged() | CombatSystem | meleeAttack(entity, player) | AI turn | Fallback melee if in range | ✅ Wired | Line 252 |
| AISystem | behaviorBoss() | CombatSystem | hasStatus(entity, type) | AI turn | Check for buff status | ✅ Wired | Line 290 |
| AISystem | behaviorBoss() | CombatSystem | useAbility(abilityKey, entity, entity) | AI turn | Use War Cry self-buff | ✅ Wired | Line 291 |
| AISystem | behaviorBoss() | CombatSystem | useAbility(abilityKey, entity, player) | AI turn | Use Fireball or Power Strike | ✅ Wired | Lines 299, 307 |
| AISystem | behaviorBoss() | CombatSystem | meleeAttack(entity, player) | AI turn | Execute melee attack on player | ✅ Wired | Line 310 |
| AISystem | summonMinions() | MonsterFactory | createMonster(templateKey, floor, x, y) | Summon | Create dragon whelp minion | ✅ Wired | Line 271 |
| AISystem | summonMinions() | GameState | addEntity(minion) | Summon | Add summoned minion to entities | ✅ Wired | Line 273 |
| AISystem | processAllMonsters() | AISystem | (various behaviors) | AI cycle | Execute AI for each monster on floor | ✅ Wired | Line 394+ |
| ItemSystem | equipItem() | ItemSystem | applyEquipmentMods(entity, item) | Equip | Apply stat modifiers from equipment | ✅ Wired | Line 581 |
| ItemSystem | equipItem() | ItemSystem | unequipItem(entity, slot) | Equip | Unequip current item in slot | ✅ Wired | Line 576 |
| ItemSystem | unequipItem() | ItemSystem | removeEquipmentMods(entity, item) | Unequip | Remove stat modifiers from item | ✅ Wired | Line 597 |
| ItemSystem | dropLoot() | ItemSystem | _generateSingleItem(floor, rng) | Loot gen | Generate individual item | ✅ Wired | Line 707 |
| ItemSystem | dropLoot() | GameState | addGroundItem(item) | Loot gen | Place generated item on ground | ✅ Wired | Line 712 |
| ItemSystem | placeItemsOnFloor() | ItemSystem | generateLoot(floor, rng) | Loot gen | Generate items for floor | ✅ Wired | Line 494 |
| ItemSystem | placeItemsOnFloor() | GameState | addGroundItem(item) | Loot gen | Place items on ground | ✅ Wired | Line 501 |
| ItemSystem | useItem() | ItemSystem | identifyItem(item) | Consume | Identify potion/scroll on use | ✅ Wired | Line 664 |
| HUD | render() | ItemSystem | getDisplayName(item) | UI render | Get display name for unidentified items | ✅ Wired | Lines 251-252 (in inventory display) |
| MonsterFactory | spawnForFloor() | GameState | createEntity(opts) | Spawn | Create monster entity | ✅ Wired | Line 128 |
| MonsterFactory | spawnForFloor() | GameState | addEntity(monster) | Spawn | Add monster to state | ✅ Wired | Lines 172, 197 |

---

## Critical Cross-Module Dependencies

### Game Initialization Flow
1. `main.startNewGame()` → `DungeonGenerator.generate()` → store via `GameState.setFloorData()`
2. `main.startNewGame()` → `ItemSystem.init()` (REQUIRED: must happen before any items generated)
3. `main.startNewGame()` → `MonsterFactory.spawnForFloor()` → monsters added to `GameState.entities`
4. `main.startNewGame()` → `ItemSystem.placeItemsOnFloor()` → items added to `GameState.groundItems`

### Turn Processing Flow
1. `main.processPlayerAction()` → `CombatSystem.processTurnStart()` (check stun, tick effects)
2. `main.processPlayerAction()` → `AISystem.processAllMonsters()` (all enemy turns)
3. `main.processPlayerAction()` → `ItemSystem.tickBuffs()` (tick timers for all entities)
4. `main.processPlayerAction()` → `CombatSystem.regenerate()` (restore resources)

### Combat Flow
1. `main.tryMove()` or ability → `CombatSystem.meleeAttack()` or `CombatSystem.useAbility()`
2. `CombatSystem.onKill()` → `ItemSystem.dropLoot()` (REQUIRED: must check for window.ItemSystem)
3. `CombatSystem.tickStatusEffects()` → updates entity HP, kills if necessary
4. `AISystem.behaviorBoss()` → `AISystem.summonMinions()` → `MonsterFactory.createMonster()` → `GameState.addEntity()`

### Inventory/Equipment Flow
1. `main.handleInventoryInput()` → `ItemSystem.equipItem()` → `ItemSystem.applyEquipmentMods()`
2. `main.handleInventoryInput()` → `ItemSystem.unequipItem()` → `ItemSystem.removeEquipmentMods()`
3. `main.handleInventoryInput()` → `ItemSystem.useItem()` → item effect → `ItemSystem.identifyItem()`

### Save/Load Flow
1. `main.saveGame()` → `ItemSystem.getIdentificationState()` (serialize ID maps)
2. `main.loadGame()` → `ItemSystem.restoreIdentificationState()` (restore ID maps)

---

## Missing/Broken Integrations (NONE CURRENTLY)

All critical integrations are now wired. The following defensive checks exist to handle optional modules gracefully:

- `main.js` uses `window.ItemSystem && ItemSystem.method` guards on lines 108, 114, 120, 138, 148, 157, 198, 209, 239, 354, 367, 464, 529, 737, 743, 756, 771
- `combat.js` uses `window.ItemSystem && ItemSystem.dropLoot` guard on line 298
- `ai.js` uses `window.MonsterFactory.createMonster` directly (no guard needed; required module)
- `hud.js` uses `window.ItemSystem && ItemSystem.getDisplayName` guards for optional integration

---

## Integration Checklist for New Features

Before declaring any work "done," verify:

- [ ] All cross-module function calls are in the above table
- [ ] New calls appear in the appropriate lifecycle phase
- [ ] Required calls (no defensive guards) are properly wired
- [ ] Optional calls use `window.Module && Module.method` guards
- [ ] Save/load state includes custom entity fields (statusEffects, tags, xpValue, _buffs, _enraged, etc.)
- [ ] ItemSystem identification state saved/restored if using potions/scrolls
- [ ] Tests pass: `npm run test`
- [ ] Code review: Lead (Sheldon) checks main.js changes

---

## Defensive Coding Policy

**Rule:** Do NOT silently fail on required integrations.

- ❌ BAD: `if (window.ItemSystem) ItemSystem.dropLoot()` when dropLoot is REQUIRED
- ✅ GOOD: `if (window.ItemSystem) ItemSystem.dropLoot()` when dropLoot is OPTIONAL (graceful degradation)
- ✅ GOOD: Direct call `ItemSystem.tickBuffs()` when required, load-order guarantees it exists

Current code is in good shape: defensive guards are used only for truly optional integrations (ItemSystem itself is optional at load time).

---

## Decision: Integration Manifest as a Merge Gate

**Status:** ACTIVE  
**Decision Date:** 2026-02-27

Integration wiring failures were the #1 root cause of critical bugs (4 of 9). This manifest serves as the definitive checklist for all cross-module calls. 

**Process:**
1. Any PR that adds or changes cross-module calls MUST update this manifest
2. Lead reviewer (Sheldon) MUST verify the manifest before approving main.js changes
3. If manifest is not updated, PR is auto-rejected (no exceptions)
4. This is part of the standard code review gate (along with tests and style)

**Why this works:**
- Prevents "never wired" bugs (functions that exist but aren't called)
- Makes wiring intent explicit (visible in one place)
- Catches missing defensive guards
- Forces discussion of required vs optional integrations
- Takes 2 minutes to check, saves days of debugging
