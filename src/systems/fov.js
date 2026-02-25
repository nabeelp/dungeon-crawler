/**
 * fov.js — Field of View (Recursive Shadowcasting)
 * Owner: Howard (Rendering + Fog of War)
 *
 * Computes which tiles are visible from the player's position using
 * recursive shadowcasting (8 octants). Updates the explored array.
 *
 * Depends on: constants.js, utils.js
 */
(function () {
  'use strict';

  const { OPAQUE_TILES, MAP_WIDTH, MAP_HEIGHT } = Constants;

  // Octant transformation multipliers for recursive shadowcasting
  const OCTANT_MULTIPLIERS = [
    [1,  0,  0,  1],
    [0,  1,  1,  0],
    [0, -1,  1,  0],
    [-1, 0,  0,  1],
    [-1, 0,  0, -1],
    [0, -1, -1,  0],
    [0,  1, -1,  0],
    [1,  0,  0, -1]
  ];

  /**
   * Compute visible tiles from (originX, originY) within radius.
   * @param {number} originX
   * @param {number} originY
   * @param {number} radius
   * @param {number[][]} tiles - 2D tile grid
   * @returns {Set<string>} Set of "x,y" keys for visible tiles
   */
  function compute(originX, originY, radius, tiles) {
    const visible = new Set();

    // Origin is always visible
    visible.add(originX + ',' + originY);

    for (let oct = 0; oct < 8; oct++) {
      castOctant(originX, originY, radius, tiles, visible,
        1, 1.0, 0.0, OCTANT_MULTIPLIERS[oct]);
    }

    return visible;
  }

  /**
   * Recursive shadowcasting for one octant.
   */
  function castOctant(ox, oy, radius, tiles, visible, row, startSlope, endSlope, mult) {
    if (startSlope < endSlope) return;

    const radiusSq = radius * radius;
    let newStart = startSlope;

    for (let j = row; j <= radius; j++) {
      let dx = -j - 1;
      let dy = -j;
      let blocked = false;

      while (dx <= 0) {
        dx++;

        const mapX = ox + dx * mult[0] + dy * mult[1];
        const mapY = oy + dx * mult[2] + dy * mult[3];

        if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) continue;

        const leftSlope  = (dx - 0.5) / (dy + 0.5);
        const rightSlope = (dx + 0.5) / (dy - 0.5);

        if (startSlope < rightSlope) continue;
        if (endSlope > leftSlope) break;

        // Tile is in radius — mark visible
        if (dx * dx + dy * dy <= radiusSq) {
          visible.add(mapX + ',' + mapY);
        }

        const tileType = tiles[mapY][mapX];
        const isOpaque = OPAQUE_TILES.has(tileType);

        if (blocked) {
          if (isOpaque) {
            newStart = rightSlope;
          } else {
            blocked = false;
            startSlope = newStart;
          }
        } else {
          if (isOpaque && j < radius) {
            blocked = true;
            castOctant(ox, oy, radius, tiles, visible, j + 1, startSlope, leftSlope, mult);
            newStart = rightSlope;
          }
        }
      }

      if (blocked) break;
    }
  }

  /**
   * Update the explored grid based on currently visible tiles.
   * @param {boolean[][]} explored - 2D explored grid
   * @param {Set<string>} visible - Set of "x,y" keys
   */
  function updateExplored(explored, visible) {
    for (const key of visible) {
      const parts = key.split(',');
      const x = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      explored[y][x] = true;
    }
  }

  window.FOVSystem = Object.freeze({
    compute,
    updateExplored
  });
})();
