/**
 * test-save.js — Tests for Save/Load and Permadeath
 * Owner: Amy (Tester)
 *
 * Covers: save serialization, load restoration, permadeath enforcement,
 * corrupted data handling, high score recording
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;
  const { PHASES, CLASSES, MAX_FLOORS } = Constants;

  const SEED = 42;
  const SAVE_KEY = 'dc_save';
  const HS_KEY = 'dc_highscores';

  // Helper: set up a full game state ready for save
  function setupGame() {
    GameState.newGame(SEED);
    const floorData = DungeonGenerator.generate(0, SEED);
    GameState.setFloorData(0, floorData);
    const room = floorData.rooms[0];
    const player = GameState.createEntity({
      name: 'TestHero', type: 'player', classKey: 'WARRIOR',
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2),
      floor: 0
    });
    GameState.addEntity(player);
    GameState.setPlayer(player);
    GameState.setPhase(PHASES.EXPLORING);
    // Add an item to inventory
    const sword = GameState.createItem({ name: 'Test Sword', type: 'weapon', slot: 'weapon', statMods: { attack: 5 } });
    player.inventory.push(sword);
    return player;
  }

  // Helper: simulate saveGame from main.js logic
  function saveGame() {
    const phase = GameState.getPhase();
    if (phase === PHASES.TITLE || phase === PHASES.DEAD || phase === PHASES.VICTORY) return false;
    try {
      const state = GameState.state;
      const saveData = {
        phase: state.phase,
        currentFloor: state.currentFloor,
        turnCounter: state.turnCounter,
        seed: state.seed,
        floors: state.floors,
        entities: state.entities,
        player: state.player,
        groundItems: state.groundItems,
        messages: state.messages.slice(0, 50)
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Helper: simulate loadGame from main.js logic
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const state = GameState.state;
      state.phase = data.phase || PHASES.EXPLORING;
      state.currentFloor = data.currentFloor || 0;
      state.turnCounter = data.turnCounter || 0;
      state.seed = data.seed || Date.now();
      state.floors = new Array(MAX_FLOORS).fill(null);
      for (let i = 0; i < data.floors.length; i++) {
        if (data.floors[i]) state.floors[i] = data.floors[i];
      }
      state.entities = data.entities || [];
      state.player = data.player || null;
      state.groundItems = data.groundItems || [];
      state.messages = data.messages || [];
      // Ensure player reference identity (split-brain fix)
      if (state.player && state.entities.length > 0) {
        var idx = state.entities.findIndex(function (e) { return e.id === state.player.id; });
        if (idx >= 0) {
          Object.assign(state.entities[idx], state.player);
          state.player = state.entities[idx];
        }
      }
      return true;
    } catch (e) {
      localStorage.removeItem(SAVE_KEY);
      return false;
    }
  }

  // Cleanup before each suite
  function cleanup() {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(HS_KEY);
  }

  // ── Save Serialization ──────────────────────────────────────
  describe('Save/Load — serialization', function () {
    it('save writes valid JSON to localStorage', function () {
      cleanup();
      setupGame();
      const saved = saveGame();
      expect(saved).toBe(true);
      const raw = localStorage.getItem(SAVE_KEY);
      expect(raw).toBeTruthy();
      const data = JSON.parse(raw);
      expect(data.seed).toBe(SEED);
      cleanup();
    });

    it('save includes player data', function () {
      cleanup();
      setupGame();
      saveGame();
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      expect(data.player).toBeTruthy();
      expect(data.player.name).toBe('TestHero');
      expect(data.player.classKey).toBe('WARRIOR');
      cleanup();
    });

    it('save includes floor and turn data', function () {
      cleanup();
      setupGame();
      GameState.advanceTurn();
      GameState.advanceTurn();
      saveGame();
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      expect(data.currentFloor).toBe(0);
      expect(data.turnCounter).toBe(2);
      cleanup();
    });

    it('save includes inventory', function () {
      cleanup();
      setupGame();
      saveGame();
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      expect(data.player.inventory.length).toBeGreaterThan(0);
      expect(data.player.inventory[0].name).toBe('Test Sword');
      cleanup();
    });

    it('save includes ground items', function () {
      cleanup();
      setupGame();
      const item = GameState.createItem({ name: 'Ground Gem', type: 'ring', x: 3, y: 3, floor: 0 });
      GameState.addGroundItem(item);
      saveGame();
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      expect(data.groundItems.length).toBeGreaterThan(0);
      cleanup();
    });
  });

  // ── Load Restoration ────────────────────────────────────────
  describe('Save/Load — restoration', function () {
    it('load restores player name and class', function () {
      cleanup();
      setupGame();
      saveGame();

      // Reset game state to simulate fresh start
      GameState.newGame(999);
      expect(GameState.getPlayer()).toBeNull();

      const loaded = loadGame();
      expect(loaded).toBe(true);
      expect(GameState.state.player.name).toBe('TestHero');
      expect(GameState.state.player.classKey).toBe('WARRIOR');
      cleanup();
    });

    it('load restores floor and seed', function () {
      cleanup();
      setupGame();
      GameState.setCurrentFloor(3);
      saveGame();

      GameState.newGame(999);
      loadGame();
      expect(GameState.state.currentFloor).toBe(3);
      expect(GameState.state.seed).toBe(SEED);
      cleanup();
    });

    it('load restores turn counter', function () {
      cleanup();
      setupGame();
      GameState.advanceTurn();
      GameState.advanceTurn();
      GameState.advanceTurn();
      saveGame();

      GameState.newGame(999);
      loadGame();
      expect(GameState.state.turnCounter).toBe(3);
      cleanup();
    });

    it('load returns false when no save exists', function () {
      cleanup();
      GameState.newGame(999);
      const loaded = loadGame();
      expect(loaded).toBe(false);
    });
  });

  // ── Permadeath ──────────────────────────────────────────────
  describe('Save/Load — permadeath', function () {
    it('DEAD phase prevents saving', function () {
      cleanup();
      setupGame();
      GameState.setPhase(PHASES.DEAD);
      const saved = saveGame();
      expect(saved).toBe(false);
      expect(localStorage.getItem(SAVE_KEY)).toBeNull();
      cleanup();
    });

    it('TITLE phase prevents saving', function () {
      cleanup();
      setupGame();
      GameState.setPhase(PHASES.TITLE);
      const saved = saveGame();
      expect(saved).toBe(false);
      cleanup();
    });

    it('VICTORY phase prevents saving', function () {
      cleanup();
      setupGame();
      GameState.setPhase(PHASES.VICTORY);
      const saved = saveGame();
      expect(saved).toBe(false);
      cleanup();
    });

    it('save is deleted on death (simulated)', function () {
      cleanup();
      setupGame();
      saveGame();
      expect(localStorage.getItem(SAVE_KEY)).toBeTruthy();

      // Simulate death: delete save as main.js handleDeath does
      localStorage.removeItem(SAVE_KEY);
      expect(localStorage.getItem(SAVE_KEY)).toBeNull();
      cleanup();
    });
  });

  // ── Corrupted Save Data ─────────────────────────────────────
  describe('Save/Load — corrupted data', function () {
    it('invalid JSON does not crash', function () {
      cleanup();
      localStorage.setItem(SAVE_KEY, 'THIS IS NOT JSON {{{');
      const loaded = loadGame();
      expect(loaded).toBe(false);
      // Should have cleaned up the bad save
      expect(localStorage.getItem(SAVE_KEY)).toBeNull();
      cleanup();
    });

    it('empty string save does not crash', function () {
      cleanup();
      localStorage.setItem(SAVE_KEY, '');
      const loaded = loadGame();
      expect(loaded).toBe(false);
      cleanup();
    });

    it('partial save data loads gracefully with defaults', function () {
      cleanup();
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        phase: PHASES.EXPLORING,
        seed: 123,
        floors: [],
        entities: []
      }));
      const loaded = loadGame();
      expect(loaded).toBe(true);
      expect(GameState.state.seed).toBe(123);
      expect(GameState.state.currentFloor).toBe(0);
      expect(GameState.state.turnCounter).toBe(0);
      cleanup();
    });
  });

  // ── High Score Recording ────────────────────────────────────
  describe('Save/Load — high scores', function () {
    it('high scores persist in localStorage', function () {
      cleanup();
      const scores = [
        { name: 'Hero', className: 'Warrior', floor: 5, level: 3, score: 1000, date: new Date().toISOString() }
      ];
      localStorage.setItem(HS_KEY, JSON.stringify(scores));
      const loaded = JSON.parse(localStorage.getItem(HS_KEY));
      expect(loaded.length).toBe(1);
      expect(loaded[0].name).toBe('Hero');
      expect(loaded[0].floor).toBe(5);
      expect(loaded[0].score).toBe(1000);
      cleanup();
    });

    it('high scores include class, floor, and score', function () {
      cleanup();
      const entry = { name: 'TestHero', className: 'Mage', floor: 7, level: 5, score: 2500, date: new Date().toISOString() };
      localStorage.setItem(HS_KEY, JSON.stringify([entry]));
      const loaded = JSON.parse(localStorage.getItem(HS_KEY));
      expect(loaded[0].className).toBe('Mage');
      expect(loaded[0].floor).toBe(7);
      expect(loaded[0].level).toBe(5);
      cleanup();
    });

    it('multiple high scores can be stored', function () {
      cleanup();
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push({ name: 'Hero' + i, className: 'Warrior', floor: i + 1, level: i + 1, score: (i + 1) * 100, date: new Date().toISOString() });
      }
      localStorage.setItem(HS_KEY, JSON.stringify(scores));
      const loaded = JSON.parse(localStorage.getItem(HS_KEY));
      expect(loaded.length).toBe(10);
      cleanup();
    });
  });

  // ── Save Mechanism ──────────────────────────────────────────
  describe('Save/Load — mechanism', function () {
    it('EXPLORING phase allows saving', function () {
      cleanup();
      setupGame();
      GameState.setPhase(PHASES.EXPLORING);
      const saved = saveGame();
      expect(saved).toBe(true);
      cleanup();
    });

    it('COMBAT phase allows saving', function () {
      cleanup();
      setupGame();
      GameState.setPhase(PHASES.COMBAT);
      const saved = saveGame();
      expect(saved).toBe(true);
      cleanup();
    });
  });

  // ── Bug Fix: Entity State Preservation ────────────────────
  describe('Save/Load — statusEffects preservation (bug fix)', function () {
    it('save preserves player statusEffects', function () {
      cleanup();
      const player = setupGame();
      player.statusEffects = [
        { type: 'poisoned', duration: 3, damage: 5 },
        { type: 'buffed', duration: 2, stat: 'attack', amount: 7 }
      ];
      saveGame();

      GameState.newGame(999);
      loadGame();

      const loaded = GameState.state.player;
      expect(loaded.statusEffects).toBeTruthy();
      expect(loaded.statusEffects.length).toBe(2);
      expect(loaded.statusEffects[0].type).toBe('poisoned');
      expect(loaded.statusEffects[0].damage).toBe(5);
      expect(loaded.statusEffects[1].type).toBe('buffed');
      expect(loaded.statusEffects[1].amount).toBe(7);
      cleanup();
    });

    it('save preserves empty statusEffects array', function () {
      cleanup();
      const player = setupGame();
      player.statusEffects = [];
      saveGame();

      GameState.newGame(999);
      loadGame();

      const loaded = GameState.state.player;
      expect(loaded.statusEffects).toBeTruthy();
      expect(loaded.statusEffects.length).toBe(0);
      cleanup();
    });
  });

  describe('Save/Load — entity tags preservation (bug fix)', function () {
    it('save preserves monster tags', function () {
      cleanup();
      setupGame();
      const monster = GameState.createEntity({
        name: 'Skeleton', type: 'monster',
        x: 10, y: 10, floor: 0,
        hp: 30, maxHp: 30, attack: 5, defense: 3, speed: 6
      });
      monster.tags = ['undead'];
      monster.statusEffects = [];
      monster.xpValue = 20;
      GameState.addEntity(monster);
      saveGame();

      GameState.newGame(999);
      loadGame();

      const entities = GameState.state.entities;
      const loadedMonster = entities.find(e => e.name === 'Skeleton');
      expect(loadedMonster).toBeTruthy();
      expect(loadedMonster.tags).toBeTruthy();
      expect(loadedMonster.tags.length).toBe(1);
      expect(loadedMonster.tags[0]).toBe('undead');
      expect(loadedMonster.xpValue).toBe(20);
      cleanup();
    });

    it('save preserves boss tags', function () {
      cleanup();
      setupGame();
      const boss = GameState.createEntity({
        name: 'Dragon Lord', type: 'monster',
        x: 20, y: 20, floor: 0,
        hp: 500, maxHp: 500, attack: 25, defense: 15, speed: 10
      });
      boss.tags = ['boss', 'dragon'];
      boss.statusEffects = [];
      boss.xpValue = 200;
      GameState.addEntity(boss);
      saveGame();

      GameState.newGame(999);
      loadGame();

      const loaded = GameState.state.entities.find(e => e.name === 'Dragon Lord');
      expect(loaded).toBeTruthy();
      expect(loaded.tags).toContain('boss');
      expect(loaded.tags).toContain('dragon');
      expect(loaded.xpValue).toBe(200);
      cleanup();
    });
  });

  // ── Regression: Split-Brain Fix (player reference identity) ─
  describe('Save/Load — player reference identity (split-brain fix)', function () {
    it('player reference is same object as entity in entities list after load', function () {
      cleanup();
      setupGame();
      saveGame();

      GameState.newGame(999);
      loadGame();

      var player = GameState.getPlayer();
      var entityInList = GameState.state.entities.find(function (e) { return e.id === player.id; });
      expect(entityInList).toBeTruthy();
      // After split-brain fix: modifying player must modify entity in list (same reference)
      player.hp = 999;
      expect(entityInList.hp).toBe(999);
      cleanup();
    });

    it('player position (5,5) survives save/load round-trip in both player and entities', function () {
      cleanup();
      var player = setupGame();
      player.x = 5;
      player.y = 5;
      saveGame();

      GameState.newGame(999);
      loadGame();

      var loadedPlayer = GameState.getPlayer();
      expect(loadedPlayer.x).toBe(5);
      expect(loadedPlayer.y).toBe(5);
      // Entity in the entities list must also show the same position
      var entityInList = GameState.state.entities.find(function (e) { return e.type === 'player'; });
      expect(entityInList).toBeTruthy();
      expect(entityInList.x).toBe(5);
      expect(entityInList.y).toBe(5);
      cleanup();
    });
  });

  describe('Save/Load — identification state (bug fix)', function () {
    it('save preserves item _defKey in inventory', function () {
      cleanup();
      const player = setupGame();
      const potion = GameState.createItem({
        name: 'Bubbling Potion', type: 'potion',
        _defKey: 'health_1', identified: false
      });
      player.inventory.push(potion);
      saveGame();

      GameState.newGame(999);
      loadGame();

      const loaded = GameState.state.player;
      const loadedPotion = loaded.inventory.find(function (i) { return i.type === 'potion'; });
      expect(loadedPotion).toBeTruthy();
      expect(loadedPotion._defKey).toBe('health_1');
      cleanup();
    });

    it('save preserves item _defKey in ground items', function () {
      cleanup();
      setupGame();
      const scroll = GameState.createItem({
        name: 'Dusty Scroll', type: 'scroll',
        _defKey: 'fireball', identified: false,
        x: 3, y: 3, floor: 0
      });
      GameState.addGroundItem(scroll);
      saveGame();

      GameState.newGame(999);
      loadGame();

      const groundItems = GameState.state.groundItems;
      const loadedScroll = groundItems.find(function (i) { return i.type === 'scroll'; });
      expect(loadedScroll).toBeTruthy();
      expect(loadedScroll._defKey).toBe('fireball');
      cleanup();
    });
  });
})();
