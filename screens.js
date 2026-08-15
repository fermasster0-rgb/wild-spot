// ============================================================================
// screens.js — die vier Bereiche neben der Karte
//
// Bis hierher war Wild Spot eine Karte. Das ist die richtige Form, wenn man
// schon weiß, wohin — aber es gibt keinen Ort für die Frage davor: Wo könnte
// ich überhaupt hin? Eine Karte beantwortet sie nur, wenn man sie stundenlang
// abfährt.
//
// Deshalb gibt es jetzt fünf Bereiche, umschaltbar über die Leiste unten:
//
//   Entdecken   Spots mit Bild, gefiltert und sortiert. Die Eingangstür.
//   Karte       Alles wie bisher, unverändert.
//   Merkliste   Gemerkte Spots, eigene Spots, offline gespeicherte Gebiete.
//   Plus        Der bezahlte Teil (plus.js).
//   Profil      Konto, Zahlen, Einstellungen, Tag und Nacht.
//
// Diese Datei macht die Umschaltung, füllt Entdecken, Merkliste und Profil,
// und stellt das Merken selbst bereit (window.WILDSPOT_MERKEN) — das braucht
// auch spot-detail.js für das Herz im Spot-Blatt.
// ============================================================================

(() => {
  const auth  = window.WILDCAMP_AUTH;
  const karte = window.WILDCAMP_KARTE;
  const sb    = auth.client;

  // ==========================================================================
  // 1. WERKZEUG
  // ==========================================================================

  const $  = (id) => document.getElementById(id);
  const el = (was) => document.createElement(was);

  // Nutzertext, der in innerHTML landet, unschädlich machen. Dieselbe Liste
  // wie in app.js — inklusive des einfachen Anführungszeichens, siehe die
  // Begründung dort.
  function sicher(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Die Adresse eines Fotos. Der Eimer ist öffentlich, das braucht keinen
  // Schlüssel — dieselbe Rechnung wie in spot-detail.js.
  function fotoAdresse(pfad) {
    if (!pfad) return null;
    return sb.storage.from('spot-photos').getPublicUrl(pfad).data.publicUrl;
  }

  function meter(m) {
    const z = Number(m);
    return Number.isFinite(z) && z > 0 ? z.toLocaleString('de-AT') + ' m' : null;
  }

  function gehzeit(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return null;
    if (m < 60) return m + ' Min';
    const std = Math.floor(m / 60), rest = m % 60;
    return rest ? `${std} h ${rest}` : `${std} h`;
  }

  // „vor 3 Tagen" statt „12.08.2026". Bei etwas, das gerade erst dazugekommen
  // ist, will man den Abstand wissen und nicht das Datum.
  function vorWie(zeit) {
    const dann = new Date(zeit).getTime();
    if (!Number.isFinite(dann)) return '';
    const tage = Math.floor((Date.now() - dann) / 86400000);
    if (tage <= 0)  return 'heute';
    if (tage === 1) return 'gestern';
    if (tage < 7)   return `vor ${tage} Tagen`;
    if (tage < 31)  return `vor ${Math.floor(tage / 7)} Wochen`;
    if (tage < 365) return `vor ${Math.floor(tage / 30)} Monaten`;
    return new Date(zeit).toLocaleDateString('de-AT');
  }

  // Das Zelt für Kacheln ohne Foto. Es steht auch in der Legende im HTML,
  // aber hier braucht es eine eigene Fassung ohne Farbe.
  const ZELT_SVG =
    '<svg viewBox="0 0 24 24"><path d="M12 4l8 15H4z"/><path d="M12 4v15"/>' +
    '<path d="M4 19l8-6 8 6"/></svg>';

  // ==========================================================================
  // 2. DIE UMSCHALTUNG
  //
  // Die Karte wird nie ausgeblendet, sondern nur verdeckt. Deshalb steht sie
  // beim Zurückwechseln sofort wieder da — an derselben Stelle, im selben
  // Zoom, mit denselben geladenen Kacheln. Eine Karte, die sich bei jedem
  // Wechsel neu aufbaut, fühlt sich kaputt an.
  // ==========================================================================

  const BEREICHE = ['entdecken', 'karte', 'merken', 'plus', 'profil'];
  const SPEICHER_TAB = 'wildspot-bereich';

  let aktiv = null;

  // Was beim ersten Öffnen eines Bereichs zu tun ist. Erst dann — niemand
  // soll beim Start Daten für vier Seiten laden, von denen er drei nie
  // aufmacht.
  const geladen = {};

  function bereichZeigen(name, { merken = true, blattBehalten = false } = {}) {
    if (!BEREICHE.includes(name)) name = 'entdecken';
    if (name === aktiv) {
      // Nochmal auf denselben Reiter: nach oben scrollen. Kleine Sache, aber
      // jeder erwartet sie von einer App mit unterer Leiste.
      const s = $('schirm-' + name);
      if (s) s.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Ein offenes Spot-Blatt gehört zu dem Bereich, aus dem es geöffnet wurde.
    // Wer auf einen anderen Reiter wechselt, will es nicht mitnehmen.
    //
    // Die eine Ausnahme ist „Auf der Karte anzeigen": Dort ist der Wechsel
    // genau der Zweck, und das Blatt soll offen bleiben.
    if (!blattBehalten && typeof window.spotDetailSchliessen === 'function') {
      window.spotDetailSchliessen();
    }

    aktiv = name;

    for (const b of BEREICHE) {
      const schirm = $('schirm-' + b);
      if (schirm) schirm.hidden = (b !== name);
    }

    for (const knopf of document.querySelectorAll('.tab')) {
      knopf.setAttribute('aria-selected', String(knopf.dataset.tab === name));
    }

    // Solange ein Bereich offen ist, hat die Karte nichts zu melden: Ihre
    // Knöpfe liegen sonst mit ihrer eigenen Ebene über der Seite.
    document.body.classList.toggle('bereich-offen', name !== 'karte');

    if (merken) {
      try { localStorage.setItem(SPEICHER_TAB, name); } catch (e) {}
    }

    // Beim Wechsel zur Karte prüfen, ob sie inzwischen anders groß ist —
    // etwa weil das Fenster gedreht wurde, während ein Bereich offen war.
    if (name === 'karte' && karte) {
      setTimeout(() => { try { karte.resize(); } catch (e) {} }, 30);
    }

    if (!geladen[name]) {
      geladen[name] = true;
      if (name === 'entdecken') entdeckenFuellen();
      if (name === 'merken')    merklisteFuellen();
      if (name === 'profil')    profilFuellen();
    } else {
      // Beim Wiederkommen nur das, was sich geändert haben kann.
      if (name === 'merken') merklisteFuellen();
      if (name === 'profil') profilFuellen();
    }
  }

  window.WILDSPOT_BEREICH = bereichZeigen;

  // Damit spot-detail.js weiß, ob sein Blatt gerade über der Karte liegt —
  // davon hängt ab, ob der Knopf „Auf der Karte anzeigen" nötig ist.
  window.WILDSPOT_BEREICH_JETZT = () => aktiv;

  for (const knopf of document.querySelectorAll('.tab')) {
    knopf.addEventListener('click', () => bereichZeigen(knopf.dataset.tab));
  }

  // ==========================================================================
  // 3. EINEN SPOT ÖFFNEN
  //
  // Das Blatt geht dort auf, wo man gerade ist — auf der Entdecken-Seite, in
  // der Merkliste, auf der Karte. Es wechselt NICHT von selbst den Bereich.
  //
  // Vorher sprang die App beim Antippen einer Kachel sofort zur Karte. Das
  // war falsch herum: Wer eine Kachel antippt, will zuerst wissen, was das
  // für ein Platz ist. Wo er liegt, ist die Frage danach — und dafür gibt es
  // im Blatt den Knopf „Auf der Karte anzeigen" (spot-detail.js).
  //
  // Der Nebeneffekt ist der eigentliche Gewinn: Man kann sich durch zehn
  // Spots lesen, ohne die Liste zu verlieren. Beim Schließen des Blattes
  // steht man wieder genau dort, wo man war.
  // ==========================================================================

  function spotOeffnen(spot) {
    const lat = Number(spot.lat), lng = Number(spot.lng);

    if (typeof window.spotDetailOeffnen === 'function') {
      window.spotDetailOeffnen(spot.id, spot.name, lat, lng);
    }
  }

  // ==========================================================================
  // 4. DIE MERKLISTE — der Teil, den auch andere Dateien brauchen
  //
  // Die IDs liegen zusätzlich im Browserspeicher. Ohne das müsste das Herz
  // im Spot-Blatt bei jedem Öffnen erst die Datenbank fragen und wäre eine
  // halbe Sekunde lang leer — ausgerechnet bei einem Knopf, der sofort
  // reagieren muss.
  // ==========================================================================

  const MERK_SPEICHER = 'wildspot-gemerkt';
  let gemerkteIds = new Set();

  function gemerktLesen() {
    try {
      const roh = JSON.parse(localStorage.getItem(MERK_SPEICHER) || '[]');
      if (Array.isArray(roh)) gemerkteIds = new Set(roh);
    } catch (e) {}
  }

  function gemerktSchreiben() {
    try {
      localStorage.setItem(MERK_SPEICHER, JSON.stringify([...gemerkteIds]));
    } catch (e) {}
  }

  async function gemerktHolen() {
    if (!auth.nutzer) { gemerkteIds = new Set(); gemerktSchreiben(); return; }
    const { data, error } = await sb.from('saved_spots').select('spot_id');
    if (error) return;                       // kein Netz: der Speicher gilt weiter
    gemerkteIds = new Set((data || []).map((z) => z.spot_id));
    gemerktSchreiben();
  }

  async function merkenUmschalten(spotId) {
    if (!auth.nutzer) {
      if (auth.anmeldenZeigen) auth.anmeldenZeigen();
      return null;
    }

    const drin = gemerkteIds.has(spotId);

    // Zuerst umschalten, dann speichern. Der Knopf soll sofort reagieren —
    // wer auf die Antwort der Datenbank wartet, tippt zweimal.
    if (drin) gemerkteIds.delete(spotId); else gemerkteIds.add(spotId);
    gemerktSchreiben();
    herzenAuffrischen();

    const { error } = drin
      ? await sb.from('saved_spots').delete().eq('spot_id', spotId).eq('user_id', auth.nutzer.id)
      : await sb.from('saved_spots').insert({ spot_id: spotId, user_id: auth.nutzer.id });

    if (error) {
      // Nicht durchgekommen — zurücknehmen, sonst zeigt die App etwas an,
      // was in der Datenbank nicht steht.
      if (drin) gemerkteIds.add(spotId); else gemerkteIds.delete(spotId);
      gemerktSchreiben();
      herzenAuffrischen();
      return null;
    }

    if (aktiv === 'merken') merklisteFuellen();
    return !drin;
  }

  // Alle sichtbaren Herzen auf den Stand bringen — auch das im Spot-Blatt.
  function herzenAuffrischen() {
    for (const h of document.querySelectorAll('[data-merken]')) {
      h.setAttribute('aria-pressed', String(gemerkteIds.has(h.dataset.merken)));
    }
  }

  window.WILDSPOT_MERKEN = {
    hat: (id) => gemerkteIds.has(id),
    umschalten: merkenUmschalten,
    anzahl: () => gemerkteIds.size,
    auffrischen: herzenAuffrischen,
  };

  gemerktLesen();

  // ==========================================================================
  // 5. DIE BAUSTEINE — Kachel und Zeile
  // ==========================================================================

  // Das Bild einer Kachel, mit Notnagel für Spots ohne Foto.
  function bildHtml(pfad) {
    const adresse = fotoAdresse(pfad);
    if (!adresse) {
      return `<span class="kein-bild">${ZELT_SVG}</span>`;
    }
    // loading="lazy": Auf der Entdecken-Seite stehen schnell zwanzig Bilder.
    // Ohne das lädt das Handy alle auf einmal, auch die, die man nie sieht.
    return `<img src="${sicher(adresse)}" alt="" loading="lazy" decoding="async">`;
  }

  // Die Fakten unter einer Kachel: höchstens drei, und immer die
  // aussagekräftigsten zuerst. Vier Angaben in einer Zeile liest niemand.
  //
  // Bewertung und Entfernung stehen bewusst hier unten und nicht auf dem Bild:
  // Oben rechts sitzt schon das Herz, und zwei Dinge in derselben Ecke
  // verdecken sich gegenseitig — bei einer langen Zahl wie „84,8 km" sofort.
  function faktenHtml(s) {
    const teile = [];

    if (Number(s.rating_count) > 0) {
      // toFixed liefert "4.5" mit Punkt. In einer deutschen App steht dort
      // ein Komma — sonst liest man es als englische Zahl.
      teile.push(`<span><span class="mini-stern">★</span> <b>${
        (Number(s.avg_stars) || 0).toLocaleString('de-AT', {
          minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b></span>`);
    }
    // Die Prüfung auf null muss ausdrücklich dastehen: Number(null) ist 0 und
    // nicht NaN. Ohne sie stünde bei jedem Spot ohne Standortbezug „0 km" —
    // also überall dort, wo gar keine Entfernung gerechnet wurde.
    if (s.entfernung_km != null && Number.isFinite(Number(s.entfernung_km))) {
      teile.push(`<span>📍 <b>${Number(s.entfernung_km).toLocaleString('de-AT')} km</b></span>`);
    }

    const hoehe = meter(s.elevation_m);
    if (hoehe && teile.length < 3) teile.push(`<span>⛰️ <b>${hoehe}</b></span>`);
    if (s.water_nearby && teile.length < 3) teile.push('<span>💧 Wasser</span>');
    const zeit = gehzeit(s.hike_minutes);
    if (zeit && teile.length < 3) teile.push(`<span>🚶 ${zeit}</span>`);
    if (s.has_lake && teile.length < 3) teile.push('<span>🏞️ See</span>');
    return teile.join('');
  }

  // Die stehende Kachel für die Bilderreihen.
  function kachel(s, { marke = '', gross = false } = {}) {
    const knopf = el('button');
    knopf.className = 'spotkarte' + (gross ? ' held' : '');
    knopf.type = 'button';

    knopf.innerHTML =
      `<span class="bild">
         ${bildHtml(s.foto_pfad)}
         ${marke ? `<span class="marke${marke === 'Neu' ? ' orange' : ''}">${sicher(marke)}</span>` : ''}
         <span class="auf-bild">
           <b>${sicher(s.name)}</b>
           ${gross && s.description
              ? `<span class="wo">${sicher(String(s.description).slice(0, 90))}${
                   String(s.description).length > 90 ? '…' : ''}</span>` : ''}
         </span>
       </span>
       <span class="fakten">${faktenHtml(s) || '<span>Noch keine Angaben</span>'}</span>`;

    // Das Herz liegt im Bild und darf den Klick auf die Kachel nicht auslösen.
    const herz = el('button');
    herz.type = 'button';
    herz.className = 'merken-knopf';
    herz.dataset.merken = s.id;
    herz.setAttribute('aria-pressed', String(gemerkteIds.has(s.id)));
    herz.setAttribute('aria-label', 'Merken');
    herz.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-9.2A4 4 0 0112 8.4 4 4 0 0119 10.8c0 4.7-7 9.2-7 9.2z"/></svg>';
    herz.addEventListener('click', (e) => { e.stopPropagation(); merkenUmschalten(s.id); });
    knopf.querySelector('.bild').appendChild(herz);

    knopf.addEventListener('click', () => spotOeffnen(s));
    return knopf;
  }

  // Die liegende Zeile für Listen.
  function zeile(s, { platz = null, unten = null } = {}) {
    const knopf = el('button');
    knopf.className = 'spotzeile';
    knopf.type = 'button';
    knopf.innerHTML =
      `${platz !== null ? `<span class="platz">${platz}</span>` : ''}
       <span class="bild">${bildHtml(s.foto_pfad)}</span>
       <span class="wo">
         <b>${sicher(s.name)}</b>
         <span class="fakten">
           ${faktenHtml(s)}
           ${unten ? `<span>${sicher(unten)}</span>` : ''}
         </span>
       </span>`;
    knopf.addEventListener('click', () => spotOeffnen(s));
    return knopf;
  }

  // Graue Kacheln, solange geladen wird. Sie halten die Höhe, damit die Seite
  // nicht springt, sobald die echten Bilder kommen.
  function warten(behaelter, anzahl, hoch) {
    behaelter.innerHTML = '';
    for (let i = 0; i < anzahl; i++) {
      const p = el('div');
      p.className = 'platzhalter';
      p.style.cssText = `flex:0 0 auto;width:252px;height:${hoch}px`;
      behaelter.appendChild(p);
    }
  }

  // ==========================================================================
  // 6. ENTDECKEN
  // ==========================================================================

  // Die Filterchips. Jeder ist eine Bedingung an die Punkte auf der Karte —
  // deshalb steht neben dem Text gleich der Kartenausdruck, mit dem MapLibre
  // die Punkte ausblendet.
  const CHIPS = [
    { id: 'see',    emoji: '🏞️', text: 'Am See',           regel: ['==', ['get', 'has_lake'], true] },
    { id: 'wasser', emoji: '💧',  text: 'Wasser dabei',      regel: ['==', ['get', 'water_nearby'], true] },
    { id: 'hoch',   emoji: '⛰️',  text: 'Ab 1.500 m',        regel: ['>=', ['coalesce', ['get', 'elevation_m'], 0], 1500] },
    { id: 'baum',   emoji: '🌲',  text: 'Über der Baumgrenze', regel: ['==', ['get', 'above_treeline'], true] },
    { id: 'kurz',   emoji: '🚶',  text: 'Zustieg unter 1 h', regel: ['<=', ['coalesce', ['get', 'hike_minutes'], 9999], 60] },
    { id: 'gut',    emoji: '⭐',  text: 'Gut bewertet',      regel: ['>=', ['coalesce', ['get', 'avg_stars'], 0], 4] },
    { id: 'still',  emoji: '👁️',  text: 'Nicht einsehbar',   regel: ['==', ['get', 'discreet'], 'sehr'] },
    { id: 'feuer',  emoji: '🔥',  text: 'Feuer erlaubt',     regel: ['==', ['get', 'fire_allowed'], 'erlaubt'] },
  ];

  const gewaehlteChips = new Set();

  function chipsBauen() {
    const reihe = $('entdecken-chips');
    if (!reihe) return;
    reihe.innerHTML = '';

    for (const c of CHIPS) {
      const k = el('button');
      k.className = 'chip';
      k.type = 'button';
      k.dataset.chip = c.id;
      k.setAttribute('aria-pressed', 'false');
      k.innerHTML = `<span class="emoji">${c.emoji}</span>${sicher(c.text)}`;
      k.addEventListener('click', () => chipUmschalten(c.id));
      reihe.appendChild(k);
    }
  }

  function chipUmschalten(id) {
    const anAus = gewaehlteChips.has(id);

    if (anAus) {
      gewaehlteChips.delete(id);
    } else {
      // Ohne Plus ist genau ein Filter drin. Das ist keine Schikane, sondern
      // die Grenze, an der es wirklich nützlich wird: Ein Filter zeigt
      // „Spots am See". Erst mehrere zusammen beantworten eine echte Frage.
      const darfMehrere = window.WILDSPOT_PLUS && window.WILDSPOT_PLUS.hat();
      if (gewaehlteChips.size >= 1 && !darfMehrere) {
        if (window.WILDSPOT_PLUS) {
          window.WILDSPOT_PLUS.schranke('mehrere Filter gleichzeitig');
        }
        gewaehlteChips.clear();
      }
      gewaehlteChips.add(id);
    }

    for (const k of document.querySelectorAll('[data-chip]')) {
      k.setAttribute('aria-pressed', String(gewaehlteChips.has(k.dataset.chip)));
    }

    filterAnwenden();

    // Ein gesetzter Filter gehört auf die Karte — dort sieht man, was er tut.
    if (gewaehlteChips.size) bereichZeigen('karte');
  }

  // Der Filter läuft über MapLibre selbst: Die Punkte sind längst geladen,
  // es werden nur welche ausgeblendet. Das geht ohne Netz und ohne Warten.
  function filterAnwenden() {
    if (!karte) return;

    const regeln = [...gewaehlteChips]
      .map((id) => (CHIPS.find((c) => c.id === id) || {}).regel)
      .filter(Boolean);

    const filter = regeln.length ? ['all', ...regeln] : null;

    for (const ebene of ['spots-symbol']) {
      try {
        if (karte.getLayer(ebene)) karte.setFilter(ebene, filter);
      } catch (e) { /* Karte noch nicht fertig */ }
    }

    zeigeFilterHinweis(regeln.length);
  }

  // Ein Hinweis auf der Karte, solange gefiltert wird. Ohne den sucht man
  // später den Spot, den man selbst weggefiltert hat.
  function zeigeFilterHinweis(anzahl) {
    let leiste = $('filter-hinweis');

    if (!anzahl) { if (leiste) leiste.remove(); return; }

    if (!leiste) {
      leiste = el('button');
      leiste.id = 'filter-hinweis';
      leiste.type = 'button';
      leiste.style.cssText =
        'align-self:center;display:flex;align-items:center;gap:7px;' +
        'padding:9px 15px;border:0;border-radius:999px;' +
        'background:var(--gruen);color:var(--auf-akzent);' +
        'font:inherit;font-size:13px;font-weight:600;cursor:pointer;' +
        'box-shadow:0 4px 18px var(--sch2)';
      leiste.addEventListener('click', () => {
        gewaehlteChips.clear();
        for (const k of document.querySelectorAll('[data-chip]')) {
          k.setAttribute('aria-pressed', 'false');
        }
        filterAnwenden();
      });

      // Bewusst IN die untere Spalte und nicht frei über die Karte gelegt:
      // Dort stapelt sich alles Untere von selbst übereinander. Ein frei
      // gesetzter Balken müsste die Höhe der Knöpfe darunter nachrechnen —
      // und läge beim ersten Umbau wieder auf ihnen.
      const spalte = document.querySelector('.unten');
      if (spalte) spalte.insertBefore(leiste, spalte.firstChild);
      else document.body.appendChild(leiste);
    }

    leiste.innerHTML =
      `${anzahl} ${anzahl === 1 ? 'Filter' : 'Filter'} aktiv` +
      '<span style="opacity:0.75;font-weight:400">· zurücksetzen ×</span>';
  }

  async function entdeckenFuellen() {
    chipsBauen();

    const heldBlock = $('entdecken-held');
    const neuReihe  = $('entdecken-neu');
    const bestListe = $('entdecken-best');

    if (heldBlock) {
      heldBlock.innerHTML =
        '<div class="platzhalter" style="height:280px;margin:0 18px;border-radius:16px"></div>';
    }
    if (neuReihe)  warten(neuReihe, 3, 218);
    if (bestListe) bestListe.innerHTML =
      '<div class="platzhalter" style="height:94px;margin-bottom:8px"></div>'.repeat(3);

    // Die drei Listen auf einmal holen. Nacheinander wäre dreimal die
    // Wartezeit für dasselbe Ergebnis.
    const [neu, best] = await Promise.all([
      sb.rpc('spots_entdecken', { sortierung: 'neu',  anzahl: 12 }),
      sb.rpc('spots_entdecken', { sortierung: 'best', anzahl: 10 }),
    ]);

    // ------------------------------------------------------- Spot der Woche
    const besteListe = (best.data || []).filter((s) => Number(s.rating_count) > 0);
    const held = besteListe[0] || (neu.data || [])[0] || null;

    if (heldBlock) {
      heldBlock.innerHTML = '';
      if (held) {
        heldBlock.appendChild(kachel(held, { gross: true }));
      } else {
        heldBlock.innerHTML =
          '<div class="rand"><p class="abschnitt-unter">Noch kein Spot in der Karte. ' +
          'Auf der Karte auf <b>+ Spot hier anlegen</b> tippen — deiner wäre der erste.</p></div>';
      }
    }

    // ---------------------------------------------------- Neu dazugekommen
    if (neuReihe) {
      neuReihe.innerHTML = '';
      const liste = (neu.data || []).filter((s) => !held || s.id !== held.id).slice(0, 10);
      if (!liste.length) {
        $('entdecken-neu-block').hidden = true;
      } else {
        for (const s of liste) {
          // Was in der letzten Woche dazugekommen ist, bekommt eine Marke.
          const frisch = (Date.now() - new Date(s.created_at).getTime()) < 7 * 86400000;
          neuReihe.appendChild(kachel(s, { marke: frisch ? 'Neu' : '' }));
        }
      }
    }

    // -------------------------------------------------- Am besten bewertet
    if (bestListe) {
      bestListe.innerHTML = '';
      const liste = besteListe.slice(0, 8);
      if (!liste.length) {
        $('entdecken-best-block').hidden = true;
      } else {
        liste.forEach((s, i) => {
          bestListe.appendChild(zeile(s, { platz: i + 1 }));
        });
      }
    }

    // Die Zeile unter der Überschrift sagt, wie viel überhaupt da ist.
    const unter = $('entdecken-unter');
    if (unter) {
      const wie = (neu.data || []).length;
      unter.innerHTML = wie
        ? `${wie === 50 ? 'Über 50' : wie} ${wie === 1 ? 'Platz' : 'Plätze'} für die Nacht draußen`
        : 'Plätze für die Nacht draußen';
    }

    herzenAuffrischen();
    nahLaden();
  }

  // In deiner Nähe — nur, wenn der Standort schon bekannt ist. Diese Seite
  // fragt nicht von sich aus danach: Ein Standortdialog beim Öffnen einer App
  // ist der schnellste Weg zu einem "Nein".
  async function nahLaden() {
    const block = $('entdecken-nah-block');
    if (!block || !navigator.permissions) return;

    let erlaubt = false;
    try {
      const stand = await navigator.permissions.query({ name: 'geolocation' });
      erlaubt = stand.state === 'granted';
    } catch (e) { return; }

    if (!erlaubt) return;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { data, error } = await sb.rpc('spots_entdecken', {
        sortierung: 'nah',
        von_lat: pos.coords.latitude,
        von_lng: pos.coords.longitude,
        anzahl: 10,
      });
      if (error || !data || !data.length) return;

      const reihe = $('entdecken-nah');
      reihe.innerHTML = '';
      for (const s of data) reihe.appendChild(kachel(s));

      const unter = $('entdecken-nah-unter');
      if (unter && data[0] && data[0].entfernung_km != null &&
          Number.isFinite(Number(data[0].entfernung_km))) {
        unter.textContent =
          `Der nächste liegt ${Number(data[0].entfernung_km).toLocaleString('de-AT')} km entfernt`;
      }

      block.hidden = false;
      herzenAuffrischen();
    }, () => {}, { maximumAge: 300000, timeout: 8000 });
  }

  // Die Suche auf der Entdecken-Seite führt zur Karte und öffnet dort die
  // richtige Suche. Zwei Suchen mit zwei Ergebnislisten wären eine zu viel.
  const suchKnopf = $('entdecken-suche');
  if (suchKnopf) {
    suchKnopf.addEventListener('click', () => {
      bereichZeigen('karte');
      setTimeout(() => {
        const feld = document.querySelector('.suche-feld input');
        if (feld) feld.focus();
      }, 120);
    });
  }

  // Die Artikel auf der Entdecken-Seite auf- und zuklappen.
  for (const knopf of document.querySelectorAll('[data-lesen]')) {
    knopf.addEventListener('click', () => {
      const text = $('lesen-' + knopf.dataset.lesen);
      if (!text) return;
      text.hidden = !text.hidden;
      if (!text.hidden) {
        setTimeout(() => text.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
      }
    });
  }

  // ==========================================================================
  // 7. MERKLISTE
  // ==========================================================================

  let welcheListe = 'gemerkt';

  for (const knopf of document.querySelectorAll('#merken-reiter [data-liste]')) {
    knopf.addEventListener('click', () => {
      welcheListe = knopf.dataset.liste;
      for (const k of document.querySelectorAll('#merken-reiter [data-liste]')) {
        k.setAttribute('aria-pressed', String(k.dataset.liste === welcheListe));
      }
      merklisteFuellen();
    });
  }

  function leerHtml(zeichen, titel, text, knopfText, knopfTat) {
    const kasten = el('div');
    kasten.className = 'leer';
    kasten.innerHTML =
      `${zeichen}<b>${sicher(titel)}</b><p>${text}</p>`;
    if (knopfText) {
      const k = el('button');
      k.className = 'oliv-knopf';
      k.type = 'button';
      k.textContent = knopfText;
      k.addEventListener('click', knopfTat);
      kasten.appendChild(k);
    }
    return kasten;
  }

  const HERZ_LEER =
    '<svg viewBox="0 0 24 24"><path d="M12 20.5S3.5 15 3.5 9.5A5 5 0 0112 6.6a5 5 0 018.5 2.9c0 5.5-8.5 11-8.5 11z"/></svg>';

  async function merklisteFuellen() {
    const kasten = $('merken-inhalt');
    if (!kasten) return;

    if (!auth.nutzer) {
      kasten.innerHTML = '';
      kasten.appendChild(leerHtml(
        HERZ_LEER,
        'Erst anmelden',
        'Die Merkliste hängt an deinem Konto — sonst wäre sie weg, sobald du ' +
        'das Handy wechselst. Ein Konto kostet nichts und braucht nur eine ' +
        'E-Mail-Adresse.',
        'Anmelden oder Konto anlegen',
        () => auth.anmeldenZeigen && auth.anmeldenZeigen(),
      ));
      return;
    }

    kasten.innerHTML = '<div class="platzhalter" style="height:94px;margin-bottom:8px"></div>'.repeat(3);

    // ------------------------------------------------------------- Offline
    if (welcheListe === 'offline') {
      offlineZeigen(kasten);
      return;
    }

    const { data, error } = welcheListe === 'meine'
      ? await sb.rpc('meine_spots')
      : await sb.rpc('meine_merkliste');

    kasten.innerHTML = '';

    if (error) {
      kasten.appendChild(leerHtml(
        HERZ_LEER,
        'Konnte nicht geladen werden',
        navigator.onLine
          ? sicher(error.message)
          : 'Ohne Netz kommt die Liste nicht durch. Sobald du wieder Empfang ' +
            'hast, steht sie hier.',
        null, null,
      ));
      return;
    }

    if (!data || !data.length) {
      if (welcheListe === 'meine') {
        kasten.appendChild(leerHtml(
          ZELT_SVG,
          'Noch keinen Spot eingetragen',
          'Kennst du einen Platz, an dem du gut geschlafen hast? Auf der Karte ' +
          'an die Stelle ziehen und auf <b>+ Spot hier anlegen</b> tippen.',
          'Zur Karte',
          () => bereichZeigen('karte'),
        ));
      } else {
        kasten.appendChild(leerHtml(
          HERZ_LEER,
          'Noch nichts gemerkt',
          'Tippe bei einem Spot auf das Herz — dann steht er hier, auch wenn ' +
          'du ihn auf der Karte nicht mehr findest.',
          'Spots ansehen',
          () => bereichZeigen('entdecken'),
        ));
      }
      return;
    }

    // Eine Zeile darüber: wie viele es sind.
    const kopf = el('p');
    kopf.className = 'abschnitt-unter';
    kopf.style.marginTop = '0';
    kopf.textContent = welcheListe === 'meine'
      ? `${data.length} ${data.length === 1 ? 'eigener Spot' : 'eigene Spots'}`
      : `${data.length} ${data.length === 1 ? 'gemerkter Platz' : 'gemerkte Plätze'}`;
    kasten.appendChild(kopf);

    for (const s of data) {
      const unten = welcheListe === 'meine'
        ? 'angelegt ' + vorWie(s.created_at)
        : 'gemerkt ' + vorWie(s.gemerkt_am);
      kasten.appendChild(zeile(s, { unten }));
    }

    // Die Liste kann von der Datenbank abweichen, wenn zwischendurch auf
    // einem anderen Gerät gemerkt wurde. Also gleich mitziehen.
    if (welcheListe === 'gemerkt') {
      gemerkteIds = new Set(data.map((s) => s.id));
      gemerktSchreiben();
      herzenAuffrischen();
    }
  }

  // Der Offline-Reiter. Er zeigt, was gespeichert ist — und was Plus daraus
  // machen würde.
  async function offlineZeigen(kasten) {
    kasten.innerHTML = '';

    const kopf = el('p');
    kopf.className = 'abschnitt-unter';
    kopf.style.marginTop = '0';
    kopf.innerHTML =
      'Was hier liegt, funktioniert auch im Funkloch. Kartenteile speichert ' +
      'die App von selbst, sobald du sie einmal angesehen hast.';
    kasten.appendChild(kopf);

    // Die Zahlen kommen aus demselben Speicher, den offline.js verwaltet.
    const kachelBox = el('div');
    kachelBox.className = 'zahlen';
    kachelBox.innerHTML =
      `<div class="zahl-kachel"><b id="off-kacheln">…</b><span>Kartenteile</span></div>
       <div class="zahl-kachel"><b id="off-spots">${gemerkteIds.size}</b><span>gemerkte Spots</span></div>
       <div class="zahl-kachel"><b id="off-mb">…</b><span>Megabyte</span></div>`;
    kasten.appendChild(kachelBox);

    try {
      const namen = await caches.keys();
      let stuecke = 0, bytes = 0;
      for (const n of namen) {
        const c = await caches.open(n);
        const schluessel = await c.keys();
        stuecke += schluessel.length;
      }
      if (navigator.storage && navigator.storage.estimate) {
        const s = await navigator.storage.estimate();
        bytes = s.usage || 0;
      }
      $('off-kacheln').textContent = stuecke.toLocaleString('de-AT');
      $('off-mb').textContent = (bytes / 1048576).toFixed(0);
    } catch (e) {
      $('off-kacheln').textContent = '–';
      $('off-mb').textContent = '–';
    }

    // Die Plus-Schranke: ein Gebiet im Voraus laden.
    if (window.WILDSPOT_PLUS) {
      kasten.appendChild(window.WILDSPOT_PLUS.schrankeBauen(
        '🗺️',
        'Gebiet im Voraus laden',
        'Karte, Wege und Spots einer ganzen Region auf einmal — statt sie ' +
        'vorher von Hand abzufahren.',
      ));
    }

    const hinweis = el('p');
    hinweis.className = 'abschnitt-unter';
    hinweis.style.marginTop = '14px';
    hinweis.innerHTML =
      '<b>So geht es heute schon:</b> Die Gegend zu Hause einmal auf der Karte ' +
      'abfahren und dabei ein- und auszoomen. Was du gesehen hast, bleibt ' +
      'liegen und ist unterwegs da.';
    kasten.appendChild(hinweis);

    const leeren = el('button');
    leeren.className = 'menue-zeile gefaehrlich';
    leeren.style.cssText = 'border-radius:14px;background:var(--flaeche);margin-top:14px';
    leeren.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>' +
      '<span class="was">Kartenspeicher leeren<small>Gibt Platz frei, lädt danach neu</small></span>';
    leeren.addEventListener('click', async () => {
      if (leeren.dataset.sicher !== 'ja') {
        leeren.dataset.sicher = 'ja';
        leeren.querySelector('small').textContent = 'Wirklich? Nochmal tippen.';
        return;
      }
      const namen = await caches.keys();
      await Promise.all(namen.map((n) => caches.delete(n)));
      offlineZeigen(kasten);
    });
    kasten.appendChild(leeren);
  }

  // ==========================================================================
  // 8. PROFIL
  // ==========================================================================

  function profilFuellen() {
    const kasten = $('profil-inhalt');
    if (!kasten) return;
    kasten.innerHTML = '';

    // ------------------------------------------------------------- Der Kopf
    const kopf = el('div');
    kopf.className = 'profil-kopf';

    if (auth.nutzer) {
      const name = auth.nutzer.username || 'Konto';
      kopf.innerHTML =
        `<div class="profil-bild">${sicher(name.slice(0, 1).toUpperCase())}</div>
         <div class="wer">
           <b>${sicher(name)}</b>
           <span>${sicher(auth.nutzer.email || '')}</span>
         </div>`;
    } else {
      kopf.innerHTML =
        `<div class="profil-bild" style="background:var(--t2);color:var(--text-weak)">?</div>
         <div class="wer">
           <b>Nicht angemeldet</b>
           <span>Ansehen geht ohne Konto — mitmachen nicht</span>
         </div>`;
    }
    kasten.appendChild(kopf);

    const rand = el('div');
    rand.className = 'rand';
    kasten.appendChild(rand);

    // -------------------------------------------------------- Die Zahlen
    if (auth.nutzer) {
      const zahlen = el('div');
      zahlen.className = 'zahlen';
      zahlen.innerHTML =
        `<div class="zahl-kachel"><b id="z-spots">…</b><span>Spots</span></div>
         <div class="zahl-kachel"><b id="z-fotos">…</b><span>Fotos</span></div>
         <div class="zahl-kachel"><b id="z-bew">…</b><span>Bewertungen</span></div>`;
      rand.appendChild(zahlen);

      sb.rpc('meine_zahlen').then(({ data }) => {
        const z = (data && data[0]) || {};
        const setz = (id, wert) => {
          const e = $(id);
          if (e) e.textContent = Number(wert || 0).toLocaleString('de-AT');
        };
        setz('z-spots', z.spots);
        setz('z-fotos', z.fotos);
        setz('z-bew',   z.bewertungen);
      }).catch(() => {});
    } else {
      const k = el('button');
      k.className = 'oliv-knopf voll';
      k.type = 'button';
      k.textContent = 'Anmelden oder Konto anlegen';
      k.style.marginBottom = '22px';
      k.addEventListener('click', () => auth.anmeldenZeigen && auth.anmeldenZeigen());
      rand.appendChild(k);
    }

    // ------------------------------------------------------------ Plus
    if (window.WILDSPOT_PLUS) {
      rand.appendChild(window.WILDSPOT_PLUS.profilKasten());
    }

    // ------------------------------------------------------ Einstellungen
    const menue1 = el('div');
    menue1.className = 'menue';

    // Tag und Nacht
    const themaZeile = el('div');
    themaZeile.className = 'menue-zeile';
    themaZeile.style.cursor = 'default';
    themaZeile.innerHTML =
      `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/>
         <path d="M12 2.6v2.2M12 19.2v2.2M4 12H1.8M22.2 12H20M5.6 5.6L4 4M18.4 18.4L20 20M18.4 5.6L20 4M5.6 18.4L4 20"/></svg>
       <span class="was">Aussehen<small>Hell draußen, dunkel im Zelt</small></span>`;

    const wahl = el('div');
    wahl.className = 'thema-wahl';
    for (const [wert, text] of [['tag', 'Hell'], ['nacht', 'Dunkel']]) {
      const b = el('button');
      b.type = 'button';
      b.textContent = text;
      b.dataset.thema = wert;
      b.setAttribute('aria-pressed', String(themaJetzt() === wert));
      b.addEventListener('click', () => { themaSetzen(wert); profilFuellen(); });
      wahl.appendChild(b);
    }
    themaZeile.appendChild(wahl);
    menue1.appendChild(themaZeile);

    // Karte offline
    menue1.appendChild(menueZeile(
      '<svg viewBox="0 0 24 24"><path d="M12 3v11M8 10.5l4 4 4-4"/><path d="M4 17v2.5h16V17"/></svg>',
      'Karte offline', 'Was gespeichert ist und wie viel Platz es braucht',
      () => { bereichZeigen('merken'); welcheListe = 'offline';
              for (const k of document.querySelectorAll('#merken-reiter [data-liste]')) {
                k.setAttribute('aria-pressed', String(k.dataset.liste === 'offline'));
              }
              merklisteFuellen(); },
    ));

    // App installieren — nur zeigen, wenn sie es noch nicht ist.
    const alsApp = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;
    if (!alsApp) {
      menue1.appendChild(menueZeile(
        '<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
        'Als App installieren', 'Eigenes Symbol, Vollbild, startet ohne Empfang',
        () => {
          const k = $('knopf-installieren');
          if (k && !k.hidden) { k.click(); return; }
          alert('Am iPhone: Teilen-Symbol → „Zum Home-Bildschirm".\n' +
                'Auf Android: Menü ⋮ → „App installieren".');
        },
      ));
    }

    rand.appendChild(menue1);

    // ------------------------------------------------------------- Wissen
    const menue2 = el('div');
    menue2.className = 'menue';

    menue2.appendChild(menueZeile(
      '<svg viewBox="0 0 24 24"><path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/></svg>',
      'Wildcampen in Österreich', 'Was erlaubt ist, was geduldet, was teuer wird',
      () => { bereichZeigen('entdecken');
              setTimeout(() => {
                const t = $('lesen-recht');
                if (t) { t.hidden = false; t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
              }, 120); },
    ));

    menue2.appendChild(menueZeile(
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/></svg>',
      'Hinweis zum Wildcampen', 'Der Text vom ersten Start, noch einmal',
      () => { const k = $('knopf-hinweis-nochmal'); if (k) k.click(); },
    ));

    if (auth.nutzer && auth.nutzer.istAdmin) {
      menue2.appendChild(menueZeile(
        '<svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v6c0 4.2-3 7.6-7.5 9-4.5-1.4-7.5-4.8-7.5-9V6z"/></svg>',
        'Verwaltung', 'Spots, Fotos, Kommentare und Nutzer',
        () => { const k = $('knopf-admin'); if (k) k.click(); },
      ));
    }

    rand.appendChild(menue2);

    // ------------------------------------------------------------ Abmelden
    if (auth.nutzer) {
      const menue3 = el('div');
      menue3.className = 'menue';
      const ab = menueZeile(
        '<svg viewBox="0 0 24 24"><path d="M15 17l5-5-5-5M20 12H9M12 20H6a2 2 0 01-2-2V6a2 2 0 012-2h6"/></svg>',
        'Abmelden', null,
        () => { const k = $('knopf-abmelden'); if (k) k.click(); },
      );
      ab.classList.add('gefaehrlich');
      menue3.appendChild(ab);
      rand.appendChild(menue3);
    }

    // ---------------------------------------------------------- Die Fassung
    //
    // Steht hier, weil sich sonst nicht feststellen lässt, welche Fassung auf
    // einem Handy wirklich läuft. Die App hält sich selbst fürs Funkloch fest;
    // wenn eine Änderung „nicht ankommt", ist fast immer die alte Fassung noch
    // im Speicher. Ohne diese Zeile sucht man den Fehler im Neuen, obwohl man
    // das Alte vor sich hat.
    //
    // Die Nummer steht im Namen des Speichers, den der Service Worker anlegt
    // (sw.js, VERSION) — von dort wird sie gelesen.
    const fassung = el('button');
    fassung.className = 'menue-zeile';
    fassung.type = 'button';
    fassung.innerHTML =
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 7.5v5M12 16h.01"/></svg>' +
      '<span class="was">Fassung<small id="fassung-text">wird gelesen …</small></span>' +
      '<span class="pfeil">↻</span>';

    // Antippen holt sie neu vom Server — der schnellste Weg aus einer alten
    // Fassung heraus, ohne die App zu löschen und neu zu installieren.
    fassung.addEventListener('click', async () => {
      const t = $('fassung-text');
      if (t) t.textContent = 'wird neu geholt …';
      try {
        for (const reg of await navigator.serviceWorker.getRegistrations()) {
          await reg.update();
        }
      } catch (e) {}
      setTimeout(() => location.reload(true), 900);
    });

    const menue0 = el('div');
    menue0.className = 'menue';
    menue0.appendChild(fassung);
    rand.appendChild(menue0);

    (async () => {
      const t = $('fassung-text');
      if (!t) return;
      let nummer = 'unbekannt';
      try {
        const namen = await caches.keys();
        const treffer = namen.map((n) => (n.match(/(\d{4}-\d{2}-\d{2}-\d{2}-\d{2})/) || [])[1])
                             .filter(Boolean)
                             .sort();
        if (treffer.length) nummer = treffer[treffer.length - 1];
      } catch (e) {}

      // Der Sicherheitsabstand, den das Gerät unten meldet. Er ist der Grund,
      // warum die Leiste auf dem einen Handy tiefer sitzt als auf dem anderen.
      const probe = el('div');
      probe.style.cssText =
        'position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden';
      document.body.appendChild(probe);
      const unten = Math.round(probe.getBoundingClientRect().height);
      probe.remove();

      const alsApp = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

      t.textContent = `${nummer} · ${alsApp ? 'als App' : 'im Browser'} · ` +
                      `Rand unten ${unten} px · zum Auffrischen tippen`;
    })();

    // ------------------------------------------------------------- Fußzeile
    const fuss = el('p');
    fuss.style.cssText =
      'margin:6px 0 0;font-size:11.5px;line-height:1.7;color:var(--text-weak);text-align:center';
    fuss.innerHTML =
      'Wild Spot — Karten von <a href="https://basemap.at" target="_blank" rel="noopener" ' +
      'style="color:inherit">basemap.at</a> und ' +
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" ' +
      'style="color:inherit">OpenStreetMap</a>, Wetter von ' +
      '<a href="https://open-meteo.com" target="_blank" rel="noopener" ' +
      'style="color:inherit">Open-Meteo</a>.<br>' +
      'Die Spots kommen von Leuten wie dir.';
    rand.appendChild(fuss);
  }

  function menueZeile(svg, titel, unter, tat) {
    const z = el('button');
    z.className = 'menue-zeile';
    z.type = 'button';
    z.innerHTML =
      `${svg}<span class="was">${sicher(titel)}${
        unter ? `<small>${sicher(unter)}</small>` : ''}</span><span class="pfeil">›</span>`;
    z.addEventListener('click', tat);
    return z;
  }

  // ==========================================================================
  // 9. TAG UND NACHT
  //
  // Die Wahl steht im Browserspeicher und wird ganz oben im HTML gesetzt,
  // noch bevor etwas gezeichnet wird. Hier wird sie nur geändert.
  // ==========================================================================

  function themaJetzt() {
    return document.documentElement.dataset.thema === 'nacht' ? 'nacht' : 'tag';
  }

  function themaSetzen(wert) {
    if (wert === 'nacht') document.documentElement.dataset.thema = 'nacht';
    else delete document.documentElement.dataset.thema;

    try { localStorage.setItem('wildspot-thema', wert); } catch (e) {}

    // Die Farbe der Statusleiste am Handy mitziehen — sonst steht eine helle
    // Uhr über einer dunklen App.
    const meta = document.getElementById('theme-color');
    if (meta) {
      meta.setAttribute('content', wert === 'nacht' ? '#12140f' : '#edebe5');
    }

    // Die Karte hört darauf und färbt ihren Untergrund um (app.js).
    window.dispatchEvent(new CustomEvent('wildspot-thema', { detail: wert }));
  }

  window.WILDSPOT_THEMA = { jetzt: themaJetzt, setzen: themaSetzen };

  // ==========================================================================
  // 10. START
  // ==========================================================================

  // Bei An- und Abmeldung ändert sich fast alles: Merkliste, Zahlen, Profil.
  auth.beiWechsel.push(async () => {
    await gemerktHolen();
    herzenAuffrischen();
    if (aktiv === 'merken') merklisteFuellen();
    if (aktiv === 'profil') profilFuellen();
  });

  // Wo es losgeht. Wer zuletzt auf der Karte war, will beim nächsten Mal
  // wieder die Karte sehen — vermutlich steht er gerade draußen.
  let anfang = 'entdecken';
  try {
    const gemerkt = localStorage.getItem(SPEICHER_TAB);
    if (BEREICHE.includes(gemerkt)) anfang = gemerkt;
  } catch (e) {}

  // Ein geteilter Link auf einen Spot gehört auf die Karte, egal was zuletzt
  // offen war (teilen.js öffnet dann das Blatt).
  if (new URLSearchParams(location.search).has('spot')) anfang = 'karte';

  bereichZeigen(anfang, { merken: false });
})();
