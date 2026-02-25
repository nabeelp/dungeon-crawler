/**
 * monsters.js — Monster templates and factory
 * Owner: Leonard (Combat + Enemy AI)
 *
 * Defines monster types for all 10 floors and provides a spawner.
 * Depends on: constants.js, utils.js, gameState.js
 */
(function () {
  'use strict';

  // ── Monster Templates ─────────────────────────────────────
  // Base stats are for floor 1; scaling is applied per floor.
  const TEMPLATES = {
    // Floor 1–3: Basic creatures
    rat: {
      name: 'Giant Rat',
      baseHp: 12, baseAttack: 4, baseDefense: 1, baseSpeed: 12,
      ai: 'aggressive', xpValue: 10, tags: [],
      abilities: [], floors: [0, 1, 2]
    },
    bat: {
      name: 'Cave Bat',
      baseHp: 8, baseAttack: 3, baseDefense: 0, baseSpeed: 14,
      ai: 'aggressive', xpValue: 8, tags: [],
      abilities: [], floors: [0, 1, 2]
    },
    goblin: {
      name: 'Goblin',
      baseHp: 18, baseAttack: 6, baseDefense: 2, baseSpeed: 10,
      ai: 'flanking', xpValue: 15, tags: [],
      abilities: [], floors: [0, 1, 2]
    },
    skeleton: {
      name: 'Skeleton',
      baseHp: 22, baseAttack: 7, baseDefense: 4, baseSpeed: 8,
      ai: 'aggressive', xpValue: 18, tags: ['undead'],
      abilities: [], floors: [1, 2, 3]
    },

    // Floor 4–6: Mid-tier threats
    orc: {
      name: 'Orc Warrior',
      baseHp: 40, baseAttack: 10, baseDefense: 6, baseSpeed: 8,
      ai: 'aggressive', xpValue: 30, tags: [],
      abilities: ['power_strike'], floors: [3, 4, 5]
    },
    dark_mage: {
      name: 'Dark Mage',
      baseHp: 25, baseAttack: 8, baseDefense: 3, baseSpeed: 10,
      ai: 'ranged', xpValue: 35, tags: [],
      abilities: ['ice_shard'], floors: [3, 4, 5]
    },
    wraith: {
      name: 'Wraith',
      baseHp: 30, baseAttack: 9, baseDefense: 2, baseSpeed: 12,
      ai: 'flanking', xpValue: 32, tags: ['undead'],
      abilities: [], floors: [4, 5, 6]
    },
    spider: {
      name: 'Giant Spider',
      baseHp: 28, baseAttack: 8, baseDefense: 3, baseSpeed: 11,
      ai: 'cautious', xpValue: 25, tags: [],
      abilities: ['poison_blade'], floors: [3, 4, 5]
    },

    // Floor 7–9: Dangerous foes
    troll: {
      name: 'Cave Troll',
      baseHp: 70, baseAttack: 14, baseDefense: 10, baseSpeed: 6,
      ai: 'aggressive', xpValue: 55, tags: [],
      abilities: ['power_strike', 'war_cry'], floors: [6, 7, 8, 9]
    },
    demon: {
      name: 'Lesser Demon',
      baseHp: 55, baseAttack: 13, baseDefense: 7, baseSpeed: 10,
      ai: 'flanking', xpValue: 60, tags: [],
      abilities: ['fireball'], floors: [6, 7, 8, 9]
    },
    lich: {
      name: 'Lich',
      baseHp: 45, baseAttack: 11, baseDefense: 5, baseSpeed: 9,
      ai: 'ranged', xpValue: 65, tags: ['undead'],
      abilities: ['ice_shard', 'arcane_shield'], floors: [7, 8, 9]
    },
    dragon_whelp: {
      name: 'Dragon Whelp',
      baseHp: 60, baseAttack: 15, baseDefense: 8, baseSpeed: 11,
      ai: 'cautious', xpValue: 70, tags: [],
      abilities: ['fireball'], floors: [7, 8, 9]
    },

    // Floor 10: Boss
    dragon_lord: {
      name: 'Dragon Lord',
      baseHp: 200, baseAttack: 22, baseDefense: 14, baseSpeed: 10,
      ai: 'boss', xpValue: 500, tags: ['boss'],
      abilities: ['fireball', 'war_cry', 'power_strike'],
      floors: [9], isBoss: true
    }
  };

  // ── Stat Scaling ──────────────────────────────────────────
  function scaleStats(template, floorIndex) {
    const scale = 1 + floorIndex * 0.15;
    return {
      hp:      Math.floor(template.baseHp * scale),
      maxHp:   Math.floor(template.baseHp * scale),
      attack:  Math.floor(template.baseAttack * scale),
      defense: Math.floor(template.baseDefense * scale),
      speed:   template.baseSpeed
    };
  }

  // ── Get available templates for a floor ───────────────────
  function getTemplatesForFloor(floorIndex) {
    return Object.entries(TEMPLATES)
      .filter(([, t]) => t.floors.includes(floorIndex))
      .map(([key, t]) => ({ key, ...t }));
  }

  // ── Create a monster entity from template ─────────────────
  function createMonster(templateKey, floorIndex, x, y) {
    const template = TEMPLATES[templateKey];
    if (!template) return null;

    const stats = scaleStats(template, floorIndex);

    const monster = GameState.createEntity({
      name: template.name,
      type: 'monster',
      x, y,
      floor: floorIndex,
      ...stats,
      mana: template.ai === 'ranged' || template.isBoss ? 60 : 0,
      maxMana: template.ai === 'ranged' || template.isBoss ? 60 : 0,
      stamina: 50,
      maxStamina: 50,
      abilities: [...template.abilities],
      ai: template.ai
    });

    // Extra properties for AI/combat
    monster.xpValue = Math.floor(template.xpValue * (1 + floorIndex * 0.3));
    monster.templateKey = templateKey;
    monster.tags = [...(template.tags || [])];
    monster.statusEffects = [];

    return monster;
  }

  // ── Spawn monsters for a floor ────────────────────────────
  function spawnForFloor(floorIndex, rooms, rng) {
    const templates = getTemplatesForFloor(floorIndex);
    if (templates.length === 0) return [];

    // Monster count scales: 3–5 on floor 1, 8–12 on floor 10
    const minCount = 3 + Math.floor(floorIndex * 0.6);
    const maxCount = 5 + Math.floor(floorIndex * 0.8);
    const count = rng.randInt(minCount, maxCount);

    const spawned = [];

    // Boss floor — always spawn the boss
    if (floorIndex === 9) {
      const bossTemplates = templates.filter(t => t.isBoss);
      if (bossTemplates.length > 0 && rooms.length > 0) {
        const bossRoom = rooms[rooms.length - 1];
        const cx = Math.floor(bossRoom.x + bossRoom.w / 2);
        const cy = Math.floor(bossRoom.y + bossRoom.h / 2);
        const boss = createMonster('dragon_lord', floorIndex, cx, cy);
        if (boss) {
          GameState.addEntity(boss);
          spawned.push(boss);
        }
      }
    }

    // Spawn regular monsters
    const regularTemplates = templates.filter(t => !t.isBoss);
    if (regularTemplates.length === 0) return spawned;

    // Skip first room (player spawn) — spread across remaining rooms
    const spawnRooms = rooms.length > 1 ? rooms.slice(1) : rooms;

    for (let i = spawned.length; i < count; i++) {
      const room = rng.pick(spawnRooms);
      // Random position inside room, avoiding center (where stairs might be)
      const mx = rng.randInt(room.x + 1, room.x + room.w - 2);
      const my = rng.randInt(room.y + 1, room.y + room.h - 2);

      // Don't spawn on top of another entity
      if (GameState.getEntityAt(mx, my, floorIndex)) continue;

      const template = rng.pick(regularTemplates);
      const monster = createMonster(template.key, floorIndex, mx, my);
      if (monster) {
        GameState.addEntity(monster);
        spawned.push(monster);
      }
    }

    return spawned;
  }

  // ── Public API ────────────────────────────────────────────
  window.MonsterFactory = Object.freeze({
    TEMPLATES,
    createMonster,
    spawnForFloor,
    getTemplatesForFloor,
    scaleStats
  });
})();
