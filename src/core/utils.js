/**
 * utils.js — Shared utility functions
 * Owner: Sheldon (Lead + Dungeon Generation)
 *
 * Seeded PRNG, distance helpers, direction utils.
 * Depends on: constants.js (must be loaded first)
 */
(function () {
  'use strict';

  // ── Seeded PRNG (Mulberry32) ───────────────────────────────
  // Fast, deterministic 32-bit PRNG. Good enough for dungeon gen.
  function createRNG(seed) {
    let s = seed | 0;
    function next() {
      s |= 0;
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return {
      /** Returns float in [0, 1) */
      random: next,
      /** Returns integer in [min, max] inclusive */
      randInt(min, max) {
        return Math.floor(next() * (max - min + 1)) + min;
      },
      /** Pick a random element from an array */
      pick(arr) {
        return arr[Math.floor(next() * arr.length)];
      },
      /** Shuffle array in place (Fisher-Yates) */
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      }
    };
  }

  // ── Distance Calculations ──────────────────────────────────
  function manhattanDist(x1, y1, x2, y2) {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  function euclideanDist(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function chebyshevDist(x1, y1, x2, y2) {
    return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  // ── Direction Helpers ──────────────────────────────────────
  /** Get the 4 cardinal neighbours of (x, y) */
  function getCardinalNeighbours(x, y) {
    return [
      { x: x,     y: y - 1 },
      { x: x + 1, y: y     },
      { x: x,     y: y + 1 },
      { x: x - 1, y: y     }
    ];
  }

  /** Get all 8 neighbours of (x, y) */
  function getAllNeighbours(x, y) {
    const dirs = Constants.DIRECTIONS;
    return Object.values(dirs).map(d => ({ x: x + d.dx, y: y + d.dy }));
  }

  // ── Grid Helpers ───────────────────────────────────────────
  /** Check whether (x, y) is inside the map bounds */
  function inBounds(x, y, w, h) {
    w = w || Constants.MAP_WIDTH;
    h = h || Constants.MAP_HEIGHT;
    return x >= 0 && y >= 0 && x < w && y < h;
  }

  /** Create a 2D array filled with a value */
  function createGrid(w, h, fillValue) {
    return Array.from({ length: h }, () =>
      Array.from({ length: w }, () => fillValue)
    );
  }

  // ── ID Generation ──────────────────────────────────────────
  let _nextId = 1;
  function generateId() {
    return _nextId++;
  }

  /** Reset the ID counter (useful for tests / new games) */
  function resetIdCounter() {
    _nextId = 1;
  }

  // ── Clamping ───────────────────────────────────────────────
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // ── Public API ─────────────────────────────────────────────
  window.Utils = Object.freeze({
    createRNG,
    manhattanDist,
    euclideanDist,
    chebyshevDist,
    getCardinalNeighbours,
    getAllNeighbours,
    inBounds,
    createGrid,
    generateId,
    resetIdCounter,
    clamp
  });
})();
