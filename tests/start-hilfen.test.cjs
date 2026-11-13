// Tests für die reinen Hilfen der Startseite (web/start-hilfen.js).
// Ausführen: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../web/start-hilfen.js');

const spot = (id, o = {}) => ({
  id, name: 'S' + id, foto_pfad: 'p/' + id,
  created_at: '2026-01-' + String(id).padStart(2, '0'), ...o,
});

test('kategorienBauen: Bergseen nur mit has_lake und Foto, ab 3 Spots', () => {
  const k = S.kategorienBauen([
    spot(1, { has_lake: true }), spot(2, { has_lake: true }),
    spot(3, { has_lake: true, foto_pfad: null }),
  ], []);
  assert.equal(k.find((x) => x.key === 'see'), undefined);
});

test('kategorienBauen: Hoch oben sortiert nach Höhe absteigend', () => {
  const k = S.kategorienBauen([1, 2, 3].map((i) => spot(i, { above_treeline: true, elevation_m: i * 1000 })), []);
  assert.deepEqual(k.find((x) => x.key === 'hoch').spots.map((s) => s.id), [3, 2, 1]);
});

test('kategorienBauen: ohne langen Zustieg heißt hike_minutes 0..30, null zählt nicht', () => {
  const k = S.kategorienBauen([
    spot(1, { hike_minutes: 0 }), spot(2, { hike_minutes: 30 }), spot(3, { hike_minutes: 10 }),
    spot(4, { hike_minutes: 31 }), spot(5, { hike_minutes: null }),
  ], []);
  assert.deepEqual(k.find((x) => x.key === 'kurz').spots.map((s) => s.id).sort(), [1, 2, 3]);
});

test('kategorienBauen: max. 10 je Reihe, ohneIds fehlen', () => {
  const viele = Array.from({ length: 14 }, (_, i) => spot(i + 1));
  const neu = S.kategorienBauen(viele, [1]).find((x) => x.key === 'neu');
  assert.equal(neu.spots.length, 10);
  assert.ok(!neu.spots.some((s) => s.id === 1));
});

test('kategorienBauen: Neu dazugekommen ist nach created_at absteigend', () => {
  const neu = S.kategorienBauen([spot(2), spot(9), spot(5)], []).find((x) => x.key === 'neu');
  assert.deepEqual(neu.spots.map((s) => s.id), [9, 5, 2]);
});

test('kategorienBauen: Reihenfolge see, hoch, kurz, neu', () => {
  const alle = Array.from({ length: 6 }, (_, i) => spot(i + 1, { has_lake: true, above_treeline: true, hike_minutes: 5 }));
  assert.deepEqual(S.kategorienBauen(alle, []).map((k) => k.key), ['see', 'hoch', 'kurz', 'neu']);
});

test('karussellWaehlen: Held zuerst, keine Doppelten, höchstens 5', () => {
  const alle = Array.from({ length: 12 }, (_, i) => spot(i + 1, { has_lake: true, above_treeline: true, hike_minutes: 5 }));
  const k = S.karussellWaehlen(alle[0], S.kategorienBauen(alle, [alle[0].id]));
  assert.equal(k[0].spot.id, 1);
  assert.equal(k[0].etikett, 'HEUTE EMPFOHLEN');
  assert.equal(new Set(k.map((x) => x.spot.id)).size, k.length);
  assert.ok(k.length >= 2 && k.length <= 5);
});

test('karussellWaehlen: Held ohne Foto wird übersprungen', () => {
  assert.equal(S.karussellWaehlen(spot(1, { foto_pfad: null }), []).length, 0);
});

const B = ['karte', 'entdecken', 'merken', 'plus', 'profil'];

test('startBereich: Neustart online → entdecken', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: null, jetzt: 0 }), 'entdecken');
});

test('startBereich: offline → karte', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: false, versteckt: null, jetzt: 0 }), 'karte');
});

test('startBereich: ?los=merken gewinnt, Unbekanntes nicht', () => {
  assert.equal(S.startBereich({ los: 'merken', bereiche: B, online: true, versteckt: null, jetzt: 0 }), 'merken');
  assert.equal(S.startBereich({ los: 'quatsch', bereiche: B, online: true, versteckt: null, jetzt: 0 }), 'entdecken');
});

test('startBereich: Rückkehr nach 29 min → null, nach 30 min → entdecken', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: 0, jetzt: 29 * 60000 }), null);
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: 0, jetzt: 30 * 60000 }), 'entdecken');
});

test('startBereich: Rückkehr nach 40 min mit offenem Spot-Blatt → null (Spot bleibt)', () => {
  assert.equal(S.startBereich({ los: null, bereiche: B, online: true, versteckt: 0, jetzt: 40 * 60000, blattOffen: true }), null);
});

test('spotsZusammenfuehren: doppelte IDs nur einmal, erste Fassung gewinnt', () => {
  const m = S.spotsZusammenfuehren([[spot(1), spot(2)], [spot(2, { name: 'anders' }), spot(3)], null]);
  assert.deepEqual(m.map((s) => s.id), [1, 2, 3]);
  assert.equal(m[1].name, 'S2');
});
