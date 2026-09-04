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
    if (tage < 14)  return 'vor einer Woche';
    if (tage < 31)  return `vor ${Math.floor(tage / 7)} Wochen`;
    if (tage < 60)  return 'vor einem Monat';
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

  // ==========================================================================
  // 2b. LANGE LISTEN KURZ HALTEN
  //
  // Fünfzehn Abzeichen und zwölf Aktivitäten hintereinander sind keine Liste
  // mehr, sondern eine Wand. Man scrollt daran vorbei, ohne etwas gelesen zu
  // haben, und alles darunter — die Einstellungen, der Rechtshinweis — rückt
  // außer Sicht.
  //
  // Deshalb: die ersten paar stehen da, der Rest liegt darunter und kommt auf
  // einen Tipp. Aufgeklappt bleibt es, bis die Seite neu gebaut wird — wer
  // alles sehen wollte, will nicht bei jedem Blick wieder klappen.
  //
  // Die Funktion arbeitet auf einem fertig gefüllten Kasten und rührt die
  // Kinder selbst nicht an. Dadurch ist ihr egal, ob darin Abzeichen,
  // Aktivitäten oder irgendwann etwas Drittes liegt.
  window.WILDSPOT_KUERZEN = function kuerzen(kasten, {
    zeigen = 3,          // wie viele sofort dastehen
    wort = 'Einträge',   // „Alle 15 Abzeichen anzeigen"
    kinder = null,       // welche Elemente zählen (sonst alle)
  } = {}) {
    const alle = kinder || [...kasten.children];
    // Ein einziger Nachzügler ist keinen Knopf wert — dann lieber zeigen.
    if (alle.length <= zeigen + 1) return kasten;

    const rest = alle.slice(zeigen);
    for (const k of rest) k.classList.add('spaeter');

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'mehr-zeigen';
    knopf.innerHTML = `Alle ${alle.length} ${wort} anzeigen
      <span class="pfeil" aria-hidden="true">›</span>`;

    knopf.addEventListener('click', () => {
      for (const k of rest) k.classList.remove('spaeter');
      knopf.remove();
    });

    kasten.appendChild(knopf);
    return kasten;
  };

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
      teile.push(`<span><b>${Number(s.entfernung_km).toLocaleString('de-AT')} km</b></span>`);
    }

    // Ohne Zeichen davor. Hier standen bis zum 2026-08-16 vor jeder Angabe
    // ein Emoji — 📍 ⛰️ 💧 🚶 🏞️ nebeneinander unter jeder Kachel. Das ist
    // dreimal dieselbe Auskunft: Bild, Wort und Zahl. Das Wort allein reicht,
    // und die Zeile wird ruhig.
    //
    // Der Stern bleibt: Er ist ein Schriftzeichen und keine Zeichnung, und
    // eine Bewertung ohne Stern liest sich wie eine beliebige Zahl.
    const hoehe = meter(s.elevation_m);
    if (hoehe && teile.length < 3) teile.push(`<span><b>${hoehe}</b></span>`);
    if (s.water_nearby && teile.length < 3) teile.push('<span>Wasser</span>');
    const zeit = gehzeit(s.hike_minutes);
    if (zeit && teile.length < 3) teile.push(`<span>${zeit} Zustieg</span>`);
    if (s.has_lake && teile.length < 3) teile.push('<span>See</span>');
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
  //
  // Dieselbe Bedingung steht ein zweites Mal in der Datenbank
  // (db/019-filter.sql, Funktion spots_filtern). Das ist kein Versehen: Die
  // Karte filtert, was sie schon geladen hat — das geht ohne Netz und ohne
  // Warten. Die Trefferliste auf Entdecken dagegen muss alle Spots kennen,
  // auch die weit weg liegenden, und die kann nur die Datenbank aussuchen.
  // Wer eine Bedingung ändert, ändert sie an beiden Stellen.
  // Ein Chip ohne "regel" filtert nur die Trefferliste, nicht die Karte —
  // das ist kein Versehen: Ob ein Spot Fotos hat, weiß die Karte nicht, denn
  // die Fotos hängen nicht am Kartenpunkt. Solche Chips stehen bewusst
  // trotzdem in der Liste; sie sind auf Entdecken nützlich.
  const CHIPS = [
    // ------------------------------------------------------------- Wasser
    { id: 'see',    gruppe: 'Wasser', text: 'Am See',            regel: ['==', ['get', 'has_lake'], true] },
    { id: 'wasser', gruppe: 'Wasser',  text: 'Wasser dabei',      regel: ['==', ['get', 'water_nearby'], true] },
    { id: 'quelle', gruppe: 'Wasser',  text: 'Quelle oder Bach',  regel: ['match', ['coalesce', ['get', 'water_type'], ''], ['quelle', 'bach'], true, false] },
    { id: 'sicher', gruppe: 'Wasser',  text: 'Ganzjährig Wasser', regel: ['==', ['get', 'water_reliable'], 'ganzjaehrig'] },

    // --------------------------------------------------------------- Lage
    { id: 'hoch',     gruppe: 'Lage', text: 'Ab 1.500 m',          regel: ['>=', ['coalesce', ['get', 'elevation_m'], 0], 1500] },
    { id: 'sehrhoch', gruppe: 'Lage', text: 'Ab 2.000 m',          regel: ['>=', ['coalesce', ['get', 'elevation_m'], 0], 2000] },
    { id: 'baum',     gruppe: 'Lage', text: 'Über der Baumgrenze', regel: ['==', ['get', 'above_treeline'], true] },
    { id: 'still',    gruppe: 'Lage', text: 'Nicht einsehbar',     regel: ['==', ['get', 'discreet'], 'sehr'] },
    { id: 'schutz',   gruppe: 'Lage', text: 'Windgeschützt',       regel: ['==', ['get', 'exposure'], 'geschuetzt'] },

    // ------------------------------------------------------------ Zustieg
    { id: 'sehrkurz', gruppe: 'Zustieg', text: 'Unter 20 Minuten', regel: ['<=', ['coalesce', ['get', 'hike_minutes'], 9999], 20] },
    { id: 'kurz',     gruppe: 'Zustieg', text: 'Unter 1 Stunde',   regel: ['<=', ['coalesce', ['get', 'hike_minutes'], 9999], 60] },
    { id: 'auto',     gruppe: 'Zustieg', text: 'Mit dem Auto hin', regel: ['==', ['get', 'access'], 'auto'] },
    { id: 'weit',     gruppe: 'Zustieg', text: 'Lange Wanderung',  regel: ['==', ['get', 'access'], 'lange_wanderung'] },

    // ---------------------------------------------------------- Der Platz
    { id: 'weich',   gruppe: 'Der Platz', text: 'Weicher Untergrund', regel: ['match', ['coalesce', ['get', 'ground_type'], ''], ['wiese', 'waldboden'], true, false] },
    { id: 'mehrere', gruppe: 'Der Platz', text: 'Mehrere Zelte',      regel: ['match', ['coalesce', ['get', 'flat_tent_spots'], ''], ['2-3', '4+'], true, false] },
    { id: 'unter',   gruppe: 'Der Platz', text: 'Unterstand in der Nähe', regel: ['match', ['coalesce', ['get', 'shelter_nearby'], ''], ['biwakschachtel', 'huette', 'felsueberhang'], true, false] },
    { id: 'holz',    gruppe: 'Der Platz', text: 'Holz vorhanden',     regel: ['match', ['coalesce', ['get', 'firewood_available'], ''], ['viel', 'etwas'], true, false] },

    // ------------------------------------------------------- Regeln, Empfang
    { id: 'feuer',    gruppe: 'Regeln und Empfang', text: 'Feuer erlaubt',        regel: ['==', ['get', 'fire_allowed'], 'erlaubt'] },
    { id: 'erlaubt',  gruppe: 'Regeln und Empfang', text: 'Erlaubt oder geduldet', regel: ['match', ['coalesce', ['get', 'legal_status'], ''], ['erlaubt', 'geduldet'], true, false] },
    { id: 'empfang',  gruppe: 'Regeln und Empfang', text: 'Handyempfang',          regel: ['==', ['get', 'mobile_signal'], 'gut'] },
    { id: 'funkloch', gruppe: 'Regeln und Empfang', text: 'Bewusst Funkloch',      regel: ['==', ['get', 'mobile_signal'], 'keiner'] },

    // -------------------------------------------------------- Jahreszeiten
    { id: 'fruehling', gruppe: 'Jahreszeit', text: 'Frühling', regel: ['in', 'fruehling', ['coalesce', ['get', 'season'], ['literal', []]]] },
    { id: 'sommer',    gruppe: 'Jahreszeit', text: 'Sommer',   regel: ['in', 'sommer',    ['coalesce', ['get', 'season'], ['literal', []]]] },
    { id: 'herbst',    gruppe: 'Jahreszeit', text: 'Herbst',   regel: ['in', 'herbst',    ['coalesce', ['get', 'season'], ['literal', []]]] },
    { id: 'winter',    gruppe: 'Jahreszeit', text: 'Winter',   regel: ['in', 'winter',    ['coalesce', ['get', 'season'], ['literal', []]]] },

    // --------------------------------------------------------------- Ruf
    { id: 'gut',    gruppe: 'Ruf und Alter', text: 'Gut bewertet',      regel: ['>=', ['coalesce', ['get', 'avg_stars'], 0], 4] },
    { id: 'neu',    gruppe: 'Ruf und Alter', text: 'Neu (30 Tage)',     regel: ['==', ['get', 'frisch'], true] },
    // Ohne Kartenregel: Fotos hängen nicht am Kartenpunkt.
    { id: 'bilder', gruppe: 'Ruf und Alter', text: 'Mit Fotos' },
  ];

  // Die Reihenfolge der Gruppen im Filterblatt.
  const CHIP_GRUPPEN = ['Wasser', 'Lage', 'Zustieg', 'Der Platz',
                        'Regeln und Empfang', 'Jahreszeit', 'Ruf und Alter'];

  // Die Chips, die als Reihe direkt auf der Entdecken-Seite stehen: die vier
  // häufigsten Fragen, mehr nicht. Alle achtundzwanzig dort hinzulegen wäre
  // eine Wand, und schon acht waren zu viel — sie schoben den Filterknopf aus
  // dem Bild. Der Rest steht hinter dem Knopf, wo er hingehört.
  const SCHNELL_CHIPS = ['see', 'wasser', 'hoch', 'gut'];

  const gewaehlteChips = new Set();

  // Die Chips stehen zweimal auf dem Schirm: auf der Entdecken-Seite und über
  // der Karte. Beide Reihen zeigen dieselbe Auswahl — wer auf Entdecken „Ab
  // 1.500 m" antippt und dann zur Karte wechselt, findet den Filter dort
  // gesetzt vor. Alles andere wäre zweimal dieselbe Einstellung mit zwei
  // verschiedenen Ständen.
  function chipsBauen() {
    const reihe = $('entdecken-chips');
    if (reihe) {
      reihe.innerHTML = '';
      for (const id of SCHNELL_CHIPS) {
        const c = CHIPS.find((x) => x.id === id);
        if (c) reihe.appendChild(chipKnopf(c));
      }
    }

    filterTafelBauen();
    filterZaehlerAuffrischen();
  }

  function chipKnopf(c) {
    const k = el('button');
    k.className = 'chip';
    k.type = 'button';
    k.dataset.chip = c.id;
    // Den Stand aus der Auswahl lesen und nicht auf „aus" setzen: Die Reihe
    // wird auch neu gebaut, während schon gefiltert wird.
    k.setAttribute('aria-pressed', String(gewaehlteChips.has(c.id)));
    // Nur Text. Bis zum 2026-08-16 stand vor jedem Chip ein Emoji — bei
    // achtundzwanzig Filtern in einem Blatt ergab das eine Wand aus bunten
    // Bildchen, in der die Wörter untergingen. Ein Filter ist ein Satzteil
    // („am See"), kein Symbol.
    k.textContent = c.text;
    k.addEventListener('click', () => chipUmschalten(c.id));
    return k;
  }

  // --------------------------------------------------------------------------
  // Das Filterblatt
  //
  // Vorher lag über der Karte eine Reihe aus acht Chips, die man seitlich
  // schieben musste — auf einem Handy sah man drei davon und ahnte den Rest.
  // Jetzt liegt dort EIN Knopf mit einem Zeichen und der Zahl der gesetzten
  // Filter. Er klappt dieses Blatt auf: alle Filter untereinander, nach
  // Gruppen sortiert, alle auf einen Blick.
  //
  // Es ist dasselbe Blatt für Karte und Entdecken — und dieselbe Auswahl.
  // Zwei Filterstände, die auseinanderlaufen können, wären der sicherste Weg
  // zu "wieso sehe ich diesen Spot nicht mehr".
  // --------------------------------------------------------------------------

  function filterTafelBauen() {
    const kasten = $('filter-inhalt');
    if (!kasten) return;
    kasten.innerHTML = '';

    for (const gruppe of CHIP_GRUPPEN) {
      const drin = CHIPS.filter((c) => c.gruppe === gruppe);
      if (!drin.length) continue;

      const h = el('h3');
      h.className = 'filter-gruppe';
      h.textContent = gruppe;
      kasten.appendChild(h);

      const reihe = el('div');
      reihe.className = 'filter-reihe';
      for (const c of drin) reihe.appendChild(chipKnopf(c));
      kasten.appendChild(reihe);
    }

    const hinweis = el('p');
    hinweis.className = 'filter-hinweis-text';
    hinweis.innerHTML =
      'Mehrere Filter gelten <b>zusammen</b>: zwei angetippte heißt beides, ' +
      'nicht eines von beiden. Auf der Karte bleiben nur die passenden Punkte ' +
      'stehen, auf <b>Entdecken</b> bekommst du die Treffer als Liste mit Bild.';
    kasten.appendChild(hinweis);
  }

  function filterOeffnen() {
    const hg = $('filter-hg');
    if (!hg) return;
    filterTafelBauen();
    filterStandAnzeigen();
    hg.hidden = false;
  }

  function filterSchliessen() {
    const hg = $('filter-hg');
    if (hg) hg.hidden = true;
  }

  // Die Zahl im Knopf und im Blattfuß. Sie ist der einzige Hinweis darauf,
  // dass überhaupt gefiltert wird, sobald das Blatt zu ist.
  function filterZaehlerAuffrischen() {
    const wie = gewaehlteChips.size;
    for (const id of ['filter-anzahl', 'entdecken-filter-anzahl']) {
      const e = $(id);
      if (!e) continue;
      e.textContent = String(wie);
      e.hidden = wie === 0;
    }
    for (const id of ['knopf-filter', 'entdecken-filter']) {
      const k = $(id);
      if (k) k.setAttribute('aria-pressed', String(wie > 0));
    }
    filterStandAnzeigen();
  }

  function filterStandAnzeigen() {
    const e = $('filter-stand');
    if (!e) return;
    const wie = gewaehlteChips.size;
    e.textContent = wie === 0
      ? 'Kein Filter gesetzt'
      : `${wie} ${wie === 1 ? 'Filter' : 'Filter'} gesetzt: ` +
        [...gewaehlteChips].map(chipText).join(' · ');
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
    filterZaehlerAuffrischen();

    // Beides auf einmal, egal wo getippt wurde: die Punkte auf der Karte
    // ausdünnen und die Trefferliste auf Entdecken neu holen. Der Filter ist
    // eine Einstellung, keine zwei — nur seine Wirkung sieht an jedem der
    // beiden Orte anders aus.
    //
    // Was hier bewusst NICHT mehr passiert: der Sprung zur Karte. Wer auf
    // Entdecken einen Filter setzt, will die passenden Plätze durchsehen —
    // und wurde bisher stattdessen auf eine Karte mit ein paar Punkten
    // geworfen, ohne Bild und ohne Namen.
    filterAnwenden();
    trefferAuffrischen();
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
        filterZuruecksetzen();
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

  // Alles auf Anfang: keine Chips, alle Punkte auf der Karte, auf Entdecken
  // wieder die gewohnte Seite.
  function filterZuruecksetzen() {
    gewaehlteChips.clear();
    for (const k of document.querySelectorAll('[data-chip]')) {
      k.setAttribute('aria-pressed', 'false');
    }
    filterZaehlerAuffrischen();
    filterAnwenden();
    trefferAuffrischen();
  }

  // ==========================================================================
  // 6b. DIE TREFFER ZUM FILTER (Entdecken)
  //
  // Die Chips sind auf dieser Seite eine Frage: „Welche Plätze liegen über
  // 1.500 m?" Die Antwort gehört hierher und nicht auf die Karte — als
  // Kacheln mit Bild, zwei nebeneinander, wie der Rest der Seite.
  //
  // Geholt wird über spots_filtern (db/019-filter.sql): eine Abfrage für
  // alle Treffer samt erstem Foto. Die Karte kann das nicht liefern, sie
  // kennt immer nur den Ausschnitt, den jemand gerade angeschaut hat.
  // ==========================================================================

  // Der zuletzt bekannte Standort — gesetzt von nahLaden(), sobald der Nutzer
  // ihn ohnehin schon freigegeben hat. Steht er, sind die Treffer nach
  // Entfernung sortiert und zeigen die Kilometer mit an. Steht er nicht,
  // wird hier nicht danach gefragt: Ein Standortdialog als Antwort auf einen
  // Filterchip wäre eine Frage, die niemand gestellt hat.
  let letzterStandort = null;

  // Läuft schon eine Abfrage, darf ihre Antwort eine neuere nicht überholen.
  let trefferLauf = 0;

  function chipText(id) {
    const c = CHIPS.find((x) => x.id === id);
    return c ? c.text : id;
  }

  async function trefferAuffrischen() {
    const block  = $('entdecken-treffer-block');
    const listeEl = $('entdecken-treffer');
    const standard = $('entdecken-standard');
    if (!block || !listeEl) return;

    const chips = [...gewaehlteChips];

    // Ohne Filter ist die Seite wieder die gewohnte.
    if (!chips.length) {
      block.hidden = true;
      listeEl.innerHTML = '';
      if (standard) standard.hidden = false;
      return;
    }

    block.hidden = false;
    if (standard) standard.hidden = true;

    const titel = $('entdecken-treffer-titel');
    const unter = $('entdecken-treffer-unter');
    if (titel) titel.textContent = chips.map(chipText).join(' · ');
    if (unter) unter.textContent = 'Wird gesucht …';

    // Graue Kacheln, solange geladen wird — die Seite soll nicht springen.
    listeEl.innerHTML =
      '<div class="platzhalter" style="height:210px;border-radius:20px"></div>'.repeat(4);

    const lauf = ++trefferLauf;

    const { data, error } = await sb.rpc('spots_filtern', {
      chips,
      von_lat: letzterStandort ? letzterStandort.lat : null,
      von_lng: letzterStandort ? letzterStandort.lng : null,
      anzahl: 60,
    });

    // Zwischenzeitlich wurde weitergetippt: diese Antwort ist überholt.
    if (lauf !== trefferLauf) return;

    if (error) {
      listeEl.innerHTML =
        '<p class="treffer-leer" style="grid-column:1/-1">Die Treffer konnten ' +
        'gerade nicht geladen werden. Ohne Netz zeigt die <b>Karte</b> weiter ' +
        'die Punkte, die schon da sind.</p>';
      if (unter) unter.textContent = 'Nicht erreichbar';
      return;
    }

    const liste = data || [];
    listeEl.innerHTML = '';

    if (!liste.length) {
      listeEl.innerHTML =
        '<p class="treffer-leer" style="grid-column:1/-1">Dazu steht noch ' +
        'kein Spot in der Karte. Entweder passt gerade keiner — oder bei den ' +
        'vorhandenen ist diese Angabe noch nicht ausgefüllt.</p>';
      if (unter) unter.textContent = 'Kein Treffer';
      return;
    }

    for (const s of liste) listeEl.appendChild(kachel(s));

    if (unter) {
      unter.textContent = liste.length === 1
        ? 'Ein Platz passt dazu'
        : `${liste.length} Plätze passen dazu`;
    }

    herzenAuffrischen();
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
    //
    // Erst ab drei Plätzen. Eine Bestenliste mit einem einzigen Eintrag ist
    // keine Rangfolge, sondern die Auskunft, dass genau eine Bewertung
    // abgegeben wurde — und der eine Platz stand als "Spot der Woche" schon
    // oben auf derselben Seite. Zweimal derselbe Name auf einer Seite lässt
    // eine Karte mit 162 Plätzen kleiner aussehen, als sie ist.
    if (bestListe) {
      bestListe.innerHTML = '';
      const liste = besteListe.slice(0, 8);
      if (liste.length < 3) {
        $('entdecken-best-block').hidden = true;
      } else {
        liste.forEach((s, i) => {
          bestListe.appendChild(zeile(s, { platz: i + 1 }));
        });
      }
    }

    // Die Zahl in der Überschrift kommt aus zahlenbandFuellen — dort wird
    // ohnehin gezählt, was in der Karte steht. Hier stand bis zum 2026-09-04
    // die Länge der gerade geladenen Kachelliste: zwölf. Das war die Zahl der
    // Kacheln auf dem Bildschirm, angeschrieben als wäre es die Zahl der
    // Plätze in der App.

    herzenAuffrischen();
    nahLaden();
    zahlenbandFuellen();

    // Die Gipfel und die Leute bauen sich selbst — beide liegen in eigenen
    // Dateien, weil sie mit der Spotliste nichts zu tun haben.
    if (window.WILDSPOT_GIPFEL) window.WILDSPOT_GIPFEL.entdeckenFuellen();

    // Heute Nacht — der Block, der morgen etwas anderes sagt (heute.js).
    if (window.WILDSPOT_HEUTE) window.WILDSPOT_HEUTE.fuellen();

    // War schon ein Filter gesetzt — etwa auf der Karte —, gehört die
    // Trefferliste auch beim ersten Öffnen dieser Seite gleich dazu.
    trefferAuffrischen();
  }

  // Das Zahlenband am Ende der Seite: wie viel überhaupt drin ist. Eine App,
  // die verschweigt, wie groß sie ist, wirkt größer und enttäuscht mehr.
  //
  // Bis zum 2026-09-04 stand hier zusätzlich, wie viele LEUTE dabei sind. Das
  // war gut gemeint und in der Wirkung das Gegenteil: "4 Leute sind dabei,
  // zusammen mit 1 Nacht draußen" ist der Satz, nach dem man die App zumacht.
  // Andrew Chen nennt das die Anti-Netzwerkwirkung — wer sieht, dass niemand
  // da ist, geht, und macht die Lage damit für den Nächsten schlechter.
  //
  // Weggelassen wird die Zahl trotzdem nicht für immer, sondern nur, solange
  // sie nichts trägt. Ab MENSCHEN_AB steht sie wieder da. Was bis dahin
  // dasteht, ist genauso wahr und deutlich mehr wert: Diese Karte kennt
  // 45.000 Wasserstellen und 823 Schutzgebiete. Das hat keine Zeltplatz-App.
  const MENSCHEN_AB = 25;

  async function zahlenbandFuellen() {
    const band = $('entdecken-band');
    if (!band) return;

    const { data, error } = await sb.rpc('gemeinschaft_zahlen');
    const z = (data && data[0]) || null;
    if (error || !z) { band.hidden = true; return; }

    const n = (w) => Number(w || 0).toLocaleString('de-AT');

    const teile = [
      `<b>${n(z.spots)}</b> ${Number(z.spots) === 1 ? 'Platz' : 'Plätze'} für die Nacht`,
      `<b>${n(z.fotos)}</b> ${Number(z.fotos) === 1 ? 'Foto' : 'Fotos'}`,
      `<b>${n(z.gipfel_frei)}</b> Gipfel zum Sammeln`,
    ];
    // Wasser und Schutzgebiete kommen aus db/034 und fehlen, solange die
    // Datei noch nicht eingespielt ist. Dann bleibt der Satz eben kürzer.
    if (Number(z.wasser))  teile.push(`<b>${n(z.wasser)}</b> Wasserstellen`);
    if (Number(z.gebiete)) teile.push(`<b>${n(z.gebiete)}</b> Schutzgebiete`);

    const letzter = teile.pop();
    const aufzaehlung = teile.join(', ') + ' und ' + letzter;

    // Der Nachsatz ist die ehrliche Antwort auf die Frage, die sich beim
    // Lesen stellt: Wer hat das alles eingetragen? Er macht aus der Jugend
    // der App keine Ausrede, sondern ihr Versprechen.
    const nachsatz = Number(z.leute) >= MENSCHEN_AB
      ? ` <b>${n(z.leute)}</b> Leute sind dabei.`
      : ' Von Hand zusammengetragen — aus Alpenvereinskarten, Geodaten und '
        + 'eigenen Touren. Keine Werbeplätze, keine gekauften Einträge.';

    band.hidden = false;
    band.innerHTML = `In der Karte stehen ${aufzaehlung}.${nachsatz}`;

    // Dieselbe Zahl trägt die Überschrift der Seite. Sie wird hier gesetzt,
    // weil sie hier ohnehin schon geholt wurde — ein zweiter Aufruf für
    // dieselbe Auskunft wäre eine Anfrage zu viel, unterwegs auf Mobilfunk.
    const titel = $('entdecken-titel');
    const wie = Number(z.spots);
    if (titel && wie) {
      const satz = `<b>${n(wie)}</b> ${wie === 1 ? 'Platz' : 'Plätze'} für die Nacht draußen`;
      titel.dataset.mitZahl = satz;
      titel.dataset.zahlDa = 'ja';
      // Nur überschreiben, wenn gerade auch die Spots-Tafel offen ist —
      // sonst stünde plötzlich "162 Plätze" über dem Feed.
      const spotsOffen = !$('entdecken-spots')?.hidden;
      if (spotsOffen) titel.innerHTML = satz;
    }
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
      // Merken für die Trefferliste: Sie sortiert dann nach Entfernung,
      // ohne selbst nach dem Standort fragen zu müssen.
      letzterStandort = { lat: pos.coords.latitude, lng: pos.coords.longitude };

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

  // Vom Trefferblock aus freiwillig zur Karte. Der Filter ist dort schon
  // gesetzt, es fehlt nur noch der Blick von oben.
  const trefferKarte = $('entdecken-treffer-karte');
  if (trefferKarte) {
    trefferKarte.addEventListener('click', () => bereichZeigen('karte'));
  }

  // Die Chips und das Filterblatt müssen dastehen, auch wenn Entdecken noch
  // nie offen war — die App kann mit der Karte starten.
  chipsBauen();

  // Die beiden Filterknöpfe (Karte und Entdecken) öffnen dasselbe Blatt.
  for (const id of ['knopf-filter', 'entdecken-filter']) {
    const k = $(id);
    if (k) k.addEventListener('click', filterOeffnen);
  }
  for (const id of ['filter-zu', 'filter-fertig']) {
    const k = $(id);
    if (k) k.addEventListener('click', filterSchliessen);
  }
  const filterWeg = $('filter-zuruecksetzen');
  if (filterWeg) filterWeg.addEventListener('click', filterZuruecksetzen);

  // Mit Esc wieder zu — dieselbe Erwartung wie bei den Tafeln auf der Karte.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const hg = $('filter-hg');
    if (hg && !hg.hidden) filterSchliessen();
  });

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

    // -------------------------------------------------------------- Gipfel
    //
    // Die gesammelten Gipfel stehen hier, weil die Merkliste die Seite ist,
    // auf der alles Eigene liegt. Gebaut wird der Kasten von gipfel.js —
    // derselbe wie im Profil.
    if (welcheListe === 'gipfel') {
      kasten.innerHTML = '';

      const kopf = el('p');
      kopf.className = 'abschnitt-unter';
      kopf.style.marginTop = '0';
      kopf.innerHTML =
        'Jeder Gipfel, auf dem du warst. Auf der Karte sind deine goldgelb — ' +
        'du siehst also im Vorbeischauen, wo du schon überall oben gestanden bist.';
      kasten.appendChild(kopf);

      if (window.WILDSPOT_GIPFEL) {
        window.WILDSPOT_GIPFEL.meineGipfelBauen(auth.nutzer.id, { ichSelbst: true })
          .then((e) => kasten.appendChild(e))
          .catch(() => {});
      }
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

  // ==========================================================================
  // Der Kasten zum Vorausladen (nur mit Plus)
  //
  // Geladen wird immer der Ausschnitt, der gerade auf der Karte steht. Das ist
  // die einzige Angabe, die man ohne Erklärung versteht: Was du siehst, nimmst
  // du mit. Ein eigener Auswahlrahmen wäre genauer und würde niemand bedienen.
  //
  // Deshalb steht auch die Zahl der Kacheln dabei und nicht nur "laden": Ein
  // Vorgang, der eine Minute dauert und Datenvolumen kostet, soll vorher
  // sagen, worauf man sich einlässt.
  // ==========================================================================
  function gebietKasten() {
    const kasten = el('div');
    kasten.className = 'gebiet-kasten';

    const schaetzung = window.WILDSPOT_GEBIET.schaetzen();

    kasten.innerHTML =
      '<div class="gebiet-kopf">' +
      '<span class="gebiet-zeichen" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24"><path d="M12 3v11M8 10.5l4 4 4-4"/>' +
      '<path d="M4 17v2.5h16V17"/></svg></span>' +
      '<div><b>Dieses Gebiet mitnehmen</b>' +
      '<small id="gebiet-stand"></small></div>' +
      '</div>' +
      '<div class="gebiet-balken" id="gebiet-balken" hidden><i></i></div>' +
      '<button type="button" class="oliv-knopf voll" id="gebiet-laden">Gebiet laden</button>';

    const stand  = kasten.querySelector('#gebiet-stand');
    const knopf  = kasten.querySelector('#gebiet-laden');
    const balken = kasten.querySelector('#gebiet-balken');

    function standSetzen() {
      const s = window.WILDSPOT_GEBIET.schaetzen();
      if (s.zuGross) {
        stand.textContent = 'Der Ausschnitt auf der Karte ist zu groß — '
          + 'zoom näher heran.';
        knopf.disabled = true;
      } else if (!s.anzahl) {
        stand.textContent = 'Öffne zuerst die Karte und stell den Ausschnitt ein.';
        knopf.disabled = true;
      } else {
        // Grob gerechnet mit 30 KB je Kachel — genauer geht es vorher nicht,
        // und eine Zahl mit Nachkommastellen wäre hier eine Scheingenauigkeit.
        const mb = Math.max(1, Math.round((s.anzahl * 30) / 1024));
        stand.textContent = `Der Ausschnitt auf der Karte: rund ${s.anzahl} `
          + `Kartenteile, etwa ${mb} MB.`;
        knopf.disabled = false;
      }
    }

    standSetzen();

    knopf.addEventListener('click', async () => {
      knopf.disabled = true;
      balken.hidden = false;
      const strich = balken.querySelector('i');

      try {
        const ergebnis = await window.WILDSPOT_GEBIET.laden((fertig, gesamt) => {
          strich.style.width = Math.round((fertig / gesamt) * 100) + '%';
          stand.textContent = `${fertig} von ${gesamt} Kartenteilen geladen …`;
        });

        // Misslungene Kacheln sind normal: Nicht jeder Kartendienst hat für
        // jede Stelle in jeder Zoomstufe ein Bild. Verschwiegen würde es
        // trotzdem nicht — wer 40 Fehler hat, soll es wissen.
        stand.textContent = ergebnis.misslungen
          ? `Fertig — ${ergebnis.fertig - ergebnis.misslungen} Kartenteile liegen `
            + `jetzt am Gerät (${ergebnis.misslungen} waren nicht verfügbar).`
          : `Fertig — ${ergebnis.fertig} Kartenteile liegen jetzt am Gerät.`;

        knopf.textContent = 'Noch ein Gebiet laden';
        knopf.disabled = false;
        strich.style.width = '100%';

        // Die Zahlen oben im Reiter stimmen jetzt nicht mehr.
        if (welcheListe === 'offline') merklisteFuellen();
      } catch (err) {
        stand.textContent = err.message || 'Das hat nicht geklappt.';
        knopf.disabled = false;
        balken.hidden = true;
      }
    });

    return kasten;
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

    // Ein Gebiet im Voraus laden. Mit Plus der echte Knopf, ohne Plus die
    // Schranke davor.
    const hatPlus = !!(window.WILDSPOT_PLUS && window.WILDSPOT_PLUS.hat());

    if (hatPlus && window.WILDSPOT_GEBIET) {
      kasten.appendChild(gebietKasten());
    } else if (window.WILDSPOT_PLUS) {
      kasten.appendChild(window.WILDSPOT_PLUS.schrankeBauen(
        '<svg viewBox="0 0 24 24"><path d="M12 3v11M8 10.5l4 4 4-4"/>' +
        '<path d="M4 17v2.5h16V17"/></svg>',
        'Gebiet im Voraus laden',
        'Karte, Wege und Spots einer ganzen Region auf einmal — statt sie ' +
        'vorher von Hand abzufahren.',
      ));
    }

    const hinweis = el('p');
    hinweis.className = 'abschnitt-unter';
    hinweis.style.marginTop = '14px';
    hinweis.innerHTML = hatPlus
      ? '<b>Und nebenbei:</b> Was du auf der Karte anschaust, bleibt ohnehin '
        + 'liegen. Das Vorausladen ist für die Gegend, in der du noch nicht warst.'
      : '<b>So geht es heute schon:</b> Die Gegend zu Hause einmal auf der Karte '
        + 'abfahren und dabei ein- und auszoomen. Was du gesehen hast, bleibt '
        + 'liegen und ist unterwegs da.';
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
      const bild = auth.nutzer.avatarPfad
        ? sb.storage.from('avatars').getPublicUrl(auth.nutzer.avatarPfad).data.publicUrl
        : null;

      // Das Bild ist gleichzeitig der Knopf zum Ändern. Ein eigener Knopf
      // daneben wäre eine Zeile mehr für dieselbe Sache — und jeder tippt
      // ohnehin zuerst auf das Bild.
      kopf.innerHTML =
        `<button type="button" class="profil-bild" id="profil-bild-knopf"
                 title="Bild ändern" style="${bild
                   ? `background-image:url('${sicher(bild)}');background-size:cover;
                      background-position:center;color:transparent` : ''}">
           ${sicher(name.slice(0, 1).toUpperCase())}
           <span class="wechseln">
             <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="3"/>
               <circle cx="12" cy="13" r="3.4"/><path d="M9 6l1.4-2h3.2L15 6"/></svg>
           </span>
         </button>
         <input type="file" id="profil-bild-datei" accept="image/*" hidden>
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

    // ============================================================ REIHENFOLGE
    //
    // Die Seite ist von oben nach unten nach Häufigkeit sortiert, nicht nach
    // Schauwert:
    //
    //   1. Wer bin ich          — Bild, Name, Follower
    //   2. Meine Zahlen         — kurz, der Rest hinter einem Knopf
    //   3. Plus                 — das Angebot, solange man noch oben ist
    //   4. Einstellungen        — Aussehen, Karte offline, App installieren
    //   5. Sammlung             — Abzeichen, Gipfel, Aktivität
    //   6. Wissen, Abmelden, Fassung
    //
    // Vorher standen Abzeichen, Gipfel und Aktivität vor den Einstellungen.
    // Wer nur von hell auf dunkel schalten oder nachsehen wollte, was offline
    // liegt, musste an allem vorbeiwischen — und das sind die zwei Sachen, die
    // man draußen wirklich braucht.
    // ==========================================================================

    // ----------------------------------------------------- Wer bin ich
    if (auth.nutzer) {
      bildKnopfVerdrahten();
      const ich = auth.nutzer.id;

      // Die Folgezeile steht direkt unter dem Namen — sie gehört zur Person,
      // nicht zu den Leistungen. Anklickbar: Hinter „12 Follower" liegt die
      // Liste der zwölf.
      const folgen = el('div');
      folgen.className = 'folge-zeile klickbar';
      folgen.innerHTML =
        '<button type="button" data-folge="follower"><b id="z-follower">…</b> Follower</button>' +
        '<button type="button" data-folge="folge"><b id="z-folge">…</b> gefolgt</button>';
      rand.appendChild(folgen);

      for (const k of folgen.querySelectorAll('[data-folge]')) {
        k.addEventListener('click', () => {
          if (window.WILDSPOT_LEUTE) {
            window.WILDSPOT_LEUTE.folgeListeOeffnen(ich, k.dataset.folge,
              auth.nutzer.username || 'dir');
          }
        });
      }

      sb.rpc('profil', { wessen_id: ich }).then(({ data }) => {
        const p = (data && data[0]) || {};
        const setz = (id, wert) => {
          const e = $(id);
          if (e) e.textContent = Number(wert || 0).toLocaleString('de-AT');
        };
        setz('z-follower', p.folgt_mir);
        setz('z-folge',    p.folge_ich);

        // Das Bild merken, damit es beim nächsten Aufbau sofort dasteht.
        if (p.avatar_path !== undefined) auth.nutzer.avatarPfad = p.avatar_path;
      }).catch(() => {});

      // -------------------------------------------------------- Die Zahlen
      // Kompakt: vier Kacheln, der Rest hinter „Alle Zahlen anzeigen“
      // (siehe gipfel.js).
      const zahlenPlatz = el('div');
      zahlenPlatz.innerHTML =
        '<div class="platzhalter" style="height:96px;border-radius:16px;margin-bottom:14px"></div>';
      rand.appendChild(zahlenPlatz);

      if (window.WILDSPOT_GIPFEL) {
        window.WILDSPOT_GIPFEL.statistikBauen(ich, { kompakt: true })
          .then((e) => zahlenPlatz.replaceWith(e))
          .catch(() => {});
      }
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

    // ============================================================== Sammlung
    // Abzeichen, Gipfel und die Spur der eigenen Einträge. Zum Stöbern, nicht
    // zum Erledigen — deshalb hinter den Einstellungen und zugeklappt. Wer
    // hinsehen will, tippt einmal; wer sein Profil wegen einer Einstellung
    // aufmacht, wischt nicht an drei Listen vorbei.
    if (auth.nutzer) {
      const ich = auth.nutzer.id;

      // ------------------------------------------------------- Abzeichen
      const abzPlatz = klappAbschnitt(rand, 'Abzeichen',
        'Was du schon geschafft hast — und was als Nächstes drin wäre');
      abzPlatz.innerHTML =
        '<div class="platzhalter" style="height:120px;border-radius:16px"></div>';
      if (window.WILDSPOT_GIPFEL) {
        window.WILDSPOT_GIPFEL.abzeichenBauen(ich)
          .then((e) => { abzPlatz.innerHTML = ''; abzPlatz.appendChild(e); })
          .catch(() => {});
      }

      // --------------------------------------------------- Meine Gipfel
      const gipfelPlatz = klappAbschnitt(rand, 'Deine Gipfel',
        'Antippen öffnet den Gipfel — dort steht, wer sonst schon oben war');
      gipfelPlatz.innerHTML =
        '<div class="platzhalter" style="height:80px;border-radius:16px"></div>';
      if (window.WILDSPOT_GIPFEL) {
        window.WILDSPOT_GIPFEL.meineGipfelBauen(ich, { ichSelbst: true })
          .then((e) => { gipfelPlatz.innerHTML = ''; gipfelPlatz.appendChild(e); })
          .catch(() => {});
      }

      // ------------------------------------------------ Letzte Aktivität
      const aktPlatz = klappAbschnitt(rand, 'Deine letzte Aktivität',
        'Alles, was du eingetragen hast, in einer Spur');
      aktPlatz.innerHTML =
        '<div class="platzhalter" style="height:80px;border-radius:16px"></div>';
      if (window.WILDSPOT_LEUTE) {
        window.WILDSPOT_LEUTE.aktivitaetBauen(ich, 10)
          .then((e) => { aktPlatz.innerHTML = ''; aktPlatz.appendChild(e); })
          .catch(() => {});
      }
    }

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

          // update() holt die neue Fassung nur herein — übernehmen tut sie
          // von selbst nichts, sie stellt sich in die Warteschlange. Ohne
          // diesen Anstoß lädt die Seite gleich neu und bekommt trotzdem
          // wieder die alten Dateien aus dem Speicher der alten Fassung.
          // Genau daran scheiterte das Auffrischen bisher.
          if (reg.waiting) reg.waiting.postMessage('jetzt-uebernehmen');
        }
      } catch (e) {}

      // Übernimmt die neue Fassung, lädt der controllerchange-Griff in
      // offline.js ohnehin neu. Dieser Zeitgeber ist nur das Netz darunter,
      // falls es gar nichts Neues gab — und er wird abgeräumt, sobald die
      // Übernahme greift. Sonst lüde die Seite zweimal hintereinander.
      const spaeter = setTimeout(() => location.reload(), 1200);
      navigator.serviceWorker?.addEventListener('controllerchange',
        () => clearTimeout(spaeter), { once: true });
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
      'Die Spots kommen von Leuten wie dir.<br>' +
      // Muss von jeder Seite aus erreichbar sein — und für den Play Store ist
      // eine verlinkte Datenschutzerklärung Bedingung, nicht Kür.
      '<a href="datenschutz.html" style="color:inherit">Datenschutz</a>';
    rand.appendChild(fuss);
  }

  // ==========================================================================
  // Das Profilbild wechseln
  //
  // Es wird wie jedes andere Bild schon im Browser verkleinert — hier auf
  // 400 Pixel, weil es nirgends größer angezeigt wird. Aus einem 8-MB-Foto
  // werden damit etwa 30 KB.
  // ==========================================================================

  function bildKnopfVerdrahten() {
    const knopf = $('profil-bild-knopf');
    const feld  = $('profil-bild-datei');
    if (!knopf || !feld) return;

    knopf.addEventListener('click', () => feld.click());

    feld.addEventListener('change', async () => {
      const datei = feld.files && feld.files[0];
      if (!datei || !datei.type.startsWith('image/')) return;

      knopf.style.opacity = '0.5';

      try {
        const klein = await window.wildspotVerkleinern(datei, 400);
        const pfad = `${auth.nutzer.id}/${crypto.randomUUID()}.jpg`;

        const hoch = await sb.storage.from('avatars')
          .upload(pfad, klein, { contentType: 'image/jpeg' });
        if (hoch.error) throw hoch.error;

        const alt = auth.nutzer.avatarPfad;

        const { error } = await sb.from('profiles')
          .update({ avatar_path: pfad })
          .eq('id', auth.nutzer.id);
        if (error) throw error;

        auth.nutzer.avatarPfad = pfad;

        // Das alte Bild wegräumen — sonst sammelt sich mit jedem Wechsel eine
        // weitere Datei im Speicher an, die niemand mehr sieht.
        if (alt) await sb.storage.from('avatars').remove([alt]).catch(() => {});

        profilFuellen();
      } catch (err) {
        knopf.style.opacity = '1';
        alert('Das Bild konnte nicht gespeichert werden.\n\n' + (err.message || err));
      }
    });
  }

  // Eine Überschrift mit Unterzeile, wie sie auf der Entdecken-Seite über
  // jedem Abschnitt steht. Das Profil hat jetzt genug Abschnitte, dass es
  // dieselbe Gliederung braucht.
  function abschnittKopf(titel, unter) {
    const k = el('div');
    k.className = 'profil-abschnitt';
    k.innerHTML =
      `<h2 class="abschnitt-titel">${sicher(titel)}</h2>` +
      (unter ? `<p class="abschnitt-unter">${sicher(unter)}</p>` : '');
    return k;
  }

  // Ein Abschnitt, der zusteht und sich beim Antippen aufmacht. Für alles,
  // was zum Stöbern da ist und nicht zum Erledigen — es soll den Weg zu den
  // Einstellungen nicht verstellen.
  //
  // Gibt den Kasten zurück, in den der Inhalt gehört; der Kopf hängt schon
  // davor. Der Inhalt wird trotzdem sofort gebaut und nicht erst beim
  // Aufklappen: Er kommt aus Abfragen, die ohnehin nebenher laufen, und ein
  // Abschnitt, der beim Antippen erst zu laden beginnt, fühlt sich zäh an.
  function klappAbschnitt(rand, titel, unter) {
    const s = el('section');
    s.className = 'klapp';

    const kopf = el('button');
    kopf.type = 'button';
    kopf.className = 'klapp-kopf';
    kopf.setAttribute('aria-expanded', 'false');
    kopf.innerHTML =
      `<span class="titel"><b>${sicher(titel)}</b>` +
      (unter ? `<small>${sicher(unter)}</small>` : '') +
      `</span><span class="klapp-pfeil" aria-hidden="true">›</span>`;

    const inhalt = el('div');
    inhalt.className = 'klapp-inhalt';
    inhalt.hidden = true;

    kopf.addEventListener('click', () => {
      const auf = inhalt.hidden;
      inhalt.hidden = !auf;
      kopf.setAttribute('aria-expanded', String(auf));
    });

    s.appendChild(kopf);
    s.appendChild(inhalt);
    rand.appendChild(s);
    return inhalt;
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

  // Wo es losgeht: immer die Karte. Sie ist das Herz der App — wer sie
  // öffnet, steht meistens draußen und will sehen, was um ihn herum ist.
  //
  // Vorher wurde der zuletzt offene Bereich wiederhergestellt (aus
  // SPEICHER_TAB). Das führte dazu, dass man nach einem Blick ins Profil
  // beim nächsten Öffnen wieder im Profil landete. Gemerkt wird der Bereich
  // weiterhin (bereichZeigen schreibt ihn), nur der Start hängt nicht mehr
  // daran.
  //
  // Ein geteilter Link auf einen Spot ändert daran nichts — der gehört
  // ohnehin auf die Karte, teilen.js öffnet dann das Blatt dazu.
  let anfang = 'karte';

  // Die Kurzbefehle der installierten App (manifest.webmanifest, "shortcuts").
  //
  // Android und Windows zeigen sie beim langen Antippen des App-Symbols:
  // „Karte" und „Merkliste" springen dann direkt dorthin. Ohne diese Zeilen
  // wäre der Kurzbefehl eine Adresse, die niemand liest — die App ginge
  // trotzdem auf der Karte auf, und beim Merkliste-Kurzbefehl fragte man sich,
  // warum er nichts tut.
  try {
    const los = new URLSearchParams(location.search).get('los');
    if (los && BEREICHE.includes(los)) anfang = los;
  } catch (e) {}

  bereichZeigen(anfang, { merken: false });
})();
