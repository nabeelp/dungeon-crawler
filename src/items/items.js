/**
 * items.js — Item system, loot tables, inventory management
 * Owner: Raj (Items + Loot)
 *
 * Complete item template database, identification system, loot generation,
 * and inventory/equipment management.
 * Depends on: constants.js, utils.js, gameState.js
 */
(function () {
  'use strict';

  const { ITEM_TYPES, EQUIPMENT_SLOTS, ITEM_RARITIES, WALKABLE_TILES } = Constants;

  // Maximum number of items an entity can carry
  const MAX_INVENTORY_SIZE = 20;

  // Module-scoped seeded RNG, stored by init()
  let _rng = null;

  // ── Item Templates Database ─────────────────────────────────
  // Each template: { name, type, slot?, rarity, statMods, description }
  // Consumables (potions/scrolls) have an `effect` function instead of statMods.

  const WEAPON_TEMPLATES = [
    // Common
    { name: 'Rusty Sword',    rarity: 'common',    slot: 'weapon', statMods: { attack: 2 },                description: 'A battered blade, still sharp enough.' },
    { name: 'Wooden Staff',   rarity: 'common',    slot: 'weapon', statMods: { attack: 1, mana: 3 },      description: 'A gnarled stick humming with faint energy.' },
    { name: 'Worn Dagger',    rarity: 'common',    slot: 'weapon', statMods: { attack: 3, defense: -1 },  description: 'Quick but offers no protection.' },
    // Uncommon
    { name: 'Iron Longsword', rarity: 'uncommon',  slot: 'weapon', statMods: { attack: 5 },                description: 'Solid iron, well-balanced.' },
    { name: 'Oak Staff',      rarity: 'uncommon',  slot: 'weapon', statMods: { attack: 3, mana: 8 },      description: 'Carved from an ancient oak.' },
    { name: 'Steel Dagger',   rarity: 'uncommon',  slot: 'weapon', statMods: { attack: 6 },                description: 'Lightweight steel with a keen edge.' },
    // Rare
    { name: 'Enchanted Blade',rarity: 'rare',      slot: 'weapon', statMods: { attack: 8, speed: 2 },     description: 'Glows faintly with arcane runes.' },
    { name: "Mage's Focus",   rarity: 'rare',      slot: 'weapon', statMods: { attack: 5, mana: 15 },     description: 'A crystal orb that amplifies magic.' },
    { name: 'Shadow Knife',   rarity: 'rare',      slot: 'weapon', statMods: { attack: 10 },               description: 'Wreathed in living shadow.' },
    // Epic
    { name: 'Flamebrand',     rarity: 'epic',      slot: 'weapon', statMods: { attack: 12 },               description: 'Burns with eternal flame. Sears on contact.', special: 'fire_dot' },
    { name: 'Archmage Staff',rarity: 'epic',      slot: 'weapon', statMods: { attack: 8, mana: 25 },     description: 'Crackles with pure arcane might.' },
    { name: "Assassin's Edge",rarity: 'epic',      slot: 'weapon', statMods: { attack: 15, speed: 5 },    description: 'So fast the eye cannot follow.' },
    // Legendary
    { name: 'Excalibur',      rarity: 'legendary', slot: 'weapon', statMods: { attack: 20, defense: 5 },  description: 'The once and future blade.' },
    { name: 'Staff of Ages',  rarity: 'legendary', slot: 'weapon', statMods: { attack: 15, mana: 40 },    description: 'Contains the wisdom of millennia.' },
    { name: 'Vorpal Blade',   rarity: 'legendary', slot: 'weapon', statMods: { attack: 25 },               description: 'One snicker-snack and heads roll.' }
  ];

  const ARMOR_TEMPLATES = [
    // Common
    { name: 'Leather Vest',     rarity: 'common',    slot: 'armor', statMods: { defense: 2 },                description: 'Basic hide protection.' },
    { name: 'Padded Tunic',     rarity: 'common',    slot: 'armor', statMods: { defense: 1, hp: 5 },        description: 'Thick cloth padding softens blows.' },
    // Uncommon
    { name: 'Chainmail',        rarity: 'uncommon',  slot: 'armor', statMods: { defense: 5 },                description: 'Interlocking iron rings.' },
    { name: 'Studded Leather',  rarity: 'uncommon',  slot: 'armor', statMods: { defense: 4, hp: 10 },       description: 'Leather reinforced with metal studs.' },
    // Rare
    { name: 'Plate Armor',      rarity: 'rare',      slot: 'armor', statMods: { defense: 8, speed: -1 },    description: 'Heavy but nearly impenetrable.' },
    { name: 'Elven Chainmail',  rarity: 'rare',      slot: 'armor', statMods: { defense: 7, hp: 15 },       description: 'Light as silk, tough as steel.' },
    // Epic
    { name: 'Dragonscale Mail', rarity: 'epic',      slot: 'armor', statMods: { defense: 12, hp: 20 },      description: 'Forged from dragon hide.' },
    { name: 'Shadow Cloak',     rarity: 'epic',      slot: 'armor', statMods: { defense: 10, speed: 3 },    description: 'Woven from darkness itself.' },
    // Legendary
    { name: 'Aegis of Valor',   rarity: 'legendary', slot: 'armor', statMods: { defense: 15, hp: 30 },      description: 'Blessed by the gods of war.' }
  ];

  const HELMET_TEMPLATES = [
    { name: 'Leather Cap',        rarity: 'common',    slot: 'helmet', statMods: { defense: 1 },              description: 'Simple head protection.' },
    { name: 'Iron Helm',          rarity: 'uncommon',  slot: 'helmet', statMods: { defense: 3 },              description: 'Sturdy iron headgear.' },
    { name: 'Visored Sallet',     rarity: 'rare',      slot: 'helmet', statMods: { defense: 5, hp: 10 },     description: 'Full-face protection with a visor.' },
    { name: 'Crown of Thorns',    rarity: 'epic',      slot: 'helmet', statMods: { defense: 7, attack: 3 },  description: 'Pain grants power.' },
    { name: "Titan's Crest",      rarity: 'legendary', slot: 'helmet', statMods: { defense: 10, hp: 25 },    description: 'Worn by giants of old.' }
  ];

  const BOOTS_TEMPLATES = [
    { name: 'Worn Sandals',       rarity: 'common',    slot: 'boots', statMods: { speed: 1 },                 description: 'Better than bare feet.' },
    { name: 'Leather Boots',      rarity: 'uncommon',  slot: 'boots', statMods: { speed: 2, defense: 1 },    description: 'Sturdy and comfortable.' },
    { name: 'Quicksilver Greaves',rarity: 'rare',      slot: 'boots', statMods: { speed: 4 },                 description: 'Impossibly light footwear.' },
    { name: 'Windrunner Boots',   rarity: 'epic',      slot: 'boots', statMods: { speed: 6, defense: 2 },    description: 'The wind itself propels you.' },
    { name: 'Hermes Wings',       rarity: 'legendary', slot: 'boots', statMods: { speed: 10, defense: 3 },   description: 'Legendary winged sandals.' }
  ];

  const RING_TEMPLATES = [
    { name: 'Copper Ring',        rarity: 'common',    slot: 'ring', statMods: { defense: 1 },                description: 'A simple band.' },
    { name: 'Ring of Vigor',      rarity: 'uncommon',  slot: 'ring', statMods: { hp: 10, stamina: 10 },      description: 'Pulses with vitality.' },
    { name: 'Ring of Power',      rarity: 'rare',      slot: 'ring', statMods: { attack: 5 },                 description: 'Radiates destructive force.' },
    { name: 'Arcane Signet',      rarity: 'epic',      slot: 'ring', statMods: { mana: 20, attack: 3 },      description: 'Etched with eldritch glyphs.' },
    { name: 'Ring of Omnipotence',rarity: 'legendary', slot: 'ring', statMods: { attack: 8, defense: 5, hp: 20 }, description: 'Absolute dominion.' }
  ];

  const AMULET_TEMPLATES = [
    { name: 'Bone Pendant',       rarity: 'common',    slot: 'amulet', statMods: { hp: 5 },                   description: 'Carved from unknown bone.' },
    { name: 'Silver Locket',      rarity: 'uncommon',  slot: 'amulet', statMods: { hp: 15, defense: 1 },     description: 'Contains a faded portrait.' },
    { name: 'Amulet of Warding',  rarity: 'rare',      slot: 'amulet', statMods: { defense: 4, hp: 10 },     description: 'Deflects harmful magic.' },
    { name: 'Phoenix Charm',      rarity: 'epic',      slot: 'amulet', statMods: { hp: 30, attack: 3 },      description: 'Burns warm against your chest.' },
    { name: 'Heart of the World', rarity: 'legendary', slot: 'amulet', statMods: { hp: 50, defense: 5, mana: 20 }, description: 'The world beats within.' }
  ];

  const FOOD_TEMPLATES = [
    { name: 'Stale Bread',   rarity: 'common',   statMods: { hp: 8 },  description: 'Hard and dry, but filling.' },
    { name: 'Dried Meat',    rarity: 'common',   statMods: { hp: 12 }, description: 'Tough jerky that restores energy.' },
    { name: 'Elven Waybread',rarity: 'uncommon', statMods: { hp: 25, stamina: 15 }, description: 'A single bite sustains for hours.' },
    { name: 'Dragon Steak',  rarity: 'rare',     statMods: { hp: 40, attack: 2 },   description: 'Tastes like victory.' }
  ];

  // ── Potion & Scroll Definitions ─────────────────────────────
  // These are the real effects. The identification system maps
  // randomized descriptions to these definitions per-run.

  const POTION_DEFS = [
    { key: 'health_1',   name: 'Health Potion',   rarity: 'common',   effect: (e) => { const heal = 30; e.hp = Math.min(e.maxHp, e.hp + heal); return `Restored ${heal} HP.`; } },
    { key: 'health_2',   name: 'Greater Health Potion', rarity: 'uncommon', effect: (e) => { const heal = 50; e.hp = Math.min(e.maxHp, e.hp + heal); return `Restored ${heal} HP.`; } },
    { key: 'health_3',   name: 'Superior Health Potion', rarity: 'rare', effect: (e) => { const heal = 80; e.hp = Math.min(e.maxHp, e.hp + heal); return `Restored ${heal} HP.`; } },
    { key: 'mana_1',     name: 'Mana Potion',     rarity: 'common',   effect: (e) => { const gain = 20; e.mana = Math.min(e.maxMana, e.mana + gain); return `Restored ${gain} mana.`; } },
    { key: 'mana_2',     name: 'Greater Mana Potion', rarity: 'uncommon', effect: (e) => { const gain = 40; e.mana = Math.min(e.maxMana, e.mana + gain); return `Restored ${gain} mana.`; } },
    { key: 'mana_3',     name: 'Superior Mana Potion', rarity: 'rare', effect: (e) => { const gain = 60; e.mana = Math.min(e.maxMana, e.mana + gain); return `Restored ${gain} mana.`; } },
    { key: 'stamina_1',  name: 'Stamina Potion',  rarity: 'common',   effect: (e) => { const gain = 30; e.stamina = Math.min(e.maxStamina, e.stamina + gain); return `Restored ${gain} stamina.`; } },
    { key: 'stamina_2',  name: 'Greater Stamina Potion', rarity: 'uncommon', effect: (e) => { const gain = 50; e.stamina = Math.min(e.maxStamina, e.stamina + gain); return `Restored ${gain} stamina.`; } },
    { key: 'stamina_3',  name: 'Superior Stamina Potion', rarity: 'rare', effect: (e) => { const gain = 80; e.stamina = Math.min(e.maxStamina, e.stamina + gain); return `Restored ${gain} stamina.`; } },
    { key: 'strength',   name: 'Strength Potion', rarity: 'uncommon', effect: (e) => { _applyBuff(e, 'attack', 5, 10); return 'Attack +5 for 10 turns!'; } },
    { key: 'poison',     name: 'Poison',          rarity: 'common',   effect: (e) => { e.hp = Math.max(1, e.hp - 20); return 'You feel sick! Lost 20 HP.'; } },
    { key: 'haste',      name: 'Haste Potion',    rarity: 'uncommon', effect: (e) => { _applyBuff(e, 'speed', 5, 10); return 'Speed +5 for 10 turns!'; } }
  ];

  const SCROLL_DEFS = [
    { key: 'fireball',   name: 'Scroll of Fireball',  rarity: 'uncommon', effect: (e) => { _aoeFireball(e); return 'Flames erupt around you!'; } },
    { key: 'teleport',   name: 'Scroll of Teleport',  rarity: 'uncommon', effect: (e) => { _scrollTeleport(e); return 'The world blurs and reforms.'; } },
    { key: 'identify',   name: 'Scroll of Identify',  rarity: 'common',   effect: (e) => { return _scrollIdentify(e); } },
    { key: 'mapping',    name: 'Scroll of Mapping',   rarity: 'rare',     effect: (e) => { _scrollMapping(e); return 'The entire floor is revealed!'; } },
    { key: 'curse',      name: 'Scroll of Curse',     rarity: 'common',   effect: (e) => { _applyDebuff(e, ['attack','defense','speed'], 3, 20); return 'A dark curse falls upon you! All stats -3 for 20 turns.'; } }
  ];

  // Unidentified display names (randomized per run)
  const POTION_APPEARANCES = [
    'Bubbling Potion', 'Fizzing Potion', 'Murky Potion', 'Glowing Potion',
    'Crimson Potion', 'Azure Potion', 'Emerald Potion', 'Amber Potion',
    'Smoky Potion', 'Shimmering Potion', 'Oily Potion', 'Sparkling Potion'
  ];

  const SCROLL_APPEARANCES = [
    'Dusty Scroll', 'Charred Scroll', 'Glowing Scroll', 'Faded Scroll',
    'Ornate Scroll'
  ];

  // ── Identification State (per run) ──────────────────────────
  // Maps appearance → def key, and tracks which keys have been identified.
  let _idMap = { potions: {}, scrolls: {} };  // appearance → def key
  let _reverseIdMap = { potions: {}, scrolls: {} }; // def key → appearance
  let _identifiedKeys = new Set();

  function _initIdentificationMaps(rng) {
    _identifiedKeys = new Set();
    _idMap = { potions: {}, scrolls: {} };
    _reverseIdMap = { potions: {}, scrolls: {} };

    // Shuffle appearances and assign to defs
    const potAppearances = rng.shuffle([...POTION_APPEARANCES]);
    POTION_DEFS.forEach((def, i) => {
      const app = potAppearances[i % potAppearances.length];
      _idMap.potions[app] = def.key;
      _reverseIdMap.potions[def.key] = app;
    });

    const scrAppearances = rng.shuffle([...SCROLL_APPEARANCES]);
    SCROLL_DEFS.forEach((def, i) => {
      const app = scrAppearances[i % scrAppearances.length];
      _idMap.scrolls[app] = def.key;
      _reverseIdMap.scrolls[def.key] = app;
    });
  }

  // ── Buff/Debuff Helpers ─────────────────────────────────────
  // Stored on entity._buffs = [{ stat, amount, turnsLeft }]
  function _applyBuff(entity, stat, amount, turns) {
    if (!entity._buffs) entity._buffs = [];
    entity[stat] += amount;
    entity._buffs.push({ stat, amount, turnsLeft: turns });
  }

  function _applyDebuff(entity, stats, amount, turns) {
    if (!entity._buffs) entity._buffs = [];
    for (const stat of stats) {
      entity[stat] -= amount;
      entity._buffs.push({ stat, amount: -amount, turnsLeft: turns });
    }
  }

  /** Call once per turn to tick down buffs/debuffs */
  function tickBuffs(entity) {
    if (!entity._buffs) return;
    entity._buffs = entity._buffs.filter(b => {
      b.turnsLeft--;
      if (b.turnsLeft <= 0) {
        entity[b.stat] -= b.amount; // reverse the buff
        return false;
      }
      return true;
    });
  }

  // ── Scroll Effect Helpers ───────────────────────────────────
  function _aoeFireball(entity) {
    const floor = entity.floor;
    const entities = GameState.getEntitiesOnFloor(floor);
    for (const e of entities) {
      if (e.id === entity.id) continue;
      if (Utils.chebyshevDist(entity.x, entity.y, e.x, e.y) <= 3) {
        const dmg = 15 + Math.floor((_rng || Utils.createRNG(Date.now())).random() * 10);
        e.hp -= dmg;
        GameState.addMessage(`${e.name} takes ${dmg} fire damage!`, 'combat');
        if (e.hp <= 0) {
          e.alive = false;
          GameState.addMessage(`${e.name} is incinerated!`, 'combat');
        }
      }
    }
  }

  function _scrollTeleport(entity) {
    const fd = GameState.getFloorData(entity.floor);
    if (!fd || !fd.rooms || fd.rooms.length === 0) return;
    const rng = _rng || Utils.createRNG(Date.now());

    for (let attempt = 0; attempt < 10; attempt++) {
      const room = fd.rooms[Math.floor(rng.random() * fd.rooms.length)];
      const nx = room.x + 1 + Math.floor(rng.random() * (room.w - 2));
      const ny = room.y + 1 + Math.floor(rng.random() * (room.h - 2));

      // Verify walkable tile and no entity collision
      const tile = fd.tiles && fd.tiles[ny] && fd.tiles[ny][nx];
      if (tile !== undefined && WALKABLE_TILES.has(tile) &&
          !GameState.getEntityAt(nx, ny, entity.floor)) {
        entity.x = nx;
        entity.y = ny;
        return;
      }
    }

    // All attempts failed — fizzle
    GameState.addMessage('The teleport fizzles.', 'system');
  }

  function _scrollIdentify(entity) {
    // Identify the first unidentified consumable in inventory
    for (const item of entity.inventory) {
      if ((item.type === 'potion' || item.type === 'scroll') && !item.identified) {
        identifyItem(item);
        return `Identified: ${item.name}!`;
      }
    }
    return 'Nothing to identify.';
  }

  function _scrollMapping(entity) {
    const fd = GameState.getFloorData(entity.floor);
    if (!fd || !fd.explored) return;
    for (let y = 0; y < fd.explored.length; y++) {
      for (let x = 0; x < fd.explored[y].length; x++) {
        fd.explored[y][x] = true;
      }
    }
  }

  // ── Identification System ───────────────────────────────────

  function getDisplayName(item) {
    if (item.type !== 'potion' && item.type !== 'scroll') return item.name;
    if (item.identified) return item.name;

    const defKey = item._defKey;
    if (!defKey) return item.name;

    if (_identifiedKeys.has(defKey)) {
      // Player has identified this type already
      const defs = item.type === 'potion' ? POTION_DEFS : SCROLL_DEFS;
      const def = defs.find(d => d.key === defKey);
      return def ? def.name : item.name;
    }

    // Show the randomized appearance name
    const category = item.type === 'potion' ? 'potions' : 'scrolls';
    return _reverseIdMap[category][defKey] || item.name;
  }

  function identifyItem(item) {
    if (!item._defKey) return;
    item.identified = true;
    _identifiedKeys.add(item._defKey);
    // Update the item's display name to the real name
    const defs = item.type === 'potion' ? POTION_DEFS : SCROLL_DEFS;
    const def = defs.find(d => d.key === item._defKey);
    if (def) item.name = def.name;
  }

  function isIdentified(item) {
    if (item.type !== 'potion' && item.type !== 'scroll') return true;
    return item.identified || _identifiedKeys.has(item._defKey);
  }

  // ── Loot Table Configuration ────────────────────────────────

  const RARITY_WEIGHTS_BY_FLOOR = [
    // Floors 1-3 (index 0-2)
    { common: 60, uncommon: 30, rare: 10, epic: 0, legendary: 0 },
    { common: 60, uncommon: 30, rare: 10, epic: 0, legendary: 0 },
    { common: 60, uncommon: 30, rare: 10, epic: 0, legendary: 0 },
    // Floors 4-6 (index 3-5)
    { common: 30, uncommon: 40, rare: 25, epic: 5, legendary: 0 },
    { common: 30, uncommon: 40, rare: 25, epic: 5, legendary: 0 },
    { common: 30, uncommon: 40, rare: 25, epic: 5, legendary: 0 },
    // Floors 7-9 (index 6-8)
    { common: 0, uncommon: 20, rare: 40, epic: 30, legendary: 10 },
    { common: 0, uncommon: 20, rare: 40, epic: 30, legendary: 10 },
    { common: 0, uncommon: 20, rare: 40, epic: 30, legendary: 10 },
    // Floor 10 (index 9)
    { common: 0, uncommon: 0, rare: 30, epic: 40, legendary: 30 }
  ];

  const TYPE_WEIGHTS = {
    weapon: 20, armor: 16, helmet: 6, boots: 6, amulet: 6, potion: 22, scroll: 12, ring: 8, food: 4
  };

  // ── Weighted Random Selection ───────────────────────────────

  function _weightedPick(weightsObj, rng) {
    const entries = Object.entries(weightsObj);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = rng.random() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  // ── Template Lookup ─────────────────────────────────────────

  const EQUIP_TEMPLATES = {
    weapon: WEAPON_TEMPLATES,
    armor:  ARMOR_TEMPLATES,
    helmet: HELMET_TEMPLATES,
    boots:  BOOTS_TEMPLATES,
    ring:   RING_TEMPLATES,
    amulet: AMULET_TEMPLATES
  };

  function _getTemplatesForType(type) {
    if (type === 'weapon' || type === 'armor' || type === 'helmet' ||
        type === 'boots'  || type === 'ring'  || type === 'amulet') {
      return EQUIP_TEMPLATES[type] || [];
    }
    return null; // potions/scrolls/food handled separately
  }

  // Map item type to equipment slot
  function _slotForType(type) {
    const map = { weapon: 'weapon', armor: 'armor', helmet: 'helmet', boots: 'boots', ring: 'ring', amulet: 'amulet' };
    return map[type] || null;
  }

  // ── Item Generation ─────────────────────────────────────────

  function _generateEquipItem(type, rarity, floorIndex, rng) {
    const templates = _getTemplatesForType(type);
    if (!templates || templates.length === 0) return null;

    // Filter by rarity, fallback to closest available
    let candidates = templates.filter(t => t.rarity === rarity);
    if (candidates.length === 0) {
      // Fallback: find closest rarity that has templates
      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const idx = rarityOrder.indexOf(rarity);
      for (let d = 1; d < rarityOrder.length; d++) {
        if (idx - d >= 0) candidates = templates.filter(t => t.rarity === rarityOrder[idx - d]);
        if (candidates.length > 0) break;
        if (idx + d < rarityOrder.length) candidates = templates.filter(t => t.rarity === rarityOrder[idx + d]);
        if (candidates.length > 0) break;
      }
      if (candidates.length === 0) candidates = templates;
    }

    const tmpl = rng.pick(candidates);
    const itemOpts = {
      name:        tmpl.name,
      type:        type,
      slot:        tmpl.slot || _slotForType(type),
      rarity:      tmpl.rarity,
      floorLevel:  floorIndex + 1,
      identified:  true, // equipment is always identified
      statMods:    { ...tmpl.statMods },
      description: tmpl.description
    };
    if (tmpl.special) itemOpts.special = tmpl.special;
    return GameState.createItem(itemOpts);
  }

  function _generatePotion(rarity, floorIndex, rng) {
    let candidates = POTION_DEFS.filter(d => d.rarity === rarity);
    if (candidates.length === 0) candidates = POTION_DEFS;
    const def = rng.pick(candidates);

    const appearance = _reverseIdMap.potions[def.key] || 'Strange Potion';
    return GameState.createItem({
      name:        appearance,
      type:        'potion',
      slot:        null,
      rarity:      def.rarity,
      floorLevel:  floorIndex + 1,
      identified:  false,
      statMods:    {},
      description: 'An unidentified potion.',
      _defKey:     def.key
    });
  }

  function _generateScroll(rarity, floorIndex, rng) {
    let candidates = SCROLL_DEFS.filter(d => d.rarity === rarity);
    if (candidates.length === 0) candidates = SCROLL_DEFS;
    const def = rng.pick(candidates);

    const appearance = _reverseIdMap.scrolls[def.key] || 'Mysterious Scroll';
    return GameState.createItem({
      name:        appearance,
      type:        'scroll',
      slot:        null,
      rarity:      def.rarity,
      floorLevel:  floorIndex + 1,
      identified:  false,
      statMods:    {},
      description: 'An unidentified scroll.',
      _defKey:     def.key
    });
  }

  function _generateFood(rarity, floorIndex, rng) {
    let candidates = FOOD_TEMPLATES.filter(t => t.rarity === rarity);
    if (candidates.length === 0) candidates = FOOD_TEMPLATES;
    const tmpl = rng.pick(candidates);

    return GameState.createItem({
      name:        tmpl.name,
      type:        'food',
      slot:        null,
      rarity:      tmpl.rarity,
      floorLevel:  floorIndex + 1,
      identified:  true,
      statMods:    { ...tmpl.statMods },
      description: tmpl.description
    });
  }

  function _generateSingleItem(floorIndex, rng) {
    const rarityWeights = RARITY_WEIGHTS_BY_FLOOR[Math.min(floorIndex, RARITY_WEIGHTS_BY_FLOOR.length - 1)];
    const rarity = _weightedPick(rarityWeights, rng);

    // Pick type with weights, mapping some types to equipment slots
    const typeKey = _weightedPick(TYPE_WEIGHTS, rng);

    switch (typeKey) {
      case 'weapon':
      case 'armor':
      case 'helmet':
      case 'boots':
      case 'ring':
      case 'amulet':
        return _generateEquipItem(typeKey, rarity, floorIndex, rng);
      case 'potion':
        return _generatePotion(rarity, floorIndex, rng);
      case 'scroll':
        return _generateScroll(rarity, floorIndex, rng);
      case 'food':
        return _generateFood(rarity, floorIndex, rng);
      default:
        return _generateEquipItem('weapon', rarity, floorIndex, rng);
    }
  }

  // ── Loot Generation ─────────────────────────────────────────

  /**
   * Generate an array of items appropriate for the given floor.
   * @param {number} floorIndex - 0-indexed floor number
   * @param {object} rng - seeded RNG from Utils.createRNG
   * @returns {object[]} array of item objects
   */
  function generateLoot(floorIndex, rng) {
    // Floor 1 (index 0): 3-5 items, scaling to floor 10 (index 9): 6-10
    const minItems = 3 + Math.floor(floorIndex * 0.33);
    const maxItems = 5 + Math.floor(floorIndex * 0.55);
    const count = rng.randInt(minItems, maxItems);

    const items = [];
    for (let i = 0; i < count; i++) {
      const item = _generateSingleItem(floorIndex, rng);
      if (item) items.push(item);
    }

    // Guarantee at least one helmet, boots, or amulet occasionally
    if (rng.random() < 0.3) {
      const bonusType = rng.pick(['helmet', 'boots', 'amulet']);
      const rarityWeights = RARITY_WEIGHTS_BY_FLOOR[Math.min(floorIndex, RARITY_WEIGHTS_BY_FLOOR.length - 1)];
      const rarity = _weightedPick(rarityWeights, rng);
      const bonus = _generateEquipItem(bonusType, rarity, floorIndex, rng);
      if (bonus) items.push(bonus);
    }

    return items;
  }

  // ── Item Placement ──────────────────────────────────────────

  /**
   * Generate loot and scatter it across rooms on a floor.
   * @param {number} floorIndex - 0-indexed floor
   * @param {object[]} rooms - array of {x, y, w, h}
   * @param {object} rng - seeded RNG
   */
  function placeItemsOnFloor(floorIndex, rooms, rng) {
    if (!rooms || rooms.length === 0) return;

    const items = generateLoot(floorIndex, rng);
    for (const item of items) {
      const room = rng.pick(rooms);
      // Place inside room bounds (1 tile inset from walls)
      item.x = room.x + 1 + rng.randInt(0, Math.max(0, room.w - 3));
      item.y = room.y + 1 + rng.randInt(0, Math.max(0, room.h - 3));
      item.floor = floorIndex;
      GameState.addGroundItem(item);
    }
  }

  // ── Inventory Management ────────────────────────────────────

  /**
   * Pick up an item from the ground into entity's inventory.
   */
  function pickupItem(entity, item) {
    if (entity.inventory.length >= MAX_INVENTORY_SIZE) {
      GameState.addMessage("Your inventory is full! Drop something first.", 'system');
      return false;
    }
    GameState.removeGroundItem(item.id);
    item.x = null;
    item.y = null;
    item.floor = null;
    entity.inventory.push(item);
    const displayName = getDisplayName(item);
    GameState.addMessage(`Picked up ${displayName}.`, 'loot');
    return true;
  }

  /**
   * Drop an item from inventory onto the ground.
   */
  function dropItem(entity, item) {
    const idx = entity.inventory.indexOf(item);
    if (idx === -1) return false;
    entity.inventory.splice(idx, 1);
    item.x = entity.x;
    item.y = entity.y;
    item.floor = entity.floor;
    GameState.addGroundItem(item);
    GameState.addMessage(`Dropped ${getDisplayName(item)}.`, 'loot');
    return true;
  }

  // ── Equipment Stat Modifiers ─────────────────────────────────

  /**
   * Apply an item's stat modifiers to an entity (on equip).
   * Handles attack, defense, speed directly and hp/mana/stamina
   * by adjusting both current and max values.
   */
  function applyEquipmentMods(entity, item) {
    _applyStatMods(entity, item.statMods, 1);
  }

  /**
   * Remove an item's stat modifiers from an entity (on unequip).
   * Symmetrically reverses applyEquipmentMods.
   */
  function removeEquipmentMods(entity, item) {
    _applyStatMods(entity, item.statMods, -1);
  }

  /**
   * Equip an item (must match a valid slot). Swaps if slot is occupied.
   */
  function equipItem(entity, item) {
    if (!item.slot) {
      GameState.addMessage(`${getDisplayName(item)} cannot be equipped.`, 'system');
      return false;
    }

    const slot = item.slot;
    if (!entity.equipment.hasOwnProperty(slot)) {
      GameState.addMessage(`No equipment slot: ${slot}.`, 'system');
      return false;
    }

    // Remove from inventory
    const idx = entity.inventory.indexOf(item);
    if (idx !== -1) entity.inventory.splice(idx, 1);

    // Unequip current item in that slot — removeEquipmentMods is called inside
    if (entity.equipment[slot]) {
      unequipItem(entity, slot);
    }

    // Equip and apply stat mods
    entity.equipment[slot] = item;
    applyEquipmentMods(entity, item);
    GameState.addMessage(`Equipped ${getDisplayName(item)}.`, 'loot');
    return true;
  }

  /**
   * Unequip an item from a slot. Returns it to inventory.
   */
  function unequipItem(entity, slot) {
    const item = entity.equipment[slot];
    if (!item) {
      GameState.addMessage('Nothing equipped in that slot.', 'system');
      return false;
    }

    // Remove stat mods
    removeEquipmentMods(entity, item);

    // Move to inventory
    entity.equipment[slot] = null;
    entity.inventory.push(item);
    GameState.addMessage(`Unequipped ${getDisplayName(item)}.`, 'loot');
    return true;
  }

  /**
   * Apply or remove stat modifiers. direction: 1 = apply, -1 = remove.
   */
  function _applyStatMods(entity, mods, direction) {
    if (!mods) return;
    for (const [stat, value] of Object.entries(mods)) {
      if (stat === 'hp') {
        entity.maxHp += value * direction;
        entity.hp += value * direction;
        if (entity.hp > entity.maxHp) entity.hp = entity.maxHp;
        if (entity.hp < 1) entity.hp = 1;
      } else if (stat === 'mana') {
        entity.maxMana += value * direction;
        entity.mana += value * direction;
        if (entity.mana > entity.maxMana) entity.mana = entity.maxMana;
        if (entity.mana < 0) entity.mana = 0;
      } else if (stat === 'stamina') {
        entity.maxStamina += value * direction;
        entity.stamina += value * direction;
        if (entity.stamina > entity.maxStamina) entity.stamina = entity.maxStamina;
        if (entity.stamina < 0) entity.stamina = 0;
      } else if (entity.hasOwnProperty(stat)) {
        entity[stat] += value * direction;
      }
    }
  }

  /**
   * Use a consumable item (potion, scroll, food).
   */
  function useItem(entity, item) {
    if (item.type === 'food') {
      // Food: apply statMods as instant healing
      if (item.statMods.hp) {
        entity.hp = Math.min(entity.maxHp, entity.hp + item.statMods.hp);
      }
      if (item.statMods.stamina) {
        entity.stamina = Math.min(entity.maxStamina, entity.stamina + item.statMods.stamina);
      }
      if (item.statMods.attack) {
        _applyBuff(entity, 'attack', item.statMods.attack, 20);
      }
      // Remove from inventory
      const idx = entity.inventory.indexOf(item);
      if (idx !== -1) entity.inventory.splice(idx, 1);
      GameState.addMessage(`Consumed ${item.name}. ${item.statMods.hp ? 'Restored ' + item.statMods.hp + ' HP.' : ''}`, 'loot');
      return true;
    }

    if (item.type === 'potion' || item.type === 'scroll') {
      const defs = item.type === 'potion' ? POTION_DEFS : SCROLL_DEFS;
      const def = defs.find(d => d.key === item._defKey);
      if (!def) {
        GameState.addMessage('The item fizzles uselessly.', 'system');
        return false;
      }

      // Using it identifies this type
      identifyItem(item);

      // Apply effect
      const msg = def.effect(entity);
      GameState.addMessage(msg, item.type === 'potion' ? 'loot' : 'combat');

      // Remove from inventory
      const idx = entity.inventory.indexOf(item);
      if (idx !== -1) entity.inventory.splice(idx, 1);
      return true;
    }

    GameState.addMessage(`Cannot use ${getDisplayName(item)}.`, 'system');
    return false;
  }

  // ── Monster Loot Drops ───────────────────────────────────────

  /**
   * Roll for loot when a monster dies. Returns an array of items
   * placed at the monster's position on the ground.
   * @param {object} monster - the dead monster entity
   * @param {number} floorIndex - 0-indexed floor number
   * @returns {object[]} array of dropped items (already added to ground)
   */
  function dropLoot(monster, floorIndex) {
    const dropped = [];
    const rng = Utils.createRNG(Date.now() + (monster.id || 0));

    // Base drop chance: 35%. Bosses always drop.
    const isBoss = monster.tags && monster.tags.includes('boss');
    const dropChance = isBoss ? 1.0 : 0.35;
    if (rng.random() > dropChance) return dropped;

    // Number of items: bosses drop 2-4, normal monsters drop 1 (rare 2)
    let count;
    if (isBoss) {
      count = rng.randInt(2, 4);
    } else {
      count = rng.random() < 0.15 ? 2 : 1;
    }

    for (let i = 0; i < count; i++) {
      const item = _generateSingleItem(floorIndex, rng);
      if (!item) continue;
      item.x = monster.x;
      item.y = monster.y;
      item.floor = monster.floor;
      GameState.addGroundItem(item);
      dropped.push(item);

      const displayName = getDisplayName(item);
      GameState.addMessage(`${monster.name} dropped ${displayName}!`, 'loot');
    }

    return dropped;
  }

  // ── Initialization ──────────────────────────────────────────

  /**
   * Initialize the identification maps for a new game run.
   * Call this once when starting a new game, after GameState.newGame().
   * @param {object} rng - seeded RNG
   */
  function init(rng) {
    _rng = rng;
    _initIdentificationMaps(rng);
  }

  /**
   * Serialize identification state for save games.
   * @returns {object} state snapshot
   */
  function getIdentificationState() {
    return {
      idMap:          { potions: { ..._idMap.potions }, scrolls: { ..._idMap.scrolls } },
      reverseIdMap:   { potions: { ..._reverseIdMap.potions }, scrolls: { ..._reverseIdMap.scrolls } },
      identifiedKeys: [..._identifiedKeys]
    };
  }

  /**
   * Restore identification state from a save game.
   * @param {object} saved - state snapshot from getIdentificationState()
   */
  function restoreIdentificationState(saved) {
    if (!saved) return;
    _idMap        = saved.idMap        || { potions: {}, scrolls: {} };
    _reverseIdMap = saved.reverseIdMap || { potions: {}, scrolls: {} };
    _identifiedKeys = new Set(saved.identifiedKeys || []);
  }

  // ── Public API ──────────────────────────────────────────────
  window.ItemSystem = Object.freeze({
    // Initialization
    init,

    // Constants
    MAX_INVENTORY_SIZE,

    // Identification state (save/load)
    getIdentificationState,
    restoreIdentificationState,

    // Loot generation
    generateLoot,
    placeItemsOnFloor,
    dropLoot,

    // Inventory management
    pickupItem,
    dropItem,
    equipItem,
    unequipItem,
    useItem,

    // Equipment stat modifiers
    applyEquipmentMods,
    removeEquipmentMods,

    // Identification
    identifyItem,
    isIdentified,
    getDisplayName,

    // Buff management (for turn processing)
    tickBuffs,

    // Expose templates for UI/tooltips
    WEAPON_TEMPLATES,
    ARMOR_TEMPLATES,
    HELMET_TEMPLATES,
    BOOTS_TEMPLATES,
    RING_TEMPLATES,
    AMULET_TEMPLATES,
    FOOD_TEMPLATES,
    POTION_DEFS,
    SCROLL_DEFS
  });
})();
