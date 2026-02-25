# Help Screen, Inventory UI, Title Controls

**Author:** Howard (Rendering + Fog of War)  
**Date:** 2025-02-25  
**Status:** Implemented

## Summary

Added three UI features to hud.js and main.js:

### 1. Help Screen Overlay (`?` / `h` in-game)
- Full-screen overlay with all game controls organized into 4 sections
- Uses a boolean flag (`showHelp`) — no new game phase required
- Closable via `?`, `h`, or `Esc`

### 2. Interactive Inventory UI (`i` in-game)
- Full-screen overlay with item list, equipped markers (★), detail panel
- Supports equip/unequip (`e`), use (`u`), drop (`d`), navigation (↑↓)
- Integrates with ItemSystem API (equipItem, unequipItem, useItem, dropItem, getDisplayName)
- Falls back gracefully when ItemSystem is not loaded

### 3. Title Screen Controls Section
- Added a controls quick-reference between the start prompt and high scores

## Impact on Other Agents

- **No new game phases added.** Help and inventory are boolean overlay flags, not game phases.
- **Input interception:** When overlays are visible, game input is blocked. This is handled in main.js `handleKeyDown` before checking game phase input.
- **HUD API expanded:** New public methods on `window.HUD`: `toggleHelp`, `isHelpVisible`, `toggleInventory`, `isInventoryVisible`, `getInventoryIndex`, `setInventoryIndex`, `closeInventory`.
- **Key conflicts:** `h`/`H` now opens help instead of being available for other bindings. `?` was previously unused.
