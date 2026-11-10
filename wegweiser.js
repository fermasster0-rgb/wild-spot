// ============================================================================
// Der Wegweiser: Rechnen für die wachsende Route (Redesign 2026-11-10)
//
// „Weg zum Spot" lässt die Linie vom Parkplatz zum Zelt wachsen, wie im
// Werbevideo. Damit das gleichmäßig aussieht, wächst sie nicht Punkt für
// Punkt (Routen haben dichte und dünne Abschnitte), sondern nach Metern:
// Bei 50 % ist die halbe Strecke gezeichnet, egal wie die Punkte verteilt
// sind.
//
// Hier steht nur die Rechnung — ohne Karte, ohne Seite. Deshalb in Node
// testbar (tests/wegweiser.test.cjs); im Browser als window.WILDSPOT_WEGWEISER.
// Die Animation selbst steht in route.js (routeAnimieren).
// ============================================================================

'use strict';

(function (wurzel, fabrik) {
  const api = fabrik();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else wurzel.WILDSPOT_WEGWEISER = api;
})(typeof self !== 'undefined' ? self : this, function () {

  const ERDRADIUS = 6371008.8;   // mittlerer Erdradius in Metern
  const rad = (g) => (g * Math.PI) / 180;

  function abstand([lng1, lat1], [lng2, lat2]) {
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * ERDRADIUS * Math.asin(Math.sqrt(a));
  }

  // Kumulierte Meter bis zu jedem Punkt; der erste ist 0.
  function streckenLaengen(coords) {
    const l = [0];
    for (let i = 1; i < coords.length; i++) l.push(l[i - 1] + abstand(coords[i - 1], coords[i]));
    return l;
  }

  // Die Linie vom Start bis zum Anteil 0…1 der Gesamtlänge. Der letzte Punkt
  // liegt genau auf der Strecke zwischen zwei Stützpunkten.
  function teilLinie(coords, anteil, laengen = streckenLaengen(coords)) {
    if (!coords.length) return [];
    if (anteil <= 0) return [coords[0]];
    if (anteil >= 1) return coords.slice();
    const ziel = laengen[laengen.length - 1] * anteil;
    const aus = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      if (laengen[i] < ziel) { aus.push(coords[i]); continue; }
      const stueck = laengen[i] - laengen[i - 1];
      const t = stueck > 0 ? (ziel - laengen[i - 1]) / stueck : 0;
      const [x1, y1] = coords[i - 1];
      const [x2, y2] = coords[i];
      aus.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      break;
    }
    return aus;
  }

  // Langsamer Anfang, langsames Ende — wie ein Finger, der den Weg nachfährt.
  function sanft(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  return { streckenLaengen, teilLinie, sanft };
});
