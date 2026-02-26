/**
 * ai.js — Enemy AI system with A* pathfinding and behavior trees
 * Owner: Leonard (Combat + Enemy AI)
 *
 * Processes all monster turns on the current floor.
 * Depends on: constants.js, utils.js, gameState.js, combat.js, monsters.js
 */
(function () {
  'use strict';

  const { MAP_WIDTH, MAP_HEIGHT, WALKABLE_TILES } = Constants;

  // ── Seeded RNG Reference ──────────────────────────────────
  let _rng = null;

  function init(rng) {
    _rng = rng;
  }

  function rng() {
    return _rng ? _rng.random() : Math.random();
  }

  // ── A* Pathfinding ────────────────────────────────────────
  function astar(startX, startY, goalX, goalY, tiles, floor) {
    if (startX === goalX && startY === goalY) return [];

    const key = (x, y) => y * MAP_WIDTH + x;
    const open = new Map();   // key → node
    const closed = new Set();

    const startNode = { x: startX, y: startY, g: 0, h: heuristic(startX, startY, goalX, goalY), parent: null };
    startNode.f = startNode.g + startNode.h;
    open.set(key(startX, startY), startNode);

    while (open.size > 0) {
      // Find node with lowest f
      let current = null;
      for (const node of open.values()) {
        if (!current || node.f < current.f) current = node;
      }

      if (current.x === goalX && current.y === goalY) {
        return reconstructPath(current);
      }

      open.delete(key(current.x, current.y));
      closed.add(key(current.x, current.y));

      // Expand neighbours (8-directional)
      const neighbours = Utils.getAllNeighbours(current.x, current.y);
      for (const n of neighbours) {
        if (n.x < 0 || n.x >= MAP_WIDTH || n.y < 0 || n.y >= MAP_HEIGHT) continue;
        const nKey = key(n.x, n.y);
        if (closed.has(nKey)) continue;
        if (!WALKABLE_TILES.has(tiles[n.y][n.x])) continue;

        // Allow moving to the goal even if occupied (we want to reach adjacency)
        const occupant = GameState.getEntityAt(n.x, n.y, floor);
        if (occupant && occupant.alive && !(n.x === goalX && n.y === goalY)) continue;

        const isDiag = n.x !== current.x && n.y !== current.y;
        const moveCost = isDiag ? 1.41 : 1;
        const tentG = current.g + moveCost;

        const existing = open.get(nKey);
        if (existing && tentG >= existing.g) continue;

        const node = {
          x: n.x, y: n.y,
          g: tentG,
          h: heuristic(n.x, n.y, goalX, goalY),
          parent: current
        };
        node.f = node.g + node.h;
        open.set(nKey, node);
      }
    }

    return null; // No path found
  }

  function heuristic(x1, y1, x2, y2) {
    // Chebyshev distance for 8-directional movement
    return Utils.chebyshevDist(x1, y1, x2, y2);
  }

  function reconstructPath(node) {
    const path = [];
    let cur = node;
    while (cur.parent) {
      path.unshift({ x: cur.x, y: cur.y });
      cur = cur.parent;
    }
    return path;
  }

  // ── Movement Helper ───────────────────────────────────────
  function moveToward(entity, targetX, targetY, tiles) {
    const path = astar(entity.x, entity.y, targetX, targetY, tiles, entity.floor);
    if (path && path.length > 0) {
      const next = path[0];
      // Don't walk onto an occupied tile
      const occupant = GameState.getEntityAt(next.x, next.y, entity.floor);
      if (!occupant || !occupant.alive) {
        entity.x = next.x;
        entity.y = next.y;
        return true;
      }
    }
    return false;
  }

  // ── Find Flanking Position ────────────────────────────────
  function findFlankPosition(entity, target, tiles) {
    // Try to get to a tile adjacent to target that is NOT between entity and target
    const neighbours = Utils.getAllNeighbours(target.x, target.y);
    const candidates = neighbours
      .filter(n => {
        if (n.x < 0 || n.x >= MAP_WIDTH || n.y < 0 || n.y >= MAP_HEIGHT) return false;
        if (!WALKABLE_TILES.has(tiles[n.y][n.x])) return false;
        const occ = GameState.getEntityAt(n.x, n.y, entity.floor);
        if (occ && occ.alive && occ.id !== entity.id) return false;
        return true;
      })
      .map(n => ({
        ...n,
        // Prefer tiles on the opposite side from entity's current position
        score: Utils.chebyshevDist(n.x, n.y, entity.x, entity.y)
      }))
      .sort((a, b) => b.score - a.score); // Furthest = most flanky

    return candidates.length > 0 ? candidates[0] : null;
  }

  // ── Find Retreat Position ─────────────────────────────────
  function findRetreatPosition(entity, threat, tiles) {
    // Move away from threat
    const dx = Math.sign(entity.x - threat.x);
    const dy = Math.sign(entity.y - threat.y);
    const candidates = [
      { x: entity.x + dx, y: entity.y + dy },
      { x: entity.x + dx, y: entity.y },
      { x: entity.x, y: entity.y + dy }
    ];

    for (const c of candidates) {
      if (c.x < 0 || c.x >= MAP_WIDTH || c.y < 0 || c.y >= MAP_HEIGHT) continue;
      if (!WALKABLE_TILES.has(tiles[c.y][c.x])) continue;
      const occ = GameState.getEntityAt(c.x, c.y, entity.floor);
      if (occ && occ.alive) continue;
      return c;
    }
    return null;
  }

  // ── AI Behavior Implementations ───────────────────────────

  function behaviorAggressive(entity, player, tiles) {
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);

    // Adjacent — attack
    if (dist <= 1) {
      // Use abilities if available and have resources
      if (entity.abilities.length > 0 && rng() < 0.3) {
        const abilityKey = entity.abilities[Math.floor(rng() * entity.abilities.length)];
        if (CombatSystem.useAbility(abilityKey, entity, player)) return;
      }
      CombatSystem.meleeAttack(entity, player);
      return;
    }

    // Move toward player
    moveToward(entity, player.x, player.y, tiles);
  }

  function behaviorFlanking(entity, player, tiles) {
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);

    // Adjacent — attack (prefer backstab-style abilities)
    if (dist <= 1) {
      if (entity.abilities.length > 0 && rng() < 0.4) {
        const abilityKey = entity.abilities[Math.floor(rng() * entity.abilities.length)];
        if (CombatSystem.useAbility(abilityKey, entity, player)) return;
      }
      CombatSystem.meleeAttack(entity, player);
      return;
    }

    // Try to flank
    const flankPos = findFlankPosition(entity, player, tiles);
    if (flankPos) {
      moveToward(entity, flankPos.x, flankPos.y, tiles);
    } else {
      moveToward(entity, player.x, player.y, tiles);
    }
  }

  function behaviorCautious(entity, player, tiles) {
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);
    const hpPercent = entity.hp / entity.maxHp;

    // Low HP — retreat and heal if possible
    if (hpPercent < 0.3) {
      // Try to heal
      if (entity.abilities.includes('heal') && entity.mana >= 30) {
        CombatSystem.useAbility('heal', entity, entity);
        return;
      }
      // Retreat
      const retreat = findRetreatPosition(entity, player, tiles);
      if (retreat) {
        entity.x = retreat.x;
        entity.y = retreat.y;
        return;
      }
    }

    // Normal combat behavior
    if (dist <= 1) {
      if (entity.abilities.length > 0 && rng() < 0.3) {
        const abilityKey = entity.abilities[Math.floor(rng() * entity.abilities.length)];
        if (CombatSystem.useAbility(abilityKey, entity, player)) return;
      }
      CombatSystem.meleeAttack(entity, player);
      return;
    }

    moveToward(entity, player.x, player.y, tiles);
  }

  function behaviorRanged(entity, player, tiles) {
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);
    const hasLOS = CombatSystem.hasLineOfSight(entity.x, entity.y, player.x, player.y, tiles);

    // Optimal range: 3–5 tiles
    const tooClose = dist < 3;
    const tooFar = dist > 6;

    // Too close — retreat
    if (tooClose) {
      // Still attack if possible
      if (hasLOS && entity.abilities.length > 0) {
        const abilityKey = entity.abilities[Math.floor(rng() * entity.abilities.length)];
        CombatSystem.useAbility(abilityKey, entity, player);
      }
      const retreat = findRetreatPosition(entity, player, tiles);
      if (retreat) {
        entity.x = retreat.x;
        entity.y = retreat.y;
      }
      return;
    }

    // In range with LOS — use ranged ability
    if (!tooFar && hasLOS && entity.abilities.length > 0) {
      const abilityKey = entity.abilities[Math.floor(rng() * entity.abilities.length)];
      if (CombatSystem.useAbility(abilityKey, entity, player)) return;
    }

    // Adjacent fallback — melee
    if (dist <= 1) {
      CombatSystem.meleeAttack(entity, player);
      return;
    }

    // Move to get into range or LOS
    if (tooFar || !hasLOS) {
      moveToward(entity, player.x, player.y, tiles);
    }
  }

  // ── Boss Minion Summoning Helper ────────────────────────────
  function summonMinions(entity, tiles, count) {
    const neighbours = Utils.getAllNeighbours(entity.x, entity.y);
    let summoned = 0;
    for (const n of neighbours) {
      if (summoned >= count) break;
      if (n.x < 0 || n.x >= MAP_WIDTH || n.y < 0 || n.y >= MAP_HEIGHT) continue;
      if (!WALKABLE_TILES.has(tiles[n.y][n.x])) continue;
      if (GameState.getEntityAt(n.x, n.y, entity.floor)) continue;
      const minion = window.MonsterFactory.createMonster('dragon_whelp', entity.floor, n.x, n.y);
      if (minion) {
        GameState.addEntity(minion);
        summoned++;
      }
    }
    return summoned;
  }

  function countActiveMinions(entity) {
    return GameState.getEntitiesOnFloor(entity.floor)
      .filter(e => e.type === 'monster' && e.alive && e.templateKey === 'dragon_whelp').length;
  }

  // ── Boss Regular Action Helper ────────────────────────────
  function bossRegularAction(entity, player, tiles) {
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);

    // Use war_cry if not buffed
    if (!CombatSystem.hasStatus(entity, 'buffed') && entity.abilities.includes('war_cry') && entity.stamina >= 25) {
      CombatSystem.useAbility('war_cry', entity, entity);
      return;
    }

    // Use fireball if player is at medium range
    if (dist >= 2 && dist <= 5 && entity.abilities.includes('fireball') && entity.mana >= 30) {
      const hasLOS = CombatSystem.hasLineOfSight(entity.x, entity.y, player.x, player.y, tiles);
      if (hasLOS) {
        CombatSystem.useAbility('fireball', entity, player);
        return;
      }
    }

    // Adjacent — power strike or melee
    if (dist <= 1) {
      if (entity.abilities.includes('power_strike') && entity.stamina >= 20 && rng() < 0.5) {
        CombatSystem.useAbility('power_strike', entity, player);
        return;
      }
      CombatSystem.meleeAttack(entity, player);
      return;
    }

    // Move toward player
    moveToward(entity, player.x, player.y, tiles);
  }

  function behaviorBoss(entity, player, tiles) {
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);
    const hpPct = entity.hp / entity.maxHp;

    // Enrage at 25% HP: +2 speed, attacks twice per turn
    if (hpPct <= 0.25 && !entity._enraged) {
      entity._enraged = true;
      entity.speed += 2;
      GameState.addMessage(`${entity.name} enters a furious rage! Speed increased!`, 'combat');
    }

    const activeMinions = countActiveMinions(entity);

    // Phase 2: summon 2 minions at 50% HP
    if (hpPct <= 0.5 && !entity._summonedPhase2) {
      entity._summonedPhase2 = true;
      const toSummon = Math.min(2, 4 - activeMinions);
      if (toSummon > 0) {
        GameState.addMessage(`${entity.name} roars and summons minions!`, 'combat');
        summonMinions(entity, tiles, toSummon);
      }
      return; // Summoning takes the turn
    }

    // Phase 3: summon 3 minions at 25% HP (respecting cap of 4 active)
    if (hpPct <= 0.25 && !entity._summonedPhase3) {
      entity._summonedPhase3 = true;
      const toSummon = Math.min(3, 4 - countActiveMinions(entity));
      if (toSummon > 0) {
        GameState.addMessage(`${entity.name} roars and summons more minions!`, 'combat');
        summonMinions(entity, tiles, toSummon);
      }
      return;
    }

    // Execute telegraphed heavy attack
    if (entity._telegraphing) {
      entity._telegraphing = false;
      if (dist <= 1) {
        const rawDmg = Math.floor(CombatSystem.calcBaseDamage(entity, player) * 3);
        const dealt = CombatSystem.applyDamage(player, rawDmg);
        CombatSystem.postAttackMsg(entity, player, dealt, `${entity.name} unleashes a devastating attack on ${player.name} for ${dealt} damage!`);
        if (!player.alive) {
          GameState.addMessage(`${player.name} is slain!`, 'combat');
        }
      } else {
        CombatSystem.aoeAttack(entity, player.x, player.y, 2, 2.5, entity.floor);
        GameState.addMessage(`${entity.name} breathes a torrent of fire!`, 'combat');
      }
      // Enraged boss gets a second action even after telegraph
      if (entity._enraged && player.alive) {
        bossRegularAction(entity, player, tiles);
      }
      return;
    }

    // Chance to telegraph a heavy attack below 50% HP
    if (hpPct <= 0.5 && rng() < 0.2) {
      entity._telegraphing = true;
      GameState.addMessage(`${entity.name} draws a deep breath...`, 'combat');
      if (entity._enraged && player.alive) {
        bossRegularAction(entity, player, tiles);
      }
      return;
    }

    // Regular boss action
    bossRegularAction(entity, player, tiles);

    // Enraged: second attack
    if (entity._enraged && player.alive) {
      bossRegularAction(entity, player, tiles);
    }
  }

  // ── AI Behavior Dispatch ──────────────────────────────────
  const BEHAVIORS = {
    aggressive: behaviorAggressive,
    flanking:   behaviorFlanking,
    cautious:   behaviorCautious,
    ranged:     behaviorRanged,
    boss:       behaviorBoss
  };

  // ── Process single monster ────────────────────────────────
  function processMonsterTurn(entity, player, tiles) {
    if (!entity.alive || entity.type !== 'monster') return;

    // Process turn start (status effects, stun check)
    const canAct = CombatSystem.processTurnStart(entity);
    if (!canAct) return;

    // Slowed monsters skip every other turn
    if (CombatSystem.hasStatus(entity, 'slowed') && GameState.getTurnCounter() % 2 === 0) {
      GameState.addMessage(`${entity.name} is slowed and moves sluggishly.`, 'combat');
      return;
    }

    // Detection range — only act if player is within 10 tiles
    const dist = Utils.chebyshevDist(entity.x, entity.y, player.x, player.y);
    if (dist > 10) return;

    // Dispatch to behavior
    const behavior = BEHAVIORS[entity.ai] || BEHAVIORS.aggressive;
    behavior(entity, player, tiles);
  }

  // ── Process All Monsters on Floor ─────────────────────────
  function processAllMonsters() {
    const player = GameState.getPlayer();
    if (!player || !player.alive) return;

    const floor = GameState.getCurrentFloor();
    const tiles = GameState.getCurrentTiles();
    if (!tiles) return;

    const monsters = GameState.getEntitiesOnFloor(floor)
      .filter(e => e.type === 'monster' && e.alive);

    // Sort by initiative (speed)
    const ordered = CombatSystem.getInitiativeOrder(monsters);

    for (const monster of ordered) {
      if (!player.alive) break; // Stop if player dies
      processMonsterTurn(monster, player, tiles);
    }
  }

  // ── Public API ────────────────────────────────────────────
  window.AISystem = Object.freeze({
    // Initialization
    init,

    // Pathfinding
    astar,
    moveToward,

    // AI processing
    processMonsterTurn,
    processAllMonsters,

    // Utility (exposed for other systems)
    findFlankPosition,
    findRetreatPosition,
    BEHAVIORS
  });
})();
