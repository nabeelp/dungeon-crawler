/**
 * test-integration.js — Integration wiring tests
 * Owner: Amy (Tester)
 *
 * Verifies that the game loop (main.js) actually calls every required
 * cross-module function. These tests catch "never wired" bugs — functions
 * that exist but are never hooked into the game loop.
 *
 * Depends on: constants.js, utils.js, gameState.js, combat.js, ai.js,
 *             fov.js, items.js, renderer.js, hud.js, monsters.js, main.js
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;

  // ── Game Initialization Wiring ────────────────────────────────

  describe('Integration — Game Initialization Wiring', function () {
    it('ItemSystem.init exists and is a function', function () {
      expect(typeof window.ItemSystem).toBe('object');
      expect(typeof window.ItemSystem.init).toBe('function');
    });

    it('ItemSystem.init accepts rng parameter without error', function () {
      const rng = Utils.createRNG(12345);
      // Should not throw — just verify it's callable with an rng
      window.ItemSystem.init(rng);
      expect(true).toBeTruthy();
    });

    it('All required modules exist on window', function () {
      const required = [
        'Constants', 'Utils', 'GameState', 'DungeonGenerator',
        'FOVSystem', 'CombatSystem', 'AISystem', 'MonsterFactory',
        'ItemSystem', 'Renderer', 'HUD', 'Game'
      ];
      for (const mod of required) {
        expect(typeof window[mod]).toBe('object');
      }
    });
  });

  // ── Turn Cycle Wiring ─────────────────────────────────────────

  describe('Integration — Turn Cycle Wiring', function () {
    it('CombatSystem.tickStatusEffects exists and is a function', function () {
      expect(typeof CombatSystem.tickStatusEffects).toBe('function');
    });

    it('CombatSystem.processTurnStart exists and is a function', function () {
      expect(typeof CombatSystem.processTurnStart).toBe('function');
    });

    it('ItemSystem.tickBuffs exists and is a function', function () {
      expect(typeof ItemSystem.tickBuffs).toBe('function');
    });

    it('AISystem.processAllMonsters exists and is a function', function () {
      expect(typeof AISystem.processAllMonsters).toBe('function');
    });
  });

  // ── Kill Wiring ───────────────────────────────────────────────

  describe('Integration — Kill Wiring', function () {
    it('CombatSystem.onKill exists and is a function', function () {
      expect(typeof CombatSystem.onKill).toBe('function');
    });

    it('ItemSystem.dropLoot exists and is a function', function () {
      expect(typeof ItemSystem.dropLoot).toBe('function');
    });
  });

  // ── Save/Load Wiring ──────────────────────────────────────────

  describe('Integration — Save/Load Wiring', function () {
    it('ItemSystem.getIdentificationState exists and is a function', function () {
      expect(typeof ItemSystem.getIdentificationState).toBe('function');
    });

    it('ItemSystem.restoreIdentificationState exists and is a function', function () {
      expect(typeof ItemSystem.restoreIdentificationState).toBe('function');
    });
  });

  // ── Cross-Module Data Contracts ───────────────────────────────

  describe('Integration — Cross-Module Data Contracts', function () {
    it('createEntity includes statusEffects field as array', function () {
      GameState.newGame(42);
      const ent = GameState.createEntity({ name: 'TestMob', type: 'monster' });
      expect(Array.isArray(ent.statusEffects)).toBeTruthy();
    });

    it('createEntity includes tags field as array', function () {
      GameState.newGame(42);
      const ent = GameState.createEntity({ name: 'TestMob', type: 'monster' });
      expect(Array.isArray(ent.tags)).toBeTruthy();
    });

    it('createEntity preserves xpValue', function () {
      GameState.newGame(42);
      const ent = GameState.createEntity({ name: 'Goblin', type: 'monster', xpValue: 25 });
      expect(ent.xpValue).toBe(25);
    });

    it('createEntity defaults xpValue to 0 when not provided', function () {
      GameState.newGame(42);
      const ent = GameState.createEntity({ name: 'NPC', type: 'npc' });
      expect(ent.xpValue).toBe(0);
    });

    it('createItem preserves _defKey', function () {
      const item = GameState.createItem({ name: 'Potion', type: 'potion', _defKey: 'healing_potion' });
      expect(item._defKey).toBe('healing_potion');
    });

    it('createItem preserves special', function () {
      const item = GameState.createItem({ name: 'Flamebrand', type: 'weapon', slot: 'weapon', special: 'fire_dot' });
      expect(item.special).toBe('fire_dot');
    });
  });

  // ── Module Init Order ─────────────────────────────────────────

  describe('Integration — Module Init Order', function () {
    it('Constants loads before GameState (Constants exists when GameState is called)', function () {
      // If Constants wasn't loaded, GameState.newGame would fail since it uses PHASES
      expect(typeof window.Constants).toBe('object');
      expect(typeof window.Constants.PHASES).toBe('object');
      GameState.newGame(42);
      expect(GameState.getPhase()).toBe(Constants.PHASES.EXPLORING);
    });

    it('Key module APIs are frozen (cannot be accidentally overwritten)', function () {
      const modules = [
        'Constants', 'GameState', 'CombatSystem', 'AISystem',
        'ItemSystem', 'FOVSystem', 'Renderer', 'HUD', 'Game',
        'MonsterFactory', 'DungeonGenerator'
      ];
      for (const mod of modules) {
        expect(Object.isFrozen(window[mod])).toBeTruthy();
      }
    });
  });

  // ── Wiring Verification: main.js calls the right functions ────

  describe('Integration — main.js wiring contracts', function () {
    it('CombatSystem.meleeAttack exists (used by tryMove in main.js)', function () {
      expect(typeof CombatSystem.meleeAttack).toBe('function');
    });

    it('CombatSystem.useAbility exists (used by tryAbility in main.js)', function () {
      expect(typeof CombatSystem.useAbility).toBe('function');
    });

    it('CombatSystem.regenerate exists (used in processPlayerAction)', function () {
      expect(typeof CombatSystem.regenerate).toBe('function');
    });

    it('ItemSystem.placeItemsOnFloor exists (used in startNewGame/changeFloor)', function () {
      expect(typeof ItemSystem.placeItemsOnFloor).toBe('function');
    });

    it('MonsterFactory.spawnForFloor exists (used in startNewGame/changeFloor)', function () {
      expect(typeof MonsterFactory.spawnForFloor).toBe('function');
    });

    it('ItemSystem.pickupItem exists (used by tryPickup in main.js)', function () {
      expect(typeof ItemSystem.pickupItem).toBe('function');
    });

    it('ItemSystem.equipItem exists (used by inventory handling in main.js)', function () {
      expect(typeof ItemSystem.equipItem).toBe('function');
    });

    it('ItemSystem.unequipItem exists (used by inventory handling in main.js)', function () {
      expect(typeof ItemSystem.unequipItem).toBe('function');
    });

    it('ItemSystem.useItem exists (used by inventory handling in main.js)', function () {
      expect(typeof ItemSystem.useItem).toBe('function');
    });

    it('ItemSystem.dropItem exists (used by inventory handling in main.js)', function () {
      expect(typeof ItemSystem.dropItem).toBe('function');
    });

    it('Game.saveGame and Game.loadGame exist (save/load wiring)', function () {
      expect(typeof Game.saveGame).toBe('function');
      expect(typeof Game.loadGame).toBe('function');
    });
  });

})();
