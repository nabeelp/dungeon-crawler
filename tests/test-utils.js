/**
 * test-utils.js — Tests for Utils module
 * Owner: Amy (Tester)
 *
 * Covers: seeded RNG, distance functions, grid helpers, clamp, inBounds
 */
(function () {
  'use strict';

  const { describe, it, expect } = TestRunner;

  // ── Seeded RNG ──────────────────────────────────────────────
  describe('Utils.createRNG — determinism', function () {
    it('same seed produces identical sequence', function () {
      const a = Utils.createRNG(42);
      const b = Utils.createRNG(42);
      for (let i = 0; i < 100; i++) {
        expect(a.random()).toBe(b.random());
      }
    });

    it('different seeds produce different sequences', function () {
      const a = Utils.createRNG(1);
      const b = Utils.createRNG(2);
      let same = 0;
      for (let i = 0; i < 50; i++) {
        if (a.random() === b.random()) same++;
      }
      expect(same).toBeLessThan(50);
    });

    it('random() returns values in [0, 1)', function () {
      const rng = Utils.createRNG(999);
      for (let i = 0; i < 200; i++) {
        const v = rng.random();
        expect(v >= 0).toBe(true);
        expect(v < 1).toBe(true);
      }
    });
  });

  describe('Utils.createRNG — randInt', function () {
    it('randInt stays within bounds (0-10)', function () {
      const rng = Utils.createRNG(77);
      for (let i = 0; i < 200; i++) {
        const v = rng.randInt(0, 10);
        expect(v >= 0).toBe(true);
        expect(v <= 10).toBe(true);
      }
    });

    it('randInt(5, 5) always returns 5', function () {
      const rng = Utils.createRNG(123);
      for (let i = 0; i < 20; i++) {
        expect(rng.randInt(5, 5)).toBe(5);
      }
    });

    it('randInt produces integers only', function () {
      const rng = Utils.createRNG(456);
      for (let i = 0; i < 100; i++) {
        const v = rng.randInt(0, 100);
        expect(v).toBe(Math.floor(v));
      }
    });
  });

  describe('Utils.createRNG — pick and shuffle', function () {
    it('pick returns an element from the array', function () {
      const rng = Utils.createRNG(10);
      const arr = ['a', 'b', 'c', 'd'];
      for (let i = 0; i < 50; i++) {
        expect(arr.includes(rng.pick(arr))).toBe(true);
      }
    });

    it('shuffle preserves all elements', function () {
      const rng = Utils.createRNG(20);
      const arr = [1, 2, 3, 4, 5];
      const copy = [...arr];
      rng.shuffle(copy);
      expect(copy.length).toBe(arr.length);
      expect(copy.sort().join(',')).toBe(arr.sort().join(','));
    });

    it('shuffle is deterministic for same seed', function () {
      const a = Utils.createRNG(30);
      const b = Utils.createRNG(30);
      const arrA = [1, 2, 3, 4, 5, 6, 7, 8];
      const arrB = [1, 2, 3, 4, 5, 6, 7, 8];
      a.shuffle(arrA);
      b.shuffle(arrB);
      expect(arrA.join(',')).toBe(arrB.join(','));
    });
  });

  // ── Distance ────────────────────────────────────────────────
  describe('Utils — distance calculations', function () {
    it('manhattanDist known values', function () {
      expect(Utils.manhattanDist(0, 0, 3, 4)).toBe(7);
      expect(Utils.manhattanDist(1, 1, 1, 1)).toBe(0);
      expect(Utils.manhattanDist(0, 0, 0, 5)).toBe(5);
      expect(Utils.manhattanDist(-2, -3, 2, 3)).toBe(10);
    });

    it('euclideanDist known values', function () {
      expect(Utils.euclideanDist(0, 0, 3, 4)).toBe(5);
      expect(Utils.euclideanDist(0, 0, 0, 0)).toBe(0);
      const d = Utils.euclideanDist(1, 1, 2, 2);
      expect(Math.abs(d - Math.SQRT2) < 0.0001).toBe(true);
    });

    it('chebyshevDist known values', function () {
      expect(Utils.chebyshevDist(0, 0, 3, 4)).toBe(4);
      expect(Utils.chebyshevDist(0, 0, 7, 2)).toBe(7);
      expect(Utils.chebyshevDist(5, 5, 5, 5)).toBe(0);
    });
  });

  // ── inBounds ────────────────────────────────────────────────
  describe('Utils.inBounds', function () {
    it('origin is in bounds', function () {
      expect(Utils.inBounds(0, 0)).toBe(true);
    });

    it('max valid coords are in bounds', function () {
      expect(Utils.inBounds(49, 49)).toBe(true);
    });

    it('just outside bounds returns false', function () {
      expect(Utils.inBounds(50, 0)).toBe(false);
      expect(Utils.inBounds(0, 50)).toBe(false);
      expect(Utils.inBounds(-1, 0)).toBe(false);
      expect(Utils.inBounds(0, -1)).toBe(false);
    });

    it('custom dimensions work', function () {
      expect(Utils.inBounds(9, 9, 10, 10)).toBe(true);
      expect(Utils.inBounds(10, 10, 10, 10)).toBe(false);
      expect(Utils.inBounds(0, 0, 1, 1)).toBe(true);
    });
  });

  // ── createGrid ──────────────────────────────────────────────
  describe('Utils.createGrid', function () {
    it('creates correct dimensions', function () {
      const g = Utils.createGrid(5, 3, 0);
      expect(g.length).toBe(3);
      expect(g[0].length).toBe(5);
      expect(g[2].length).toBe(5);
    });

    it('fills with the provided value', function () {
      const g = Utils.createGrid(4, 4, 99);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          expect(g[y][x]).toBe(99);
        }
      }
    });

    it('rows are independent (not shared references)', function () {
      const g = Utils.createGrid(3, 3, 0);
      g[0][0] = 1;
      expect(g[1][0]).toBe(0);
    });
  });

  // ── clamp ───────────────────────────────────────────────────
  describe('Utils.clamp', function () {
    it('value within range is unchanged', function () {
      expect(Utils.clamp(5, 0, 10)).toBe(5);
    });

    it('value below min is clamped to min', function () {
      expect(Utils.clamp(-5, 0, 10)).toBe(0);
    });

    it('value above max is clamped to max', function () {
      expect(Utils.clamp(15, 0, 10)).toBe(10);
    });

    it('value equal to min is unchanged', function () {
      expect(Utils.clamp(0, 0, 10)).toBe(0);
    });

    it('value equal to max is unchanged', function () {
      expect(Utils.clamp(10, 0, 10)).toBe(10);
    });

    it('negative range works', function () {
      expect(Utils.clamp(-3, -5, -1)).toBe(-3);
      expect(Utils.clamp(-10, -5, -1)).toBe(-5);
      expect(Utils.clamp(0, -5, -1)).toBe(-1);
    });
  });

  // ── Neighbour helpers ───────────────────────────────────────
  describe('Utils — neighbour helpers', function () {
    it('getCardinalNeighbours returns 4 neighbours', function () {
      const n = Utils.getCardinalNeighbours(5, 5);
      expect(n.length).toBe(4);
    });

    it('getAllNeighbours returns 8 neighbours', function () {
      const n = Utils.getAllNeighbours(5, 5);
      expect(n.length).toBe(8);
    });
  });

  // ── ID generation ───────────────────────────────────────────
  describe('Utils — ID generation', function () {
    it('generateId produces incrementing IDs', function () {
      Utils.resetIdCounter();
      const a = Utils.generateId();
      const b = Utils.generateId();
      expect(b).toBe(a + 1);
    });

    it('resetIdCounter resets to 1', function () {
      Utils.resetIdCounter();
      expect(Utils.generateId()).toBe(1);
    });
  });
})();
