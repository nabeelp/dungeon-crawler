/**
 * test-dungeon.js — Tests for DungeonGenerator
 * Owner: Amy (Tester)
 *
 * Covers: grid validity, rooms, stairs, determinism, connectivity
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;
  const { TILES, WALKABLE_TILES, MAP_WIDTH, MAP_HEIGHT, MAX_FLOORS } = Constants;

  const SEED = 42;
  const VALID_TILES = new Set(Object.values(TILES));

  // Helper: BFS to find all reachable walkable tiles from a starting point
  function bfsReachable(tiles, startX, startY) {
    const visited = new Set();
    const queue = [{ x: startX, y: startY }];
    const key = (x, y) => x + ',' + y;
    visited.add(key(startX, startY));

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const neighbors = [
        { x: x - 1, y },
        { x: x + 1, y },
        { x, y: y - 1 },
        { x, y: y + 1 }
      ];
      for (const n of neighbors) {
        if (n.x < 0 || n.y < 0 || n.x >= MAP_WIDTH || n.y >= MAP_HEIGHT) continue;
        const k = key(n.x, n.y);
        if (visited.has(k)) continue;
        if (WALKABLE_TILES.has(tiles[n.y][n.x])) {
          visited.add(k);
          queue.push(n);
        }
      }
    }
    return visited;
  }

  // Helper: count total walkable tiles
  function countWalkable(tiles) {
    let count = 0;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (WALKABLE_TILES.has(tiles[y][x])) count++;
      }
    }
    return count;
  }

  // Helper: find first walkable tile
  function findWalkable(tiles) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (WALKABLE_TILES.has(tiles[y][x])) return { x, y };
      }
    }
    return null;
  }

  // ── Grid Validity ───────────────────────────────────────────
  describe('DungeonGenerator — grid validity', function () {
    it('generates a 50x50 grid for each floor', function () {
      for (let f = 0; f < MAX_FLOORS; f++) {
        const result = DungeonGenerator.generate(f, SEED);
        expect(result.tiles.length).toBe(MAP_HEIGHT);
        expect(result.tiles[0].length).toBe(MAP_WIDTH);
      }
    });

    it('all tiles are valid TILES values', function () {
      for (let f = 0; f < MAX_FLOORS; f++) {
        const result = DungeonGenerator.generate(f, SEED);
        for (let y = 0; y < MAP_HEIGHT; y++) {
          for (let x = 0; x < MAP_WIDTH; x++) {
            expect(VALID_TILES.has(result.tiles[y][x])).toBe(true);
          }
        }
      }
    });

    it('explored grid is all false', function () {
      const result = DungeonGenerator.generate(0, SEED);
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          expect(result.explored[y][x]).toBe(false);
        }
      }
    });
  });

  // ── Rooms ───────────────────────────────────────────────────
  describe('DungeonGenerator — rooms', function () {
    it('every floor has at least 5 rooms', function () {
      for (let f = 0; f < MAX_FLOORS; f++) {
        const result = DungeonGenerator.generate(f, SEED);
        expect(result.rooms.length).toBeGreaterThan(4);
      }
    });

    it('all rooms are within map bounds', function () {
      for (let f = 0; f < MAX_FLOORS; f++) {
        const result = DungeonGenerator.generate(f, SEED);
        for (const room of result.rooms) {
          expect(room.x).toBeGreaterThan(0);
          expect(room.y).toBeGreaterThan(0);
          expect(room.x + room.w).toBeLessThan(MAP_WIDTH);
          expect(room.y + room.h).toBeLessThan(MAP_HEIGHT);
        }
      }
    });

    it('rooms have positive dimensions', function () {
      for (let f = 0; f < MAX_FLOORS; f++) {
        const result = DungeonGenerator.generate(f, SEED);
        for (const room of result.rooms) {
          expect(room.w).toBeGreaterThan(0);
          expect(room.h).toBeGreaterThan(0);
        }
      }
    });
  });

  // ── Stairs ──────────────────────────────────────────────────
  describe('DungeonGenerator — stairs', function () {
    it('floor 0 has stairs_down but no stairs_up', function () {
      const result = DungeonGenerator.generate(0, SEED);
      expect(result.stairs.down).toBeTruthy();
      expect(result.stairs.up).toBeNull();
      // Verify tile on grid matches
      expect(result.tiles[result.stairs.down.y][result.stairs.down.x]).toBe(TILES.STAIRS_DOWN);
    });

    it('floors 1-8 have both stairs_down and stairs_up', function () {
      for (let f = 1; f < MAX_FLOORS - 1; f++) {
        const result = DungeonGenerator.generate(f, SEED);
        expect(result.stairs.down).toBeTruthy();
        expect(result.stairs.up).toBeTruthy();
        expect(result.tiles[result.stairs.down.y][result.stairs.down.x]).toBe(TILES.STAIRS_DOWN);
        expect(result.tiles[result.stairs.up.y][result.stairs.up.x]).toBe(TILES.STAIRS_UP);
      }
    });

    it('last floor has stairs_up but no stairs_down', function () {
      const result = DungeonGenerator.generate(MAX_FLOORS - 1, SEED);
      expect(result.stairs.down).toBeNull();
      expect(result.stairs.up).toBeTruthy();
      expect(result.tiles[result.stairs.up.y][result.stairs.up.x]).toBe(TILES.STAIRS_UP);
    });
  });

  // ── Determinism ─────────────────────────────────────────────
  describe('DungeonGenerator — determinism', function () {
    it('same seed produces identical dungeons', function () {
      const a = DungeonGenerator.generate(0, 12345);
      const b = DungeonGenerator.generate(0, 12345);

      // Tiles must be identical
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          expect(a.tiles[y][x]).toBe(b.tiles[y][x]);
        }
      }

      // Rooms must be identical
      expect(a.rooms.length).toBe(b.rooms.length);
      for (let i = 0; i < a.rooms.length; i++) {
        expect(a.rooms[i].x).toBe(b.rooms[i].x);
        expect(a.rooms[i].y).toBe(b.rooms[i].y);
        expect(a.rooms[i].w).toBe(b.rooms[i].w);
        expect(a.rooms[i].h).toBe(b.rooms[i].h);
      }

      // Stairs must be identical
      expect(a.stairs.down.x).toBe(b.stairs.down.x);
      expect(a.stairs.down.y).toBe(b.stairs.down.y);
    });

    it('different seeds produce different dungeons', function () {
      const a = DungeonGenerator.generate(0, 111);
      const b = DungeonGenerator.generate(0, 222);

      let diffCount = 0;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (a.tiles[y][x] !== b.tiles[y][x]) diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThan(0);
    });
  });

  // ── Connectivity ────────────────────────────────────────────
  describe('DungeonGenerator — connectivity', function () {
    it('all walkable tiles are reachable from first walkable tile (floor 0)', function () {
      const result = DungeonGenerator.generate(0, SEED);
      const start = findWalkable(result.tiles);
      expect(start).toBeTruthy();

      const reachable = bfsReachable(result.tiles, start.x, start.y);
      const totalWalkable = countWalkable(result.tiles);
      expect(reachable.size).toBe(totalWalkable);
    });

    it('all walkable tiles reachable on multiple floors', function () {
      // Test a few representative floors
      for (const f of [0, 4, MAX_FLOORS - 1]) {
        const result = DungeonGenerator.generate(f, SEED);
        const start = findWalkable(result.tiles);
        expect(start).toBeTruthy();

        const reachable = bfsReachable(result.tiles, start.x, start.y);
        const totalWalkable = countWalkable(result.tiles);
        expect(reachable.size).toBe(totalWalkable);
      }
    });

    it('stairs are reachable from room centers', function () {
      const result = DungeonGenerator.generate(0, SEED);
      const stairsDown = result.stairs.down;
      expect(stairsDown).toBeTruthy();

      // BFS from stairs should reach all walkable tiles including room floors
      const reachable = bfsReachable(result.tiles, stairsDown.x, stairsDown.y);

      // Every room center should be reachable
      for (const room of result.rooms) {
        const cx = Math.floor(room.x + room.w / 2);
        const cy = Math.floor(room.y + room.h / 2);
        expect(reachable.has(cx + ',' + cy)).toBe(true);
      }
    });

    it('corridors connect rooms — BFS path exists between any two rooms', function () {
      const result = DungeonGenerator.generate(0, SEED);
      if (result.rooms.length < 2) return; // skip if < 2 rooms

      const room0 = result.rooms[0];
      const c0 = { x: Math.floor(room0.x + room0.w / 2), y: Math.floor(room0.y + room0.h / 2) };
      const reachable = bfsReachable(result.tiles, c0.x, c0.y);

      for (let i = 1; i < result.rooms.length; i++) {
        const room = result.rooms[i];
        const cx = Math.floor(room.x + room.w / 2);
        const cy = Math.floor(room.y + room.h / 2);
        expect(reachable.has(cx + ',' + cy)).toBe(true);
      }
    });
  });

  // ── Room Overlap ────────────────────────────────────────────
  describe('DungeonGenerator — room overlap', function () {
    it('rooms have minimal overlap', function () {
      const result = DungeonGenerator.generate(0, SEED);
      let overlapCount = 0;

      for (let i = 0; i < result.rooms.length; i++) {
        for (let j = i + 1; j < result.rooms.length; j++) {
          const a = result.rooms[i];
          const b = result.rooms[j];

          // Check AABB overlap
          const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
          const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
          const area = overlapX * overlapY;
          if (area > 0) overlapCount++;
        }
      }

      // BSP should prevent most overlaps; allow at most 10% of pairs
      const totalPairs = (result.rooms.length * (result.rooms.length - 1)) / 2;
      expect(overlapCount).toBeLessThan(Math.max(1, Math.ceil(totalPairs * 0.1)));
    });
  });
})();
