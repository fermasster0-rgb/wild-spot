// Tests für die reine Logik des Wegweisers (web/wegweiser.js).
// Ausführen: node --test tests/*.test.cjs
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../web/wegweiser.js');

test('streckenLaengen beginnt bei 0 und misst Meter', () => {
  const l = W.streckenLaengen([[15, 47], [15, 47.001]]);
  assert.equal(l[0], 0);
  assert.ok(Math.abs(l[1] - 111.2) < 0.5, `erwartet ≈111,2 m, war ${l[1]}`);
});

test('teilLinie bei 0 ist nur der Startpunkt', () => {
  const L = [[0, 0], [0, 0.001], [0, 0.002]];
  assert.deepEqual(W.teilLinie(L, 0), [[0, 0]]);
});

test('teilLinie bei 1 ist die ganze Linie', () => {
  const L = [[0, 0], [0, 0.001], [0, 0.002]];
  assert.deepEqual(W.teilLinie(L, 1), L);
});

test('teilLinie interpoliert den letzten Punkt', () => {
  const t = W.teilLinie([[0, 0], [0, 0.002]], 0.5);
  const letzter = t[t.length - 1];
  assert.ok(Math.abs(letzter[0]) < 1e-6);
  assert.ok(Math.abs(letzter[1] - 0.001) < 1e-6, `erwartet 0.001, war ${letzter[1]}`);
});

test('sanft ist ease-in-out mit festen Enden', () => {
  assert.equal(W.sanft(0), 0);
  assert.equal(W.sanft(1), 1);
  assert.equal(W.sanft(0.5), 0.5);
  assert.ok(W.sanft(0.25) < 0.25 && W.sanft(0.75) > 0.75);
});
