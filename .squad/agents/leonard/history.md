# Leonard — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Owner:** Nabeel
- **Stack:** JavaScript, HTML5 Canvas, browser-based
- **Description:** Procedural dungeon generation, permadeath, turn-based combat, fog of war, item identification system
- **My Role:** Combat + enemy AI developer. Turn-based combat engine, enemy behaviors, class abilities.

## Learnings

- **Combat file:** `src/systems/combat.js` → `window.CombatSystem`. Handles melee/ranged/AoE attacks, all 12 class abilities, status effects (stunned/slowed/poisoned/shielded/buffed/evading/divine_shield), XP/leveling, Bresenham LOS.
- **Monster file:** `src/entities/monsters.js` → `window.MonsterFactory`. 13 monster templates across 10 floors with stat scaling (1 + floor * 0.15). `spawnForFloor(floorIndex, rooms, rng)` is the main entry point.
- **AI file:** `src/systems/ai.js` → `window.AISystem`. A* pathfinding (8-directional, respects walkable tiles + entity collision). Five AI behaviors: aggressive, flanking, cautious, ranged, boss.
- **Load order:** combat.js → monsters.js → ai.js (ai depends on both CombatSystem and MonsterFactory).
- **Damage formula:** `max(1, atk - def/2 + rand(-2,2))`. Abilities multiply this base.
- **Status effects** are stored on `entity.statusEffects[]` as objects with `{ type, duration, ...params }`. Call `CombatSystem.processTurnStart(entity)` each turn to tick them.
- **Boss pattern:** Dragon Lord summons 2 dragon whelps at 50% HP (once). Uses war_cry buff, fireball at range, power_strike in melee.
- **Monster detection range:** 10 tiles (Chebyshev). Monsters outside this range idle.
- **XP scaling:** `template.xpValue * (1 + floor * 0.1)`. Level-up grants +8 HP, +4 mana, +4 stamina, +2 atk, +1 def, +1 spd.

### Balance Pass (2025-07-24)
- **Cleric Heal nerfed:** 20→30 mana cost, 40→25 HP heal. Was strongest sustain in game with no cooldown; now forces Clerics to manage mana and take more tactical risks. AI cautious behavior mana check updated to match.
- **Rogue Evade nerfed:** Duration 2→1 turns. Previously let Rogue ignore two attacks for 15 stamina — too much value. Now dodges only the next attack, requiring better timing.
- **Warrior War Cry buffed:** ATK bonus 5→7. Warriors take melee risk every turn; +5 wasn't enough to offset that compared to ranged classes. +7 makes War Cry worth the stamina.
- **New status effects:** BLEED (stacking DoT, 2 dmg/turn for 3 turns, triggered by crits — stacks add damage), VULNERABLE (target takes +25% damage for 3 turns).
- **Combat feedback:** All attack messages now show target HP% in brackets. Critical hits (>1.5x reference base damage) are flagged with "CRITICAL!" prefix and auto-apply bleed. Status effects warn at 1 turn remaining.
- **Boss mechanics:** Dragon Lord enrages at 25% HP (+2 speed, double attacks). Telegraphs heavy attacks ("draws a deep breath...") one turn before 3x melee or 2.5x AoE fire breath. Summons scale: 2 whelps at 50% HP, 3 more at 25% HP, hard cap of 4 active minions.

## Cross-Agent Updates (2026-02-25)

### Sheldon: XP Progression Curve Fix
- **XP_PER_LEVEL:** Multiplier 1.4→1.25 in constants.js (level 20: 29,881→3,469 XP)
- **Monster XP scaling:** Floor factor 0.1→0.3 in monsters.js (late-game monsters now reward 2-4x more XP)
- **Impact on Leonard:** Monster XP rewards now align with leveling curve; player can realistically progress to end-game on deeper floors

### Raj: Equipment Stat Application & Monster Loot
- **New ItemSystem API:** `applyEquipmentMods(entity, item)` and `removeEquipmentMods(entity, item)` are public functions
- **Loot drops:** `ItemSystem.dropLoot(monster, floorIndex)` drops 35% on normal monsters, 100% on bosses
- **Integration:** Leonard's combat `onKill` handler calls `ItemSystem.dropLoot(victim, victim.floor)` to drop loot after monster death

### Howard: Visual Effects & Game Loop
- **Screen shake:** `Renderer.triggerShake(intensity)` called after damage hits (intensity: 2/4/6)
- **Floating damage:** `Renderer.spawnDamageNumber(x, y, amount, type)` called after combat resolution (type: player_damage/enemy_damage/heal/critical)
- **Pulsing stairs:** STAIRS_DOWN/UP tiles pulse opacity 0.7→1.0 when visible in FOV
- **Game loop:** `Renderer.hasActiveAnimations()` enables continuous rendering during effects, dirty-flag mode when idle
- **Guards:** Combat system guards visual calls with `window.Renderer && Renderer.method()` for graceful degradation

### Amy: Comprehensive Tests
- **45+ new tests:** Combat abilities (all 12), status effect application/ticking, damage variance, boss behavior
- **Item tests:** Equipment stat application/removal, loot generation, monster drop rates (35%/100%), identification, inventory management
- **Save/load tests:** Full game state serialization, equipment persistence, inventory integrity, entity state preservation, permadeath behavior
- **Coverage:** Edge cases (empty inventory, no drops, invalid equipment), state transitions (alive→dead→restart), RNG determinism, multi-floor scaling
- **Files:** test-combat.js, test-items.js, test-save.js; tests/index.html updated

## Cross-Agent Updates (2026-02-25)

### ItemSystem Integration (from Raj)
- **New:** `ItemSystem.tickBuffs(entity)` must be called once per turn for all entities (player + monsters)
- **Effect:** Buff/debuff timers decrement, and effects reverse when expired
- **Timing:** Call after `CombatSystem.processTurnStart()` in the turn-processing flow
- **API:** `entity._buffs[]` array is managed by ItemSystem; don't modify directly
- **Combat interactions:** Certain items (e.g., Flamebrand) have `special === 'fire_dot'` for extra effects during combat
- **Stat mods:** Equipment applies/removes stat mods on equip/unequip via `_applyStatMods()` — preserve `entity._buffs[]` array across these operations

### Rendering Integration (from Howard)
- **Module order:** combat.js loads BEFORE monsters.js and ai.js — Howard ensures this in index.html
- **Game loop:** `AISystem.processAllMonsters()` called once per player turn from main.js game loop
- **Status effects display:** HUD renders entity status effects from `entity.statusEffects[]` (no action needed on Leonard's side)
- **Graceful degradation:** main.js guards `window.AISystem && AISystem.processAllMonsters()` — game runs without AI if script fails to load

### Help Screen Integration (from Howard, 2026-02-25)
- **Help overlay documents:** All 12 class abilities (power_strike, fireball, backstab, heal, etc.) with descriptions and resource costs
- **Help key:** Press `?` or `h` in-game to see full ability list and combat controls
- **No action needed:** Leonard's ability system is already complete; help screen displays existing data

### Class-Based Regeneration System (2026-02-25)
- **REGEN_RATES** added to `constants.js`: per-class HP/mana/stamina regen rates (Warrior 2/0/3, Mage 1/3/1, Rogue 1/0/3, Cleric 2/2/2)
- **`CombatSystem.regenerate(entity)`** added to `combat.js`: applies class-based regen, only during EXPLORING phase, capped at max values, logs only when something regenerated
- **Old flat regen removed** from `processTurnStart()` (was +2 stamina, +1 mana for all players regardless of class)
- **Hooked into main.js** `processPlayerAction()`: called after turn advance and FOV recompute, before combat phase check
- **Design rationale:** Warriors/Rogues get high stamina regen (ability-spam), Mages get high mana regen (spell-dependent), Clerics are balanced. No class gets more than 3 in any stat per turn to keep regen meaningful but not trivializing.
- **Help screen updated** in `hud.js` with new REGENERATION section showing per-class rates
- **README updated** with Resource Regeneration section in Game Systems
- **Tests updated** in `test-combat.js`: old flat regen test replaced with 4 new tests covering class-based regen, max cap, and combat phase skip

## Leslie's Game Audit (2026-02-26)

### Critical Issues Found in Combat System
1. **Double XP / Level-Up on Kill** — main.js:190-195 AND combat.js:289-296 both trigger on same kill; inconsistent stat gains
2. **ItemSystem.dropLoot() Never Called** — combat.js onKill() missing loot drop call; monsters never drop loot
3. **ItemSystem.tickBuffs() Never Called** — buffs/debuffs permanent; single Strength Potion grants infinite +5 attack
4. **Save/Load Loses Entity State** — statusEffects, tags, xpValue, _buffs, _enraged, _telegraphing, _summonedPhase fields lost on load; monsters give 0 XP, boss phases broken, Cleric Smite broken

### Serious Issues Found
- **Math.random() in combat (line 137)** breaks determinism — should use seeded RNG
- **Math.random() in AI** (lines 154/171/233/245/306/375) breaks determinism
- **Combat Phase Threshold Too Tight** — set to Chebyshev distance ≤ 2, but ranged enemies attack from 6+ tiles without COMBAT indicator appearing
- **Self-Targeting Abilities Blocked** — can't use Heal/War Cry/Evade/Divine Shield when no enemies visible; can't heal when safe
- **Fireball AoE Hits Friendlies** — combat.js aoeAttack hits all entities except attacker; will damage player's NPC allies and boss's own minions

### Integration Notes for Leonard
- Priority: (1) Fix double XP/level-up by removing award from main.js, (2) Wire ItemSystem.dropLoot() in onKill(), (3) Add ItemSystem.tickBuffs() call per turn, (4) Save/restore buff state
- Next: Replace Math.random() with seeded RNG where possible; expand combat phase threshold; add allegiance filtering for AoE

### Bug Fixes (2026-02-26)
- **Double XP fix (Bug #1):** Made `CombatSystem.onKill()` and `CombatSystem.checkLevelUp()` the canonical XP/level-up path. Both are now exported on `window.CombatSystem`. Howard removed the duplicate XP award and `checkLevelUp()` from `main.js`.
- **checkLevelUp stat gains updated:** Changed from +8 HP/+4 mana/+4 stamina/+2 atk/+1 def/+1 spd to +10 HP (partial heal)/+3 mana/+3 stamina/+1 atk/+1 def. Removed speed gain — speed should come from equipment, not levels.
- **dropLoot wired (Bug #4):** `onKill()` now calls `ItemSystem.dropLoot(victim, victim.floor)` with `window.ItemSystem &&` guard. `dropLoot` handles `addGroundItem()` and loot messages internally — no extra work needed in combat.js.
- **onKill exported:** Added `onKill` to `CombatSystem` public API so main.js can call it from the fallback path if needed.

### Leslie's Bug Fix Sprint (2026-02-26) — COMPLETE

- **Team:** Sheldon (Lead), Leonard (Combat), Howard (Rendering), Amy (Tester)
- **Scope:** All 6 critical bugs resolved
- **Bugs fixed:** Double XP (Leonard), createItem props (Sheldon), ItemSystem.init wiring (Howard), dropLoot wiring (Leonard), tickBuffs wiring (Howard), save/load state (Sheldon + Howard)
- **Test coverage:** 17 new regression tests (6 combat, 7 items, 7 save/load) — all passing
- **Decision docs:** All inbox files merged into decisions.md; orchestration logs created
