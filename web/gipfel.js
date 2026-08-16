// ============================================================================
// gipfel.js — Sammeln, Abzeichen, Zahlen
//
// Was diese Datei baut:
//
//   Das Gipfelblatt   Antippen eines Gipfels auf der Karte oder in einer
//                     Liste: Höhe, der wievielthöchste des Landes, wer schon
//                     oben war — und der Knopf „Ich war oben".
//   Die Gipfelliste   Ein eigenes Blatt zum Stöbern: die höchsten, die
//                     nächsten, meine gesammelten, die noch offenen. Mit Suche.
//   Die Abzeichen     Fünfzehn Stück, gerechnet aus dem, was jemand getan hat
//                     (db/020, Funktion abzeichen).
//   Die Zahlen        Gipfel, Plätze, Nächte, Gipfelmeter — und die beiden,
//                     die noch nicht gehen: Kilometer und Stunden.
//
// ----------------------------------------------------------------------------
// WARUM KILOMETER UND STUNDEN HIER ALS „KOMMT NOCH" STEHEN
//
// Eine Webseite darf im Hintergrund nicht dauerhaft den Standort verfolgen.
// Sobald der Bildschirm aus ist, hört sie auf zu zählen — die Hälfte der
// Strecke fehlt, und niemand merkt es. Eine Zahl, die falsch ist, ohne dass
// man es sieht, ist schlechter als gar keine.
//
// Deshalb steht in der App an dieser Stelle offen, dass es noch nicht geht,
// statt eine erfundene Zahl. Die Tabelle dahinter (tracks) ist fertig; sobald
// es eine echte App gibt oder jemand eine GPX-Datei hochlädt, stehen die
// Kilometer sofort da, ohne dass hier etwas geändert werden muss.
// ============================================================================

(() => {
  const auth = window.WILDCAMP_AUTH;
  const sb   = auth.client;

  const $  = (id) => document.getElementById(id);
  const el = (was) => document.createElement(was);

  function sicher(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function zahl(n) {
    const z = Number(n);
    return Number.isFinite(z) ? z.toLocaleString('de-AT') : '–';
  }

  function datumLang(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-AT',
      { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Das Bergzeichen — dasselbe wie in der Legende und auf der Karte. Es
  // ersetzt die Emojis ⛰️ und 🏔️, die hier bis zum 2026-08-16 standen: Die
  // sahen auf jedem Gerät anders aus und passten zu nichts anderem in dieser
  // App. Ein gesammelter Gipfel wird eingefärbt, nicht ausgetauscht.
  const BERG_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M2 20 9 5l4.5 8L16.5 8 22 20Z"/>' +
    '<path d="M6.4 12.6 9 7.2l2.6 5.4"/></svg>';

  // ==========================================================================
  // 1. DIE EIGENE SAMMLUNG
  //
  // Sie liegt zusätzlich im Browserspeicher — genau wie die Merkliste in
  // screens.js und aus demselben Grund: Die Karte fragt beim Zeichnen jedes
  // einzelnen Gipfels, ob er gesammelt ist. Das darf keine Datenbankabfrage
  // sein.
  // ==========================================================================

  const SPEICHER = 'wildspot-gipfel';
  let meine = new Set();

  function lesen() {
    try {
      const roh = JSON.parse(localStorage.getItem(SPEICHER) || '[]');
      if (Array.isArray(roh)) meine = new Set(roh);
    } catch (e) {}
  }

  function schreiben() {
    try { localStorage.setItem(SPEICHER, JSON.stringify([...meine])); } catch (e) {}
  }

  async function holen() {
    if (!auth.nutzer) { meine = new Set(); schreiben(); return; }
    const { data, error } = await sb.from('peak_logs')
      .select('peak_id').eq('user_id', auth.nutzer.id);
    if (error) return;                       // kein Netz: der Speicher gilt weiter
    meine = new Set((data || []).map((z) => z.peak_id));
    schreiben();
    kartefaerben();
  }

  function kartefaerben() {
    if (typeof window.WILDCAMP_PUNKTE_NEU === 'function') {
      window.WILDCAMP_PUNKTE_NEU();
    }
  }

  lesen();

  // ==========================================================================
  // 2. DAS GIPFELBLATT
  // ==========================================================================

  let offenerGipfel = null;

  async function oeffnen(gipfelId, name) {
    offenerGipfel = gipfelId;

    const hg = $('gipfel-hg');
    const kasten = $('gipfel-inhalt');
    if (!hg || !kasten) return;

    hg.hidden = false;
    kasten.innerHTML =
      `<div class="gipfel-kopf"><h2>${sicher(name || 'Gipfel')}</h2></div>
       <div class="platzhalter" style="height:120px;border-radius:16px"></div>`;

    const { data, error } = await sb.rpc('gipfel_detail', { gipfel_id: gipfelId });
    const g = data && data[0];

    if (error || !g) {
      kasten.innerHTML =
        '<p class="detail-leer">Zu diesem Gipfel ist gerade nichts zu holen. ' +
        'Ohne Netz geht das nicht.</p>';
      return;
    }

    const gesammelt = meine.has(g.id) || g.ich_war;

    kasten.innerHTML =
      `<div class="gipfel-kopf ${gesammelt ? 'gesammelt' : ''}">
         <span class="gipfel-zeichen">${BERG_SVG}</span>
         <h2>${sicher(g.name)}</h2>
         <p class="gipfel-hoehe"><b>${zahl(g.elevation_m)} m</b></p>
         ${gesammelt ? '<span class="gipfel-marke">Gesammelt</span>' : ''}
       </div>

       <div class="zahlen">
         <div class="zahl-kachel"><b>${zahl(g.rang)}.</b><span>höchster in Österreich</span></div>
         <div class="zahl-kachel"><b>${zahl(g.sammler)}</b><span>${
            Number(g.sammler) === 1 ? 'war oben' : 'waren oben'}</span></div>
         <div class="zahl-kachel"><b>${g.besucht_am ? '✓' : '–'}</b><span>${
            g.besucht_am ? sicher(datumLang(g.besucht_am)) : 'noch nicht'}</span></div>
       </div>

       ${g.notiz ? `<p class="gipfel-notiz">„${sicher(g.notiz)}"</p>` : ''}

       ${(g.letzte && g.letzte.length)
          ? `<p class="gipfel-leute">Zuletzt oben: ${g.letzte.map((n) =>
               `<b>${sicher(n)}</b>`).join(', ')}</p>`
          : '<p class="gipfel-leute">Hier war noch niemand aus Wild Spot. Du wärst der Erste.</p>'}

       <div class="gipfel-knoepfe">
         <button type="button" class="${gesammelt ? 'oliv-knopf still' : 'oliv-knopf'} voll"
                 id="gipfel-sammeln">
           ${gesammelt ? 'Ich war doch nicht oben' : '✓ Ich war oben'}
         </button>
         <button type="button" class="flach-knopf" id="gipfel-karte">Auf der Karte zeigen</button>
       </div>

       ${gesammelt ? '' :
         `<div class="gipfel-datum-block" id="gipfel-datum-block">
            <label for="gipfel-datum">Wann warst du oben? <span>(darf leer bleiben)</span></label>
            <input type="date" id="gipfel-datum">
            <label for="gipfel-notiz">Ein Satz dazu</label>
            <input type="text" id="gipfel-notiz" maxlength="200"
                   placeholder="Nebel bis 2.000, oben Sonne …">
          </div>`}`;

    $('gipfel-sammeln').addEventListener('click',
      () => sammelnUmschalten(g, gesammelt));

    $('gipfel-karte').addEventListener('click', () => {
      hg.hidden = true;
      if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('karte');
      const karte = window.WILDCAMP_KARTE;
      if (karte && Number.isFinite(Number(g.lat))) {
        karte.flyTo({ center: [Number(g.lng), Number(g.lat)], zoom: 14 });
      }
    });
  }

  async function sammelnUmschalten(g, warSchon) {
    if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

    const knopf = $('gipfel-sammeln');
    knopf.disabled = true;

    if (warSchon) {
      const { error } = await sb.from('peak_logs').delete()
        .eq('user_id', auth.nutzer.id).eq('peak_id', g.id);
      if (!error) {
        meine.delete(g.id);
        schreiben();
        kartefaerben();
        oeffnen(g.id, g.name);
        melden('Der Gipfel ist wieder offen.');
      } else {
        knopf.disabled = false;
      }
      return;
    }

    const datum = $('gipfel-datum') ? ($('gipfel-datum').value || null) : null;
    const notiz = $('gipfel-notiz') ? ($('gipfel-notiz').value.trim() || null) : null;

    const { error } = await sb.from('peak_logs').insert({
      user_id: auth.nutzer.id,
      peak_id: g.id,
      besucht_am: datum,
      notiz: notiz ? notiz.slice(0, 500) : null,
    });

    if (error) {
      knopf.disabled = false;
      melden('Hat nicht geklappt: ' + error.message);
      return;
    }

    meine.add(g.id);
    schreiben();
    kartefaerben();
    oeffnen(g.id, g.name);
    melden(`${g.name} ist deiner Sammlung hinzugefügt — ${zahl(meine.size)} ${
      meine.size === 1 ? 'Gipfel' : 'Gipfel'} insgesamt.`);
  }

  // Eine kurze Quittung oben. Dieselbe Form wie im Feed.
  function melden(text) {
    const alt = $('feed-meldung');
    if (alt) alt.remove();
    const m = el('div');
    m.id = 'feed-meldung';
    m.className = 'feed-meldung';
    m.textContent = text;
    document.body.appendChild(m);
    setTimeout(() => m.remove(), 4200);
  }

  // ==========================================================================
  // 3. DIE GIPFELLISTE
  //
  // Vier Ansichten auf dieselben Daten. „Offen" ist die eigentliche
  // Sammelliste: alles, wo ich noch nicht oben war.
  // ==========================================================================

  let welche = 'alle';
  let standort = null;

  function listeOeffnen(anfang = 'alle') {
    const hg = $('gipfelliste-hg');
    if (!hg) return;
    welche = anfang;
    hg.hidden = false;

    for (const k of document.querySelectorAll('#gipfelliste-reiter [data-gl]')) {
      k.setAttribute('aria-pressed', String(k.dataset.gl === welche));
    }

    listeFuellen();

    // Den Standort nur nehmen, wenn er ohnehin schon freigegeben ist — ein
    // Dialog als Antwort auf „Gipfel ansehen" wäre eine Frage, die niemand
    // gestellt hat.
    if (!standort && navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((stand) => {
        if (stand.state !== 'granted') return;
        navigator.geolocation.getCurrentPosition((pos) => {
          standort = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (welche === 'nah') listeFuellen();
        }, () => {}, { maximumAge: 300000, timeout: 8000 });
      }).catch(() => {});
    }
  }

  async function listeFuellen() {
    const kasten = $('gipfelliste-inhalt');
    if (!kasten) return;

    const suche = $('gipfelliste-suche') ? $('gipfelliste-suche').value.trim() : '';

    kasten.innerHTML =
      '<div class="platzhalter" style="height:62px;margin-bottom:8px"></div>'.repeat(5);

    const { data, error } = await sb.rpc('gipfel_liste', {
      welche: suche.length >= 2 ? 'alle' : welche,
      suche: suche.length >= 2 ? suche : null,
      von_lat: standort ? standort.lat : null,
      von_lng: standort ? standort.lng : null,
      ab_hoehe: 0,
      anzahl: 60,
    });

    kasten.innerHTML = '';

    if (error) {
      kasten.innerHTML =
        '<p class="detail-leer">Die Gipfel kamen nicht durch. Ohne Netz geht das nicht.</p>';
      return;
    }

    const liste = data || [];

    if (!liste.length) {
      kasten.innerHTML = welche === 'meine'
        ? '<p class="detail-leer">Noch kein Gipfel gesammelt. Tippe auf der Karte ' +
          'einen an — oder wähle oben <b>Alle</b> und such dir einen aus.</p>'
        : '<p class="detail-leer">Dazu findet sich gerade nichts.</p>';
      return;
    }

    for (const g of liste) kasten.appendChild(gipfelZeile(g));
  }

  // Eine Zeile in der Liste: Höhe groß, weil sie die Sortierung erklärt.
  function gipfelZeile(g) {
    const k = el('button');
    k.type = 'button';
    k.className = 'gipfelzeile' + ((g.ich_war || meine.has(g.id)) ? ' gesammelt' : '');
    k.innerHTML =
      `<span class="zeichen">${BERG_SVG}</span>
       <span class="wo">
         <b>${sicher(g.name)}</b>
         <small>${zahl(g.elevation_m)} m${
           g.entfernung_km != null ? ' · ' + zahl(g.entfernung_km) + ' km entfernt' : ''}${
           Number(g.sammler) > 0 ? ' · ' + zahl(g.sammler) + ' oben' : ''}</small>
       </span>
       <span class="pfeil">›</span>`;
    k.addEventListener('click', () => oeffnen(g.id, g.name));
    return k;
  }

  // ==========================================================================
  // 4. DER BLOCK AUF DER ENTDECKEN-SEITE
  // ==========================================================================

  async function entdeckenFuellen() {
    const reihe = $('entdecken-gipfel');
    const unter = $('entdecken-gipfel-unter');
    if (!reihe) return;

    reihe.innerHTML =
      '<div class="platzhalter" style="flex:0 0 auto;width:168px;height:126px"></div>'.repeat(4);

    // Ohne Konto die höchsten des Landes, mit Konto die noch offenen: Wer
    // sammelt, will sehen, was ihm fehlt.
    const { data, error } = await sb.rpc('gipfel_liste', {
      welche: auth.nutzer ? 'offen' : 'alle',
      suche: null, von_lat: null, von_lng: null,
      ab_hoehe: 0, anzahl: 12,
    });

    reihe.innerHTML = '';

    if (error || !data || !data.length) {
      const block = $('entdecken-gipfel-block');
      if (block) block.hidden = true;
      return;
    }

    for (const g of data) reihe.appendChild(gipfelKachel(g));

    if (unter) {
      unter.textContent = auth.nutzer
        ? `${zahl(meine.size)} gesammelt — das hier fehlt dir noch`
        : 'Die höchsten Gipfel Österreichs';
    }
  }

  // Eine stehende Kachel wie bei den Spots, nur ohne Foto: Gipfel haben keins,
  // und ein gekauftes Bergbild wäre gelogen. Stattdessen die Höhe groß.
  function gipfelKachel(g) {
    const k = el('button');
    k.type = 'button';
    k.className = 'gipfelkachel' + ((g.ich_war || meine.has(g.id)) ? ' gesammelt' : '');
    k.innerHTML =
      `<span class="berg">
         <svg viewBox="0 0 100 46" aria-hidden="true">
           <path d="M2 44 L30 8 L46 30 L58 16 L98 44 Z"/>
           <path d="M22 21 L30 8 L38 21 Z" class="schnee"/>
         </svg>
       </span>
       <b class="hoehe">${zahl(g.elevation_m)}<small> m</small></b>
       <span class="name">${sicher(g.name)}</span>
       <span class="wer-oben">${Number(g.sammler) > 0
          ? zahl(g.sammler) + (Number(g.sammler) === 1 ? ' war oben' : ' waren oben')
          : 'noch niemand oben'}</span>`;
    k.addEventListener('click', () => oeffnen(g.id, g.name));
    return k;
  }

  // ==========================================================================
  // 5. ABZEICHEN
  //
  // Sie stehen im eigenen Profil und im fremden. Im fremden werden nur die
  // erreichten gezeigt — der Fortschritt eines anderen zu „3 von 10 Gipfeln"
  // geht niemanden etwas an und liest sich wie eine Bewertung.
  // ==========================================================================

  async function abzeichenBauen(wessenId, { nurErreichte = false } = {}) {
    const kasten = el('div');
    kasten.className = 'abzeichen-wand';
    kasten.innerHTML =
      '<div class="platzhalter" style="height:96px;border-radius:16px"></div>';

    const { data, error } = await sb.rpc('abzeichen', { wessen_id: wessenId });

    if (error || !data) {
      kasten.innerHTML = '<p class="detail-leer">Die Abzeichen kamen nicht durch.</p>';
      return kasten;
    }

    const liste = nurErreichte ? data.filter((a) => a.erreicht) : data;

    if (!liste.length) {
      kasten.innerHTML =
        '<p class="detail-leer">Noch kein Abzeichen. Das erste gibt es für die ' +
        'erste Nacht draußen, von der man erzählt.</p>';
      return kasten;
    }

    kasten.innerHTML = '';
    for (const a of liste) {
      const k = el('div');
      k.className = 'abz' + (a.erreicht ? ' erreicht' : '');
      const anteil = Math.min(100, Math.round((Number(a.stand) / Math.max(1, Number(a.ziel))) * 100));
      k.innerHTML =
        `<span class="zeichen">${a.zeichen}</span>
         <b>${sicher(a.titel)}</b>
         <small>${sicher(a.beschreibung)}</small>
         ${a.erreicht
            ? '<span class="stand fertig">erreicht</span>'
            : `<span class="balken"><i style="width:${anteil}%"></i></span>
               <span class="stand">${zahl(a.stand)} von ${zahl(a.ziel)}</span>`}`;
      kasten.appendChild(k);
    }

    return kasten;
  }

  // ==========================================================================
  // 6. DIE ZAHLEN
  // ==========================================================================

  async function statistikBauen(wessenId, { ichSelbst = false } = {}) {
    const kasten = el('div');
    kasten.innerHTML =
      '<div class="platzhalter" style="height:88px;border-radius:16px"></div>';

    const { data, error } = await sb.rpc('statistik', { wessen_id: wessenId });
    const s = (data && data[0]) || null;

    if (error || !s) {
      kasten.innerHTML = '';
      return kasten;
    }

    const einzahl = (n, eins, viele) => (Number(n) === 1 ? eins : viele);

    kasten.innerHTML =
      `<div class="zahlen vier">
         <div class="zahl-kachel gross"><b>${zahl(s.gipfel)}</b>
           <span>${einzahl(s.gipfel, 'Gipfel', 'Gipfel')} gesammelt</span></div>
         <div class="zahl-kachel"><b>${zahl(s.plaetze)}</b>
           <span>${einzahl(s.plaetze, 'Platz besucht', 'Plätze besucht')}</span></div>
         <div class="zahl-kachel"><b>${zahl(s.naechte)}</b>
           <span>${einzahl(s.naechte, 'Nacht draußen', 'Nächte draußen')}</span></div>
         <div class="zahl-kachel"><b>${zahl(s.spots_gelegt)}</b>
           <span>Spots eingetragen</span></div>
         <div class="zahl-kachel"><b>${zahl(s.gipfel_meter)}<small> m</small></b>
           <span>Gipfelmeter gesammelt</span></div>
         <div class="zahl-kachel"><b>${s.gipfel_hoechster ? zahl(s.gipfel_hoechster) + ' m' : '–'}</b>
           <span>höchster Punkt</span></div>
         <div class="zahl-kachel"><b>${zahl(s.fotos)}</b><span>Fotos</span></div>
         <div class="zahl-kachel"><b>${zahl(s.bewertungen)}</b><span>Bewertungen</span></div>
       </div>`;

    // Die beiden Zahlen, die es noch nicht gibt. Sie stehen trotzdem da —
    // aber ehrlich beschriftet, statt als 0 km zu lügen.
    if (ichSelbst) {
      const bald = el('div');
      bald.className = 'bald-kasten';
      bald.innerHTML =
        `<div class="bald-zahlen">
           <div><b>${Number(s.km) > 0 ? zahl(s.km) + ' km' : '– km'}</b><span>zurückgelegt</span></div>
           <div><b>${Number(s.stunden) > 0 ? zahl(s.stunden) + ' h' : '– h'}</b><span>unterwegs</span></div>
           <div><b>${Number(s.aufstieg_m) > 0 ? zahl(s.aufstieg_m) + ' m' : '– m'}</b><span>Aufstieg</span></div>
         </div>
         <p><b>Kilometer und Zeit zählt Wild Spot noch nicht mit.</b>
            Eine Webseite darf im Hintergrund nicht dauerhaft mitschreiben —
            sobald der Bildschirm aus ist, würde die Hälfte der Strecke fehlen.
            Alles dafür ist vorbereitet: Sobald es Wild Spot als echte App gibt,
            stehen die Zahlen hier, rückwirkend ab der ersten aufgezeichneten Tour.</p>`;
      kasten.appendChild(bald);
    }

    return kasten;
  }

  // ==========================================================================
  // 7. MEINE GIPFEL — der Kasten fürs Profil
  // ==========================================================================

  async function meineGipfelBauen(wessenId, { ichSelbst = false } = {}) {
    const kasten = el('div');
    kasten.className = 'gipfel-kasten';

    const { data } = await sb.rpc('gipfel_liste', {
      welche: 'alle', suche: null, von_lat: null, von_lng: null,
      ab_hoehe: 0, anzahl: 200,
    });

    // Die Liste kommt nach Höhe sortiert; hier bleiben nur die gesammelten
    // dieser Person. Für das eigene Profil geht das über den Speicher, für
    // fremde über eine eigene Abfrage.
    let gesammelte = [];
    if (ichSelbst) {
      gesammelte = (data || []).filter((g) => g.ich_war || meine.has(g.id));
    } else {
      const { data: fremd } = await sb.from('peak_logs')
        .select('peak_id, besucht_am').eq('user_id', wessenId);
      const ids = new Set((fremd || []).map((z) => z.peak_id));
      gesammelte = (data || []).filter((g) => ids.has(g.id));
    }

    if (!gesammelte.length) {
      kasten.innerHTML = ichSelbst
        ? `<p class="detail-leer">Noch kein Gipfel gesammelt.</p>`
        : `<p class="detail-leer">Noch kein Gipfel gesammelt.</p>`;
      if (ichSelbst) {
        const k = el('button');
        k.className = 'oliv-knopf voll';
        k.type = 'button';
        k.textContent = 'Gipfel suchen und eintragen';
        k.addEventListener('click', () => listeOeffnen('alle'));
        kasten.appendChild(k);
      }
      return kasten;
    }

    for (const g of gesammelte.slice(0, 8)) kasten.appendChild(gipfelZeile(g));

    if (gesammelte.length > 8 || ichSelbst) {
      const mehr = el('button');
      mehr.className = 'flach-knopf voll';
      mehr.type = 'button';
      mehr.textContent = gesammelte.length > 8
        ? `Alle ${zahl(gesammelte.length)} ansehen`
        : 'Weitere Gipfel eintragen';
      mehr.addEventListener('click', () => listeOeffnen(ichSelbst ? 'meine' : 'alle'));
      kasten.appendChild(mehr);
    }

    return kasten;
  }

  // ==========================================================================
  // 8. VERDRAHTEN
  // ==========================================================================

  let sucheZeit = null;

  function verdrahten() {
    const zu = $('gipfel-zu');
    if (zu) zu.addEventListener('click', () => { $('gipfel-hg').hidden = true; });

    const listeZu = $('gipfelliste-zu');
    if (listeZu) listeZu.addEventListener('click',
      () => { $('gipfelliste-hg').hidden = true; });

    for (const k of document.querySelectorAll('#gipfelliste-reiter [data-gl]')) {
      k.addEventListener('click', () => {
        welche = k.dataset.gl;
        for (const a of document.querySelectorAll('#gipfelliste-reiter [data-gl]')) {
          a.setAttribute('aria-pressed', String(a.dataset.gl === welche));
        }
        listeFuellen();
      });
    }

    const feld = $('gipfelliste-suche');
    if (feld) {
      feld.addEventListener('input', () => {
        clearTimeout(sucheZeit);
        sucheZeit = setTimeout(listeFuellen, 260);
      });
    }

    const alle = $('gipfel-alle');
    if (alle) alle.addEventListener('click', () => listeOeffnen('alle'));

    // Beim An- und Abmelden ändert sich die eigene Sammlung.
    auth.beiWechsel.push(async () => {
      await holen();
      entdeckenFuellen();
    });

    holen();

    // Die Entdecken-Seite baut sich am Ende von screens.js auf — also
    // möglicherweise, bevor diese Datei überhaupt geladen war. Dann fehlt der
    // Gipfelblock still. Deshalb hier noch einmal: Ist der Block leer, füllen.
    const reihe = $('entdecken-gipfel');
    if (reihe && !reihe.children.length) entdeckenFuellen();
  }

  document.addEventListener('DOMContentLoaded', verdrahten);
  if (document.readyState !== 'loading') verdrahten();

  // ==========================================================================
  // Was andere Dateien von hier brauchen
  // ==========================================================================

  window.WILDSPOT_GIPFEL = {
    hat: (id) => meine.has(id),
    anzahl: () => meine.size,
    oeffnen,
    listeOeffnen,
    entdeckenFuellen,
    abzeichenBauen,
    statistikBauen,
    meineGipfelBauen,
  };
})();
