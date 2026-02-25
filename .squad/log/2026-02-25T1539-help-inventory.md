# 2026-02-25T15:39 — Help Screen & Inventory UI

## What Happened
Howard added help overlay (?/h key), interactive inventory UI (i key), and title controls reference.

## Files Changed
- `src/ui/hud.js` — Help overlay, inventory UI with actions
- `src/main.js` — Input handling, title screen controls section

## Key APIs Integrated
- `ItemSystem.getDisplayName()` — Shows item name/appearance
- `ItemSystem.equipItem()`, `unequipItem()`, `useItem()`, `dropItem()` — Inventory actions

## Status
Complete. Help screen documents combat abilities and items for all team members.
