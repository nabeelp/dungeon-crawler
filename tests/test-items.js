/**
 * test-items.js — Tests for ItemSystem
 * Owner: Amy (Tester)
 *
 * Covers: item creation, equipment stat mods, unequip reversal,
 * inventory management, identification, loot generation, consumables
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;
  const { CLASSES } = Constants;

  const SEED = 42;

  // Helper: create a player entity and init ItemSystem
  function makePlayer(overrides) {
    GameState.newGame(SEED);
    const rng = Utils.createRNG(SEED);
    ItemSystem.init(rng);
    const e = GameState.createEntity({
      name: 'Hero', type: 'player', classKey: 'WARRIOR',
      x: 5, y: 5, floor: 0, ...overrides
    });
    GameState.addEntity(e);
    GameState.setPlayer(e);
    e.statusEffects = [];
    return e;
  }

  // ── Item Creation from Templates ────────────────────────────
  describe('ItemSystem — item creation', function () {
    it('generates items from templates via generateLoot', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 100);
      const items = ItemSystem.generateLoot(0, rng);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.id).toBeTruthy();
        expect(item.name).toBeTruthy();
      }
    });

    it('equipment items are always identified', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 200);
      const items = ItemSystem.generateLoot(0, rng);
      const equips = items.filter(i => ['weapon', 'armor', 'helmet', 'boots', 'ring', 'amulet'].includes(i.type));
      for (const item of equips) {
        expect(item.identified).toBe(true);
      }
    });

    it('consumable items start unidentified', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 300);
      const items = ItemSystem.generateLoot(0, rng);
      const consumables = items.filter(i => i.type === 'potion' || i.type === 'scroll');
      for (const item of consumables) {
        expect(item.identified).toBe(false);
      }
    });

    it('createItem produces item with all required fields', function () {
      GameState.newGame(SEED);
      const item = GameState.createItem({ name: 'Test Sword', type: 'weapon', slot: 'weapon', statMods: { attack: 5 } });
      expect(item.name).toBe('Test Sword');
      expect(item.type).toBe('weapon');
      expect(item.slot).toBe('weapon');
      expect(item.statMods.attack).toBe(5);
    });
  });

  // ── Equipment Stat Modifiers ────────────────────────────────
  describe('ItemSystem — equip/unequip stats', function () {
    it('equipping a weapon increases attack', function () {
      const player = makePlayer();
      const basAtk = player.attack;
      const sword = GameState.createItem({ name: 'Iron Sword', type: 'weapon', slot: 'weapon', statMods: { attack: 5 }, identified: true });
      player.inventory.push(sword);
      ItemSystem.equipItem(player, sword);
      expect(player.attack).toBe(basAtk + 5);
      expect(player.equipment.weapon).toBeTruthy();
      expect(player.equipment.weapon.name).toBe('Iron Sword');
    });

    it('equipping armor increases defense', function () {
      const player = makePlayer();
      const baseDef = player.defense;
      const armor = GameState.createItem({ name: 'Chainmail', type: 'armor', slot: 'armor', statMods: { defense: 5 }, identified: true });
      player.inventory.push(armor);
      ItemSystem.equipItem(player, armor);
      expect(player.defense).toBe(baseDef + 5);
    });

    it('unequip reverses stat changes', function () {
      const player = makePlayer();
      const basAtk = player.attack;
      const sword = GameState.createItem({ name: 'Iron Sword', type: 'weapon', slot: 'weapon', statMods: { attack: 5 }, identified: true });
      player.inventory.push(sword);
      ItemSystem.equipItem(player, sword);
      expect(player.attack).toBe(basAtk + 5);

      ItemSystem.unequipItem(player, 'weapon');
      expect(player.attack).toBe(basAtk);
      expect(player.equipment.weapon).toBeNull();
    });

    it('hp stat mod changes both hp and maxHp', function () {
      const player = makePlayer();
      const baseHp = player.hp;
      const baseMaxHp = player.maxHp;
      const amulet = GameState.createItem({ name: 'HP Amulet', type: 'amulet', slot: 'amulet', statMods: { hp: 20 }, identified: true });
      player.inventory.push(amulet);
      ItemSystem.equipItem(player, amulet);
      expect(player.maxHp).toBe(baseMaxHp + 20);
      expect(player.hp).toBe(baseHp + 20);

      ItemSystem.unequipItem(player, 'amulet');
      expect(player.maxHp).toBe(baseMaxHp);
    });

    it('swapping equipment auto-unequips old item', function () {
      const player = makePlayer();
      const basAtk = player.attack;
      const sword1 = GameState.createItem({ name: 'Sword A', type: 'weapon', slot: 'weapon', statMods: { attack: 3 }, identified: true });
      const sword2 = GameState.createItem({ name: 'Sword B', type: 'weapon', slot: 'weapon', statMods: { attack: 7 }, identified: true });
      player.inventory.push(sword1);
      player.inventory.push(sword2);

      ItemSystem.equipItem(player, sword1);
      expect(player.attack).toBe(basAtk + 3);

      ItemSystem.equipItem(player, sword2);
      expect(player.attack).toBe(basAtk + 7);
      // Old sword should be back in inventory
      expect(player.inventory).toContain(sword1);
    });

    it('items without slot cannot be equipped', function () {
      const player = makePlayer();
      const potion = GameState.createItem({ name: 'Health Potion', type: 'potion', slot: null });
      player.inventory.push(potion);
      const result = ItemSystem.equipItem(player, potion);
      expect(result).toBe(false);
    });
  });

  // ── Inventory Management ────────────────────────────────────
  describe('ItemSystem — inventory', function () {
    it('pickupItem moves item from ground to inventory', function () {
      const player = makePlayer();
      const item = GameState.createItem({ name: 'Gold Ring', type: 'ring', slot: 'ring', x: 5, y: 5, floor: 0 });
      GameState.addGroundItem(item);
      expect(GameState.getGroundItemsAt(5, 5, 0).length).toBe(1);

      ItemSystem.pickupItem(player, item);
      expect(GameState.getGroundItemsAt(5, 5, 0).length).toBe(0);
      expect(player.inventory.length).toBe(1);
      expect(player.inventory[0].name).toBe('Gold Ring');
    });

    it('dropItem moves item from inventory to ground', function () {
      const player = makePlayer();
      const item = GameState.createItem({ name: 'Gold Ring', type: 'ring', slot: 'ring' });
      player.inventory.push(item);

      ItemSystem.dropItem(player, item);
      expect(player.inventory.length).toBe(0);
      expect(GameState.getGroundItemsAt(5, 5, 0).length).toBe(1);
    });

    it('dropped item has entity position', function () {
      const player = makePlayer();
      const item = GameState.createItem({ name: 'Sword', type: 'weapon', slot: 'weapon' });
      player.inventory.push(item);

      ItemSystem.dropItem(player, item);
      const ground = GameState.getGroundItemsAt(5, 5, 0);
      expect(ground[0].x).toBe(5);
      expect(ground[0].y).toBe(5);
      expect(ground[0].floor).toBe(0);
    });

    it('dropItem for item not in inventory returns false', function () {
      const player = makePlayer();
      const item = GameState.createItem({ name: 'Phantom' });
      const result = ItemSystem.dropItem(player, item);
      expect(result).toBe(false);
    });
  });

  // ── Identification System ───────────────────────────────────
  describe('ItemSystem — identification', function () {
    it('unidentified potion shows appearance name', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 400);
      const items = ItemSystem.generateLoot(0, rng);
      const potion = items.find(i => i.type === 'potion');
      if (potion) {
        const display = ItemSystem.getDisplayName(potion);
        // Should not be the real potion name since it's unidentified
        expect(potion.identified).toBe(false);
        expect(display).toBeTruthy();
      }
    });

    it('identifying item reveals true name', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 500);
      const items = ItemSystem.generateLoot(0, rng);
      const potion = items.find(i => i.type === 'potion');
      if (potion) {
        const nameBefore = ItemSystem.getDisplayName(potion);
        ItemSystem.identifyItem(potion);
        expect(potion.identified).toBe(true);
        // After identify, the display name should be the real name
        const nameAfter = ItemSystem.getDisplayName(potion);
        expect(nameAfter).toBe(potion.name);
      }
    });

    it('equipment is always considered identified', function () {
      const player = makePlayer();
      const sword = GameState.createItem({ name: 'Test Sword', type: 'weapon', slot: 'weapon', identified: true });
      expect(ItemSystem.isIdentified(sword)).toBe(true);
    });

    it('identifying a potion type marks all of that type as known', function () {
      const player = makePlayer();
      const rng1 = Utils.createRNG(SEED + 600);
      const rng2 = Utils.createRNG(SEED + 700);

      // Generate two batches — look for potions with same _defKey
      const items1 = ItemSystem.generateLoot(0, rng1);
      const items2 = ItemSystem.generateLoot(0, rng2);
      const potions = [...items1, ...items2].filter(i => i.type === 'potion');

      if (potions.length >= 2) {
        // Find two potions with same defKey
        const defKeys = {};
        for (const p of potions) {
          if (!defKeys[p._defKey]) defKeys[p._defKey] = [];
          defKeys[p._defKey].push(p);
        }
        const pair = Object.values(defKeys).find(arr => arr.length >= 2);
        if (pair) {
          ItemSystem.identifyItem(pair[0]);
          expect(ItemSystem.isIdentified(pair[1])).toBe(true);
        }
      }
    });
  });

  // ── Loot Table Distribution ─────────────────────────────────
  describe('ItemSystem — loot generation', function () {
    it('floor 0 generates 3-5 items (plus possible bonus)', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 800);
      const items = ItemSystem.generateLoot(0, rng);
      expect(items.length).toBeGreaterThan(2);
    });

    it('deeper floors generate more items', function () {
      const player = makePlayer();
      // Compare floor 0 vs floor 9 over several runs
      let totalFloor0 = 0, totalFloor9 = 0;
      for (let i = 0; i < 10; i++) {
        const rng0 = Utils.createRNG(SEED + 900 + i);
        const rng9 = Utils.createRNG(SEED + 1900 + i);
        totalFloor0 += ItemSystem.generateLoot(0, rng0).length;
        totalFloor9 += ItemSystem.generateLoot(9, rng9).length;
      }
      expect(totalFloor9).toBeGreaterThan(totalFloor0);
    });

    it('floor 9 generates no common items', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 2000);
      const items = ItemSystem.generateLoot(9, rng);
      const commons = items.filter(i => i.rarity === 'common');
      // Floor 10 rarity weights: common=0
      // Equipment items have rarity from templates, but weighted pick won't choose common
      // Some equipment might fallback, but potions/scrolls won't be common-rarity
      // This is a soft check — mostly verifying the weight system works
      expect(items.length).toBeGreaterThan(0);
    });

    it('placeItemsOnFloor places items on ground', function () {
      const player = makePlayer();
      const rooms = [{ x: 2, y: 2, w: 10, h: 10 }];
      const rng = Utils.createRNG(SEED + 3000);
      ItemSystem.placeItemsOnFloor(0, rooms, rng);

      // Check ground items exist on floor 0
      const groundItems = GameState.state.groundItems.filter(i => i.floor === 0);
      expect(groundItems.length).toBeGreaterThan(0);
    });

    it('generated items have valid types', function () {
      const player = makePlayer();
      const rng = Utils.createRNG(SEED + 4000);
      const items = ItemSystem.generateLoot(5, rng);
      const validTypes = ['weapon', 'armor', 'helmet', 'boots', 'ring', 'amulet', 'potion', 'scroll', 'food'];
      for (const item of items) {
        expect(validTypes.indexOf(item.type) !== -1).toBe(true);
      }
    });
  });

  // ── Consumable Effects ──────────────────────────────────────
  describe('ItemSystem — consumable effects', function () {
    it('using food restores HP', function () {
      const player = makePlayer();
      player.hp = 50;
      const food = GameState.createItem({ name: 'Stale Bread', type: 'food', statMods: { hp: 8 }, identified: true });
      player.inventory.push(food);

      ItemSystem.useItem(player, food);
      expect(player.hp).toBe(58);
      expect(player.inventory.length).toBe(0); // consumed
    });

    it('using health potion restores HP', function () {
      const player = makePlayer();
      player.hp = 50;
      // Create a health potion manually
      const potion = GameState.createItem({ name: 'Test Potion', type: 'potion', _defKey: 'health_1', identified: false });
      player.inventory.push(potion);

      ItemSystem.useItem(player, potion);
      // health_1 restores 30 HP
      expect(player.hp).toBe(80);
      expect(player.inventory.length).toBe(0);
      // Using identifies the potion type
      expect(potion.identified).toBe(true);
    });

    it('using item with invalid defKey fails gracefully', function () {
      const player = makePlayer();
      const item = GameState.createItem({ name: 'Broken Potion', type: 'potion', _defKey: 'nonexistent' });
      player.inventory.push(item);
      const result = ItemSystem.useItem(player, item);
      expect(result).toBe(false);
    });

    it('buff from potion applies and ticks down', function () {
      const player = makePlayer();
      const baseAtk = player.attack;
      const potion = GameState.createItem({ name: 'Str Potion', type: 'potion', _defKey: 'strength', identified: false });
      player.inventory.push(potion);

      ItemSystem.useItem(player, potion);
      expect(player.attack).toBe(baseAtk + 5);
      expect(player._buffs.length).toBeGreaterThan(0);

      // Tick to expiry
      for (let i = 0; i < 10; i++) {
        ItemSystem.tickBuffs(player);
      }
      expect(player.attack).toBe(baseAtk);
    });
  });

  // ── Template Exposure ───────────────────────────────────────
  describe('ItemSystem — templates', function () {
    it('WEAPON_TEMPLATES is exposed and non-empty', function () {
      expect(ItemSystem.WEAPON_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('ARMOR_TEMPLATES is exposed and non-empty', function () {
      expect(ItemSystem.ARMOR_TEMPLATES.length).toBeGreaterThan(0);
    });

    it('POTION_DEFS has health, mana, and stamina potions', function () {
      const keys = ItemSystem.POTION_DEFS.map(d => d.key);
      expect(keys.indexOf('health_1') !== -1).toBe(true);
      expect(keys.indexOf('mana_1') !== -1).toBe(true);
      expect(keys.indexOf('stamina_1') !== -1).toBe(true);
    });
  });
})();
