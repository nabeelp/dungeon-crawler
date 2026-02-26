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

## P0/P1 Fixes (2026-02-27)

### 1. Seeded RNG (P0)
- **combat.js:** Added `let _rng = null`, `init(rng)` function, and `rng()` fallback helper. Replaced `Math.random()` in `calcBaseDamage()` with `rng()`. Exported `init` on `CombatSystem`.
- **ai.js:** Same pattern — `_rng`, `init(rng)`, `rng()` helper. Replaced all 10 `Math.random()` calls across `behaviorAggressive`, `behaviorFlanking`, `behaviorCautious`, `behaviorRanged`, `bossRegularAction`, and `behaviorBoss`.
- **main.js:** Wired `CombatSystem.init(seed+777)` and `AISystem.init(seed+888)` in both `startNewGame()` and `loadGame()`.
- **Pattern:** Follows ItemSystem.init(rng) pattern from Raj. Seed offsets 777/888 avoid collision with existing streams (999, 500, base).

### 2. AoE kills call onKill (P0)
- **Already fixed.** Verified `aoeAttack()` already calls `onKill(attacker, ent)` after setting `ent.alive = false`. This was fixed in the previous bug sprint.

### 3. DOT kills call onKill (P2)
- **combat.js:** Added `onKill(effect.source || null, entity)` after poison and bleed kill entities in `tickStatusEffects()`.
- Added `entity.alive` guards to both DOT blocks to prevent double-damage/double-kill when entity has both poison and bleed.
- Added `source` field to DOT status effects: `poison_blade` sets `source: user`, `postAttackMsg` crit bleed sets `source: attacker`.
- Guarded `onKill()` for null killer (`if (killer && killer.type === 'player')`) so DOT kills without a tracked source still drop loot/announce death but don't crash on XP award.

### 4. Regen Cooldown (P1)
- **combat.js `regenerate()`:** Added `regenCooldown` field. Initialized to 5 on first call (`=== undefined` check). Decremented each EXPLORING turn. Regen blocked when `<= 0`.
- **main.js `checkCombatPhase()`:** Detects COMBAT→EXPLORING transition and resets `player.regenCooldown = 5`. Gives 5 turns of post-combat recovery.
- **Design:** Players start with 5 regen turns (handles game start). Each combat exit resets the window. Prevents infinite wait-to-heal exploit identified by Leslie.

### 5. Mage Arcane Bolt (P1)
- **constants.js:** Added `rangedAttack: { range: 4, damageMultiplier: 0.5 }` to MAGE class definition.
- **combat.js `meleeAttack()`:** Added ranged attack path before the "too far" fail. Checks `attacker.classKey`, looks up `Constants.CLASSES`, verifies `dist <= range` and LOS. Applies 50% base damage. Calls `onKill` on kill.
- **main.js `tryMove()`:** After player moves to empty tile, scans movement direction for enemies at range 2–4. If found, calls `CombatSystem.meleeAttack()` which routes to the ranged path.
- **README.md:** Documented Arcane Bolt as passive under Mage class. Added regen cooldown note under Resource Regeneration.

## Review Fixes (2026-02-27)

### 1. effect.source → effect.sourceId (Serialization Fix)
- **Problem:** Status effects stored full entity object references in `effect.source`, bloating JSON saves and risking circular references.
- **combat.js `postAttackMsg()`:** Changed crit bleed from `source: attacker` → `sourceId: attacker.id`.
- **combat.js `poison_blade`:** Changed from `source: user` → `sourceId: user.id`.
- **combat.js `tickStatusEffects()`:** DOT kill paths now look up killer via `GameState.state.entities.find(e => e.id === effect.sourceId)` instead of reading `effect.source` directly.
- **Impact:** Status effects now serialize cleanly — only a numeric ID is stored, not the full entity tree.

### 2. Boss Telegraph Kills Now Call onKill
- **Problem:** Dragon Lord's telegraphed melee attack (3x damage) used `CombatSystem.applyDamage()` directly, which sets `alive = false` but doesn't call `onKill()`. Kills skipped XP, loot, and death announcements.
- **ai.js `behaviorBoss`:** Replaced the inline `GameState.addMessage` death message with `window.CombatSystem && CombatSystem.onKill && CombatSystem.onKill(entity, player)`, routing through the canonical kill handler.
- **Note:** The AoE fire breath path already routed through `CombatSystem.aoeAttack()` which calls `onKill` internally — no change needed there.

## Mana Recovery Analysis & Proposal (2026-02-27)

### Problem Statement
Nabeel identified that the 5-turn regen cooldown creates a mana deficit for the Mage class. Post-combat regen window only recovers 5 × 3 = 15 mana per encounter, but Mage maxMana is 120. If the Mage spends mana in combat, it can never fully recover between fights. But removing the cooldown entirely re-introduces the "wait-to-win" exploit Leslie flagged as the #1 fun-killer.

### Current Implementation Analysis

**Regen Cooldown Mechanics (combat.js:620-653, main.js:436-438):**
- `regenCooldown` initialized to 5 on first use (or on COMBAT→EXPLORING transition)
- Each EXPLORING turn: decrement cooldown, apply regen if cooldown > 0
- Regen stops completely once cooldown hits 0
- All resources (HP, mana, stamina) share the same 5-turn window

**Mage Stats (constants.js:106-118):**
- HP: 60, maxHP: 60
- Mana: 120, maxMana: 120
- Stamina: 60, maxStamina: 60
- Attack: 6, Defense: 4 (lowest in game — glass cannon)

**Mage Regen Rates (constants.js:148):**
- HP: 1/turn, Mana: 3/turn, Stamina: 1/turn

**Mage Ability Costs:**
- Fireball: 30 mana (AoE, 2x damage)
- Ice Shard: 15 mana (ranged, slow)
- Arcane Shield: 25 mana (absorb 30 damage)

### Math: Mana Economy Per Fight

**Mana Recovery Per Encounter:**
- 5 turns × 3 mana/turn = **15 mana recovered** per encounter

**Mana Spent Per Fight (typical):**
- Conservative fight: 1 Ice Shard (15) = 15 mana → Break even
- Moderate fight: 1 Fireball (30) = 30 mana → Net loss of 15
- Hard fight: 1 Fireball + 1 Ice Shard (45) = 45 mana → Net loss of 30
- Defensive fight: 1 Arcane Shield + 1 Ice Shard (40) = 40 mana → Net loss of 25

**Fights Until Empty (starting from 120 mana):**
- Conservative (1 Ice Shard): 120 / 15 net = never empties (break-even)
- Moderate (1 Fireball): 120 / 15 net loss = **8 fights** to empty
- Hard (Fireball + Ice Shard): 120 / 30 net loss = **4 fights** to empty
- Multi-spell hard: (2 Fireballs = 60 cost, 45 net loss) = **~3 fights** to empty

**Turns to Full Recovery (if unlimited):**
- Empty to full: 120 / 3 = **40 turns** of walking
- But capped at 5 turns, so max recovery = 15 mana = **12.5% of pool**

### Comparison: Other Class Resource Economies

**Warrior (Stamina 100, regen 3/turn, 5 turns = 15 stamina):**
- Power Strike: 20 stamina, Shield Bash: 15, War Cry: 25
- Moderate fight (1 Power Strike): 20 cost, 15 recovery = 5 net loss
- Fights to empty: 100 / 5 = **20 fights** — Warriors effectively never run out
- Also: Warriors rely on free melee attacks primarily, abilities are supplemental

**Rogue (Stamina 120, regen 3/turn, 5 turns = 15 stamina):**
- Backstab: 20, Evade: 15, Poison Blade: 25
- Moderate fight (1 Backstab): 20 cost, 15 recovery = 5 net loss
- Fights to empty: 120 / 5 = **24 fights** — Rogues never run out either
- Also: Rogues have strong melee (12 atk, crits), abilities are bonuses

**Cleric (Mana 80, regen 2/turn, 5 turns = 10 mana):**
- Heal: 30, Smite: 15, Divine Shield: 30
- Moderate fight (1 Heal): 30 cost, 10 recovery = 20 net loss
- Fights to empty: 80 / 20 = **4 fights** with healing every fight
- BUT: Cleric also has 90 HP, 10 defense — less reliant on spells to survive

**The Imbalance:**
- Warrior/Rogue: Abilities are supplemental to strong free melee. 20+ fights before resource issues.
- Cleric: Also drains fast, but has defensive stats (90 HP, 10 def) to fall back on.
- Mage: Abilities ARE the class identity. 3-8 fights to empty. Has worst melee (6 atk, 4 def, 60 HP). When mana is gone, Mage is the weakest class in the game by far — even with Arcane Bolt (50% of an already bad base damage).

### Option Analysis

**Option A: Two-Tier Regen** — Full rate (3/turn) for 5 turns, then slow rate (1/turn) indefinitely. HP/stamina still cut off at 5 turns.
- ✅ Simple to implement (add an else-branch in `regenerate()`)
- ✅ Mana eventually recovers fully (120 turns walking = full from empty)
- ⚠️ Partial wait-to-win concern: 1 mana/turn is slow enough that waiting 105 turns for the remaining 105 mana is tedious but possible
- ✅ Doesn't affect HP/stamina balance — only mana gets the slow tail
- ✅ Feels natural: "magical energy slowly seeps back"
- **Wait-to-win risk: LOW.** 1 mana/turn is so slow that waiting 105 turns is genuinely boring. Players CAN do it but won't WANT to. Compare: current HP regen at 1/turn for Mage is already deemed acceptable over 5 turns.

**Option B: Mana-Exempt Cooldown** — Mana always regenerates at full rate (3/turn), ignores cooldown. HP/stamina still respect cooldown.
- ✅ Simple to implement (skip cooldown check for mana)
- ❌ **Re-introduces wait-to-win for mana.** 120 / 3 = 40 turns = full mana every time. Player just waits 40 turns between every fight.
- ❌ Leslie explicitly flagged this exact pattern. She'll reject it.
- ✅ Feels class-distinctive
- **Wait-to-win risk: HIGH.** This is exactly the exploit Leslie identified, just for one resource.

**Option C: Meditation Mechanic** — Press M to skip turn, recover 5-8 mana.
- ✅ Player agency — active choice, not passive
- ⚠️ Still wait-to-win: Player just presses M 15-24 times between fights. Same problem with more keystrokes.
- ⚠️ More complex to implement: new input handler, new action type, HUD changes, help screen update
- ❌ Doesn't solve the core problem — it's just "wait but with extra steps"
- **Wait-to-win risk: HIGH.** Meditation IS waiting. The cost (skip turn) is irrelevant when exploring safely.

**Option D: Longer Cooldown for Mage** — 10 turns instead of 5. Same rate.
- ✅ Simple to implement (per-class cooldown value)
- ✅ Recovery doubles: 10 × 3 = 30 mana per encounter
- ⚠️ Still only 25% of pool. Moderate fights still drain faster than recovery.
- ⚠️ Means Mage also gets 10 turns of HP regen (10 HP) — unintended buff to survivability
- ⚠️ Would need per-class cooldown values in constants.js, complicating the system
- **Wait-to-win risk: NONE** (still hard-capped). But doesn't fully solve the problem.

### Recommendation: Option A (Two-Tier Regen) — MANA ONLY

**Implementation:**
In `CombatSystem.regenerate()`, after the cooldown expires (cooldown ≤ 0), add a mana-only slow regen path at 1 mana/turn. HP and stamina regen remain hard-capped at 5 turns. No changes to constants.js needed — the slow rate (1/turn) can be hardcoded or added as a `PASSIVE_MANA_REGEN` constant.

**Pseudocode change to `regenerate()` (combat.js:620-653):**
```js
function regenerate(entity) {
  if (!entity || !entity.alive) return;
  if (GameState.getPhase() !== PHASES.EXPLORING) return;

  if (entity.regenCooldown === undefined) entity.regenCooldown = 5;

  const rates = REGEN_RATES[entity.classKey];
  if (!rates) return;

  const parts = [];

  if (entity.regenCooldown > 0) {
    entity.regenCooldown--;
    // Full regen window: all resources at full rate
    if (rates.hp > 0 && entity.hp < entity.maxHp) {
      const gain = Math.min(rates.hp, entity.maxHp - entity.hp);
      entity.hp += gain;
      parts.push(gain + ' HP');
    }
    if (rates.mana > 0 && entity.mana < entity.maxMana) {
      const gain = Math.min(rates.mana, entity.maxMana - entity.mana);
      entity.mana += gain;
      parts.push(gain + ' mana');
    }
    if (rates.stamina > 0 && entity.stamina < entity.maxStamina) {
      const gain = Math.min(rates.stamina, entity.maxStamina - entity.stamina);
      entity.stamina += gain;
      parts.push(gain + ' stamina');
    }
  } else {
    // Passive mana-only regen (post-cooldown, slow rate)
    if (rates.mana > 0 && entity.mana < entity.maxMana) {
      const gain = Math.min(1, entity.maxMana - entity.mana);
      entity.mana += gain;
      parts.push(gain + ' mana');
    }
  }

  if (parts.length > 0) {
    GameState.addMessage('You regenerate ' + parts.join(', ') + '.', 'info');
  }
}
```

**Why Option A wins:**

1. **Wait-to-win risk is LOW.** At 1 mana/turn, recovering 105 mana takes 105 turns of walking through already-explored dungeon. That's ~2 minutes of pressing arrow keys. Players CAN do it, but the tedium is the cost. Compare: in classic roguelikes, resting to heal works similarly — it costs time/food. We don't have food, but we have boredom as a natural deterrent. Leslie's original concern was about 60-turn full recovery at rate 3 — that's fast enough to be exploitable. Rate 1 is 3x slower and only affects mana.

2. **Doesn't break other class balance.** Warrior/Rogue use stamina (no mana regen needed). Cleric gets slow mana regen too (at rate 1 instead of their normal 2) — fair, since Cleric has better stats to fall back on. The slow tail is a universal mana benefit, but it primarily helps the class that needs it most (Mage).

3. **Simple to implement.** One else-branch in `regenerate()`. No new input handlers, no new constants, no per-class cooldown logic. ~10 lines changed.

4. **Feels good as a player.** Mana slowly trickles back. You're not locked at 15 mana with a 120 mana pool and no way to recover. You still feel the pressure (it's slow), but you're not permanently crippled.

5. **Recoverable math:** After a hard fight (45 mana spent, 15 recovered in cooldown = 30 net loss), the Mage needs 30 turns of walking to recover via passive. That's roughly 1-2 rooms of exploration — it paces naturally with dungeon traversal.

### For Leslie's Review

Key concern: Does this re-introduce wait-to-win?
- At 1 mana/turn passive, full recovery from 0 takes 120 turns. That's tedious by design.
- HP and stamina are still hard-capped at 5 turns — you can't wait-to-heal.
- The only resource that slowly recovers is mana, and only at 1/3 the normal rate.
- If Leslie considers even 1/turn too exploitable, we could reduce to 1 mana every 2 turns (0.5/turn effective). But I believe 1/turn hits the sweet spot.

## Per-Class Regen Cooldowns — Option E (2026-02-27)

### Implementation
Leslie's proposal won: instead of a flat 5-turn cooldown for all classes, each class gets its own post-combat regen window. This gives mana-dependent classes (Mage, Cleric) more recovery time without changing regen rates or introducing new mechanics.

### Changes Made
- **constants.js:** Added `REGEN_COOLDOWN` frozen object: `{ WARRIOR: 5, MAGE: 8, ROGUE: 5, CLERIC: 7 }`. Exported on `window.Constants`.
- **combat.js:** `regenerate()` initial assignment changed from hardcoded `5` to `(REGEN_COOLDOWN && REGEN_COOLDOWN[entity.classKey]) || 5`. Falls back to 5 for unknown classes.
- **main.js:** `checkCombatPhase()` COMBAT→EXPLORING transition changed from `player.regenCooldown = 5` to `(Constants.REGEN_COOLDOWN && Constants.REGEN_COOLDOWN[player.classKey]) || 5`.
- **hud.js:** Help screen REGENERATION section updated with per-class cooldown line.
- **README.md:** Post-Combat Cooldown section updated with per-class table and rationale.

### Balance Impact
- **Warrior/Rogue (5 turns):** Unchanged — they rely on stamina which regens fast (3/turn, 15 total).
- **Cleric (7 turns):** Gets 14 mana recovery (7 × 2) per encounter vs old 10 (5 × 2). +40% mana recovery.
- **Mage (8 turns):** Gets 24 mana recovery (8 × 3) per encounter vs old 15 (5 × 3). +60% mana recovery. Still can't fully recover 120 mana pool, but significantly reduces the deficit.

### Pre-existing Issue Noted
The `regenCooldown` field is initialized to `0` in `createEntity()` (gameState.js:81), which means `regenerate()` skips the `=== undefined` branch and hits `<= 0` returning immediately. This affects new players who haven't exited combat yet. This is a pre-existing issue (Howard's save/load fix set default to 0), not introduced by this change.

## Sprint Fixes (2026-02-27)

### Fix 1: regenCooldown initialized to 0 (CRITICAL)
- **Problem:** `createEntity()` in gameState.js set `regenCooldown: 0`. Since `regenerate()` checks `if (regenCooldown <= 0) return`, new players got ZERO regen until their first combat ended and reset the cooldown.
- **Fix:** Changed `gameState.js:81` from `regenCooldown: opts.regenCooldown ?? 0` to `regenCooldown: opts.regenCooldown ?? (opts.classKey && Constants.REGEN_COOLDOWN && Constants.REGEN_COOLDOWN[opts.classKey]) || 5`. Now entities start with their per-class cooldown value (WARRIOR:5, MAGE:8, ROGUE:5, CLERIC:7), falling back to 5 for monsters/unknowns. Save/load still works because `opts.regenCooldown` is preserved via `??`.

### Fix 2: AoE hits friendlies (MAJOR)
- **Problem:** `aoeAttack()` in combat.js only filtered out `attacker.id`, meaning player fireballs hit allies and boss fireballs hit the boss's own whelps.
- **Fix:** Added faction check in `aoeAttack()` after the self-skip: `if ((attacker.type === 'player') === (ent.type === 'player')) continue;`. Player AoE now only hits monsters; monster AoE only hits the player. Uses `entity.type` field ('player'|'monster'|'npc') which is already set on all entities via `createEntity()`. No full faction system needed.
