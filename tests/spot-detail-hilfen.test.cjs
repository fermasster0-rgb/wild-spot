// Tests für die reinen Hilfen des Spot-Blatts (web/blatt-hilfen.js).
// Ausführen: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../web/blatt-hilfen.js');

test('zustiegMinuten nimmt zuerst die berechnete Route', () => {
  assert.equal(H.zustiegMinuten({ route_minutes: 240, hike_minutes: 200 }), 240);
});

test('zustiegMinuten fällt auf die eingetragene Gehzeit zurück', () => {
  assert.equal(H.zustiegMinuten({ hike_minutes: 45 }), 45);
});

test('zustiegMinuten ohne Angaben ist null', () => {
  assert.equal(H.zustiegMinuten({}), null);
  assert.equal(H.zustiegMinuten({ route_minutes: null, hike_minutes: null }), null);
});

test('dauerText schreibt Minuten und Stunden', () => {
  assert.equal(H.dauerText(45), '45 min');
  assert.equal(H.dauerText(240), '4 h');
  assert.equal(H.dauerText(150), '2 h 30 min');
  assert.equal(H.dauerText(null), '–');
});

test('hoeheText trennt Tausender mit schmalem Leerzeichen', () => {
  assert.equal(H.hoeheText(2136), '2 136 m');
  assert.equal(H.hoeheText(980), '980 m');
  assert.equal(H.hoeheText(null), '–');
});

test('hatRoute braucht mindestens zwei Punkte', () => {
  assert.equal(H.hatRoute({ route_line: [[15, 47], [15.1, 47.1]] }), true);
  assert.equal(H.hatRoute({ route_line: [[15, 47]] }), false);
  assert.equal(H.hatRoute({}), false);
});
