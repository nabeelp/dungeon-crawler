# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Dungeon generation, BSP, cellular automata, floors, rooms, corridors | Sheldon | Procedural gen algorithms, floor layouts, difficulty scaling |
| Architecture, data model, scope decisions, code review | Sheldon | Tile format, entity model, system interfaces, trade-offs |
| Combat system, turn-based mechanics, enemy AI, pathfinding | Leonard | Attack types, damage calc, flanking AI, retreat behavior |
| HTML5 Canvas rendering, tilemap, viewport, fog of war, raycasting | Howard | Canvas drawing, tile rendering, visibility, camera, UI |
| Items, weapons, armor, potions, scrolls, loot tables, identification | Raj | Item generation, loot drops, unidentified items, inventory |
| Testing, quality, edge cases, integration verification | Amy | Unit tests, gameplay tests, balance testing, regression |
| Critical review, design critique, assumption challenging, code review | Leslie | Feature evaluation, architecture critique, balance analysis, edge case identification |
| Session logging | Scribe | Automatic — never needs routing |

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for simple questions.
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn Amy to write test cases from requirements simultaneously.
