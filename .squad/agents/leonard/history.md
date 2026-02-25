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
