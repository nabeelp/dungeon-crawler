/**
 * constants.js — Shared game constants, tile types, class definitions
 * Owner: Sheldon (Lead + Dungeon Generation)
 *
 * This is the canonical source of truth for all game constants.
 * Every other module reads from window.Constants.
 */
(function () {
  'use strict';

  // ── Tile Types ──────────────────────────────────────────────
  const TILES = Object.freeze({
    WALL:        0,
    FLOOR:       1,
    DOOR:        2,
    STAIRS_DOWN: 3,
    STAIRS_UP:   4,
    CORRIDOR:    5,
    WATER:       6,
    TRAP:        7
  });

  // Reverse lookup: id → name
  const TILE_NAMES = Object.freeze(
    Object.fromEntries(Object.entries(TILES).map(([k, v]) => [v, k]))
  );

  // Which tiles can be walked on
  const WALKABLE_TILES = Object.freeze(new Set([
    TILES.FLOOR,
    TILES.DOOR,
    TILES.STAIRS_DOWN,
    TILES.STAIRS_UP,
    TILES.CORRIDOR,
    TILES.TRAP
  ]));

  // Which tiles block line-of-sight
  const OPAQUE_TILES = Object.freeze(new Set([
    TILES.WALL,
    TILES.DOOR   // closed doors block sight
  ]));

  // ── Map / Rendering ────────────────────────────────────────
  const TILE_SIZE   = 32;
  const MAP_WIDTH   = 50;
  const MAP_HEIGHT  = 50;
  const MAX_FLOORS  = 10;
  const FOV_RADIUS  = 8;

  // ── Dungeon Generator Tuning ───────────────────────────────
  // Per-floor difficulty ramp: rooms range, min room size, corridor width
  // Floor index 0 = floor 1 (easiest)
  const FLOOR_PARAMS = Object.freeze(
    Array.from({ length: MAX_FLOORS }, (_, i) => Object.freeze({
      minRooms:      5 + Math.floor(i * 0.5),
      maxRooms:      8 + Math.floor(i * 0.6),
      minRoomSize:   Math.max(4, 7 - Math.floor(i * 0.3)),
      maxRoomSize:   Math.max(8, 12 - Math.floor(i * 0.4)),
      corridorWidth: i < 5 ? 2 : 1,  // tighter corridors deeper down
      extraCorridors: Math.floor(i / 3) // occasional loops on deeper floors
    }))
  );

  // ── Item Types & Slots ─────────────────────────────────────
  const ITEM_TYPES = Object.freeze({
    WEAPON:  'weapon',
    ARMOR:   'armor',
    POTION:  'potion',
    SCROLL:  'scroll',
    RING:    'ring',
    FOOD:    'food'
  });

  const EQUIPMENT_SLOTS = Object.freeze({
    WEAPON:   'weapon',
    ARMOR:    'armor',
    HELMET:   'helmet',
    BOOTS:    'boots',
    RING:     'ring',
    AMULET:   'amulet'
  });

  const ITEM_RARITIES = Object.freeze({
    COMMON:    'common',
    UNCOMMON:  'uncommon',
    RARE:      'rare',
    EPIC:      'epic',
    LEGENDARY: 'legendary'
  });

  // ── Character Classes ──────────────────────────────────────
  const CLASSES = Object.freeze({
    WARRIOR: Object.freeze({
      name: 'Warrior',
      description: 'A sturdy fighter with high HP and strong melee attacks.',
      baseStats: Object.freeze({
        hp: 120, maxHp: 120,
        mana: 20, maxMana: 20,
        stamina: 100, maxStamina: 100,
        attack: 14, defense: 12,
        speed: 8
      }),
      abilities: Object.freeze(['power_strike', 'shield_bash', 'war_cry'])
    }),
    MAGE: Object.freeze({
      name: 'Mage',
      description: 'A glass cannon with devastating spells but fragile body.',
      baseStats: Object.freeze({
        hp: 60, maxHp: 60,
        mana: 120, maxMana: 120,
        stamina: 60, maxStamina: 60,
        attack: 6, defense: 4,
        speed: 10
      }),
      abilities: Object.freeze(['fireball', 'ice_shard', 'arcane_shield']),
      rangedAttack: Object.freeze({ range: 4, damageMultiplier: 0.5 })
    }),
    ROGUE: Object.freeze({
      name: 'Rogue',
      description: 'Fast and deadly; relies on crits and evasion.',
      baseStats: Object.freeze({
        hp: 80, maxHp: 80,
        mana: 40, maxMana: 40,
        stamina: 120, maxStamina: 120,
        attack: 12, defense: 6,
        speed: 14
      }),
      abilities: Object.freeze(['backstab', 'evade', 'poison_blade'])
    }),
    CLERIC: Object.freeze({
      name: 'Cleric',
      description: 'Healer and buffer; survives through sustain.',
      baseStats: Object.freeze({
        hp: 90, maxHp: 90,
        mana: 80, maxMana: 80,
        stamina: 80, maxStamina: 80,
        attack: 8, defense: 10,
        speed: 9
      }),
      abilities: Object.freeze(['heal', 'smite', 'divine_shield'])
    })
  });

  // ── Per-Class Regeneration Rates (per turn, exploring only) ─
  const REGEN_RATES = Object.freeze({
    WARRIOR: Object.freeze({ hp: 2, mana: 0, stamina: 3 }),
    MAGE:    Object.freeze({ hp: 1, mana: 3, stamina: 1 }),
    ROGUE:   Object.freeze({ hp: 1, mana: 0, stamina: 3 }),
    CLERIC:  Object.freeze({ hp: 2, mana: 2, stamina: 2 })
  });

  // ── Per-Class Regen Cooldown (turns of regen after combat) ─
  const REGEN_COOLDOWN = Object.freeze({
    WARRIOR: 5,
    MAGE:    8,
    ROGUE:   5,
    CLERIC:  7
  });

  // ── Game Phases ─────────────────────────────────────────────
  const PHASES = Object.freeze({
    TITLE:     'title',
    EXPLORING: 'exploring',
    COMBAT:    'combat',
    INVENTORY: 'inventory',
    DEAD:      'dead',
    VICTORY:   'victory'
  });

  // ── Directions (8-way movement) ────────────────────────────
  const DIRECTIONS = Object.freeze({
    N:  Object.freeze({ dx:  0, dy: -1 }),
    NE: Object.freeze({ dx:  1, dy: -1 }),
    E:  Object.freeze({ dx:  1, dy:  0 }),
    SE: Object.freeze({ dx:  1, dy:  1 }),
    S:  Object.freeze({ dx:  0, dy:  1 }),
    SW: Object.freeze({ dx: -1, dy:  1 }),
    W:  Object.freeze({ dx: -1, dy:  0 }),
    NW: Object.freeze({ dx: -1, dy: -1 })
  });

  // ── XP / Leveling ──────────────────────────────────────────
  const XP_PER_LEVEL = Object.freeze(
    Array.from({ length: 20 }, (_, i) => Math.floor(50 * Math.pow(1.25, i)))
  );

  // ── Public API ─────────────────────────────────────────────
  window.Constants = Object.freeze({
    TILES,
    TILE_NAMES,
    WALKABLE_TILES,
    OPAQUE_TILES,
    TILE_SIZE,
    MAP_WIDTH,
    MAP_HEIGHT,
    MAX_FLOORS,
    FOV_RADIUS,
    FLOOR_PARAMS,
    ITEM_TYPES,
    EQUIPMENT_SLOTS,
    ITEM_RARITIES,
    CLASSES,
    REGEN_RATES,
    REGEN_COOLDOWN,
    PHASES,
    DIRECTIONS,
    XP_PER_LEVEL
  });
})();
