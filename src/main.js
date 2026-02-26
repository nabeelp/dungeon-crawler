/**
 * main.js — Game Loop, Input Handling, Game Flow
 * Owner: Howard (Rendering + Fog of War)
 *
 * Main entry point: game loop (requestAnimationFrame), keyboard input,
 * turn processing, save/load, stair transitions, permadeath.
 *
 * Depends on: All other modules (loaded last)
 */
(function () {
  'use strict';

  const { TILES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, MAX_FLOORS, FOV_RADIUS,
          PHASES, CLASSES, WALKABLE_TILES, XP_PER_LEVEL } = Constants;

  let canvas = null;
  let visibleTiles = new Set();
  let running = false;
  let needsRender = true;

  // ── Initialization ─────────────────────────────────────────
  function init() {
    canvas = document.getElementById('game');
    Renderer.init(canvas);
    HUD.resetTitleState();

    // Try loading a saved game
    if (loadGame()) {
      recomputeFOV();
      GameState.addMessage('Welcome back!', 'system');
    } else {
      GameState.setPhase(PHASES.TITLE);
    }

    setupInput();
    setupAutoSave();
    needsRender = true;
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(gameLoop);
  }

  // ── Game Loop ──────────────────────────────────────────────
  function gameLoop() {
    if (!running) return;

    // Continuous rendering during active animations (shake, particles)
    if (Renderer.hasActiveAnimations()) {
      needsRender = true;
    }

    if (needsRender) {
      Renderer.render(visibleTiles);
      HUD.render(visibleTiles);
      needsRender = false;
    }

    requestAnimationFrame(gameLoop);
  }

  function requestRender() {
    needsRender = true;
  }

  // ── FOV Recomputation ──────────────────────────────────────
  function recomputeFOV() {
    const player = GameState.getPlayer();
    if (!player) return;
    const floorData = GameState.getFloorData(GameState.getCurrentFloor());
    if (!floorData) return;

    visibleTiles = FOVSystem.compute(player.x, player.y, FOV_RADIUS, floorData.tiles);
    FOVSystem.updateExplored(floorData.explored, visibleTiles);
  }

  // ── New Game Flow ──────────────────────────────────────────
  function startNewGame() {
    const ts = HUD.getTitleState();
    const classKey = ts.classKeys[ts.selectedClass];
    const playerName = ts.playerName.trim() || 'Hero';

    GameState.newGame(Date.now());

    // Generate floor 0
    const floorData = DungeonGenerator.generate(0, GameState.state.seed);
    GameState.setFloorData(0, floorData);

    // Place player at first room center
    const firstRoom = floorData.rooms[0];
    const startX = Math.floor(firstRoom.x + firstRoom.w / 2);
    const startY = Math.floor(firstRoom.y + firstRoom.h / 2);

    const player = GameState.createEntity({
      name: playerName,
      type: 'player',
      classKey: classKey,
      x: startX,
      y: startY,
      floor: 0
    });
    GameState.addEntity(player);
    GameState.setPlayer(player);

    // Initialize item identification system before any items are generated
    if (window.ItemSystem && ItemSystem.init) {
      const idRng = Utils.createRNG(GameState.state.seed + 999);
      ItemSystem.init(idRng);
    }

    // Spawn monsters if MonsterFactory is available
    if (window.MonsterFactory && MonsterFactory.spawnForFloor) {
      const rng = Utils.createRNG(GameState.state.seed);
      MonsterFactory.spawnForFloor(0, floorData.rooms, rng);
    }

    // Spawn items if ItemSystem is available
    if (window.ItemSystem && ItemSystem.placeItemsOnFloor) {
      const rng = Utils.createRNG(GameState.state.seed + 500);
      ItemSystem.placeItemsOnFloor(0, floorData.rooms, rng);
    }

    recomputeFOV();
    requestRender();
  }

  // ── Player Action Processing ───────────────────────────────
  function processPlayerAction(action) {
    const phase = GameState.getPhase();
    if (phase !== PHASES.EXPLORING && phase !== PHASES.COMBAT) return;

    const player = GameState.getPlayer();
    if (!player || !player.alive) return;

    let acted = false;

    if (action.type === 'move') {
      acted = tryMove(player, action.dx, action.dy);
    } else if (action.type === 'descend') {
      acted = tryDescend(player);
    } else if (action.type === 'ascend') {
      acted = tryAscend(player);
    } else if (action.type === 'pickup') {
      acted = tryPickup(player);
    } else if (action.type === 'ability') {
      acted = tryAbility(player, action.index);
    } else if (action.type === 'wait') {
      acted = true;
    }

    if (acted) {
      // Enemy turns
      if (window.AISystem && AISystem.processAllMonsters) {
        AISystem.processAllMonsters();
      }

      GameState.advanceTurn();
      recomputeFOV();

      // Check combat phase
      checkCombatPhase();

      // Tick buff/debuff timers for all entities on the current floor
      if (window.ItemSystem && ItemSystem.tickBuffs) {
        ItemSystem.tickBuffs(player);
        const floorEntities = GameState.getEntitiesOnFloor(GameState.getCurrentFloor());
        for (const ent of floorEntities) {
          if (ent.type !== 'player' && ent.alive) {
            ItemSystem.tickBuffs(ent);
          }
        }
      }

      // Class-based resource regeneration (exploring only)
      if (window.CombatSystem && CombatSystem.regenerate) {
        CombatSystem.regenerate(player);
      }

      // Check player death
      if (player.hp <= 0) {
        player.alive = false;
        handleDeath(player);
      }

      requestRender();
    }
  }

  function tryMove(player, dx, dy) {
    const newX = player.x + dx;
    const newY = player.y + dy;

    if (!Utils.inBounds(newX, newY)) return false;

    const tiles = GameState.getCurrentTiles();
    if (!tiles) return false;

    const tileType = tiles[newY][newX];
    if (!WALKABLE_TILES.has(tileType)) return false;

    // Check for entity at target
    const target = GameState.getEntityAt(newX, newY, player.floor);
    if (target && target.type === 'monster' && target.alive) {
      // Attack the monster
      if (window.CombatSystem && CombatSystem.meleeAttack) {
        CombatSystem.meleeAttack(player, target);
        // XP and level-up handled by CombatSystem.onKill()
      } else {
        // Fallback: simple damage
        const dmg = Math.max(1, player.attack - target.defense);
        target.hp -= dmg;
        GameState.addMessage('You hit ' + target.name + ' for ' + dmg + ' damage!', 'combat');
        if (target.hp <= 0) {
          target.alive = false;
          GameState.addMessage(target.name + ' is defeated!', 'combat');
          player.xp += (target.level || 1) * 10;
          checkLevelUp(player);
        }
      }
      return true;
    }

    // Move player
    player.x = newX;
    player.y = newY;

    // Check for trap
    if (tileType === TILES.TRAP) {
      const trapDmg = Utils.createRNG(Date.now()).randInt(3, 8);
      player.hp -= trapDmg;
      GameState.addMessage('You triggered a trap! ' + trapDmg + ' damage!', 'combat');
    }

    // Check for items on ground
    const groundItems = GameState.getGroundItemsAt(newX, newY, player.floor);
    if (groundItems.length > 0) {
      GameState.addMessage('You see items here. Press G to pick up.', 'loot');
    }

    return true;
  }

  function tryDescend(player) {
    const tiles = GameState.getCurrentTiles();
    if (!tiles) return false;
    if (tiles[player.y][player.x] !== TILES.STAIRS_DOWN) {
      GameState.addMessage('No stairs going down here.', 'system');
      return false;
    }

    const nextFloor = GameState.getCurrentFloor() + 1;
    if (nextFloor >= MAX_FLOORS) {
      // Victory!
      GameState.setPhase(PHASES.VICTORY);
      handleVictory(player);
      requestRender();
      return false;
    }

    changeFloor(nextFloor, 'down');
    return true;
  }

  function tryAscend(player) {
    const tiles = GameState.getCurrentTiles();
    if (!tiles) return false;
    if (tiles[player.y][player.x] !== TILES.STAIRS_UP) {
      GameState.addMessage('No stairs going up here.', 'system');
      return false;
    }

    const prevFloor = GameState.getCurrentFloor() - 1;
    if (prevFloor < 0) {
      GameState.addMessage('You cannot leave the dungeon!', 'system');
      return false;
    }

    changeFloor(prevFloor, 'up');
    return true;
  }

  function changeFloor(targetFloor, direction) {
    const player = GameState.getPlayer();

    // Generate floor if needed
    let floorData = GameState.getFloorData(targetFloor);
    if (!floorData) {
      floorData = DungeonGenerator.generate(targetFloor, GameState.state.seed);
      GameState.setFloorData(targetFloor, floorData);

      // Spawn monsters and items
      if (window.MonsterFactory && MonsterFactory.spawnForFloor) {
        const rng = Utils.createRNG(GameState.state.seed + targetFloor * 100);
        MonsterFactory.spawnForFloor(targetFloor, floorData.rooms, rng);
      }
      if (window.ItemSystem && ItemSystem.placeItemsOnFloor) {
        const rng = Utils.createRNG(GameState.state.seed + targetFloor * 100 + 500);
        ItemSystem.placeItemsOnFloor(targetFloor, floorData.rooms, rng);
      }
    }

    // Position player at appropriate stairs
    if (direction === 'down' && floorData.stairs.up) {
      player.x = floorData.stairs.up.x;
      player.y = floorData.stairs.up.y;
    } else if (direction === 'up' && floorData.stairs.down) {
      player.x = floorData.stairs.down.x;
      player.y = floorData.stairs.down.y;
    } else {
      // Fallback: center of first room
      const room = floorData.rooms[0];
      player.x = Math.floor(room.x + room.w / 2);
      player.y = Math.floor(room.y + room.h / 2);
    }

    player.floor = targetFloor;
    GameState.setCurrentFloor(targetFloor);
    GameState.addMessage('You ' + (direction === 'down' ? 'descend' : 'ascend') +
      ' to floor ' + (targetFloor + 1) + '.', 'system');

    recomputeFOV();
  }

  function tryPickup(player) {
    const items = GameState.getGroundItemsAt(player.x, player.y, player.floor);
    if (items.length === 0) {
      GameState.addMessage('Nothing to pick up here.', 'system');
      return false;
    }

    const item = items[0];
    if (window.ItemSystem && ItemSystem.pickupItem) {
      ItemSystem.pickupItem(player, item);
    } else {
      player.inventory.push(item);
      GameState.removeGroundItem(item.id);
      GameState.addMessage('Picked up ' + item.name + '.', 'loot');
    }
    return true;
  }

  function tryAbility(player, index) {
    if (index < 0 || index >= player.abilities.length) return false;

    if (window.CombatSystem && CombatSystem.useAbility) {
      const abilityKey = player.abilities[index];
      if (!abilityKey) return false;

      // Find nearest enemy as target
      const enemies = GameState.getEntitiesOnFloor(player.floor)
        .filter(e => e.type === 'monster' && e.alive);
      let nearest = null;
      let nearestDist = Infinity;
      for (const e of enemies) {
        const d = Utils.manhattanDist(player.x, player.y, e.x, e.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = e;
        }
      }
      if (nearest && nearestDist <= FOV_RADIUS) {
        CombatSystem.useAbility(abilityKey, player, nearest);
        return true;
      } else {
        GameState.addMessage('No target in range.', 'combat');
        return false;
      }
    }
    return false;
  }

  function checkCombatPhase() {
    const player = GameState.getPlayer();
    if (!player) return;

    const enemies = GameState.getEntitiesOnFloor(player.floor)
      .filter(e => e.type === 'monster' && e.alive);

    let inCombat = false;
    for (const e of enemies) {
      if (visibleTiles.has(e.x + ',' + e.y)) {
        const dist = Utils.chebyshevDist(player.x, player.y, e.x, e.y);
        if (dist <= 2) {
          inCombat = true;
          break;
        }
      }
    }

    GameState.setPhase(inCombat ? PHASES.COMBAT : PHASES.EXPLORING);
  }

  function checkLevelUp(player) {
    const xpNeeded = XP_PER_LEVEL[player.level - 1] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
    while (player.xp >= xpNeeded && player.level < 20) {
      player.xp -= xpNeeded;
      player.level++;
      player.maxHp += 10;
      player.hp = player.maxHp;
      player.attack += 2;
      player.defense += 1;
      GameState.addMessage('Level up! You are now level ' + player.level + '!', 'system');
    }
  }

  // ── Death / Victory ────────────────────────────────────────
  function handleDeath(player) {
    GameState.setPhase(PHASES.DEAD);
    GameState.addMessage('You have been slain!', 'system');

    const score = HUD.calculateScore(player);
    HUD.saveHighScore({
      name: player.name,
      className: player.classKey ? CLASSES[player.classKey].name : 'Adventurer',
      floor: GameState.getCurrentFloor() + 1,
      level: player.level,
      score: score,
      date: new Date().toISOString()
    });

    // Delete save on death (permadeath)
    localStorage.removeItem('dc_save');
  }

  function handleVictory(player) {
    const score = HUD.calculateScore(player) * 2;
    HUD.saveHighScore({
      name: player.name,
      className: player.classKey ? CLASSES[player.classKey].name : 'Adventurer',
      floor: MAX_FLOORS,
      level: player.level,
      score: score,
      date: new Date().toISOString()
    });

    localStorage.removeItem('dc_save');
  }

  // ── Save / Load ────────────────────────────────────────────
  function saveGame() {
    const phase = GameState.getPhase();
    if (phase === PHASES.TITLE || phase === PHASES.DEAD || phase === PHASES.VICTORY) return;

    try {
      const state = GameState.state;
      const idState = window.ItemSystem && ItemSystem.getIdentificationState ? ItemSystem.getIdentificationState() : null;
      const saveData = {
        phase: state.phase,
        currentFloor: state.currentFloor,
        turnCounter: state.turnCounter,
        seed: state.seed,
        floors: state.floors,
        entities: state.entities,
        player: state.player,
        groundItems: state.groundItems,
        messages: state.messages.slice(0, 50),
        identificationState: idState
      };
      localStorage.setItem('dc_save', JSON.stringify(saveData));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem('dc_save');
      if (!raw) return false;

      const data = JSON.parse(raw);
      const state = GameState.state;

      state.phase = data.phase || PHASES.EXPLORING;
      state.currentFloor = data.currentFloor || 0;
      state.turnCounter = data.turnCounter || 0;
      state.seed = data.seed || Date.now();

      // Restore floors
      state.floors = new Array(MAX_FLOORS).fill(null);
      for (let i = 0; i < data.floors.length; i++) {
        if (data.floors[i]) {
          const fd = data.floors[i];
          // Restore explored as proper booleans
          if (fd.explored) {
            for (let y = 0; y < fd.explored.length; y++) {
              for (let x = 0; x < fd.explored[y].length; x++) {
                fd.explored[y][x] = !!fd.explored[y][x];
              }
            }
          }
          state.floors[i] = fd;
        }
      }

      // Restore entities
      state.entities = data.entities || [];
      state.player = data.player || null;
      state.groundItems = data.groundItems || [];
      state.messages = data.messages || [];

      // Restore item identification state
      if (data.identificationState && window.ItemSystem && ItemSystem.restoreIdentificationState) {
        ItemSystem.restoreIdentificationState(data.identificationState);
      }

      return true;
    } catch (e) {
      console.warn('Load failed:', e);
      localStorage.removeItem('dc_save');
      return false;
    }
  }

  function setupAutoSave() {
    window.addEventListener('beforeunload', () => {
      saveGame();
    });
  }

  // ── Input Handling ─────────────────────────────────────────
  function setupInput() {
    window.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    const phase = GameState.getPhase();

    if (phase === PHASES.TITLE) {
      handleTitleInput(e);
      return;
    }

    if (phase === PHASES.DEAD || phase === PHASES.VICTORY) {
      if (e.key === 'Enter') {
        HUD.resetTitleState();
        GameState.setPhase(PHASES.TITLE);
        requestRender();
      }
      return;
    }

    // Help overlay intercepts all input when visible
    if (HUD.isHelpVisible()) {
      if (e.key === '?' || e.key === 'h' || e.key === 'H' || e.key === 'Escape') {
        HUD.toggleHelp();
        requestRender();
      }
      return;
    }

    // Inventory overlay intercepts all input when visible
    if (HUD.isInventoryVisible()) {
      handleInventoryInput(e);
      return;
    }

    // In-game input
    if (phase === PHASES.EXPLORING || phase === PHASES.COMBAT) {
      handleGameInput(e);
    }
  }

  function handleTitleInput(e) {
    const ts = HUD.getTitleState();

    if (e.key === 'Tab') {
      e.preventDefault();
      ts.inputActive = !ts.inputActive;
      requestRender();
      return;
    }

    if (ts.inputActive) {
      // Name input mode
      if (e.key === 'Backspace') {
        ts.playerName = ts.playerName.slice(0, -1);
      } else if (e.key === 'Enter') {
        ts.inputActive = false;
        startNewGame();
      } else if (e.key === 'Escape') {
        ts.inputActive = false;
      } else if (e.key.length === 1 && ts.playerName.length < 16) {
        ts.playerName += e.key;
      }
      requestRender();
      return;
    }

    // Class selection
    if (e.key === 'ArrowUp' || e.key === 'w') {
      ts.selectedClass = (ts.selectedClass - 1 + ts.classKeys.length) % ts.classKeys.length;
      requestRender();
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      ts.selectedClass = (ts.selectedClass + 1) % ts.classKeys.length;
      requestRender();
    } else if (e.key === 'Enter') {
      startNewGame();
    }
  }

  function handleGameInput(e) {
    const key = e.key;

    // Help toggle
    if (key === '?' || key === 'h' || key === 'H') {
      HUD.toggleHelp();
      requestRender();
      return;
    }

    // Inventory toggle
    if (key === 'i' || key === 'I') {
      HUD.toggleInventory();
      requestRender();
      return;
    }

    // Movement (arrow keys + WASD)
    const moveMap = {
      'ArrowUp':    { dx: 0, dy: -1 },
      'ArrowDown':  { dx: 0, dy:  1 },
      'ArrowLeft':  { dx: -1, dy: 0 },
      'ArrowRight': { dx: 1,  dy: 0 },
      'w':          { dx: 0, dy: -1 },
      's':          { dx: 0, dy:  1 },
      'a':          { dx: -1, dy: 0 },
      'd':          { dx: 1,  dy: 0 }
    };

    if (moveMap[key]) {
      e.preventDefault();
      processPlayerAction({ type: 'move', ...moveMap[key] });
      return;
    }

    // Stairs
    if (key === '>' || key === '.') {
      processPlayerAction({ type: 'descend' });
      return;
    }
    if (key === '<' || key === ',') {
      processPlayerAction({ type: 'ascend' });
      return;
    }

    // Pick up
    if (key === 'g' || key === 'G') {
      processPlayerAction({ type: 'pickup' });
      return;
    }

    // Wait
    if (key === ' ' || key === '5') {
      processPlayerAction({ type: 'wait' });
      return;
    }

    // Abilities (1-9)
    if (key >= '1' && key <= '9') {
      processPlayerAction({ type: 'ability', index: parseInt(key) - 1 });
      return;
    }
  }

  // ── Inventory Input Handling ───────────────────────────────
  function handleInventoryInput(e) {
    const key = e.key;
    const player = GameState.getPlayer();
    if (!player) return;

    const items = player.inventory || [];
    let idx = HUD.getInventoryIndex();

    // Close inventory
    if (key === 'Escape' || key === 'i' || key === 'I') {
      HUD.closeInventory();
      requestRender();
      return;
    }

    // Navigate
    if (key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) {
        idx = (idx - 1 + items.length) % items.length;
        HUD.setInventoryIndex(idx);
      }
      requestRender();
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) {
        idx = (idx + 1) % items.length;
        HUD.setInventoryIndex(idx);
      }
      requestRender();
      return;
    }

    if (items.length === 0) return;
    if (idx >= items.length) idx = items.length - 1;
    const item = items[idx];
    if (!item) return;

    // Equip / Unequip
    if (key === 'e' || key === 'E') {
      if (isItemEquippedMain(player, item)) {
        // Unequip
        if (window.ItemSystem && ItemSystem.unequipItem && item.slot) {
          ItemSystem.unequipItem(player, item.slot);
          GameState.addMessage('Unequipped ' + ((window.ItemSystem && ItemSystem.getDisplayName) ? ItemSystem.getDisplayName(item) : item.name) + '.', 'loot');
        }
      } else {
        // Equip
        if (window.ItemSystem && ItemSystem.equipItem) {
          ItemSystem.equipItem(player, item);
        } else if (item.slot) {
          player.equipment[item.slot] = item;
          GameState.addMessage('Equipped ' + item.name + '.', 'loot');
        }
      }
      requestRender();
      return;
    }

    // Use item (potions/scrolls/food)
    if (key === 'u' || key === 'U') {
      if (window.ItemSystem && ItemSystem.useItem) {
        ItemSystem.useItem(player, item);
      } else {
        GameState.addMessage('Cannot use ' + item.name + '.', 'system');
      }
      // Clamp index after removal
      if (HUD.getInventoryIndex() >= player.inventory.length) {
        HUD.setInventoryIndex(Math.max(0, player.inventory.length - 1));
      }
      requestRender();
      return;
    }

    // Drop item
    if (key === 'd' || key === 'D') {
      if (window.ItemSystem && ItemSystem.dropItem) {
        ItemSystem.dropItem(player, item);
      } else {
        // Fallback: manual drop
        const dropIdx = player.inventory.indexOf(item);
        if (dropIdx !== -1) {
          player.inventory.splice(dropIdx, 1);
          item.x = player.x;
          item.y = player.y;
          item.floor = player.floor;
          GameState.addGroundItem(item);
          GameState.addMessage('Dropped ' + item.name + '.', 'loot');
        }
      }
      if (HUD.getInventoryIndex() >= player.inventory.length) {
        HUD.setInventoryIndex(Math.max(0, player.inventory.length - 1));
      }
      requestRender();
      return;
    }
  }

  function isItemEquippedMain(player, item) {
    if (!player.equipment) return false;
    for (const slot of Object.keys(player.equipment)) {
      if (player.equipment[slot] && player.equipment[slot].id === item.id) return true;
    }
    return false;
  }

  // ── Public API ─────────────────────────────────────────────
  window.Game = Object.freeze({
    init,
    start,
    processPlayerAction,
    requestRender,
    recomputeFOV,
    saveGame,
    loadGame
  });
})();
