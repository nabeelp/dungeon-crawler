/**
 * gameState.js — Central game state management
 * Owner: Sheldon (Lead + Dungeon Generation)
 *
 * Single source of truth for the running game.
 * Depends on: constants.js, utils.js
 */
(function () {
  'use strict';

  const { TILES, MAP_WIDTH, MAP_HEIGHT, MAX_FLOORS, PHASES, CLASSES, EQUIPMENT_SLOTS } = Constants;

  // ── Entity Factory ─────────────────────────────────────────
  /**
   * Create a new entity (player, monster, NPC).
   * @param {object} opts
   * @returns {object} entity
   */
  function createEntity(opts) {
    const base = opts.classKey && CLASSES[opts.classKey]
      ? { ...CLASSES[opts.classKey].baseStats }
      : {
          hp: 10, maxHp: 10,
          mana: 0, maxMana: 0,
          stamina: 10, maxStamina: 10,
          attack: 2, defense: 0,
          speed: 10
        };

    return {
      id:        opts.id || Utils.generateId(),
      name:      opts.name || 'Unknown',
      type:      opts.type || 'monster',   // 'player' | 'monster' | 'npc'
      classKey:  opts.classKey || null,
      x:         opts.x ?? 0,
      y:         opts.y ?? 0,
      floor:     opts.floor ?? 0,

      // Stats (shallow copy so each entity has its own)
      hp:         opts.hp         ?? base.hp,
      maxHp:      opts.maxHp      ?? base.maxHp,
      mana:       opts.mana       ?? base.mana,
      maxMana:    opts.maxMana    ?? base.maxMana,
      stamina:    opts.stamina    ?? base.stamina,
      maxStamina: opts.maxStamina ?? base.maxStamina,
      attack:     opts.attack     ?? base.attack,
      defense:    opts.defense    ?? base.defense,
      speed:      opts.speed      ?? base.speed,

      // Progression
      level: opts.level || 1,
      xp:    opts.xp    || 0,

      // Abilities (from class or custom)
      abilities: opts.abilities
        ? [...opts.abilities]
        : (opts.classKey && CLASSES[opts.classKey]
            ? [...CLASSES[opts.classKey].abilities]
            : []),

      // Inventory & equipment
      inventory: opts.inventory ? [...opts.inventory] : [],
      equipment: opts.equipment || {
        [EQUIPMENT_SLOTS.WEAPON]: null,
        [EQUIPMENT_SLOTS.ARMOR]:  null,
        [EQUIPMENT_SLOTS.HELMET]: null,
        [EQUIPMENT_SLOTS.BOOTS]:  null,
        [EQUIPMENT_SLOTS.RING]:   null,
        [EQUIPMENT_SLOTS.AMULET]: null
      },

      // AI / behaviour tag for monsters
      ai: opts.ai || null,

      // Extra fields needed by combat/AI (survive save/load)
      statusEffects: opts.statusEffects ? [...opts.statusEffects] : [],
      tags:          opts.tags ? [...opts.tags] : [],
      xpValue:       opts.xpValue ?? 0,
      templateKey:   opts.templateKey || null,
      _buffs:        opts._buffs ? [...opts._buffs] : [],
      regenCooldown: opts.regenCooldown ?? 0,

      // Is entity alive?
      alive: true
    };
  }

  // ── Item Factory ───────────────────────────────────────────
  /**
   * Create an item instance.
   * @param {object} opts
   * @returns {object} item
   */
  function createItem(opts) {
    const STANDARD_KEYS = ['id','name','type','slot','description','rarity',
      'floorLevel','identified','statMods','x','y','floor'];

    const item = {
      id:          opts.id || Utils.generateId(),
      name:        opts.name || 'Unknown Item',
      type:        opts.type || 'potion',      // weapon | armor | potion | scroll | ring | food
      slot:        opts.slot || null,           // equipment slot (if equippable)
      description: opts.description || '',
      rarity:      opts.rarity || 'common',
      floorLevel:  opts.floorLevel ?? 1,
      identified:  opts.identified ?? false,

      // Stat modifiers applied while equipped / on use
      statMods: opts.statMods || {},

      // Position on the ground (null if in inventory)
      x: opts.x ?? null,
      y: opts.y ?? null,
      floor: opts.floor ?? null
    };

    // Preserve extra properties (e.g. _defKey, special) from opts
    for (const key of Object.keys(opts)) {
      if (!STANDARD_KEYS.includes(key) && !(key in item)) {
        item[key] = opts[key];
      }
    }

    return item;
  }

  // ── Game State Singleton ───────────────────────────────────
  const state = {
    phase:       PHASES.TITLE,
    currentFloor: 0,           // 0-indexed
    turnCounter:  0,
    seed:         Date.now(),

    // One map per floor; generated lazily
    // Each entry: { tiles: 2D array, rooms: [{x,y,w,h}], explored: 2D bool array }
    floors: new Array(MAX_FLOORS).fill(null),

    // All entities across all floors
    entities: [],

    // Quick reference to player entity
    player: null,

    // Items lying on the ground across all floors
    groundItems: [],

    // Message log (newest first)
    messages: [],

    // Maximum messages retained
    maxMessages: 200
  };

  // ── State Accessors ────────────────────────────────────────
  function getPhase()       { return state.phase; }
  function setPhase(p)      { state.phase = p; }
  function getCurrentFloor(){ return state.currentFloor; }
  function setCurrentFloor(f){ state.currentFloor = f; }
  function getTurnCounter() { return state.turnCounter; }
  function advanceTurn()    { state.turnCounter++; }

  /** Get the map data for a floor (or null if not yet generated) */
  function getFloorData(floorIndex) {
    return state.floors[floorIndex] || null;
  }

  /** Store generated map data for a floor */
  function setFloorData(floorIndex, data) {
    state.floors[floorIndex] = data;
  }

  /** Get current floor's tile grid */
  function getCurrentTiles() {
    const fd = state.floors[state.currentFloor];
    return fd ? fd.tiles : null;
  }

  /** Get current floor's room list */
  function getCurrentRooms() {
    const fd = state.floors[state.currentFloor];
    return fd ? fd.rooms : [];
  }

  // ── Entity Management ──────────────────────────────────────
  function addEntity(entity) {
    state.entities.push(entity);
    return entity;
  }

  function removeEntity(id) {
    state.entities = state.entities.filter(e => e.id !== id);
  }

  function getEntitiesOnFloor(floorIndex) {
    return state.entities.filter(e => e.floor === floorIndex && e.alive);
  }

  function getEntityAt(x, y, floorIndex) {
    return state.entities.find(
      e => e.x === x && e.y === y && e.floor === floorIndex && e.alive
    ) || null;
  }

  function setPlayer(entity) {
    entity.type = 'player';
    state.player = entity;
  }

  function getPlayer() {
    return state.player;
  }

  // ── Ground Items ───────────────────────────────────────────
  function addGroundItem(item) {
    state.groundItems.push(item);
  }

  function removeGroundItem(id) {
    state.groundItems = state.groundItems.filter(i => i.id !== id);
  }

  function getGroundItemsAt(x, y, floorIndex) {
    return state.groundItems.filter(
      i => i.x === x && i.y === y && i.floor === floorIndex
    );
  }

  // ── Message Log ────────────────────────────────────────────
  function addMessage(text, type) {
    state.messages.unshift({
      text,
      type: type || 'info',   // info | combat | loot | system
      turn: state.turnCounter
    });
    if (state.messages.length > state.maxMessages) {
      state.messages.length = state.maxMessages;
    }
  }

  function getMessages(count) {
    return state.messages.slice(0, count || 20);
  }

  // ── New Game ───────────────────────────────────────────────
  function newGame(seed) {
    Utils.resetIdCounter();
    state.phase        = PHASES.EXPLORING;
    state.currentFloor = 0;
    state.turnCounter  = 0;
    state.seed         = seed ?? Date.now();
    state.floors       = new Array(MAX_FLOORS).fill(null);
    state.entities     = [];
    state.player       = null;
    state.groundItems  = [];
    state.messages     = [];
    addMessage('You descend into the dungeon…', 'system');
  }

  // ── Public API ─────────────────────────────────────────────
  window.GameState = Object.freeze({
    // Factories
    createEntity,
    createItem,

    // Phase / turn
    getPhase, setPhase,
    getCurrentFloor, setCurrentFloor,
    getTurnCounter, advanceTurn,

    // Floor data
    getFloorData, setFloorData,
    getCurrentTiles, getCurrentRooms,

    // Entities
    addEntity, removeEntity,
    getEntitiesOnFloor, getEntityAt,
    setPlayer, getPlayer,

    // Ground items
    addGroundItem, removeGroundItem, getGroundItemsAt,

    // Messages
    addMessage, getMessages,

    // Lifecycle
    newGame,

    // Direct state access (read-only intent — honour the contract)
    get state() { return state; }
  });
})();
