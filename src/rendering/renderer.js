/**
 * renderer.js — HTML5 Canvas Renderer
 * Owner: Howard (Rendering + Fog of War)
 *
 * Renders the dungeon, entities, and fog of war to the canvas.
 * Camera/viewport centered on player, scrolls with movement.
 *
 * Depends on: constants.js, gameState.js, fov.js
 */
(function () {
  'use strict';

  const { TILES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } = Constants;

  // Tile colors
  const TILE_COLORS = {
    [TILES.WALL]:        '#333333',
    [TILES.FLOOR]:       '#8B7355',
    [TILES.DOOR]:        '#8B4513',
    [TILES.STAIRS_DOWN]: '#FFD700',
    [TILES.STAIRS_UP]:   '#C0C0C0',
    [TILES.CORRIDOR]:    '#6B5B3A',
    [TILES.WATER]:       '#4169E1',
    [TILES.TRAP]:        '#FF4500'
  };

  let canvas = null;
  let ctx = null;
  let canvasWidth = 0;
  let canvasHeight = 0;

  // Screen shake state
  let shakeX = 0;
  let shakeY = 0;
  let shakeIntensity = 0;
  let shakeDuration = 0;

  // Floating damage number particles
  let particles = [];

  /**
   * Initialize the renderer with the game canvas.
   */
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
  }

  /**
   * Trigger screen shake effect.
   * @param {number} intensity - Shake strength in pixels (e.g. 2=light, 4=medium, 6=strong)
   */
  function triggerShake(intensity) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeDuration = Math.max(shakeDuration, 8);
  }

  /**
   * Spawn a floating damage number particle.
   * @param {number} x - Tile X position
   * @param {number} y - Tile Y position
   * @param {number} amount - Damage/heal amount to display
   * @param {string} type - 'player_damage'|'enemy_damage'|'heal'|'critical'
   */
  function spawnDamageNumber(x, y, amount, type) {
    const colors = {
      player_damage: '#FF4444',
      enemy_damage: '#FFFFFF',
      heal: '#44FF44',
      critical: '#FFD700'
    };
    particles.push({
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE,
      text: (type === 'heal' ? '+' : '') + Math.abs(Math.floor(amount)),
      color: colors[type] || '#FFFFFF',
      life: 1.0,
      isCritical: type === 'critical',
      spawnTime: Date.now()
    });
  }

  /**
   * Update shake decay and particle lifetimes. Called each frame.
   */
  function updateAnimations() {
    // Decay shake
    if (shakeDuration > 0) {
      const t = shakeDuration / 8;
      shakeX = (Math.random() - 0.5) * 2 * shakeIntensity * t;
      shakeY = (Math.random() - 0.5) * 2 * shakeIntensity * t;
      shakeDuration--;
      if (shakeDuration <= 0) {
        shakeX = 0;
        shakeY = 0;
        shakeIntensity = 0;
      }
    }

    // Update particles (1 second lifetime)
    const now = Date.now();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const elapsed = (now - p.spawnTime) / 1000;
      p.life = Math.max(0, 1 - elapsed);
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  /**
   * Returns true if animations need continuous rendering.
   */
  function hasActiveAnimations() {
    return shakeDuration > 0 || particles.length > 0;
  }

  /**
   * Render the full game frame.
   * @param {Set<string>} visibleTiles - Set of "x,y" keys currently in FOV
   */
  function render(visibleTiles) {
    updateAnimations();

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const phase = GameState.getPhase();
    if (phase === Constants.PHASES.TITLE) return;

    const player = GameState.getPlayer();
    if (!player) return;

    const floorData = GameState.getFloorData(GameState.getCurrentFloor());
    if (!floorData) return;

    const tiles = floorData.tiles;
    const explored = floorData.explored;

    // Camera offset: center player on screen, apply shake
    const camX = player.x * TILE_SIZE - canvasWidth / 2 + TILE_SIZE / 2 + shakeX;
    const camY = player.y * TILE_SIZE - canvasHeight / 2 + TILE_SIZE / 2 + shakeY;

    // Calculate visible tile range (with 1 tile margin)
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol = Math.min(MAP_WIDTH - 1, Math.ceil((camX + canvasWidth) / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endRow = Math.min(MAP_HEIGHT - 1, Math.ceil((camY + canvasHeight) / TILE_SIZE) + 1);

    // Draw tiles
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const key = x + ',' + y;
        const isVisible = visibleTiles && visibleTiles.has(key);
        const isExplored = explored[y][x];

        if (!isVisible && !isExplored) continue; // Unexplored = black

        const tileType = tiles[y][x];
        const screenX = x * TILE_SIZE - camX;
        const screenY = y * TILE_SIZE - camY;

        // Don't render traps unless visible
        if (tileType === TILES.TRAP && !isVisible) {
          ctx.fillStyle = TILE_COLORS[TILES.FLOOR];
        } else {
          ctx.fillStyle = TILE_COLORS[tileType] || '#000';
        }

        // Pulsing opacity for stairs tiles
        if ((tileType === TILES.STAIRS_DOWN || tileType === TILES.STAIRS_UP) && isVisible) {
          const pulse = 0.7 + 0.3 * ((Math.sin(Date.now() / 500) + 1) / 2);
          ctx.globalAlpha = pulse;
        }

        ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

        // Stair symbols
        if (tileType === TILES.STAIRS_DOWN || tileType === TILES.STAIRS_UP) {
          ctx.fillStyle = '#000';
          ctx.font = 'bold ' + (TILE_SIZE * 0.7) + 'px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            tileType === TILES.STAIRS_DOWN ? '>' : '<',
            screenX + TILE_SIZE / 2,
            screenY + TILE_SIZE / 2
          );
          ctx.globalAlpha = 1.0;
        }

        // Fog overlay for explored-but-not-visible tiles
        if (!isVisible && isExplored) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // Draw ground items (visible when explored)
    const floor = GameState.getCurrentFloor();
    const groundItems = GameState.state.groundItems.filter(i => i.floor === floor);
    for (const item of groundItems) {
      const key = item.x + ',' + item.y;
      const isVisible = visibleTiles && visibleTiles.has(key);
      const isExplored = explored[item.y] && explored[item.y][item.x];

      if (!isVisible && !isExplored) continue;

      const screenX = item.x * TILE_SIZE - camX;
      const screenY = item.y * TILE_SIZE - camY;

      ctx.fillStyle = '#FFD700';
      const margin = TILE_SIZE * 0.3;
      ctx.fillRect(screenX + margin, screenY + margin, TILE_SIZE - margin * 2, TILE_SIZE - margin * 2);

      if (!isVisible) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(screenX + margin, screenY + margin, TILE_SIZE - margin * 2, TILE_SIZE - margin * 2);
      }
    }

    // Draw entities (only if visible in FOV)
    const entities = GameState.getEntitiesOnFloor(floor);
    for (const entity of entities) {
      const key = entity.x + ',' + entity.y;
      if (!visibleTiles || !visibleTiles.has(key)) continue;
      if (entity.type === 'player') continue; // Draw player last

      const screenX = entity.x * TILE_SIZE - camX;
      const screenY = entity.y * TILE_SIZE - camY;

      // Monster: red square with first letter
      ctx.fillStyle = '#CC0000';
      ctx.fillRect(screenX + 2, screenY + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold ' + (TILE_SIZE * 0.6) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        (entity.name || 'M').charAt(0).toUpperCase(),
        screenX + TILE_SIZE / 2,
        screenY + TILE_SIZE / 2
      );
    }

    // Draw player
    if (player.alive) {
      const px = player.x * TILE_SIZE - camX;
      const py = player.y * TILE_SIZE - camY;

      ctx.fillStyle = '#00FF00';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#000';
      ctx.font = 'bold ' + (TILE_SIZE * 0.7) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('@', px + TILE_SIZE / 2, py + TILE_SIZE / 2);
    }

    // Draw floating damage number particles
    for (const p of particles) {
      const screenX = p.x - camX;
      const floatOffset = (1 - p.life) * 40;
      const screenY = p.y - camY - floatOffset;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.font = (p.isCritical ? 'bold 18px' : 'bold 14px') + ' monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, screenX, screenY);
    }
    ctx.globalAlpha = 1.0;
  }

  /**
   * Get the canvas context (for HUD overlays).
   */
  function getCtx() { return ctx; }
  function getCanvasSize() { return { w: canvasWidth, h: canvasHeight }; }

  window.Renderer = Object.freeze({
    init,
    render,
    getCtx,
    getCanvasSize,
    triggerShake,
    spawnDamageNumber,
    hasActiveAnimations
  });
})();
