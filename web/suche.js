// ============================================================================
// Die Suche
//
// Sie durchsucht drei Töpfe gleichzeitig und zeigt sie in einer Liste:
//
//   1. Spots        — die eigenen Plätze. Stehen immer ganz oben, sie sind
//                     der Grund für die App.
//   2. Auf der Karte — Bergseen, Wasserfälle, Hütten und Quellen aus
//                     OpenStreetMap, soweit sie einen Namen haben (rund
//                     11.500 von 64.000).
//   3. Orte          — alles andere: Städte, Täler, Berge. Kommt von Photon,
//                     einem freien Suchdienst für OpenStreetMap-Daten.
//
// Beim Antippen fliegt die Karte hin. Bei einem Punkt aus Topf 2 wird die
// passende Ebene mit eingeschaltet — sonst fliegt man hin und sieht nichts,
// weil beim Start nur die Spots an sind.
// ============================================================================

'use strict';

const sucheEl       = document.getElementById('suche');
const sucheEingabe  = document.getElementById('suche-eingabe');
const sucheTreffer  = document.getElementById('suche-treffer');
const sucheLeeren   = document.getElementById('suche-leeren');

// Photon gehört zu Komoot und darf frei benutzt werden. Die Suche wird auf
// Österreich und ein Stück Umland begrenzt — ein Treffer in Portugal hilft
// hier niemandem.
const PHOTON = 'https://photon.komoot.io/api/';
const PHOTON_BBOX = '9.0,46.0,17.7,49.4';

// Erst ab zwei Zeichen suchen: bei einem einzelnen Buchstaben kämen tausende
// Treffer, von denen keiner der gemeinte ist.
const MINDESTLAENGE = 2;

let tippTimer = null;
let laufendeSuche = 0;   // zählt mit, damit späte Antworten nicht überholen

// ============================================================================
// 1. TIPPEN
// ============================================================================

sucheEingabe.oninput = () => {
  const q = sucheEingabe.value.trim();
  sucheLeeren.hidden = q === '';

  clearTimeout(tippTimer);

  if (q.length < MINDESTLAENGE) {
    sucheTreffer.hidden = true;
    return;
  }

  // Kurz warten, statt bei jedem Buchstaben loszurennen. Wer "Lünersee"
  // tippt, löst sonst acht Abfragen aus, von denen sieben niemand sieht.
  tippTimer = setTimeout(() => suchen(q), 220);
};

sucheEingabe.onfocus = () => {
  if (sucheEingabe.value.trim().length >= MINDESTLAENGE) sucheTreffer.hidden = false;
};

sucheLeeren.onclick = () => {
  sucheEingabe.value = '';
  sucheLeeren.hidden = true;
  sucheTreffer.hidden = true;
  sucheEingabe.focus();
};

// Klick daneben oder Escape schließt die Liste.
document.addEventListener('click', (e) => {
  if (!sucheEl.contains(e.target)) sucheTreffer.hidden = true;
});
sucheEl.onclick = (e) => e.stopPropagation();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sucheTreffer.hidden) {
    sucheTreffer.hidden = true;
    sucheEingabe.blur();
  }
});

// ============================================================================
// 2. SUCHEN
// ============================================================================

async function suchen(q) {
  const meine = ++laufendeSuche;

  sucheTreffer.hidden = false;
  sucheTreffer.innerHTML = '<p class="suche-leer">Wird gesucht …</p>';

  const [spots, punkte, orte] = await Promise.all([
    spotsSuchen(q), punkteSuchen(q), orteSuchen(q),
  ]);

  // Ist inzwischen weitergetippt worden, gehört das Ergebnis zu einer alten
  // Anfrage — dann darf es die neuere nicht überschreiben.
  if (meine !== laufendeSuche) return;

  zeichnenTreffer(spots, punkte, orte);
}

async function spotsSuchen(q) {
  try {
    const { data, error } = await window.WILDCAMP_AUTH.client
      .rpc('spots_suchen', { q, max_rows: 5 });
    return error ? [] : (data || []);
  } catch { return []; }
}

async function punkteSuchen(q) {
  try {
    const { data, error } = await window.WILDCAMP_AUTH.client
      .rpc('punkte_suchen', { q, max_rows: 7 });
    return error ? [] : (data || []);
  } catch { return []; }
}

async function orteSuchen(q) {
  try {
    const res = await fetch(
      `${PHOTON}?q=${encodeURIComponent(q)}&lang=de&limit=4&bbox=${PHOTON_BBOX}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return [];

    const json = await res.json();
    return (json.features || [])
      .map((f) => ({
        name: f.properties.name,
        // "Zell am See, Salzburg" — der Zusatz macht gleiche Namen
        // unterscheidbar, und davon gibt es in Österreich reichlich.
        wo: [f.properties.city, f.properties.district, f.properties.state]
          .filter((x) => x && x !== f.properties.name)[0] || f.properties.country,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }))
      .filter((o) => o.name);
  } catch { return []; }
}

// ============================================================================
// 3. ANZEIGEN
// ============================================================================

function zeichnenTreffer(spots, punkte, orte) {
  const teile = [];

  if (spots.length) {
    teile.push('<div class="suche-titel">Spots</div>');
    for (const s of spots) {
      teile.push(eintrag('spot', s.name, 'Spot', {
        art: 'spot', id: s.id, name: s.name, lat: s.lat, lng: s.lng,
      }));
    }
  }

  if (punkte.length) {
    teile.push('<div class="suche-titel">Auf der Karte</div>');
    for (const p of punkte) {
      const art = ARTEN[p.kind];
      const zusatz = [art ? art.label : p.kind, p.elevation_m ? p.elevation_m + ' m' : null]
        .filter(Boolean).join(' · ');
      teile.push(eintrag(art ? art.gruppe : 'wasser', p.name, zusatz, {
        art: 'punkt', gruppe: art ? art.gruppe : null, lat: p.lat, lng: p.lng,
      }));
    }
  }

  if (orte.length) {
    teile.push('<div class="suche-titel">Orte</div>');
    for (const o of orte) {
      teile.push(eintrag('ort', o.name, o.wo || 'Ort', {
        art: 'ort', lat: o.lat, lng: o.lng,
      }));
    }
  }

  if (!teile.length) {
    sucheTreffer.innerHTML =
      '<p class="suche-leer">Nichts gefunden.<br>' +
      'Vielleicht anders geschrieben oder kürzer?</p>';
    return;
  }

  sucheTreffer.innerHTML = teile.join('');

  for (const b of sucheTreffer.querySelectorAll('button')) {
    b.onclick = () => hinspringen(JSON.parse(b.dataset.ziel));
  }
}

// Ein Eintrag in der Liste. Das Zeichen ist dasselbe wie in der Legende und
// auf der Karte — man erkennt sofort, was man da vor sich hat.
function eintrag(gruppe, name, zusatz, ziel) {
  const vorlage = document.querySelector('.sym.' + gruppe);
  const zeichen = vorlage
    ? vorlage.outerHTML.replace('sym ' + gruppe, 'sym ' + gruppe)
    : ortZeichen();

  return (
    // Doppelte Anführungszeichen als Begrenzer, nicht einfache. escapeHtml
    // ersetzt beide Sorten — aber wenn hier einmal etwas ohne escapeHtml
    // hineingerät, ist der Schaden mit " kleiner, weil JSON.stringify seine
    // eigenen " ohnehin maskiert.
    `<button type="button" data-ziel="${escapeHtml(JSON.stringify(ziel))}">` +
    zeichen +
    `<span class="wo"><b>${escapeHtml(name)}</b><small>${escapeHtml(zusatz)}</small></span>` +
    '</button>'
  );
}

function ortZeichen() {
  return '<svg class="sym" viewBox="0 0 24 24" aria-hidden="true" ' +
         'style="color:var(--text-weak)">' +
         '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z"/>' +
         '<circle cx="12" cy="10" r="2.6"/></svg>';
}

// ============================================================================
// 4. HINSPRINGEN
// ============================================================================

function hinspringen(ziel) {
  sucheTreffer.hidden = true;
  sucheEingabe.blur();

  // Bei einem Punkt aus OpenStreetMap die zugehörige Ebene einschalten —
  // sonst fliegt man hin und sieht nichts, weil beim Start nur die Spots
  // an sind.
  if (ziel.art === 'punkt' && ziel.gruppe && !ebenen[ziel.gruppe]) {
    ebenen[ziel.gruppe] = true;
    const knopf = document.getElementById('knopf-' + ziel.gruppe);
    if (knopf) knopf.setAttribute('aria-pressed', 'true');
    ebenenAnwenden();
    punkteLaden();
  }

  const zoom = ziel.art === 'ort' ? 12 : 15;
  karte.flyTo({ center: [ziel.lng, ziel.lat], zoom, duration: 1200 });

  // Beim Spot gleich die Leiste öffnen — man hat ihn ja gesucht, um ihn
  // anzusehen. Erst nach dem Flug, sonst schiebt sie die Karte mittendrin.
  if (ziel.art === 'spot' && typeof window.spotDetailOeffnen === 'function') {
    karte.once('moveend', () => {
      window.spotDetailOeffnen(ziel.id, ziel.name, ziel.lat, ziel.lng);
    });
  }
}
