/**
 * hud.js — Heads-Up Display / UI Overlays
 * Owner: Howard (Rendering + Fog of War)
 *
 * Renders overlay UI: health/mana/stamina bars, message log,
 * mini-map, title screen, death screen, victory screen.
 *
 * Depends on: constants.js, gameState.js, renderer.js
 */
(function () {
  'use strict';

  const { TILES, TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, PHASES, CLASSES, XP_PER_LEVEL } = Constants;

  const BAR_WIDTH = 160;
  const BAR_HEIGHT = 16;
  const BAR_PADDING = 4;
  const HUD_MARGIN = 12;

  // Mini-map settings
  const MINI_TILE = 3;
  const MINI_SIZE = 150;

  // Title screen state
  let titleState = {
    selectedClass: 0,
    playerName: '',
    inputActive: false,
    classKeys: ['WARRIOR', 'MAGE', 'ROGUE', 'CLERIC']
  };

  // Help screen state
  let showHelp = false;

  // Inventory UI state
  let showInventory = false;
  let inventoryIndex = 0;

  // High scores
  let highScores = [];

  function loadHighScores() {
    try {
      highScores = JSON.parse(localStorage.getItem('dc_highscores') || '[]');
    } catch (e) {
      highScores = [];
    }
  }

  function saveHighScore(entry) {
    loadHighScores();
    highScores.push(entry);
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 10);
    localStorage.setItem('dc_highscores', JSON.stringify(highScores));
  }

  function getHighScores() {
    loadHighScores();
    return highScores;
  }

  function getTitleState() {
    return titleState;
  }

  function resetTitleState() {
    titleState.selectedClass = 0;
    titleState.playerName = '';
    titleState.inputActive = false;
  }

  /**
   * Render the full HUD overlay.
   * @param {Set<string>} visibleTiles
   */
  function render(visibleTiles) {
    const ctx = Renderer.getCtx();
    if (!ctx) return;
    const { w, h } = Renderer.getCanvasSize();
    const phase = GameState.getPhase();

    if (phase === PHASES.TITLE) {
      drawTitleScreen(ctx, w, h);
      return;
    }
    if (phase === PHASES.DEAD) {
      drawDeathScreen(ctx, w, h);
      return;
    }
    if (phase === PHASES.VICTORY) {
      drawVictoryScreen(ctx, w, h);
      return;
    }

    // In-game HUD
    const player = GameState.getPlayer();
    if (!player) return;

    drawBars(ctx, player);
    drawFloorIndicator(ctx, w);
    drawCharInfo(ctx, player);
    drawMessageLog(ctx, w, h);
    drawMiniMap(ctx, w, visibleTiles);

    if (phase === PHASES.COMBAT) {
      drawCombatIndicator(ctx, w, h);
    }

    // Overlay screens (drawn on top of game HUD)
    if (showHelp) {
      drawHelpScreen(ctx, w, h);
    }
    if (showInventory) {
      drawInventoryScreen(ctx, w, h, player);
    }
  }

  // ── Status Bars ────────────────────────────────────────────
  function drawBars(ctx, player) {
    const x = HUD_MARGIN;
    let y = HUD_MARGIN;

    // HP bar
    drawBar(ctx, x, y, 'HP', player.hp, player.maxHp, '#CC0000', '#440000');
    y += BAR_HEIGHT + BAR_PADDING;

    // Mana bar
    drawBar(ctx, x, y, 'MP', player.mana, player.maxMana, '#3366FF', '#112244');
    y += BAR_HEIGHT + BAR_PADDING;

    // Stamina bar
    drawBar(ctx, x, y, 'SP', player.stamina, player.maxStamina, '#33CC33', '#114411');
  }

  function drawBar(ctx, x, y, label, current, max, fgColor, bgColor) {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 2, y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4);

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);

    // Fill
    const ratio = max > 0 ? Math.max(0, current / max) : 0;
    ctx.fillStyle = fgColor;
    ctx.fillRect(x, y, BAR_WIDTH * ratio, BAR_HEIGHT);

    // Border
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, BAR_WIDTH, BAR_HEIGHT);

    // Text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label + ' ' + Math.floor(current) + '/' + Math.floor(max), x + 4, y + BAR_HEIGHT / 2);
  }

  // ── Floor Indicator ────────────────────────────────────────
  function drawFloorIndicator(ctx, w) {
    const floor = GameState.getCurrentFloor() + 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(w / 2 - 50, HUD_MARGIN - 2, 100, 22);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Floor ' + floor, w / 2, HUD_MARGIN);
  }

  // ── Character Info ─────────────────────────────────────────
  function drawCharInfo(ctx, player) {
    const x = HUD_MARGIN;
    let y = HUD_MARGIN + (BAR_HEIGHT + BAR_PADDING) * 3 + 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x - 2, y - 2, BAR_WIDTH + 4, 60);

    ctx.fillStyle = '#CCC';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const className = player.classKey ? CLASSES[player.classKey].name : 'Adventurer';
    ctx.fillText(player.name + ' - ' + className, x + 2, y + 2);

    ctx.fillText('Lv ' + player.level + '  ATK ' + player.attack + '  DEF ' + player.defense, x + 2, y + 18);

    // XP progress bar
    const xpNeeded = XP_PER_LEVEL[player.level - 1] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
    const xpRatio = Math.min(1, player.xp / xpNeeded);
    ctx.fillStyle = '#444';
    ctx.fillRect(x + 2, y + 36, BAR_WIDTH - 4, 8);
    ctx.fillStyle = '#9933FF';
    ctx.fillRect(x + 2, y + 36, (BAR_WIDTH - 4) * xpRatio, 8);
    ctx.fillStyle = '#CCC';
    ctx.font = '9px monospace';
    ctx.fillText('XP ' + player.xp + '/' + xpNeeded, x + 4, y + 46);
  }

  // ── Message Log ────────────────────────────────────────────
  function drawMessageLog(ctx, w, h) {
    const messages = GameState.getMessages(5);
    if (messages.length === 0) return;

    const logHeight = messages.length * 16 + 10;
    const logY = h - logHeight - HUD_MARGIN;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(HUD_MARGIN, logY, w - HUD_MARGIN * 2, logHeight);

    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const msgColors = { info: '#CCC', combat: '#FF6666', loot: '#FFD700', system: '#66CCFF' };

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      ctx.fillStyle = msgColors[msg.type] || '#CCC';
      ctx.fillText(msg.text, HUD_MARGIN + 6, logY + 5 + i * 16);
    }
  }

  // ── Mini-Map ───────────────────────────────────────────────
  function drawMiniMap(ctx, w, visibleTiles) {
    const floorData = GameState.getFloorData(GameState.getCurrentFloor());
    if (!floorData) return;

    const mmX = w - MINI_SIZE - HUD_MARGIN;
    const mmY = HUD_MARGIN;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(mmX - 2, mmY - 2, MINI_SIZE + 4, MINI_SIZE + 4);

    const explored = floorData.explored;
    const tiles = floorData.tiles;
    const player = GameState.getPlayer();

    // Scale to fit mini-map
    const scale = MINI_SIZE / Math.max(MAP_WIDTH, MAP_HEIGHT);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!explored[y][x]) continue;

        const tileType = tiles[y][x];
        if (tileType === TILES.WALL) {
          ctx.fillStyle = '#555';
        } else if (tileType === TILES.STAIRS_DOWN) {
          ctx.fillStyle = '#FFD700';
        } else if (tileType === TILES.STAIRS_UP) {
          ctx.fillStyle = '#C0C0C0';
        } else {
          ctx.fillStyle = '#8B7355';
        }

        ctx.fillRect(
          mmX + x * scale,
          mmY + y * scale,
          Math.max(1, scale),
          Math.max(1, scale)
        );
      }
    }

    // Player dot on mini-map
    if (player) {
      ctx.fillStyle = '#0F0';
      ctx.fillRect(
        mmX + player.x * scale - 1,
        mmY + player.y * scale - 1,
        3, 3
      );
    }
  }

  // ── Combat Indicator ───────────────────────────────────────
  function drawCombatIndicator(ctx, w, h) {
    ctx.fillStyle = 'rgba(200, 0, 0, 0.3)';
    ctx.fillRect(0, 0, w, 3);
    ctx.fillRect(0, h - 3, w, 3);
    ctx.fillRect(0, 0, 3, h);
    ctx.fillRect(w - 3, 0, 3, h);

    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('⚔ COMBAT ⚔', w / 2, HUD_MARGIN + 24);
  }

  // ── Title Screen ───────────────────────────────────────────
  function drawTitleScreen(ctx, w, h) {
    // Background
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DUNGEON CRAWLER', w / 2, h * 0.12);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('A Roguelike Adventure', w / 2, h * 0.18);

    // Class selection
    ctx.fillStyle = '#CCC';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('Choose Your Class', w / 2, h * 0.28);

    const classKeys = titleState.classKeys;
    for (let i = 0; i < classKeys.length; i++) {
      const cls = CLASSES[classKeys[i]];
      const selected = (i === titleState.selectedClass);
      const cy = h * 0.34 + i * 60;

      if (selected) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.fillRect(w / 2 - 200, cy - 18, 400, 50);
        ctx.fillStyle = '#FFD700';
      } else {
        ctx.fillStyle = '#999';
      }

      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText((selected ? '▶ ' : '  ') + cls.name, w / 2, cy);

      ctx.fillStyle = selected ? '#BBB' : '#666';
      ctx.font = '12px monospace';
      ctx.fillText(cls.description, w / 2, cy + 18);
    }

    // Name input
    const nameY = h * 0.34 + classKeys.length * 60 + 30;
    ctx.fillStyle = '#CCC';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Enter Name:', w / 2, nameY);

    ctx.fillStyle = titleState.inputActive ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(w / 2 - 100, nameY + 10, 200, 30);
    ctx.strokeStyle = titleState.inputActive ? '#FFD700' : '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(w / 2 - 100, nameY + 10, 200, 30);

    ctx.fillStyle = '#FFF';
    ctx.font = '16px monospace';
    const displayName = titleState.playerName + (titleState.inputActive ? '_' : '');
    ctx.fillText(displayName || 'Hero', w / 2, nameY + 26);

    // Start prompt
    ctx.fillStyle = '#66FF66';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Press ENTER to Start', w / 2, nameY + 70);

    // Controls info
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText('↑↓ Select Class  |  TAB Name Input  |  ENTER Start', w / 2, nameY + 95);

    // Controls quick-reference
    const ctrlY = nameY + 120;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('── Controls ──', w / 2, ctrlY);
    ctx.fillStyle = '#AAA';
    ctx.font = '12px monospace';
    ctx.fillText('Move: Arrows/WASD  Diagonal: Numpad/YUBN', w / 2, ctrlY + 20);
    ctx.fillText('Abilities: 1-3    Pick Up: G    Stairs: > <', w / 2, ctrlY + 36);
    ctx.fillText('Inventory: I    Wait: Space    Help: ?', w / 2, ctrlY + 52);

    // High scores
    loadHighScores();
    if (highScores.length > 0) {
      const hsY = ctrlY + 80;
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('── High Scores ──', w / 2, hsY);

      ctx.font = '12px monospace';
      for (let i = 0; i < Math.min(5, highScores.length); i++) {
        const hs = highScores[i];
        ctx.fillStyle = '#CCC';
        ctx.fillText(
          (i + 1) + '. ' + hs.name + ' (' + hs.className + ') - Floor ' + hs.floor + ' - ' + hs.score + 'pts',
          w / 2, hsY + 22 + i * 18
        );
      }
    }
  }

  // ── Death Screen ───────────────────────────────────────────
  function drawDeathScreen(ctx, w, h) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#CC0000';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU DIED', w / 2, h * 0.25);

    const player = GameState.getPlayer();
    if (player) {
      ctx.fillStyle = '#CCC';
      ctx.font = '18px monospace';
      const className = player.classKey ? CLASSES[player.classKey].name : 'Adventurer';
      ctx.fillText(player.name + ' the ' + className, w / 2, h * 0.35);
      ctx.fillText('Level ' + player.level + '  |  Floor ' + (GameState.getCurrentFloor() + 1), w / 2, h * 0.40);
      ctx.fillText('Turns Survived: ' + GameState.getTurnCounter(), w / 2, h * 0.45);

      const score = calculateScore(player);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('Score: ' + score, w / 2, h * 0.52);
    }

    ctx.fillStyle = '#66FF66';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Press ENTER to Return to Title', w / 2, h * 0.65);
  }

  // ── Victory Screen ─────────────────────────────────────────
  function drawVictoryScreen(ctx, w, h) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU WIN!', w / 2, h * 0.25);

    const player = GameState.getPlayer();
    if (player) {
      ctx.fillStyle = '#CCC';
      ctx.font = '18px monospace';
      const className = player.classKey ? CLASSES[player.classKey].name : 'Adventurer';
      ctx.fillText(player.name + ' the ' + className, w / 2, h * 0.35);
      ctx.fillText('Conquered all 10 floors!', w / 2, h * 0.40);
      ctx.fillText('Level ' + player.level + '  |  Turns: ' + GameState.getTurnCounter(), w / 2, h * 0.45);

      const score = calculateScore(player) * 2; // Bonus for winning
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 24px monospace';
      ctx.fillText('Final Score: ' + score, w / 2, h * 0.52);
    }

    ctx.fillStyle = '#66FF66';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Press ENTER to Return to Title', w / 2, h * 0.65);
  }

  function calculateScore(player) {
    const baseScore = (GameState.getCurrentFloor() + 1) * 100
      + player.level * 50
      + player.xp;
    const turnPenalty = Math.floor(GameState.getTurnCounter() / 10);
    return Math.max(0, baseScore - turnPenalty);
  }

  // ── Help Screen Overlay ─────────────────────────────────────
  function drawHelpScreen(ctx, w, h) {
    // Semi-transparent dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    let y = 30;
    const lineH = 18;
    const sectionGap = 10;

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('HOW TO PLAY', cx, y);
    y += 40;

    function sectionTitle(text) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('── ' + text + ' ──', cx, y);
      y += lineH + 2;
    }

    function helpLine(text, color) {
      ctx.fillStyle = color || '#CCC';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, y);
      y += lineH;
    }

    // MOVEMENT & EXPLORATION
    sectionTitle('MOVEMENT & EXPLORATION');
    helpLine('Arrow Keys or WASD to move (cardinal)');
    helpLine('Numpad 7/9/1/3 or Y/U/B/N to move diagonally');
    helpLine('Walk into enemies to attack (melee)');
    helpLine('> or .  to descend stairs (stand on gold > tile)');
    helpLine('< or ,  to ascend stairs (stand on silver < tile)');
    helpLine('G  to pick up items from the ground');
    helpLine('Space or 5  to wait one turn');
    y += sectionGap;

    // COMBAT
    sectionTitle('COMBAT');
    helpLine('Walk into enemies to perform a basic melee attack');
    helpLine('Press 1-3 to use class abilities (auto-targets nearest visible enemy)');
    helpLine('Each class has 3 unique abilities that cost mana or stamina');
    helpLine('Warrior: 1=Power Strike  2=Shield Bash  3=War Cry', '#FF8844');
    helpLine('Mage:    1=Fireball(AoE) 2=Ice Shard    3=Arcane Shield', '#6699FF');
    helpLine('Rogue:   1=Backstab      2=Evade        3=Poison Blade', '#66FF66');
    helpLine('Cleric:  1=Heal          2=Smite        3=Divine Shield', '#FFFF66');
    y += sectionGap;

    // INVENTORY & ITEMS
    sectionTitle('INVENTORY & ITEMS');
    helpLine('I  to open inventory');
    helpLine('In inventory: ↑↓ select, E equip/unequip, U use, D drop, Esc close');
    helpLine('Items on the ground appear as yellow dots');
    helpLine('Potions and scrolls start UNIDENTIFIED — use to reveal');
    helpLine('⚠ Unidentified items may be harmful! (poison, curses)', '#FF6666');
    y += sectionGap;

    // REGENERATION
    sectionTitle('REGENERATION');
    helpLine('Each class passively regenerates resources per turn while exploring:');
    helpLine('Warrior: 2 HP, 3 stamina          Mage: 1 HP, 3 mana, 1 stamina', '#FF8844');
    helpLine('Rogue:   1 HP, 3 stamina          Cleric: 2 HP, 2 mana, 2 stamina', '#66FF66');
    helpLine('Post-combat regen window: Warrior 5, Rogue 5, Cleric 7, Mage 8 turns');
    y += sectionGap;

    // GAME INFO
    sectionTitle('GAME INFO');
    helpLine('Permadeath: when you die, it\'s over. Score is saved.');
    helpLine('Explore 10 floors of increasing difficulty');
    helpLine('Enemies get stronger each floor — gear up!');
    helpLine('Save is automatic when you close the browser');
    helpLine('?  or  H  to toggle this help screen');
    y += sectionGap + 4;

    // Close hint
    ctx.fillStyle = '#66FF66';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ? , H , or Esc to close', cx, y);
  }

  // ── Inventory Screen Overlay ────────────────────────────────
  function drawInventoryScreen(ctx, w, h, player) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const panelW = Math.min(500, w - 40);
    const panelX = cx - panelW / 2;
    let y = 30;

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('INVENTORY', cx, y);
    y += 36;

    const items = player.inventory || [];

    if (items.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText('Your inventory is empty.', cx, y + 40);
    } else {
      // Clamp selection index
      if (inventoryIndex >= items.length) inventoryIndex = Math.max(0, items.length - 1);

      const lineH = 22;
      const listTop = y;
      const maxVisible = Math.min(items.length, Math.floor((h - 200) / lineH));

      // Scrolling: determine visible window
      let scrollOffset = 0;
      if (items.length > maxVisible) {
        scrollOffset = Math.max(0, Math.min(inventoryIndex - Math.floor(maxVisible / 2), items.length - maxVisible));
      }

      for (let vi = 0; vi < maxVisible; vi++) {
        const i = vi + scrollOffset;
        if (i >= items.length) break;
        const item = items[i];
        const iy = listTop + vi * lineH;

        const isSelected = (i === inventoryIndex);

        // Highlight selected row
        if (isSelected) {
          ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
          ctx.fillRect(panelX, iy - 2, panelW, lineH);
        }

        // Check if equipped
        const equipped = isItemEquipped(player, item);
        const marker = equipped ? '★ ' : '  ';

        // Item name
        const displayName = (window.ItemSystem && ItemSystem.getDisplayName)
          ? ItemSystem.getDisplayName(item) : item.name;

        ctx.fillStyle = isSelected ? '#FFD700' : '#CCC';
        ctx.font = (isSelected ? 'bold ' : '') + '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(marker + displayName, panelX + 8, iy + 4);

        // Slot / type info on the right
        const slotLabel = item.slot || item.type || '';
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(slotLabel, panelX + panelW - 8, iy + 4);
      }

      // Item detail panel for selected item
      const detailY = listTop + maxVisible * lineH + 16;
      const selectedItem = items[inventoryIndex];
      if (selectedItem) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(panelX, detailY, panelW, 80);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, detailY, panelW, 80);

        const displayName = (window.ItemSystem && ItemSystem.getDisplayName)
          ? ItemSystem.getDisplayName(selectedItem) : selectedItem.name;

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(displayName, panelX + 10, detailY + 14);

        // Description
        if (selectedItem.description) {
          ctx.fillStyle = '#AAA';
          ctx.font = '11px monospace';
          ctx.fillText(selectedItem.description, panelX + 10, detailY + 32);
        }

        // Stats
        const stats = [];
        if (selectedItem.statMods) {
          for (const [key, val] of Object.entries(selectedItem.statMods)) {
            if (val !== 0) stats.push(key + (val > 0 ? '+' : '') + val);
          }
        }
        if (selectedItem.rarity) stats.push('[' + selectedItem.rarity + ']');

        if (stats.length > 0) {
          ctx.fillStyle = '#8CF';
          ctx.font = '11px monospace';
          ctx.fillText(stats.join('  '), panelX + 10, detailY + 50);
        }

        // Equipped indicator
        if (isItemEquipped(player, selectedItem)) {
          ctx.fillStyle = '#66FF66';
          ctx.font = 'bold 11px monospace';
          ctx.fillText('[ EQUIPPED ]', panelX + 10, detailY + 66);
        }
      }
    }

    // Controls at the bottom
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('↑↓ Select  |  E Equip  |  U Use  |  D Drop  |  Esc Close', cx, h - 30);
  }

  function isItemEquipped(player, item) {
    if (!player.equipment) return false;
    for (const slot of Object.keys(player.equipment)) {
      if (player.equipment[slot] && player.equipment[slot].id === item.id) return true;
    }
    return false;
  }

  // ── Help / Inventory Toggles ────────────────────────────────
  function toggleHelp() {
    showHelp = !showHelp;
    if (showHelp) showInventory = false;
  }

  function isHelpVisible() {
    return showHelp;
  }

  function toggleInventory() {
    showInventory = !showInventory;
    if (showInventory) {
      showHelp = false;
      inventoryIndex = 0;
    }
  }

  function isInventoryVisible() {
    return showInventory;
  }

  function getInventoryIndex() {
    return inventoryIndex;
  }

  function setInventoryIndex(idx) {
    inventoryIndex = idx;
  }

  function closeInventory() {
    showInventory = false;
  }

  window.HUD = Object.freeze({
    render,
    getTitleState,
    resetTitleState,
    saveHighScore,
    getHighScores,
    calculateScore,
    toggleHelp,
    isHelpVisible,
    toggleInventory,
    isInventoryVisible,
    getInventoryIndex,
    setInventoryIndex,
    closeInventory
  });
})();
