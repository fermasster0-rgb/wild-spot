// ============================================================================
// Kleine Rechenhilfen für das Spot-Blatt (Redesign 2026-11-10)
//
// Bewusst ohne Zugriff auf Seite, Karte oder Datenbank: Was hier steht, nimmt
// Zahlen und gibt Text zurück. Deshalb lässt es sich in Node testen
// (tests/spot-detail-hilfen.test.cjs) und im Browser gleich benutzen —
// dort als window.WILDSPOT_BLATT.
// ============================================================================

'use strict';

(function (wurzel, fabrik) {
  const api = fabrik();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else wurzel.WILDSPOT_BLATT = api;
})(typeof self !== 'undefined' ? self : this, function () {

  const zahl = (w) => (w === null || w === undefined || w === '' ? NaN : Number(w));

  // Die gemessene Gehzeit der berechneten Route schlägt die Schätzung dessen,
  // der den Spot eingetragen hat (siehe route.js, „Was das löst").
  function zustiegMinuten(spot) {
    const route = zahl(spot && spot.route_minutes);
    if (Number.isFinite(route) && route > 0) return Math.round(route);
    const geschaetzt = zahl(spot && spot.hike_minutes);
    if (Number.isFinite(geschaetzt) && geschaetzt >= 0) return Math.round(geschaetzt);
    return null;
  }

  function dauerText(minuten) {
    const m = zahl(minuten);
    if (!Number.isFinite(m)) return '–';
    if (m < 60) return Math.round(m) + ' min';
    const std = Math.floor(m / 60);
    const rest = Math.round(m % 60);
    return rest ? `${std} h ${rest} min` : `${std} h`;
  }

  // Schmales geschütztes Leerzeichen als Tausendertrenner, wie im
  // österreichischen Satz üblich: 2 136 m, nicht 2.136 m (das läse man als
  // Dezimalzahl) und nicht 2136 m (schwerer zu erfassen).
  function hoeheText(meter) {
    const m = zahl(meter);
    if (!Number.isFinite(m)) return '–';
    const ganz = String(Math.round(m)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return ganz + ' m';
  }

  function hatRoute(spot) {
    return Array.isArray(spot && spot.route_line) && spot.route_line.length > 1;
  }

  return { zustiegMinuten, dauerText, hoeheText, hatRoute };
});
