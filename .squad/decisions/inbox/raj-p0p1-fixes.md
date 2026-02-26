# Decision: ItemSystem P0/P1/P2 Bug Fixes

**Author:** Raj (Items + Loot)
**Date:** 2026-02-26
**Status:** Implemented
**Files Changed:** `src/items/items.js`, `README.md`

## Context

Leslie's game audit identified several critical and serious issues in the item system. Four were assigned for immediate fix.

## Decisions

### 1. Seeded RNG Storage (P0)

**Decision:** Store the RNG passed to `init(rng)` in a module-scoped `_rng` variable. All internal functions that need randomness use `_rng` instead of `Math.random()`.

**Rationale:** `Math.random()` breaks deterministic replay and seed-based reproducibility. The `init()` function already received the seeded RNG but never stored it. Two functions (`_aoeFireball`, `_scrollTeleport`) were using `Math.random()` directly.

**Fallback:** If `_rng` is null (init not called), creates a fallback RNG via `Utils.createRNG(Date.now())` to avoid crashes. This is a safety net, not intended behavior.

### 2. Inventory Cap — 20 Items (P1)

**Decision:** Hard cap of 20 items in any entity's inventory. Enforced in `pickupItem()`.

**Rationale:** Without a cap, players can hoard unlimited items, breaking game economy and making inventory UI unwieldy. 20 is generous enough for normal play but forces meaningful choices on deeper floors.

**Impact on other agents:**
- **Howard (UI):** `MAX_INVENTORY_SIZE` is exposed on `ItemSystem` API. Inventory overlay should show "X/20" count.
- **Leonard (Combat):** No impact — monster loot drops go to ground, not inventory.
- **Sheldon:** No impact.

### 3. Helmet/Boots/Amulet in TYPE_WEIGHTS (P1)

**Decision:** Added helmet (6%), boots (6%), amulet (6%) to `TYPE_WEIGHTS`. Rebalanced existing weights to keep total at 100. Added switch cases in `_generateSingleItem()`.

**Old weights:** weapon:25, armor:20, potion:25, scroll:15, ring:10, food:5
**New weights:** weapon:20, armor:16, helmet:6, boots:6, amulet:6, potion:22, scroll:12, ring:8, food:4

**Rationale:** Previously these 3 slot types could only appear via the 30% bonus roll in `generateLoot()`, making them extremely rare (~0.1 per floor). They already had full template arrays. The bonus roll is retained as extra insurance.

### 4. Scroll of Teleport Safety (P2)

**Decision:** Teleport now validates destination: walkable tile + no entity present. Up to 10 retry attempts. Falls back to current position with "The teleport fizzles." message.

**Rationale:** Previously could land player inside walls or on top of monsters, causing softlocks or undefined behavior. Uses `Constants.WALKABLE_TILES` set and `GameState.getEntityAt()` for validation.

## Cross-Agent Notes

- **Howard:** Should display "X/20" inventory count in the inventory overlay. Check `ItemSystem.MAX_INVENTORY_SIZE`.
- **Amy:** Existing item tests may need updates for the inventory cap check and new TYPE_WEIGHTS. New test cases recommended for: inventory full rejection, teleport fizzle fallback, helmet/boots/amulet drop rates.
