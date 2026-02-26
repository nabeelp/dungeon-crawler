# Howard — P0/P1/P2 Fix Sprint

**Author:** Howard (Rendering + Fog of War)  
**Date:** 2026-02-26  
**Status:** Complete  

## Changes

### 1. Diagonal Movement (P1) — `src/main.js`

Added 8-way player movement to match monster movement:

- **Numpad keys** (via `e.code` to avoid conflict with ability hotkeys 1-9): Numpad 7/8/9/4/6/1/2/3 for all 8 directions. Numpad 5 = wait.
- **Vi-keys** (via `e.key`): Y = up-left, U = up-right, B = down-left, N = down-right.
- Existing WASD/Arrow movement unchanged.
- All movement goes through `tryMove()` — same walkable checks, bump-combat, trap triggers, ground item notifications.

**Key design decision:** Numpad keys are dispatched before the `moveMap`/ability check by using `e.code` (e.g. `'Numpad1'`) instead of `e.key` (which would be `'1'`, conflicting with ability slot 1). This keeps top-row 1-9 for abilities and numpad 1-9 for movement.

### 2. Distance Function Mismatch (P0) — `src/main.js`

`tryAbility()` was using `Utils.manhattanDist` to find nearest enemy, while `checkCombatPhase()` and AI use `Utils.chebyshevDist`. Changed to `chebyshevDist`.

**Impact:** Manhattan distance overcounts diagonal distance (2 diagonal tiles = manhattan 4 vs chebyshev 2). This caused abilities to sometimes target wrong enemies or fail to find valid targets that were within FOV range.

### 3. Score Formula (P2) — `src/ui/hud.js`

Old formula: `floor*100 + level*50 + xp + turns` (turns as positive term = slow play rewarded).

New formula: `max(0, floor*100 + level*50 + xp - floor(turns/10))`. Turn penalty is gentle (1 point per 10 turns) but directionally correct.

### 4. Documentation Updates

- **README.md:** Controls table split Move into cardinal/diagonal rows.
- **hud.js help screen:** Added diagonal movement line.
- **hud.js title screen:** Updated controls quick-reference.

## Files Changed

- `src/main.js` — diagonal input handling, distance function fix
- `src/ui/hud.js` — score formula, help screen, title screen controls
- `README.md` — controls table
- `.squad/agents/howard/history.md` — session log
