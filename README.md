# Dungeon Crawler

A roguelike dungeon crawler built with vanilla JavaScript and HTML5 Canvas. No dependencies, no build step—just open `index.html` in your browser and descend into darkness.

![Screenshot](screenshot.png)

## Features

- **Procedural Generation** — 10 floors of randomized dungeons with Binary Space Partitioning (BSP)
- **Turn-Based Combat** — Strategic, tactical fights with classes and abilities
- **4 Unique Classes** — Warrior, Mage, Rogue, and Cleric with distinct playstyles
- **Fog of War** — Dynamic vision system; unseen areas remain dark
- **Item System** — Equipment, potions, scrolls, and unidentified mysteries
- **Permadeath** — When you die, it's permanent. High scores are saved to remember your attempts
- **Save System** — Auto-save on browser close; resume your progress anytime
- **Real-Time Feedback** — Screen shake, floating damage numbers, and status effect tracking
- **Scalable Difficulty** — Enemies grow stronger each floor; find better gear to survive

## How to Play

**No installation required.** Simply open `index.html` in a modern web browser.

```bash
# Or run a local server (optional)
python -m http.server 8000
# Then navigate to http://localhost:8000
```

## Controls

| Action | Keys |
|--------|------|
| **Move** | Arrow Keys or WASD |
| **Attack** | Walk into enemies (melee auto-attack) |
| **Descend Stairs** | `>` or `.` (while standing on gold stairs) |
| **Ascend Stairs** | `<` or `,` (while standing on silver stairs) |
| **Pick Up Items** | `G` |
| **Wait / Skip Turn** | Spacebar or `5` |
| **Cast Ability** | `1` – `3` (auto-targets nearest visible enemy) |
| **Open Inventory** | `I` |
| **Inventory Navigation** | Arrow Keys (↑ ↓) |
| **Equip / Unequip** | `E` (in inventory) |
| **Use Item** | `U` (in inventory) |
| **Drop Item** | `D` (in inventory) |
| **Close Inventory** | Escape or `I` |
| **Help / Controls** | `?` or `H` |

## Classes

### Warrior
A sturdy fighter with high HP and strong melee attacks.
- **Power Strike** — Double damage melee attack (costs stamina)
- **Shield Bash** — Attack + stun enemy (costs stamina)
- **War Cry** — Boost attack for 3 turns (costs stamina)

### Mage
A glass cannon with devastating spells but fragile body.
- **Fireball** — Area-of-effect damage to nearby enemies (costs mana)
- **Ice Shard** — Ranged attack that slows target (costs mana)
- **Arcane Shield** — Absorb 30 damage for duration (costs mana)

### Rogue
Fast and deadly; relies on crits and evasion.
- **Backstab** — High damage when attacking from behind (costs stamina)
- **Evade** — Dodge the next attack (costs stamina)
- **Poison Blade** — Melee attack with poison damage over time (costs stamina)

### Cleric
Healer and buffer; survives through sustain and support.
- **Heal** — Restore 25 HP (costs mana)
- **Smite** — Melee attack, 2x damage vs undead (costs mana)
- **Divine Shield** — Reduce party damage by 50% for 2 turns (costs mana)

## Game Systems

### Resource Regeneration
Each class passively regenerates HP, mana, and stamina at different rates per turn while exploring (not during combat):

| Class | HP/turn | Mana/turn | Stamina/turn |
|-------|---------|-----------|--------------|
| Warrior | 2 | 0 | 3 |
| Mage | 1 | 3 | 1 |
| Rogue | 1 | 0 | 3 |
| Cleric | 2 | 2 | 2 |

Regeneration never exceeds maximum values. A log message appears when resources are restored.

### Combat
Turn-based system with action resolution:
- **Melee Attacks** — Walk into an enemy to deal base damage (attacker stats - half defender defense)
- **Abilities** — Each class has 3 unique abilities with mana/stamina costs
- **Status Effects** — Poison, bleed, slow, stun, shield, buff, vulnerable, and more
- **Critical Hits** — Bonus damage that applies bleed; triggers when damage > 1.5× base

### Items & Identification
- Pick up weapons, armor, potions, scrolls, rings, and food
- Items can be **identified** or **unidentified** (use an unidentified item to learn what it is)
- Equip items to boost stats; unequip to swap gear
- **Risk/Reward** — Unidentified items may be beneficial or cursed

### Fog of War
- Only see enemies and tiles within an 8-tile radius (Field of View)
- Explored areas remain visible with a darkened overlay when out of sight
- Walls and closed doors block line of sight
- Enables tactical positioning and exploration

### Save System
- **Automatic Save** — Game state is saved to browser localStorage when you close the page
- **Resume** — Reopen the page to continue from where you left off
- **Permadeath** — When you die, your save is deleted (but your score is recorded)
- **High Scores** — Top 10 high scores are tracked across all playthroughs

## Running Tests

Tests are located in the `tests/` directory. Open them in your browser:

```
tests/index.html
```

Tests are written as .html files you can run directly in the browser. No test framework installation needed.

## Tech Stack

- **Language** — Vanilla JavaScript (ES6+)
- **Rendering** — HTML5 Canvas 2D
- **Storage** — Browser localStorage
- **Dependencies** — None
- **Build Step** — None

The entire codebase is structured as independent modules loaded in sequence. Each module (Constants, Utils, GameState, DungeonGenerator, etc.) is self-contained and exposes a single frozen object to the global namespace.

## File Structure

```
dungeon-crawler/
├── index.html              # Entry point
├── README.md               # This file
├── src/
│   ├── core/
│   │   ├── constants.js    # Game constants, tile types, class definitions
│   │   ├── utils.js        # Shared utilities (RNG, math, grid operations)
│   │   └── gameState.js    # Global game state (entities, floors, messages)
│   ├── dungeon/
│   │   └── generator.js    # BSP dungeon generation
│   ├── systems/
│   │   ├── combat.js       # Turn-based combat, abilities, status effects
│   │   ├── fov.js          # Fog of War (line-of-sight, exploration tracking)
│   │   └── ai.js           # Monster AI and behavior
│   ├── entities/
│   │   └── monsters.js     # Monster definitions and spawning
│   ├── items/
│   │   └── items.js        # Item types, equipment, identification system
│   ├── rendering/
│   │   └── renderer.js     # Canvas rendering, camera, particle effects
│   ├── ui/
│   │   └── hud.js          # HUD overlays, title screen, help screen
│   └── main.js             # Game loop, input handling, save/load
└── tests/
    └── index.html          # Test suite
```

## License

MIT

---

**Last Updated** — 2024
