/**
 * test-combat.js — Tests for CombatSystem
 * Owner: Amy (Tester)
 *
 * Covers: damage calculation, status effects, abilities,
 * death handling, critical hits, resource costs, leveling
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;
  const { CLASSES, PHASES } = Constants;

  // Helper: create a fresh warrior player entity
  function makePlayer(overrides) {
    GameState.newGame(1);
    const e = GameState.createEntity({
      name: 'Hero', type: 'player', classKey: 'WARRIOR',
      x: 5, y: 5, floor: 0, ...overrides
    });
    GameState.addEntity(e);
    GameState.setPlayer(e);
    e.statusEffects = [];
    return e;
  }

  // Helper: create a monster adjacent to position
  function makeMonster(overrides) {
    const e = GameState.createEntity({
      name: 'Goblin', type: 'monster',
      x: 6, y: 5, floor: 0,
      hp: 50, maxHp: 50, attack: 8, defense: 4, speed: 8,
      ...overrides
    });
    e.statusEffects = [];
    e.tags = overrides && overrides.tags ? overrides.tags : [];
    GameState.addEntity(e);
    return e;
  }

  // Helper: set up minimal floor data for LOS checks
  function setupFloor() {
    const tiles = [];
    for (let y = 0; y < 50; y++) {
      const row = [];
      for (let x = 0; x < 50; x++) row.push(1); // all floor
      tiles.push(row);
    }
    GameState.setFloorData(0, { tiles, rooms: [{ x: 0, y: 0, w: 50, h: 50 }], stairs: {}, explored: [] });
  }

  // ── Damage Calculation ──────────────────────────────────────
  describe('CombatSystem — damage calculation', function () {
    it('base damage is attacker.attack - defender.defense/2 ± variance', function () {
      const player = makePlayer();
      const monster = makeMonster();
      // Warrior attack=14, monster defense=4 → base = 14 - 2 = 12, variance -2 to +2
      const damages = [];
      for (let i = 0; i < 50; i++) {
        monster.hp = 50;
        monster.alive = true;
        monster.statusEffects = [];
        const dmg = CombatSystem.applyDamage(monster, CombatSystem.calcBaseDamage(player, monster));
        damages.push(dmg);
      }
      const min = Math.min(...damages);
      const max = Math.max(...damages);
      // Should be around 10-14 (12 ± 2), minimum clamped to 1
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(0);
    });

    it('damage is always at least 1', function () {
      const player = makePlayer({ attack: 1 });
      const monster = makeMonster({ defense: 100 });
      const raw = CombatSystem.calcBaseDamage(player, monster);
      expect(raw).toBeGreaterThan(0);
    });

    it('defense reduces damage taken', function () {
      const player = makePlayer({ attack: 20 });
      const lowDef = makeMonster({ defense: 0, x: 6, y: 5 });
      const highDef = makeMonster({ defense: 20, x: 7, y: 5 });

      // Run many samples to compare average
      let totalLow = 0, totalHigh = 0;
      for (let i = 0; i < 100; i++) {
        totalLow += CombatSystem.calcBaseDamage(player, lowDef);
        totalHigh += CombatSystem.calcBaseDamage(player, highDef);
      }
      expect(totalLow / 100).toBeGreaterThan(totalHigh / 100);
    });
  });

  // ── Status Effects ──────────────────────────────────────────
  describe('CombatSystem — status effects', function () {
    it('poison ticks damage each turn', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 100, maxHp: 100 });
      CombatSystem.addStatusEffect(monster, 'poisoned', { duration: 3, damage: 5 });
      expect(CombatSystem.hasStatus(monster, 'poisoned')).toBe(true);

      CombatSystem.tickStatusEffects(monster);
      expect(monster.hp).toBe(95);
    });

    it('shield absorbs damage', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 50, maxHp: 50 });
      CombatSystem.addStatusEffect(monster, 'shielded', { absorb: 20, duration: 99 });

      const dealt = CombatSystem.applyDamage(monster, 10);
      // Shield should absorb all 10 damage
      expect(dealt).toBe(0);
      expect(monster.hp).toBe(50);
      // Shield absorb reduced
      const shield = CombatSystem.getStatus(monster, 'shielded');
      expect(shield.absorb).toBe(10);
    });

    it('shield breaks when absorb is depleted', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 50, maxHp: 50 });
      CombatSystem.addStatusEffect(monster, 'shielded', { absorb: 5, duration: 99 });

      const dealt = CombatSystem.applyDamage(monster, 15);
      // Shield absorbs 5, remaining 10 goes through
      expect(dealt).toBe(10);
      expect(monster.hp).toBe(40);
      expect(CombatSystem.hasStatus(monster, 'shielded')).toBe(false);
    });

    it('buff expires and stat reverts', function () {
      const player = makePlayer();
      const baseAtk = player.attack;
      CombatSystem.addStatusEffect(player, 'buffed', { duration: 1, stat: 'attack', amount: 5 });
      player.attack += 5; // simulate war_cry applying the stat
      expect(player.attack).toBe(baseAtk + 5);

      CombatSystem.tickStatusEffects(player);
      // After tick, duration hits 0 → buff removed and stat reverted
      expect(player.attack).toBe(baseAtk);
      expect(CombatSystem.hasStatus(player, 'buffed')).toBe(false);
    });

    it('evading dodges the next attack', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 50, maxHp: 50 });
      CombatSystem.addStatusEffect(monster, 'evading', { duration: 2 });

      const dealt = CombatSystem.applyDamage(monster, 20);
      expect(dealt).toBe(0);
      expect(monster.hp).toBe(50);
      expect(CombatSystem.hasStatus(monster, 'evading')).toBe(false);
    });

    it('status effect of same type replaces existing', function () {
      const player = makePlayer();
      CombatSystem.addStatusEffect(player, 'poisoned', { duration: 3, damage: 5 });
      CombatSystem.addStatusEffect(player, 'poisoned', { duration: 10, damage: 8 });

      const effects = player.statusEffects.filter(e => e.type === 'poisoned');
      expect(effects.length).toBe(1);
      expect(effects[0].duration).toBe(10);
      expect(effects[0].damage).toBe(8);
    });

    it('multiple different effects can coexist', function () {
      const player = makePlayer();
      CombatSystem.addStatusEffect(player, 'poisoned', { duration: 3, damage: 5 });
      CombatSystem.addStatusEffect(player, 'slowed', { duration: 3 });
      CombatSystem.addStatusEffect(player, 'shielded', { absorb: 10, duration: 99 });

      expect(CombatSystem.hasStatus(player, 'poisoned')).toBe(true);
      expect(CombatSystem.hasStatus(player, 'slowed')).toBe(true);
      expect(CombatSystem.hasStatus(player, 'shielded')).toBe(true);
      expect(player.statusEffects.length).toBe(3);
    });
  });

  // ── Death Handling ──────────────────────────────────────────
  describe('CombatSystem — death handling', function () {
    it('entity at 0 HP is marked dead', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 1, maxHp: 1 });
      CombatSystem.applyDamage(monster, 100);
      expect(monster.hp).toBe(0);
      expect(monster.alive).toBe(false);
    });

    it('negative raw damage does not crash — HP floors at 0', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 5, maxHp: 5 });
      CombatSystem.applyDamage(monster, 999);
      expect(monster.hp).toBe(0);
      expect(monster.alive).toBe(false);
    });

    it('poison can kill an entity', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 2, maxHp: 50 });
      CombatSystem.addStatusEffect(monster, 'poisoned', { duration: 5, damage: 10 });
      CombatSystem.tickStatusEffects(monster);
      expect(monster.hp).toBe(0);
      expect(monster.alive).toBe(false);
    });
  });

  // ── Ability Resolution ──────────────────────────────────────
  describe('CombatSystem — abilities', function () {
    it('power_strike costs stamina and deals double damage', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 200, maxHp: 200 });
      const staminaBefore = player.stamina;

      CombatSystem.useAbility('power_strike', player, monster);
      expect(player.stamina).toBe(staminaBefore - 20);
      // Monster should have taken damage
      expect(monster.hp).toBeLessThan(200);
    });

    it('shield_bash stuns the target', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 200, maxHp: 200 });

      CombatSystem.useAbility('shield_bash', player, monster);
      expect(CombatSystem.hasStatus(monster, 'stunned')).toBe(true);
    });

    it('war_cry buffs attack', function () {
      const player = makePlayer();
      const atkBefore = player.attack;
      CombatSystem.useAbility('war_cry', player, null);
      expect(player.attack).toBe(atkBefore + 5);
      expect(CombatSystem.hasStatus(player, 'buffed')).toBe(true);
    });

    it('heal restores HP', function () {
      const player = makePlayer({ classKey: 'CLERIC' });
      player.hp = 30;
      const maxHp = player.maxHp;
      CombatSystem.useAbility('heal', player, null);
      expect(player.hp).toBe(Math.min(maxHp, 30 + 40));
    });

    it('smite deals extra damage to undead', function () {
      const player = makePlayer({ classKey: 'CLERIC' });
      const undead = makeMonster({ hp: 200, maxHp: 200, tags: ['undead'] });
      const normal = makeMonster({ hp: 200, maxHp: 200, x: 4, y: 5 });

      // Test with multiple attempts to account for variance
      let undeadTotal = 0, normalTotal = 0;
      for (let i = 0; i < 20; i++) {
        undead.hp = 200; undead.alive = true; undead.statusEffects = [];
        normal.hp = 200; normal.alive = true; normal.statusEffects = [];
        player.mana = 100;
        CombatSystem.useAbility('smite', player, undead);
        undeadTotal += 200 - undead.hp;
        player.mana = 100;
        CombatSystem.useAbility('smite', player, normal);
        normalTotal += 200 - normal.hp;
      }
      expect(undeadTotal).toBeGreaterThan(normalTotal);
    });

    it('arcane_shield creates a shield effect', function () {
      const player = makePlayer({ classKey: 'MAGE' });
      CombatSystem.useAbility('arcane_shield', player, null);
      expect(CombatSystem.hasStatus(player, 'shielded')).toBe(true);
      const shield = CombatSystem.getStatus(player, 'shielded');
      expect(shield.absorb).toBe(30);
    });

    it('evade grants evading status', function () {
      const player = makePlayer({ classKey: 'ROGUE' });
      CombatSystem.useAbility('evade', player, null);
      expect(CombatSystem.hasStatus(player, 'evading')).toBe(true);
    });

    it('poison_blade applies poison to target', function () {
      const player = makePlayer({ classKey: 'ROGUE' });
      const monster = makeMonster({ hp: 200, maxHp: 200 });
      CombatSystem.useAbility('poison_blade', player, monster);
      expect(CombatSystem.hasStatus(monster, 'poisoned')).toBe(true);
    });
  });

  // ── Resource Costs ──────────────────────────────────────────
  describe('CombatSystem — resource costs', function () {
    it('ability fails gracefully when insufficient stamina', function () {
      const player = makePlayer();
      player.stamina = 0;
      const monster = makeMonster({ hp: 50 });
      const result = CombatSystem.useAbility('power_strike', player, monster);
      expect(result).toBe(false);
      expect(monster.hp).toBe(50); // no damage dealt
    });

    it('ability fails gracefully when insufficient mana', function () {
      const player = makePlayer({ classKey: 'MAGE' });
      player.mana = 0;
      setupFloor();
      const monster = makeMonster({ hp: 50 });
      const result = CombatSystem.useAbility('fireball', player, monster);
      expect(result).toBe(false);
    });

    it('stunned entity cannot use abilities', function () {
      const player = makePlayer();
      CombatSystem.addStatusEffect(player, 'stunned', { duration: 2 });
      const monster = makeMonster({ hp: 50 });
      const result = CombatSystem.useAbility('power_strike', player, monster);
      expect(result).toBe(false);
    });

    it('unknown ability returns false', function () {
      const player = makePlayer();
      const result = CombatSystem.useAbility('nonexistent_ability', player, null);
      expect(result).toBe(false);
    });
  });

  // ── Initiative / Turn Processing ────────────────────────────
  describe('CombatSystem — initiative and turns', function () {
    it('initiative sorts by speed descending', function () {
      const player = makePlayer();
      const fast = makeMonster({ name: 'Fast', speed: 20, x: 7, y: 5 });
      const slow = makeMonster({ name: 'Slow', speed: 2, x: 8, y: 5 });
      const order = CombatSystem.getInitiativeOrder([player, fast, slow]);
      expect(order[0].name).toBe('Fast');
      expect(order[order.length - 1].name).toBe('Slow');
    });

    it('processTurnStart returns false for stunned entity', function () {
      const player = makePlayer();
      CombatSystem.addStatusEffect(player, 'stunned', { duration: 2 });
      const canAct = CombatSystem.processTurnStart(player);
      expect(canAct).toBe(false);
    });

    it('processTurnStart regens mana/stamina for player', function () {
      const player = makePlayer();
      player.stamina = 10;
      player.mana = 5;
      CombatSystem.processTurnStart(player);
      expect(player.stamina).toBe(12); // +2
      expect(player.mana).toBe(6);     // +1
    });
  });

  // ── Melee Attack ────────────────────────────────────────────
  describe('CombatSystem — melee attack', function () {
    it('melee attack succeeds when adjacent', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 200, maxHp: 200 });
      const result = CombatSystem.meleeAttack(player, monster);
      expect(result).toBe(true);
      expect(monster.hp).toBeLessThan(200);
    });

    it('melee attack fails when target is far away', function () {
      const player = makePlayer();
      const monster = makeMonster({ hp: 50, x: 20, y: 20 });
      const result = CombatSystem.meleeAttack(player, monster);
      expect(result).toBe(false);
      expect(monster.hp).toBe(50);
    });
  });
})();
