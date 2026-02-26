# Leslie — History

## Project Context

- **Project:** Browser-based roguelike dungeon crawler
- **Stack:** Vanilla JavaScript, HTML5 Canvas, no bundler — modules export via `window.X` globals
- **Owner:** Nabeel
- **Joined:** 2026-02-26

## Key Files

- `src/core/constants.js` — Tile types, classes (Warrior/Mage/Rogue/Cleric), item types, XP table, regen rates
- `src/core/utils.js` — Seeded PRNG, distance calcs, grid helpers
- `src/core/gameState.js` — State singleton, entity/item factories
- `src/dungeon/generator.js` — BSP dungeon generation, 50x50 grids
- `src/systems/combat.js` — Turn-based combat, 12 abilities, status effects, class-based regen
- `src/systems/ai.js` — A* pathfinding, 5 AI behaviors (aggressive, flanking, cautious, ranged, boss)
- `src/entities/monsters.js` — 13 monster types across 10 floors
- `src/items/items.js` — 50+ items, identification system, loot tables, equipment stat application
- `src/rendering/renderer.js` — Canvas tilemap, fog of war, screen shake, damage numbers
- `src/ui/hud.js` — HUD, minimap, title/death/victory/help/inventory screens
- `src/main.js` — Game loop, input handling, save/load, permadeath

## Learnings

- **Double XP / double level-up bug**: `main.js:tryMove()` awards XP via `player.xp += (target.level || 1) * 10` AND `CombatSystem.meleeAttack()` → `onKill()` awards XP via `victim.xpValue`. Both paths fire on kill = double XP. Additionally, `main.js:checkLevelUp()` and `combat.js:checkLevelUp()` have different stat formulas — both will run, causing double level-up with inconsistent stat gains.
- **Save/load loses all non-schema fields**: JSON round-trip drops `statusEffects`, `tags`, `xpValue`, `templateKey`, `_buffs`, `_defKey`, `_enraged`, `_telegraphing`, `_summonedPhase2/3`, identification state (`_idMap`, `_identifiedKeys`). Loaded games will have broken monsters, broken items, broken boss AI.
- **ItemSystem.init() never called**: `startNewGame()` in `main.js` never calls `ItemSystem.init(rng)`. The identification maps are never populated, so all potions/scrolls will have undefined appearance names. Decision doc explicitly says this must be called.
- **ItemSystem.dropLoot() never called**: `combat.js:onKill()` never calls `ItemSystem.dropLoot()`. Monsters never drop loot on death despite the system existing.
- **ItemSystem.tickBuffs() never called**: Neither `main.js` nor `ai.js` calls `ItemSystem.tickBuffs()` for any entity. Buff/debuff timers from potions, scrolls, and food never tick down — they last forever.
- **Math.random() used in deterministic systems**: `combat.js:calcBaseDamage()` and multiple AI behavior functions use `Math.random()` instead of seeded RNG. This breaks determinism and makes save/load replays inconsistent.
- **ai.js loads before monsters.js**: Script order in `index.html` has `ai.js` before `monsters.js`, but `ai.js:summonMinions()` calls `window.MonsterFactory.createMonster()`. Works because it's called at runtime not load-time, but fragile.
- **No inventory size limit**: Players can hoard unlimited items. No weight, no cap.
- **Combat phase threshold (distance ≤ 2) is too tight** for ranged enemies that can hit from 6+ tiles away — player gets attacked without the COMBAT indicator.
- **Helmet and amulet slots have no TYPE_WEIGHTS entry**: TYPE_WEIGHTS only includes weapon/armor/potion/scroll/ring/food. Helmets, boots, and amulets can only appear via the 30% bonus roll, making them extremely rare.
