// ============================================================================
// Kleine Rechenhilfen für die Startseite (Feinschliff 2026-11-13)
//
// Ohne Zugriff auf Seite oder Datenbank: Hier wird nur entschieden, welche
// Spots in welche Reihe kommen, welche das Karussell zeigt und wo die App
// beim Öffnen anfängt. Deshalb in Node testbar (tests/start-hilfen.test.cjs)
// und im Browser als window.WILDSPOT_START.
// ============================================================================

'use strict';

(function (wurzel, fabrik) {
  const api = fabrik();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else wurzel.WILDSPOT_START = api;
})(typeof self !== 'undefined' ? self : this, function () {

  // Eine Reihe mit einem oder zwei Spots sieht nach leerer App aus, nicht
  // nach Auswahl. Und mehr als zehn wischt niemand durch.
  const MINDESTENS = 3;
  const HOECHSTENS = 10;

  // Jede Reihe folgt aus einer echten Eigenschaft der Spots — nichts, was
  // man raten müsste. Die Reihenfolge hier ist die auf der Seite.
  const KATEGORIEN = [
    { key: 'see', titel: 'Bergseen zum Übernachten', etikett: 'AM WASSER',
      passt: (s) => s.has_lake === true },
    { key: 'hoch', titel: 'Hoch oben', etikett: 'HOCH HINAUS',
      passt: (s) => s.above_treeline === true,
      ordnung: (a, b) => (Number(b.elevation_m) || 0) - (Number(a.elevation_m) || 0) },
    { key: 'kurz', titel: 'Ohne langen Zustieg', etikett: 'SCHNELL DA',
      passt: (s) => s.hike_minutes !== null && s.hike_minutes !== undefined &&
        Number(s.hike_minutes) >= 0 && Number(s.hike_minutes) <= 30 },
    { key: 'neu', titel: 'Neu dazugekommen', etikett: 'NEU',
      passt: () => true,
      ordnung: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) },
  ];

  function kategorienBauen(spots, ohneIds) {
    const ohne = new Set(ohneIds || []);
    const mitFoto = (spots || []).filter((s) => s && s.foto_pfad && !ohne.has(s.id));
    const reihen = [];
    for (const k of KATEGORIEN) {
      let liste = mitFoto.filter(k.passt);
      if (k.ordnung) liste = liste.slice().sort(k.ordnung);
      if (liste.length < MINDESTENS) continue;
      reihen.push({ key: k.key, titel: k.titel, spots: liste.slice(0, HOECHSTENS) });
    }
    return reihen;
  }

  // Vorne der Spot, der heute empfohlen ist, danach aus jeder Reihe der erste,
  // der noch nicht vorkommt — zweimal derselbe Platz im Karussell sähe aus,
  // als hätte die App nicht mehr.
  function karussellWaehlen(held, kategorien) {
    const auswahl = [];
    const schon = new Set();
    if (held && held.foto_pfad) {
      auswahl.push({ spot: held, etikett: 'HEUTE EMPFOHLEN' });
      schon.add(held.id);
    }
    for (const reihe of kategorien || []) {
      if (auswahl.length >= 5) break;
      const vorlage = KATEGORIEN.find((k) => k.key === reihe.key);
      const s = reihe.spots.find((x) => !schon.has(x.id));
      if (!s || !vorlage) continue;
      auswahl.push({ spot: s, etikett: vorlage.etikett });
      schon.add(s.id);
    }
    return auswahl;
  }

  const RUECKKEHR_MS = 30 * 60 * 1000;

  // Wo die App anfängt. Ein Kurzbefehl (?los=) gewinnt immer. Ohne Netz die
  // Karte: Sie geht mit gespeicherten Gebieten auch offline, die Startseite
  // nicht. Kommt die App nach kurzer Zeit aus dem Hintergrund zurück, bleibt
  // alles, wie es war (null) — erst nach einer halben Stunde ist es ein
  // neues Öffnen. Außer es ist ein Spot offen: Wer mit „Anfahrt" in Google
  // Maps zum Platz gefahren ist, will ihn bei der Ankunft noch vor sich haben.
  function startBereich({ los, bereiche, online, versteckt, jetzt, blattOffen = false }) {
    const rueckkehr = versteckt !== null && versteckt !== undefined;
    if (rueckkehr && (blattOffen || jetzt - versteckt < RUECKKEHR_MS)) return null;
    if (los && (bereiche || []).includes(los)) return los;
    return online ? 'entdecken' : 'karte';
  }

  // Mehrere Abfragen zu einer Liste: Die Datenbank liefert je Abfrage
  // höchstens 50 bzw. 100 Spots, deshalb wird pro Kategorie gezielt gefragt
  // und hier zusammengelegt. Jeder Spot nur einmal.
  function spotsZusammenfuehren(listen) {
    const gesehen = new Set();
    const alle = [];
    for (const liste of listen || []) {
      for (const sp of liste || []) {
        if (!sp || gesehen.has(sp.id)) continue;
        gesehen.add(sp.id);
        alle.push(sp);
      }
    }
    return alle;
  }

  return { kategorienBauen, karussellWaehlen, startBereich, spotsZusammenfuehren };
});
