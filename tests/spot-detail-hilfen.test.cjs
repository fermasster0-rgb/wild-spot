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

// --- Stufen des Blatts und Kartenversatz (Feinschliff 2026-11-13) ---------

test('stufeNachZug: Schnipser nach oben aus halb → voll', () => {
  assert.equal(H.stufeNachZug({ von: 'halb', weg: -30, tempo: -0.8, halbHoehe: 330 }), 'voll');
});

test('stufeNachZug: weit nach unten aus halb → zu', () => {
  assert.equal(H.stufeNachZug({ von: 'halb', weg: 120, tempo: 0.1, halbHoehe: 330 }), 'zu');
});

test('stufeNachZug: Schnipser nach unten aus voll → halb', () => {
  assert.equal(H.stufeNachZug({ von: 'voll', weg: 60, tempo: 0.9, halbHoehe: 330 }), 'halb');
});

test('stufeNachZug: langsam bis über die Mitte aus voll → halb, davor → voll', () => {
  assert.equal(H.stufeNachZug({ von: 'voll', weg: 200, tempo: 0.1, halbHoehe: 330 }), 'halb');
  assert.equal(H.stufeNachZug({ von: 'voll', weg: 100, tempo: 0.1, halbHoehe: 330 }), 'voll');
});

test('stufeNachZug: kleiner Zug bleibt auf der Stufe', () => {
  assert.equal(H.stufeNachZug({ von: 'halb', weg: 40, tempo: 0.2, halbHoehe: 330 }), 'halb');
});

test('spotVersatzY zielt auf die Mitte des freien Kartenstücks', () => {
  assert.equal(H.spotVersatzY({ hoehe: 844, obenFrei: 110, blattOben: 444 }), -145);
});

test('zielZoom zoomt nie heraus', () => {
  assert.equal(H.zielZoom(8), 14);
  assert.equal(H.zielZoom(16.5), 16.5);
});
