/**
 * test-gamestate.js — Tests for GameState module
 * Owner: Amy (Tester)
 *
 * Covers: newGame, createEntity, createItem, entity CRUD,
 * player get/set, ground items, messages, phases, floor data
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;
  const { PHASES, CLASSES, EQUIPMENT_SLOTS } = Constants;

  // ── newGame ─────────────────────────────────────────────────
  describe('GameState.newGame — reset', function () {
    it('resets phase to EXPLORING', function () {
      GameState.newGame(42);
      expect(GameState.getPhase()).toBe(PHASES.EXPLORING);
    });

    it('resets floor to 0', function () {
      GameState.newGame(42);
      GameState.setCurrentFloor(3);
      GameState.newGame(42);
      expect(GameState.getCurrentFloor()).toBe(0);
    });

    it('resets turn counter to 0', function () {
      GameState.newGame(42);
      GameState.advanceTurn();
      GameState.advanceTurn();
      GameState.newGame(42);
      expect(GameState.getTurnCounter()).toBe(0);
    });

    it('clears entities', function () {
      GameState.newGame(42);
      GameState.addEntity(GameState.createEntity({ name: 'Goblin' }));
      GameState.newGame(42);
      expect(GameState.getEntitiesOnFloor(0).length).toBe(0);
    });

    it('clears player', function () {
      GameState.newGame(42);
      expect(GameState.getPlayer()).toBeNull();
    });

    it('clears ground items', function () {
      GameState.newGame(42);
      GameState.addGroundItem(GameState.createItem({ name: 'Sword', x: 1, y: 1, floor: 0 }));
      GameState.newGame(42);
      expect(GameState.getGroundItemsAt(1, 1, 0).length).toBe(0);
    });

    it('adds initial system message', function () {
      GameState.newGame(42);
      const msgs = GameState.getMessages(10);
      expect(msgs.length).toBe(1);
      expect(msgs[0].type).toBe('system');
    });

    it('stores the provided seed', function () {
      GameState.newGame(12345);
      expect(GameState.state.seed).toBe(12345);
    });

    it('floors array is reset to nulls', function () {
      GameState.newGame(42);
      for (let i = 0; i < Constants.MAX_FLOORS; i++) {
        expect(GameState.getFloorData(i)).toBeNull();
      }
    });
  });

  // ── createEntity ────────────────────────────────────────────
  describe('GameState.createEntity', function () {
    it('produces entity with all required fields', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Rat', x: 5, y: 10, floor: 2 });
      expect(e.name).toBe('Rat');
      expect(e.x).toBe(5);
      expect(e.y).toBe(10);
      expect(e.floor).toBe(2);
      expect(e.alive).toBe(true);
      expect(e.hp).toBeGreaterThan(0);
      expect(e.level).toBe(1);
      expect(Array.isArray(e.inventory)).toBe(true);
      expect(typeof e.equipment).toBe('object');
    });

    it('uses class stats when classKey provided', function () {
      GameState.newGame(1);
      const warrior = GameState.createEntity({ name: 'Hero', classKey: 'WARRIOR' });
      expect(warrior.hp).toBe(CLASSES.WARRIOR.baseStats.hp);
      expect(warrior.attack).toBe(CLASSES.WARRIOR.baseStats.attack);
      expect(warrior.defense).toBe(CLASSES.WARRIOR.baseStats.defense);
    });

    it('copies class abilities', function () {
      GameState.newGame(1);
      const mage = GameState.createEntity({ name: 'Wizard', classKey: 'MAGE' });
      expect(mage.abilities.length).toBe(CLASSES.MAGE.abilities.length);
      expect(mage.abilities).toContain('fireball');
    });

    it('defaults to monster type', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Slime' });
      expect(e.type).toBe('monster');
    });

    it('each entity gets a unique ID', function () {
      GameState.newGame(1);
      const a = GameState.createEntity({ name: 'A' });
      const b = GameState.createEntity({ name: 'B' });
      expect(a.id).toNotBe(b.id);
    });

    it('equipment slots are initialized', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Test' });
      expect(e.equipment[EQUIPMENT_SLOTS.WEAPON]).toBeNull();
      expect(e.equipment[EQUIPMENT_SLOTS.ARMOR]).toBeNull();
    });
  });

  // ── createItem ──────────────────────────────────────────────
  describe('GameState.createItem', function () {
    it('produces valid item with all fields', function () {
      GameState.newGame(1);
      const item = GameState.createItem({ name: 'Iron Sword', type: 'weapon', slot: 'weapon' });
      expect(item.name).toBe('Iron Sword');
      expect(item.type).toBe('weapon');
      expect(item.slot).toBe('weapon');
      expect(item.rarity).toBe('common');
      expect(item.identified).toBe(false);
      expect(typeof item.statMods).toBe('object');
    });

    it('each item gets a unique ID', function () {
      GameState.newGame(1);
      const a = GameState.createItem({ name: 'A' });
      const b = GameState.createItem({ name: 'B' });
      expect(a.id).toNotBe(b.id);
    });

    it('defaults type to potion', function () {
      GameState.newGame(1);
      const item = GameState.createItem({ name: 'Mystery' });
      expect(item.type).toBe('potion');
    });
  });

  // ── Entity CRUD ─────────────────────────────────────────────
  describe('GameState — entity management', function () {
    it('addEntity and getEntitiesOnFloor', function () {
      GameState.newGame(1);
      const e1 = GameState.createEntity({ name: 'Rat', floor: 0 });
      const e2 = GameState.createEntity({ name: 'Bat', floor: 1 });
      GameState.addEntity(e1);
      GameState.addEntity(e2);
      expect(GameState.getEntitiesOnFloor(0).length).toBe(1);
      expect(GameState.getEntitiesOnFloor(1).length).toBe(1);
    });

    it('removeEntity removes by id', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Goblin', floor: 0 });
      GameState.addEntity(e);
      expect(GameState.getEntitiesOnFloor(0).length).toBe(1);
      GameState.removeEntity(e.id);
      expect(GameState.getEntitiesOnFloor(0).length).toBe(0);
    });

    it('getEntityAt returns correct entity', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Spider', x: 3, y: 7, floor: 0 });
      GameState.addEntity(e);
      const found = GameState.getEntityAt(3, 7, 0);
      expect(found).toBeTruthy();
      expect(found.name).toBe('Spider');
    });

    it('getEntityAt returns null if nothing there', function () {
      GameState.newGame(1);
      expect(GameState.getEntityAt(99, 99, 0)).toBeNull();
    });

    it('dead entities are excluded from getEntitiesOnFloor', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Zombie', floor: 0 });
      GameState.addEntity(e);
      e.alive = false;
      expect(GameState.getEntitiesOnFloor(0).length).toBe(0);
    });
  });

  // ── Player ──────────────────────────────────────────────────
  describe('GameState — player', function () {
    it('setPlayer sets type to player', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Hero', classKey: 'WARRIOR' });
      GameState.addEntity(e);
      GameState.setPlayer(e);
      expect(e.type).toBe('player');
    });

    it('getPlayer returns the set player', function () {
      GameState.newGame(1);
      const e = GameState.createEntity({ name: 'Hero', classKey: 'ROGUE' });
      GameState.addEntity(e);
      GameState.setPlayer(e);
      expect(GameState.getPlayer().name).toBe('Hero');
      expect(GameState.getPlayer().classKey).toBe('ROGUE');
    });
  });

  // ── Ground Items ────────────────────────────────────────────
  describe('GameState — ground items', function () {
    it('addGroundItem and query', function () {
      GameState.newGame(1);
      const item = GameState.createItem({ name: 'Gold', x: 2, y: 3, floor: 0 });
      GameState.addGroundItem(item);
      const items = GameState.getGroundItemsAt(2, 3, 0);
      expect(items.length).toBe(1);
      expect(items[0].name).toBe('Gold');
    });

    it('removeGroundItem works', function () {
      GameState.newGame(1);
      const item = GameState.createItem({ name: 'Potion', x: 1, y: 1, floor: 0 });
      GameState.addGroundItem(item);
      GameState.removeGroundItem(item.id);
      expect(GameState.getGroundItemsAt(1, 1, 0).length).toBe(0);
    });

    it('multiple items at same position', function () {
      GameState.newGame(1);
      GameState.addGroundItem(GameState.createItem({ name: 'A', x: 5, y: 5, floor: 0 }));
      GameState.addGroundItem(GameState.createItem({ name: 'B', x: 5, y: 5, floor: 0 }));
      expect(GameState.getGroundItemsAt(5, 5, 0).length).toBe(2);
    });

    it('items on different floors are separate', function () {
      GameState.newGame(1);
      GameState.addGroundItem(GameState.createItem({ name: 'A', x: 1, y: 1, floor: 0 }));
      GameState.addGroundItem(GameState.createItem({ name: 'B', x: 1, y: 1, floor: 1 }));
      expect(GameState.getGroundItemsAt(1, 1, 0).length).toBe(1);
      expect(GameState.getGroundItemsAt(1, 1, 1).length).toBe(1);
    });
  });

  // ── Message Log ─────────────────────────────────────────────
  describe('GameState — message log', function () {
    it('addMessage and getMessages', function () {
      GameState.newGame(1);
      GameState.addMessage('Hello', 'info');
      GameState.addMessage('World', 'combat');
      const msgs = GameState.getMessages(10);
      // newGame adds 1 system message, then we added 2 more
      expect(msgs.length).toBe(3);
    });

    it('newest messages are first', function () {
      GameState.newGame(1);
      GameState.addMessage('First');
      GameState.addMessage('Second');
      const msgs = GameState.getMessages(5);
      expect(msgs[0].text).toBe('Second');
      expect(msgs[1].text).toBe('First');
    });

    it('max message cap is enforced', function () {
      GameState.newGame(1);
      const maxMsgs = GameState.state.maxMessages;
      for (let i = 0; i < maxMsgs + 50; i++) {
        GameState.addMessage('msg ' + i);
      }
      expect(GameState.state.messages.length).toBe(maxMsgs);
    });

    it('getMessages limits returned count', function () {
      GameState.newGame(1);
      for (let i = 0; i < 50; i++) {
        GameState.addMessage('msg ' + i);
      }
      expect(GameState.getMessages(5).length).toBe(5);
    });
  });

  // ── Phase Transitions ──────────────────────────────────────
  describe('GameState — phases', function () {
    it('setPhase changes the phase', function () {
      GameState.newGame(1);
      GameState.setPhase(PHASES.COMBAT);
      expect(GameState.getPhase()).toBe(PHASES.COMBAT);
    });

    it('can cycle through all phases', function () {
      GameState.newGame(1);
      const allPhases = Object.values(PHASES);
      for (const p of allPhases) {
        GameState.setPhase(p);
        expect(GameState.getPhase()).toBe(p);
      }
    });
  });

  // ── Floor Data ──────────────────────────────────────────────
  describe('GameState — floor data', function () {
    it('setFloorData and getFloorData', function () {
      GameState.newGame(1);
      const fakeData = { tiles: [], rooms: [], stairs: {} };
      GameState.setFloorData(3, fakeData);
      expect(GameState.getFloorData(3)).toBe(fakeData);
    });

    it('getCurrentTiles returns tiles for current floor', function () {
      GameState.newGame(1);
      const tiles = [[1, 2], [3, 4]];
      GameState.setFloorData(0, { tiles, rooms: [] });
      expect(GameState.getCurrentTiles()).toBe(tiles);
    });

    it('getCurrentTiles returns null if floor not generated', function () {
      GameState.newGame(1);
      expect(GameState.getCurrentTiles()).toBeNull();
    });

    it('getCurrentRooms returns rooms array', function () {
      GameState.newGame(1);
      const rooms = [{ x: 1, y: 1, w: 5, h: 5 }];
      GameState.setFloorData(0, { tiles: [], rooms });
      expect(GameState.getCurrentRooms().length).toBe(1);
    });
  });

  // ── Turn Counter ────────────────────────────────────────────
  describe('GameState — turn counter', function () {
    it('advanceTurn increments', function () {
      GameState.newGame(1);
      expect(GameState.getTurnCounter()).toBe(0);
      GameState.advanceTurn();
      expect(GameState.getTurnCounter()).toBe(1);
      GameState.advanceTurn();
      expect(GameState.getTurnCounter()).toBe(2);
    });
  });
})();
