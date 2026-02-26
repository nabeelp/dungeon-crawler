/**
 * combat.js — Turn-based combat system
 * Owner: Leonard (Combat + Enemy AI)
 *
 * Handles attack resolution, abilities, status effects, XP/leveling.
 * Depends on: constants.js, utils.js, gameState.js
 */
(function () {
  'use strict';

  const { MAP_WIDTH, MAP_HEIGHT, OPAQUE_TILES, XP_PER_LEVEL, REGEN_RATES, PHASES } = Constants;

  // ── Status Effect Defaults ────────────────────────────────
  const STATUS_DEFAULTS = {
    stunned:  { duration: 1 },
    slowed:   { duration: 3 },
    poisoned: { duration: 5, damage: 3 },
    shielded: { duration: 0, absorb: 0 },
    buffed:   { duration: 3, stat: 'attack', amount: 0 },
    evading:  { duration: 1 },
    divine_shield: { duration: 2, reduction: 0.5 },
    bleed:    { duration: 3, damage: 2 },
    vulnerable: { duration: 3 }
  };

  // ── Bresenham's Line ──────────────────────────────────────
  function bresenhamLine(x0, y0, x1, y1) {
    const points = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      points.push({ x: x0, y: y0 });
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
    return points;
  }

  // ── Line of Sight ─────────────────────────────────────────
  function hasLineOfSight(x0, y0, x1, y1, tiles) {
    const line = bresenhamLine(x0, y0, x1, y1);
    // Skip start and end tiles — only check intermediate
    for (let i = 1; i < line.length - 1; i++) {
      const p = line[i];
      if (p.x < 0 || p.x >= MAP_WIDTH || p.y < 0 || p.y >= MAP_HEIGHT) return false;
      if (OPAQUE_TILES.has(tiles[p.y][p.x])) return false;
    }
    return true;
  }

  // ── Status Effects ────────────────────────────────────────
  function initStatusEffects(entity) {
    if (!entity.statusEffects) entity.statusEffects = [];
  }

  function addStatusEffect(entity, type, opts) {
    initStatusEffects(entity);
    const effect = { type, ...STATUS_DEFAULTS[type], ...opts };
    // Bleed stacks: increase damage on existing bleed
    if (type === 'bleed') {
      const existing = entity.statusEffects.find(e => e.type === 'bleed');
      if (existing) {
        existing.damage += effect.damage;
        existing.duration = Math.max(existing.duration, effect.duration);
        return;
      }
    }
    // Replace existing effect of same type
    entity.statusEffects = entity.statusEffects.filter(e => e.type !== type);
    entity.statusEffects.push(effect);
  }

  function hasStatus(entity, type) {
    initStatusEffects(entity);
    return entity.statusEffects.some(e => e.type === type);
  }

  function getStatus(entity, type) {
    initStatusEffects(entity);
    return entity.statusEffects.find(e => e.type === type) || null;
  }

  function tickStatusEffects(entity) {
    initStatusEffects(entity);
    const expiring = [];
    entity.statusEffects = entity.statusEffects.filter(effect => {
      // Poison tick
      if (effect.type === 'poisoned' && effect.damage) {
        entity.hp -= effect.damage;
        GameState.addMessage(`${entity.name} takes ${effect.damage} poison damage.`, 'combat');
        if (entity.hp <= 0) {
          entity.hp = 0;
          entity.alive = false;
          GameState.addMessage(`${entity.name} dies from poison!`, 'combat');
        }
      }
      // Bleed tick
      if (effect.type === 'bleed' && effect.damage) {
        entity.hp -= effect.damage;
        GameState.addMessage(`${entity.name} takes ${effect.damage} bleed damage.`, 'combat');
        if (entity.hp <= 0) {
          entity.hp = 0;
          entity.alive = false;
          GameState.addMessage(`${entity.name} bleeds out!`, 'combat');
        }
      }
      effect.duration--;
      if (effect.duration <= 0) {
        expiring.push(effect);
        return false;
      }
      // Warn when 1 turn left
      if (effect.duration === 1) {
        const label = effect.type.charAt(0).toUpperCase() + effect.type.slice(1).replace('_', ' ');
        GameState.addMessage(`${entity.name}'s ${label} is fading! (1 turn left)`, 'combat');
      }
      return true;
    });

    // Clean up expired buff stat mods
    for (const eff of expiring) {
      if (eff.type === 'buffed' && eff.stat) {
        entity[eff.stat] -= eff.amount;
        GameState.addMessage(`${entity.name}'s ${eff.stat} buff fades.`, 'combat');
      }
    }
  }

  // ── Damage Calculation ────────────────────────────────────
  function calcBaseDamage(attacker, defender) {
    const variance = Math.floor(Math.random() * 5) - 2; // -2 to +2
    return Math.max(1, attacker.attack - Math.floor(defender.defense / 2) + variance);
  }

  function applyDamage(target, rawDamage) {
    initStatusEffects(target);
    let damage = rawDamage;

    // Evade check
    if (hasStatus(target, 'evading')) {
      target.statusEffects = target.statusEffects.filter(e => e.type !== 'evading');
      GameState.addMessage(`${target.name} evades the attack!`, 'combat');
      return 0;
    }

    // Vulnerable: +25% damage taken
    if (hasStatus(target, 'vulnerable')) {
      damage = Math.floor(damage * 1.25);
    }

    // Divine shield reduction
    if (hasStatus(target, 'divine_shield')) {
      const ds = getStatus(target, 'divine_shield');
      damage = Math.floor(damage * (1 - ds.reduction));
    }

    // Absorb shield
    if (hasStatus(target, 'shielded')) {
      const shield = getStatus(target, 'shielded');
      if (shield.absorb > 0) {
        const absorbed = Math.min(shield.absorb, damage);
        shield.absorb -= absorbed;
        damage -= absorbed;
        GameState.addMessage(`${target.name}'s shield absorbs ${absorbed} damage.`, 'combat');
        if (shield.absorb <= 0) {
          target.statusEffects = target.statusEffects.filter(e => e.type !== 'shielded');
        }
      }
    }

    target.hp -= damage;
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
    }
    return damage;
  }

  // ── Combat Feedback Helpers ───────────────────────────────
  function hpPercent(entity) {
    return Math.max(0, Math.round((entity.hp / entity.maxHp) * 100));
  }

  function calcReferenceDamage(attacker, defender) {
    return Math.max(1, attacker.attack - Math.floor(defender.defense / 2));
  }

  function postAttackMsg(attacker, defender, dealt, customMsg) {
    const pct = hpPercent(defender);
    const refDmg = calcReferenceDamage(attacker, defender);
    const isCrit = dealt > refDmg * 1.5;
    const hpTag = ` [${pct}% HP]`;
    const baseMsg = customMsg || `${attacker.name} hits ${defender.name} for ${dealt} damage`;
    if (isCrit) {
      GameState.addMessage(`CRITICAL! ${baseMsg}${hpTag}`, 'combat');
      if (defender.alive) {
        addStatusEffect(defender, 'bleed', { duration: 3, damage: 2 });
        GameState.addMessage(`${defender.name} is bleeding!`, 'combat');
      }
    } else {
      GameState.addMessage(`${baseMsg}${hpTag}`, 'combat');
    }
    return isCrit;
  }

  // ── Melee Attack ──────────────────────────────────────────
  function meleeAttack(attacker, defender) {
    const dist = Utils.chebyshevDist(attacker.x, attacker.y, defender.x, defender.y);
    if (dist > 1) {
      GameState.addMessage(`${defender.name} is too far for melee.`, 'combat');
      return false;
    }

    const rawDmg = calcBaseDamage(attacker, defender);
    const dealt = applyDamage(defender, rawDmg);

    if (dealt > 0) {
      postAttackMsg(attacker, defender, dealt);
    }

    if (!defender.alive) {
      onKill(attacker, defender);
    }
    return true;
  }

  // ── Ranged Attack ─────────────────────────────────────────
  function rangedAttack(attacker, defender, range, tiles) {
    const dist = Utils.chebyshevDist(attacker.x, attacker.y, defender.x, defender.y);
    if (dist > range) {
      GameState.addMessage(`${defender.name} is out of range.`, 'combat');
      return false;
    }
    if (!hasLineOfSight(attacker.x, attacker.y, defender.x, defender.y, tiles)) {
      GameState.addMessage(`No line of sight to ${defender.name}.`, 'combat');
      return false;
    }

    const rawDmg = calcBaseDamage(attacker, defender);
    const dealt = applyDamage(defender, rawDmg);

    if (dealt > 0) {
      postAttackMsg(attacker, defender, dealt, `${attacker.name} shoots ${defender.name} for ${dealt} damage`);
    }

    if (!defender.alive) {
      onKill(attacker, defender);
    }
    return true;
  }

  // ── AoE Attack ────────────────────────────────────────────
  function aoeAttack(attacker, targetX, targetY, radius, damageMultiplier, floor) {
    const entities = GameState.getEntitiesOnFloor(floor);
    let hitCount = 0;
    for (const ent of entities) {
      if (ent.id === attacker.id) continue;
      const dist = Utils.chebyshevDist(targetX, targetY, ent.x, ent.y);
      if (dist <= radius) {
        const rawDmg = Math.floor(calcBaseDamage(attacker, ent) * damageMultiplier);
        const dealt = applyDamage(ent, rawDmg);
        if (dealt > 0) {
          const pct = hpPercent(ent);
          GameState.addMessage(`${ent.name} takes ${dealt} AoE damage [${pct}% HP]`, 'combat');
        }
        if (!ent.alive) {
          onKill(attacker, ent);
        }
        hitCount++;
      }
    }
    return hitCount;
  }

  // ── Initiative ────────────────────────────────────────────
  function getInitiativeOrder(entities) {
    return [...entities]
      .filter(e => e.alive)
      .sort((a, b) => b.speed - a.speed || a.id - b.id);
  }

  // ── XP and Leveling ───────────────────────────────────────
  function onKill(killer, victim) {
    GameState.addMessage(`${victim.name} is slain!`, 'combat');
    if (killer.type === 'player' && victim.xpValue) {
      killer.xp += victim.xpValue;
      GameState.addMessage(`+${victim.xpValue} XP`, 'system');
      checkLevelUp(killer);
    }

    // Drop loot at the dead monster's position
    if (window.ItemSystem && ItemSystem.dropLoot) {
      ItemSystem.dropLoot(victim, victim.floor);
    }
  }

  function checkLevelUp(entity) {
    while (entity.level < XP_PER_LEVEL.length) {
      const needed = XP_PER_LEVEL[entity.level - 1];
      if (entity.xp < needed) break;
      entity.xp -= needed;
      entity.level++;
      // Stat increases: +10 HP (partial heal), +3 mana, +3 stamina, +1 atk, +1 def
      entity.maxHp += 10;
      entity.hp = Math.min(entity.hp + 10, entity.maxHp);
      entity.maxMana += 3;
      entity.mana = Math.min(entity.mana + 3, entity.maxMana);
      entity.maxStamina += 3;
      entity.stamina = Math.min(entity.stamina + 3, entity.maxStamina);
      entity.attack += 1;
      entity.defense += 1;
      GameState.addMessage(`${entity.name} reaches level ${entity.level}!`, 'system');
    }
  }

  // ── Ability Definitions ───────────────────────────────────
  const ABILITIES = {
    // ── Warrior ──
    power_strike: {
      name: 'Power Strike',
      cost: { stamina: 20 },
      type: 'melee',
      execute(user, target) {
        const dist = Utils.chebyshevDist(user.x, user.y, target.x, target.y);
        if (dist > 1) return fail('Too far for Power Strike.');
        const rawDmg = calcBaseDamage(user, target) * 2;
        const dealt = applyDamage(target, rawDmg);
        postAttackMsg(user, target, dealt, `${user.name} uses Power Strike on ${target.name} for ${dealt} damage!`);
        if (!target.alive) onKill(user, target);
        return true;
      }
    },

    shield_bash: {
      name: 'Shield Bash',
      cost: { stamina: 15 },
      type: 'melee',
      execute(user, target) {
        const dist = Utils.chebyshevDist(user.x, user.y, target.x, target.y);
        if (dist > 1) return fail('Too far for Shield Bash.');
        const rawDmg = calcBaseDamage(user, target);
        const dealt = applyDamage(target, rawDmg);
        addStatusEffect(target, 'stunned', { duration: 1 });
        postAttackMsg(user, target, dealt, `${user.name} bashes ${target.name} for ${dealt} damage and stuns them!`);
        if (!target.alive) onKill(user, target);
        return true;
      }
    },

    war_cry: {
      name: 'War Cry',
      cost: { stamina: 25 },
      type: 'self',
      execute(user) {
        const amount = 7;
        user.attack += amount;
        addStatusEffect(user, 'buffed', { duration: 3, stat: 'attack', amount });
        GameState.addMessage(`${user.name} lets out a War Cry! Attack +${amount} for 3 turns.`, 'combat');
        return true;
      }
    },

    // ── Mage ──
    fireball: {
      name: 'Fireball',
      cost: { mana: 30 },
      type: 'aoe',
      execute(user, target) {
        const tiles = GameState.getCurrentTiles();
        if (!tiles) return fail('No map data.');
        if (!hasLineOfSight(user.x, user.y, target.x, target.y, tiles)) {
          return fail('No line of sight for Fireball.');
        }
        const hits = aoeAttack(user, target.x, target.y, 2, 2, user.floor);
        GameState.addMessage(`${user.name} casts Fireball! ${hits} targets hit.`, 'combat');
        return true;
      }
    },

    ice_shard: {
      name: 'Ice Shard',
      cost: { mana: 15 },
      type: 'ranged',
      execute(user, target) {
        const tiles = GameState.getCurrentTiles();
        if (!tiles) return fail('No map data.');
        const dist = Utils.chebyshevDist(user.x, user.y, target.x, target.y);
        if (dist > 6) return fail('Out of range for Ice Shard.');
        if (!hasLineOfSight(user.x, user.y, target.x, target.y, tiles)) {
          return fail('No line of sight for Ice Shard.');
        }
        const rawDmg = calcBaseDamage(user, target);
        const dealt = applyDamage(target, rawDmg);
        addStatusEffect(target, 'slowed', { duration: 3 });
        postAttackMsg(user, target, dealt, `${user.name} hurls an Ice Shard at ${target.name} for ${dealt} damage! Target slowed`);
        if (!target.alive) onKill(user, target);
        return true;
      }
    },

    arcane_shield: {
      name: 'Arcane Shield',
      cost: { mana: 25 },
      type: 'self',
      execute(user) {
        addStatusEffect(user, 'shielded', { absorb: 30, duration: 99 });
        GameState.addMessage(`${user.name} conjures an Arcane Shield (absorbs 30 damage).`, 'combat');
        return true;
      }
    },

    // ── Rogue ──
    backstab: {
      name: 'Backstab',
      cost: { stamina: 20 },
      type: 'melee',
      execute(user, target) {
        const dist = Utils.chebyshevDist(user.x, user.y, target.x, target.y);
        if (dist > 1) return fail('Too far for Backstab.');
        // "Behind" = user is on the opposite side from where target is facing
        // Simplified: if there's a player between, or if user approached from behind
        // Use positional check: behind means user is not in front 3 tiles
        const isBehind = isAttackerBehind(user, target);
        const multiplier = isBehind ? 3 : 1.5;
        const rawDmg = Math.floor(calcBaseDamage(user, target) * multiplier);
        const dealt = applyDamage(target, rawDmg);
        const msg = isBehind ? 'Backstab (from behind)' : 'Backstab';
        postAttackMsg(user, target, dealt, `${user.name} uses ${msg} on ${target.name} for ${dealt} damage!`);
        if (!target.alive) onKill(user, target);
        return true;
      }
    },

    evade: {
      name: 'Evade',
      cost: { stamina: 15 },
      type: 'self',
      execute(user) {
        addStatusEffect(user, 'evading', { duration: 1 });
        GameState.addMessage(`${user.name} prepares to evade the next attack.`, 'combat');
        return true;
      }
    },

    poison_blade: {
      name: 'Poison Blade',
      cost: { stamina: 25 },
      type: 'melee',
      execute(user, target) {
        const dist = Utils.chebyshevDist(user.x, user.y, target.x, target.y);
        if (dist > 1) return fail('Too far for Poison Blade.');
        const rawDmg = calcBaseDamage(user, target);
        const dealt = applyDamage(target, rawDmg);
        addStatusEffect(target, 'poisoned', { duration: 5, damage: 3 });
        postAttackMsg(user, target, dealt, `${user.name} poisons ${target.name} for ${dealt} damage! Poisoned for 5 turns`);
        if (!target.alive) onKill(user, target);
        return true;
      }
    },

    // ── Cleric ──
    heal: {
      name: 'Heal',
      cost: { mana: 30 },
      type: 'self',
      execute(user) {
        const amount = Math.min(25, user.maxHp - user.hp);
        user.hp += amount;
        GameState.addMessage(`${user.name} heals for ${amount} HP.`, 'combat');
        return true;
      }
    },

    smite: {
      name: 'Smite',
      cost: { mana: 15 },
      type: 'melee',
      execute(user, target) {
        const dist = Utils.chebyshevDist(user.x, user.y, target.x, target.y);
        if (dist > 1) return fail('Too far for Smite.');
        const isUndead = target.tags && target.tags.includes('undead');
        const multiplier = isUndead ? 2 : 1;
        const rawDmg = Math.floor(calcBaseDamage(user, target) * multiplier);
        const dealt = applyDamage(target, rawDmg);
        const extra = isUndead ? ' (holy damage vs undead!)' : '';
        postAttackMsg(user, target, dealt, `${user.name} smites ${target.name} for ${dealt} damage!${extra}`);
        if (!target.alive) onKill(user, target);
        return true;
      }
    },

    divine_shield: {
      name: 'Divine Shield',
      cost: { mana: 30 },
      type: 'party',
      execute(user) {
        // Apply to all allies on the floor (for now, just the player)
        const allies = GameState.getEntitiesOnFloor(user.floor)
          .filter(e => e.type === 'player' || e.type === 'npc');
        for (const ally of allies) {
          addStatusEffect(ally, 'divine_shield', { duration: 2, reduction: 0.5 });
        }
        GameState.addMessage(`${user.name} invokes Divine Shield! Party takes 50% less damage for 2 turns.`, 'combat');
        return true;
      }
    }
  };

  // ── Helper: check if attacker is behind target ────────────
  function isAttackerBehind(attacker, target) {
    // Determine target's facing based on last known direction
    // Fallback: target faces toward the player if it's a monster
    const player = GameState.getPlayer();
    if (!player || target.type === 'player') return false;
    // Target faces toward player; attacker is behind if on the opposite side
    const faceDx = Math.sign(player.x - target.x);
    const faceDy = Math.sign(player.y - target.y);
    const atkDx = Math.sign(attacker.x - target.x);
    const atkDy = Math.sign(attacker.y - target.y);
    // Behind = attacker direction is opposite to face direction
    return (faceDx !== 0 && atkDx === -faceDx) || (faceDy !== 0 && atkDy === -faceDy);
  }

  function fail(msg) {
    GameState.addMessage(msg, 'combat');
    return false;
  }

  // ── Use Ability ───────────────────────────────────────────
  function useAbility(abilityKey, user, target) {
    const ability = ABILITIES[abilityKey];
    if (!ability) {
      GameState.addMessage(`Unknown ability: ${abilityKey}`, 'system');
      return false;
    }

    // Check stunned
    if (hasStatus(user, 'stunned')) {
      GameState.addMessage(`${user.name} is stunned and cannot act!`, 'combat');
      return false;
    }

    // Check cost
    if (ability.cost) {
      for (const [resource, amount] of Object.entries(ability.cost)) {
        if ((user[resource] || 0) < amount) {
          GameState.addMessage(`${user.name} doesn't have enough ${resource} for ${ability.name}.`, 'combat');
          return false;
        }
      }
      // Deduct cost
      for (const [resource, amount] of Object.entries(ability.cost)) {
        user[resource] -= amount;
      }
    }

    return ability.execute(user, target);
  }

  // ── Process Turn (tick effects for one entity) ────────────
  function processTurnStart(entity) {
    if (!entity.alive) return;

    // Check stun — skip turn if stunned
    if (hasStatus(entity, 'stunned')) {
      GameState.addMessage(`${entity.name} is stunned and skips their turn.`, 'combat');
      // Still tick effects so stun wears off
      tickStatusEffects(entity);
      return false; // Cannot act
    }

    // Tick status effects at start of turn
    tickStatusEffects(entity);

    return true; // Can act
  }

  // ── Class-Based Regeneration ────────────────────────────────
  function regenerate(entity) {
    if (!entity || !entity.alive) return;
    if (GameState.getPhase() !== PHASES.EXPLORING) return;

    const rates = REGEN_RATES[entity.classKey];
    if (!rates) return;

    const parts = [];

    if (rates.hp > 0 && entity.hp < entity.maxHp) {
      const gain = Math.min(rates.hp, entity.maxHp - entity.hp);
      entity.hp += gain;
      parts.push(gain + ' HP');
    }
    if (rates.mana > 0 && entity.mana < entity.maxMana) {
      const gain = Math.min(rates.mana, entity.maxMana - entity.mana);
      entity.mana += gain;
      parts.push(gain + ' mana');
    }
    if (rates.stamina > 0 && entity.stamina < entity.maxStamina) {
      const gain = Math.min(rates.stamina, entity.maxStamina - entity.stamina);
      entity.stamina += gain;
      parts.push(gain + ' stamina');
    }

    if (parts.length > 0) {
      GameState.addMessage('You regenerate ' + parts.join(', ') + '.', 'info');
    }
  }

  // ── Public API ────────────────────────────────────────────
  window.CombatSystem = Object.freeze({
    // Core attacks
    meleeAttack,
    rangedAttack,
    aoeAttack,

    // Abilities
    useAbility,
    getAbilityInfo(key) { return ABILITIES[key] || null; },
    ABILITIES,

    // Status effects
    addStatusEffect,
    hasStatus,
    getStatus,
    tickStatusEffects,

    // Turn management
    getInitiativeOrder,
    processTurnStart,

    // XP / leveling
    onKill,
    checkLevelUp,

    // Regeneration
    regenerate,

    // Utility
    hasLineOfSight,
    bresenhamLine,
    calcBaseDamage,
    applyDamage,
    hpPercent,
    postAttackMsg
  });
})();
