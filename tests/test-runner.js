/**
 * test-runner.js — Lightweight browser-based test framework
 * Owner: Amy (Tester)
 *
 * Provides describe/it/expect API similar to Jest/Mocha.
 * Renders results to a styled HTML page.
 * Depends on: nothing (standalone)
 */
(function () {
  'use strict';

  const suites = [];
  let currentSuite = null;

  // ── Registration ────────────────────────────────────────────
  function describe(name, fn) {
    const suite = { name, tests: [], passed: 0, failed: 0, errors: [] };
    suites.push(suite);
    const prev = currentSuite;
    currentSuite = suite;
    try { fn(); } catch (e) {
      suite.errors.push({ name: '(suite setup)', error: e });
    }
    currentSuite = prev;
  }

  function it(name, fn) {
    if (!currentSuite) throw new Error('it() must be called inside describe()');
    currentSuite.tests.push({ name, fn });
  }

  // ── Assertions ──────────────────────────────────────────────
  function expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
        }
      },
      toEqual(expected) {
        const a = JSON.stringify(actual);
        const b = JSON.stringify(expected);
        if (a !== b) {
          throw new Error(`Expected ${trunc(a)} to deep-equal ${trunc(b)}`);
        }
      },
      toBeTruthy() {
        if (!actual) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be truthy`);
        }
      },
      toBeFalsy() {
        if (actual) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be falsy`);
        }
      },
      toBeGreaterThan(n) {
        if (!(actual > n)) {
          throw new Error(`Expected ${actual} to be greater than ${n}`);
        }
      },
      toBeLessThan(n) {
        if (!(actual < n)) {
          throw new Error(`Expected ${actual} to be less than ${n}`);
        }
      },
      toContain(item) {
        if (Array.isArray(actual)) {
          if (!actual.includes(item)) {
            throw new Error(`Expected array to contain ${JSON.stringify(item)}`);
          }
        } else if (typeof actual === 'string') {
          if (!actual.includes(item)) {
            throw new Error(`Expected string to contain "${item}"`);
          }
        } else if (actual instanceof Set) {
          if (!actual.has(item)) {
            throw new Error(`Expected Set to contain ${JSON.stringify(item)}`);
          }
        } else {
          throw new Error('toContain() requires an Array, String, or Set');
        }
      },
      toThrow() {
        if (typeof actual !== 'function') {
          throw new Error('toThrow() requires a function');
        }
        let threw = false;
        try { actual(); } catch (_) { threw = true; }
        if (!threw) {
          throw new Error('Expected function to throw');
        }
      },
      toBeNull() {
        if (actual !== null) {
          throw new Error(`Expected ${JSON.stringify(actual)} to be null`);
        }
      },
      toNotBe(unexpected) {
        if (actual === unexpected) {
          throw new Error(`Expected value to not be ${JSON.stringify(unexpected)}`);
        }
      },
      toBeInstanceOf(cls) {
        if (!(actual instanceof cls)) {
          throw new Error(`Expected value to be instance of ${cls.name}`);
        }
      }
    };
  }

  function trunc(s, max) {
    max = max || 120;
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  // ── Runner ──────────────────────────────────────────────────
  function run() {
    const startTime = performance.now();
    let totalPassed = 0;
    let totalFailed = 0;
    const results = [];

    for (const suite of suites) {
      const suiteResult = { name: suite.name, tests: [], passed: 0, failed: 0 };

      for (const test of suite.tests) {
        try {
          test.fn();
          suiteResult.passed++;
          totalPassed++;
          suiteResult.tests.push({ name: test.name, passed: true });
        } catch (e) {
          suiteResult.failed++;
          totalFailed++;
          suiteResult.tests.push({ name: test.name, passed: false, error: e.message || String(e) });
        }
      }

      // Include suite-level errors
      for (const err of suite.errors) {
        suiteResult.failed++;
        totalFailed++;
        suiteResult.tests.push({ name: err.name, passed: false, error: err.error.message || String(err.error) });
      }

      results.push(suiteResult);
    }

    const elapsed = (performance.now() - startTime).toFixed(1);

    renderResults(results, totalPassed, totalFailed, elapsed);
    return { totalPassed, totalFailed, elapsed, results };
  }

  // ── Rendering ───────────────────────────────────────────────
  function renderResults(results, totalPassed, totalFailed, elapsed) {
    const root = document.getElementById('test-results');
    if (!root) return;

    const allPassed = totalFailed === 0;
    const total = totalPassed + totalFailed;

    let html = `
      <div class="summary ${allPassed ? 'pass' : 'fail'}">
        <h1>${allPassed ? '✅ All Tests Passed' : '❌ Some Tests Failed'}</h1>
        <p><strong>${totalPassed}</strong> passed, <strong>${totalFailed}</strong> failed out of <strong>${total}</strong> tests in <strong>${elapsed}ms</strong></p>
      </div>
    `;

    for (const suite of results) {
      const suitePass = suite.failed === 0;
      html += `<div class="suite">`;
      html += `<h2 class="${suitePass ? 'pass' : 'fail'}">${suitePass ? '✅' : '❌'} ${esc(suite.name)} (${suite.passed}/${suite.passed + suite.failed})</h2>`;

      for (const test of suite.tests) {
        if (test.passed) {
          html += `<div class="test pass">✔ ${esc(test.name)}</div>`;
        } else {
          html += `<div class="test fail">✘ ${esc(test.name)}<div class="error">${esc(test.error)}</div></div>`;
        }
      }

      html += `</div>`;
    }

    root.innerHTML = html;
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Public API ──────────────────────────────────────────────
  window.TestRunner = { describe, it, expect, run };
})();
