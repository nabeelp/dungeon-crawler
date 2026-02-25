/**
 * generator.js — BSP Dungeon Generator
 * Owner: Sheldon (Lead + Dungeon Generation)
 *
 * Binary Space Partitioning approach:
 *   1. Recursively split the map into leaf nodes.
 *   2. Place a room inside each leaf.
 *   3. Connect sibling rooms with corridors.
 *   4. Place stairs.
 *
 * Depends on: constants.js, utils.js
 */
(function () {
  'use strict';

  const { TILES, MAP_WIDTH, MAP_HEIGHT, MAX_FLOORS, FLOOR_PARAMS } = Constants;

  // ── BSP Node ───────────────────────────────────────────────
  class BSPNode {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.left  = null;
      this.right = null;
      this.room  = null; // { x, y, w, h } — carved room inside the leaf
    }

    isLeaf() {
      return this.left === null && this.right === null;
    }

    /** Recursively split until we can't or don't want to */
    split(rng, minSize) {
      if (!this.isLeaf()) return;

      // Decide horizontal vs vertical split
      let splitH;
      if      (this.w / this.h >= 1.25) splitH = false;  // wide → split vertically
      else if (this.h / this.w >= 1.25) splitH = true;   // tall → split horizontally
      else                              splitH = rng.random() > 0.5;

      const maxDim = (splitH ? this.h : this.w) - minSize;
      if (maxDim < minSize) return; // too small to split

      const splitPos = rng.randInt(minSize, maxDim);

      if (splitH) {
        this.left  = new BSPNode(this.x, this.y, this.w, splitPos);
        this.right = new BSPNode(this.x, this.y + splitPos, this.w, this.h - splitPos);
      } else {
        this.left  = new BSPNode(this.x, this.y, splitPos, this.h);
        this.right = new BSPNode(this.x + splitPos, this.y, this.w - splitPos, this.h);
      }

      // Recurse
      this.left.split(rng, minSize);
      this.right.split(rng, minSize);
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  function getLeaves(node) {
    if (node.isLeaf()) return [node];
    return [...getLeaves(node.left), ...getLeaves(node.right)];
  }

  function roomCenter(room) {
    return {
      x: Math.floor(room.x + room.w / 2),
      y: Math.floor(room.y + room.h / 2)
    };
  }

  // ── Carving ────────────────────────────────────────────────
  function carveRoom(grid, room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        grid[y][x] = TILES.FLOOR;
      }
    }
  }

  function carveCorridor(grid, x1, y1, x2, y2, width) {
    // L-shaped corridor: horizontal then vertical
    const carve = (cx, cy) => {
      for (let dy = 0; dy < width; dy++) {
        for (let dx = 0; dx < width; dx++) {
          const ny = cy + dy;
          const nx = cx + dx;
          if (ny >= 0 && ny < MAP_HEIGHT && nx >= 0 && nx < MAP_WIDTH) {
            grid[ny][nx] = TILES.CORRIDOR;
          }
        }
      }
    };

    // Horizontal segment
    const xStep = x1 < x2 ? 1 : -1;
    for (let x = x1; x !== x2; x += xStep) carve(x, y1);

    // Vertical segment
    const yStep = y1 < y2 ? 1 : -1;
    for (let y = y1; y !== y2; y += yStep) carve(x2, y);

    carve(x2, y2); // make sure endpoint is carved
  }

  // ── Connect BSP Siblings ───────────────────────────────────
  /** Get a random room from this subtree */
  function getRandomRoom(node, rng) {
    if (node.isLeaf()) return node.room;
    const leftRoom  = node.left  ? getRandomRoom(node.left, rng)  : null;
    const rightRoom = node.right ? getRandomRoom(node.right, rng) : null;
    if (!leftRoom)  return rightRoom;
    if (!rightRoom) return leftRoom;
    return rng.random() > 0.5 ? leftRoom : rightRoom;
  }

  function connectBSP(node, grid, rng, corridorWidth) {
    if (node.isLeaf()) return;
    if (node.left)  connectBSP(node.left, grid, rng, corridorWidth);
    if (node.right) connectBSP(node.right, grid, rng, corridorWidth);

    const roomA = getRandomRoom(node.left, rng);
    const roomB = getRandomRoom(node.right, rng);
    if (roomA && roomB) {
      const a = roomCenter(roomA);
      const b = roomCenter(roomB);
      carveCorridor(grid, a.x, a.y, b.x, b.y, corridorWidth);
    }
  }

  // ── Place Doors (optional) ─────────────────────────────────
  function placeDoors(grid, rooms, rng) {
    // Place doors where corridors meet room edges
    for (const room of rooms) {
      const perimeterCells = [];
      // Top and bottom edges
      for (let x = room.x; x < room.x + room.w; x++) {
        if (room.y - 1 >= 0)          perimeterCells.push({ x, y: room.y - 1 });
        if (room.y + room.h < MAP_HEIGHT) perimeterCells.push({ x, y: room.y + room.h });
      }
      // Left and right edges
      for (let y = room.y; y < room.y + room.h; y++) {
        if (room.x - 1 >= 0)         perimeterCells.push({ x: room.x - 1, y });
        if (room.x + room.w < MAP_WIDTH) perimeterCells.push({ x: room.x + room.w, y });
      }

      for (const p of perimeterCells) {
        if (grid[p.y][p.x] === TILES.CORRIDOR) {
          // 30% chance of a door
          if (rng.random() < 0.3) {
            grid[p.y][p.x] = TILES.DOOR;
          }
        }
      }
    }
  }

  // ── Stair Placement ────────────────────────────────────────
  function placeStairs(grid, rooms, floorIndex, rng) {
    const stairsInfo = { down: null, up: null };

    // Place stairs down (not on last floor)
    if (floorIndex < MAX_FLOORS - 1) {
      const downRoom = rooms[rooms.length - 1]; // deepest BSP leaf → far room
      const dc = roomCenter(downRoom);
      grid[dc.y][dc.x] = TILES.STAIRS_DOWN;
      stairsInfo.down = { x: dc.x, y: dc.y };
    }

    // Place stairs up (not on first floor)
    if (floorIndex > 0) {
      const upRoom = rooms[0]; // first room → entry
      const uc = roomCenter(upRoom);
      grid[uc.y][uc.x] = TILES.STAIRS_UP;
      stairsInfo.up = { x: uc.x, y: uc.y };
    }

    return stairsInfo;
  }

  // ── Main Generator ─────────────────────────────────────────
  /**
   * Generate a dungeon floor.
   *
   * @param {number} floorIndex  0-based floor number
   * @param {number} seed        Seed for deterministic RNG
   * @returns {{
   *   tiles: number[][],
   *   rooms: {x:number,y:number,w:number,h:number}[],
   *   stairs: {down:{x,y}|null, up:{x,y}|null},
   *   explored: boolean[][]
   * }}
   */
  function generate(floorIndex, seed) {
    const floorSeed = seed + floorIndex * 1000;
    const rng = Utils.createRNG(floorSeed);
    const params = FLOOR_PARAMS[floorIndex] || FLOOR_PARAMS[FLOOR_PARAMS.length - 1];

    // 1. Start with all walls
    const grid = Utils.createGrid(MAP_WIDTH, MAP_HEIGHT, TILES.WALL);

    // 2. BSP tree — leave 1-cell border
    const root = new BSPNode(1, 1, MAP_WIDTH - 2, MAP_HEIGHT - 2);
    root.split(rng, params.minRoomSize + 2); // +2 for padding

    // 3. Place rooms in leaves
    const leaves = getLeaves(root);
    const rooms = [];

    for (const leaf of leaves) {
      const rw = rng.randInt(params.minRoomSize, Math.min(params.maxRoomSize, leaf.w - 2));
      const rh = rng.randInt(params.minRoomSize, Math.min(params.maxRoomSize, leaf.h - 2));
      const rx = rng.randInt(leaf.x + 1, leaf.x + leaf.w - rw - 1);
      const ry = rng.randInt(leaf.y + 1, leaf.y + leaf.h - rh - 1);

      const room = { x: rx, y: ry, w: rw, h: rh };
      rooms.push(room);
      leaf.room = room;
      carveRoom(grid, room);
    }

    // 4. Connect sibling rooms via BSP
    connectBSP(root, grid, rng, params.corridorWidth);

    // 5. Optional extra corridors for loops (deeper floors)
    for (let i = 0; i < params.extraCorridors && rooms.length >= 2; i++) {
      const a = rng.pick(rooms);
      const b = rng.pick(rooms);
      if (a !== b) {
        const ca = roomCenter(a);
        const cb = roomCenter(b);
        carveCorridor(grid, ca.x, ca.y, cb.x, cb.y, params.corridorWidth);
      }
    }

    // 6. Place doors
    placeDoors(grid, rooms, rng);

    // 7. Place stairs
    const stairs = placeStairs(grid, rooms, floorIndex, rng);

    // 8. Explored grid (all false — fog of war)
    const explored = Utils.createGrid(MAP_WIDTH, MAP_HEIGHT, false);

    return { tiles: grid, rooms, stairs, explored };
  }

  // ── Public API ─────────────────────────────────────────────
  window.DungeonGenerator = Object.freeze({
    generate
  });
})();
