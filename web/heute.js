// ============================================================================
// heute.js — der Block, der sich jeden Tag von selbst ändert
//
// ----------------------------------------------------------------------------
// Warum es ihn gibt
//
// Am 2026-09-04 stand in Wild Spot alles, was eine Karte braucht: 162 Plätze,
// 163 Fotos, 14.560 Gipfel, 45.000 Wasserstellen. Und trotzdem fühlte sich die
// App leer an. Der Grund war nicht die Datenmenge, sondern die Bewegung: Wer
// die App zweimal in einer Woche öffnete, sah zweimal exakt dasselbe. Nichts
// hatte sich gerührt. Eine App, in der sich nichts rührt, liest man als tot —
// egal wie viel drinsteht.
//
// Der naheliegende Weg, das zu ändern, wäre Betrieb von Menschen: Beiträge,
// Bewertungen, "drei Leute waren diese Woche hier". Den gibt es noch nicht,
// und erfinden kommt nicht in Frage — eine Karte mit geheimen Schlafplätzen
// lebt von genau einer Sache, und das ist Glaubwürdigkeit.
//
// Es gibt aber etwas, das sich ohne einen einzigen Menschen jeden Tag ändert,
// und das ausgerechnet die wichtigste Frage dieser App beantwortet: das
// Wetter in der kommenden Nacht. Vier Grad und Regen sind eine andere Auskunft
// als acht Grad und klarer Himmel, und morgen steht wieder etwas anderes da.
// Das ist keine Kulisse, sondern die Auskunft, wegen der man die App aufmacht.
//
// ----------------------------------------------------------------------------
// Was der Block genau zeigt
//
// Einen Platz, dazu die kommende Nacht dort: Tiefsttemperatur, wie es wird,
// wann es dunkel wird. Darunter, welche Nacht der nächsten Woche dort die
// beste wäre. Angetippt geht der Platz auf.
//
// Welcher Platz — in dieser Reihenfolge:
//   1. Der nächstgelegene, wenn der Standort ohnehin schon freigegeben ist.
//      Dann ist es keine Empfehlung mehr, sondern eine Auskunft über hier.
//   2. Sonst ein Platz des Tages. Ausgewürfelt wird er nicht: Aus dem Datum
//      wird eine Zahl gerechnet, und die zeigt auf einen Platz. Dadurch sehen
//      alle am selben Tag denselben — und morgen einen anderen.
//
// Nach dem Standort wird NICHT gefragt. Ein Standortdialog beim Öffnen einer
// unbekannten App ist der schnellste Weg zu einem Nein (dieselbe Regel wie
// bei "In deiner Nähe" in screens.js).
//
// ----------------------------------------------------------------------------
// Warum stündliche Werte und nicht die Tageswerte
//
// Open-Meteo liefert pro Tag ein temperature_2m_min. Das ist verlockend und
// falsch: Das Minimum eines Kalendertages fällt fast immer in die Stunden VOR
// Sonnenaufgang — es gehört also zur Nacht von GESTERN auf heute, nicht zu
// der, die bevorsteht. Wer heute Abend losfährt und sich auf den Tageswert
// verlässt, liegt um eine Nacht daneben.
//
// Deshalb werden hier Stundenwerte geholt und die Nacht selbst
// zusammengerechnet: von 21 Uhr bis 7 Uhr früh. Das ist der Zeitraum, in dem
// man im Zelt liegt, und nur der zählt.
//
// Aufgehoben wird nichts davon (siehe wetter.js): Ein zwei Tage altes Wetter
// wäre schlimmer als gar keins, weil man ihm glaubt.
// ============================================================================

(() => {
  const auth = window.WILDCAMP_AUTH;
  const sb   = auth && auth.client;
  if (!sb) return;

  const $ = (id) => document.getElementById(id);

  const sicher = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const zahl = (n) => Number(n || 0).toLocaleString('de-AT');

  // Die Nachtstunden. 21 bis 7 — davor sitzt man noch, danach steht man auf.
  const AB = 21;
  const BIS = 7;

  // ==========================================================================
  // 1. WELCHER PLATZ
  // ==========================================================================

  // Ist der Standort schon freigegeben, wird er genommen — aber nur dann.
  // permissions.query fragt nach dem Stand, ohne einen Dialog auszulösen.
  async function standortWennErlaubt() {
    if (!navigator.permissions || !navigator.geolocation) return null;
    try {
      const stand = await navigator.permissions.query({ name: 'geolocation' });
      if (stand.state !== 'granted') return null;
    } catch (e) { return null; }

    return new Promise((fertig) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => fertig({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => fertig(null),
        { timeout: 4000, maximumAge: 600000 },
      );
    });
  }

  // Aus dem Datum eine Zahl. Derselbe Tag ergibt denselben Platz, der nächste
  // Tag einen anderen — ohne dass irgendwo gespeichert werden müsste, welcher
  // schon dran war.
  function tagesZahl() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  const entfernungKm = (a, b) => {
    const R = 6371;
    const r = (g) => (g * Math.PI) / 180;
    const dLat = r(b.lat - a.lat);
    const dLng = r(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2
      + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  async function platzWaehlen() {
    // 40 Plätze reichen: Sie sind die Auswahl für den Platz des Tages, und
    // für "der nächstgelegene" genügt ein Ausschnitt — wer in Wien sitzt,
    // bekommt so oder so keinen, der um die Ecke liegt.
    const { data, error } = await sb.rpc('spots_entdecken', {
      sortierung: 'neu', anzahl: 40,
    });
    const liste = (data || []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    if (error || !liste.length) return null;

    const wo = await standortWennErlaubt();
    if (wo) {
      let naechster = null;
      let kuerzeste = Infinity;
      for (const s of liste) {
        const km = entfernungKm(wo, s);
        if (km < kuerzeste) { kuerzeste = km; naechster = s; }
      }
      // Nur wenn er auch wirklich in der Nähe ist. Ein "nächster Platz" in
      // 600 km Entfernung ist als Auskunft über die heutige Nacht wertlos.
      if (naechster && kuerzeste <= 250) {
        return { spot: naechster, km: kuerzeste, weil: 'nah' };
      }
    }

    return { spot: liste[tagesZahl() % liste.length], km: null, weil: 'tag' };
  }

  // ==========================================================================
  // 2. DIE NACHT AUSRECHNEN
  // ==========================================================================

  // Die Wettercodes wie in wetter.js — hier nur die grobe Einteilung, weil
  // eine Nacht keine Wortklauberei braucht, sondern eine Ansage.
  function himmel(code, bewoelkung) {
    const c = Number(code);
    if (c >= 95) return 'Gewitter';
    if (c >= 71 && c <= 77) return 'Schnee';
    if (c >= 85) return 'Schneeschauer';
    if (c >= 80) return 'Schauer';
    if (c >= 61) return 'Regen';
    if (c >= 51) return 'Niesel';
    if (c === 45 || c === 48) return 'Nebel';
    if (bewoelkung >= 80) return 'Bedeckt';
    if (bewoelkung >= 40) return 'Wolkig';
    return 'Klar';
  }

  // Fasst die Stunden einer Nacht zu einer Nacht zusammen.
  //
  // "Nacht n" heißt: die Nacht, die am Tag n abends beginnt. Ihre Stunden
  // liegen also in zwei Kalendertagen, und genau deshalb steht diese Funktion
  // hier und nicht in wetter.js, das tageweise denkt.
  function nachtRechnen(std, startTag) {
    const stunden = [];
    for (let i = 0; i < std.time.length; i++) {
      const t = std.time[i];
      const tag = t.slice(0, 10);
      const h = Number(t.slice(11, 13));
      const gehoert = (tag === startTag && h >= AB)
        || (tag === naechsterTag(startTag) && h < BIS);
      if (gehoert) stunden.push(i);
    }
    if (stunden.length < 4) return null;

    const werte = (feld) => stunden
      .map((i) => Number(std[feld]?.[i]))
      .filter((v) => Number.isFinite(v));

    const temps = werte('temperature_2m');
    const regen = werte('precipitation');
    const wind  = werte('wind_speed_10m');
    const wolke = werte('cloud_cover');
    const codes = werte('weather_code');

    if (!temps.length) return null;

    return {
      tag: startTag,
      kalt: Math.min(...temps),
      regen: regen.reduce((a, b) => a + b, 0),
      wind: wind.length ? Math.max(...wind) : 0,
      wolken: wolke.length ? wolke.reduce((a, b) => a + b, 0) / wolke.length : 50,
      code: codes.length ? Math.max(...codes) : 0,
    };
  }

  function naechsterTag(iso) {
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // Wie gut ist die Nacht? Dieselbe Rangfolge wie in wetter.js: trocken vor
  // windstill vor warm vor klar. Abzüge von hundert, damit man dem Ergebnis
  // ansieht, was fehlt.
  function bewerten(n) {
    let p = 100;
    if (n.regen >= 4)        p -= 60;
    else if (n.regen >= 1)   p -= 38;
    else if (n.regen >= 0.2) p -= 18;

    if (n.wind >= 40)      p -= 30;
    else if (n.wind >= 25) p -= 16;
    else if (n.wind >= 15) p -= 6;

    if (n.kalt <= -5)     p -= 26;
    else if (n.kalt <= 0) p -= 14;
    else if (n.kalt <= 3) p -= 6;

    if (n.wolken < 20)      p += 8;
    else if (n.wolken < 45) p += 4;
    return p;
  }

  // Der Satz zur Nacht. Er ist die eigentliche Arbeit dieses Blocks: Eine
  // Zahl allein ("4 °C") sagt niemandem, ob er losfahren soll.
  function urteil(n) {
    const nass    = n.regen >= 0.2;
    const stuermisch = n.wind >= 25;
    const frost   = n.kalt <= 0;
    const klar    = n.wolken < 25;

    if (n.code >= 95)  return ['Gewitter — heute nicht.', 'schlecht'];
    if (n.regen >= 4)  return ['Nass. Zelt und Schlafsack trocknen bis morgen nicht.', 'schlecht'];
    if (nass)          return ['Es regnet in der Nacht. Machbar, aber ungemütlich.', 'mau'];
    if (stuermisch)    return ['Zu windig. Ein Zelt steht darin nicht ruhig.', 'mau'];
    if (frost && klar) return ['Klar und frostig — schöner Himmel, harte Nacht.', 'mau'];
    if (frost)         return ['Unter null. Nur mit dem richtigen Schlafsack.', 'mau'];
    if (klar && n.kalt >= 8)  return ['Klar, trocken, mild. So gut wird es selten.', 'gut'];
    if (klar)          return ['Klar und trocken — Sternenhimmel.', 'gut'];
    if (n.wolken >= 80) return ['Trocken, aber bedeckt. Vom Himmel wenig zu sehen.', 'okay'];
    return ['Trocken und ruhig.', 'gut'];
  }

  const wochentag = (iso) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('de-AT', { weekday: 'long' });

  // ==========================================================================
  // 3. DER BLOCK
  // ==========================================================================

  let lief = false;

  async function fuellen() {
    const kasten = $('entdecken-heute');
    const block  = $('entdecken-heute-block');
    if (!kasten || !block) return;

    // Nur einmal pro Sitzung. Der Block wechselt tageweise, nicht minütlich —
    // ihn bei jedem Reiterwechsel neu zu holen wäre verschwendete Bandbreite
    // am Berg.
    if (lief) return;
    lief = true;

    block.hidden = false;
    kasten.innerHTML = '<div class="platzhalter heute-laedt"></div>';

    let wahl = null;
    try {
      wahl = await platzWaehlen();
    } catch (e) { wahl = null; }

    if (!wahl) { block.hidden = true; lief = false; return; }

    const s = wahl.spot;

    const felder = 'temperature_2m,precipitation,wind_speed_10m,cloud_cover,weather_code';
    const adresse = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${s.lat.toFixed(4)}&longitude=${s.lng.toFixed(4)}`
      + `&hourly=${felder}&daily=sunset&timezone=auto&forecast_days=8`
      + (Number.isFinite(s.elevation_m) ? `&elevation=${Math.round(s.elevation_m)}` : '');

    let w;
    try {
      const antwort = await fetch(adresse);
      if (!antwort.ok) throw new Error('Wetter ' + antwort.status);
      w = await antwort.json();
    } catch (e) {
      // Ohne Netz verschwindet der Block ganz. Eine Überschrift "Heute Nacht"
      // über einer Fehlermeldung ist schlechter als keine Überschrift — die
      // Seite darunter funktioniert ja weiter.
      block.hidden = true;
      lief = false;
      return;
    }

    const heute = new Date().toISOString().slice(0, 10);
    const jetzt = new Date().getHours();

    // Vor 7 Uhr früh ist "heute Nacht" die Nacht, in der man gerade steckt —
    // die hat gestern Abend begonnen. Ab 7 Uhr ist die kommende gemeint.
    const startTag = jetzt < BIS
      ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      : heute;

    const naechte = [];
    for (let i = 0; i < 7; i++) {
      const tag = new Date(new Date(startTag + 'T12:00:00').getTime() + i * 86400000)
        .toISOString().slice(0, 10);
      const n = nachtRechnen(w.hourly || {}, tag);
      if (n) naechte.push(n);
    }

    if (!naechte.length) { block.hidden = true; lief = false; return; }

    const kommend = naechte[0];
    const [satz, wie] = urteil(kommend);

    // Die beste der übrigen — aber nur, wenn sie deutlich besser ist als die
    // kommende. "Die beste Nacht ist heute" ist keine Nachricht, und ein
    // Vorschlag, der nur zwei Punkte besser ist, ist keiner.
    let beste = null;
    for (const n of naechte.slice(1)) {
      if (!beste || bewerten(n) > bewerten(beste)) beste = n;
    }
    if (beste && bewerten(beste) <= bewerten(kommend) + 12) beste = null;

    // Sonnenuntergang des Abends, an dem die Nacht beginnt.
    const sIndex = (w.daily?.time || []).indexOf(startTag);
    const dunkel = sIndex >= 0 ? String(w.daily.sunset[sIndex]).slice(11, 16) : null;

    const grad = (t) => `${Math.round(t)}°`;

    const wo = wahl.weil === 'nah' && wahl.km != null
      ? `${sicher(s.name)} · ${wahl.km < 10 ? wahl.km.toFixed(1) : Math.round(wahl.km)} km von hier`
      : sicher(s.name);

    const angaben = [];
    if (dunkel) angaben.push(`dunkel ab ${dunkel}`);
    if (kommend.wind >= 10) angaben.push(`Wind ${Math.round(kommend.wind)} km/h`);
    if (kommend.regen >= 0.2) angaben.push(`${kommend.regen.toFixed(1)} mm Regen`);
    if (Number.isFinite(s.elevation_m)) angaben.push(`${zahl(s.elevation_m)} m`);

    const ueberschrift = jetzt < BIS ? 'Diese Nacht' : 'Heute Nacht';

    kasten.innerHTML =
      `<button class="heute-karte ${wie}" type="button">
         <span class="heute-oben">
           <span class="heute-grad">${grad(kommend.kalt)}</span>
           <span class="heute-was">
             <b>${himmel(kommend.code, kommend.wolken)}</b>
             <span>${sicher(satz)}</span>
           </span>
         </span>
         <span class="heute-wo">${wo}</span>
         ${angaben.length ? `<span class="heute-klein">${angaben.join(' · ')}</span>` : ''}
       </button>`
      + (beste
        ? `<p class="heute-aussicht">Die beste Nacht der Woche wäre dort
             <b>${wochentag(beste.tag)}</b> — ${grad(beste.kalt)},
             ${himmel(beste.code, beste.wolken).toLowerCase()}.</p>`
        : '');

    const unter = $('entdecken-heute-unter');
    if (unter) {
      unter.textContent = wahl.weil === 'nah'
        ? 'Der nächste Platz von hier — und wie die Nacht dort wird'
        : 'Ein Platz aus der Karte — und wie die Nacht dort wird';
    }

    kasten.querySelector('.heute-karte')?.addEventListener('click', () => {
      if (typeof window.spotDetailOeffnen === 'function') {
        window.spotDetailOeffnen(s.id, s.name, s.lat, s.lng);
      }
    });
  }

  window.WILDSPOT_HEUTE = { fuellen };
})();
