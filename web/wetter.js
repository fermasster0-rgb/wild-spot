// ============================================================================
// Bedingungen am Spot — Wetter und Sonnenzeiten für die nächsten drei Tage
//
// ----------------------------------------------------------------------------
// Warum ausgerechnet das
//
// Für eine Nacht draußen ist nicht die Tagestemperatur die Frage, sondern die
// NACHTtemperatur. Ein Platz auf 2.200 m hat im Juli nachts gut und gern 2 °C
// — wer mit einem Sommerschlafsack hinfährt, friert. Dazu Regen und Wind, und
// wann es dunkel wird: Die Gehzeit zum Spot nützt wenig, wenn man im Finstern
// ankommt.
//
// ----------------------------------------------------------------------------
// Woher die Daten kommen
//
// Open-Meteo — derselbe Dienst, der beim Anlegen eines Spots schon die Seehöhe
// liefert. Gratis, ohne Anmeldung, ohne Schlüssel, und er erlaubt Anfragen
// direkt aus dem Browser. Kein neuer Vertrag, kein neues Konto.
//
// Mitgeschickt wird die Seehöhe des Spots ("elevation"). Nachgemessen an den
// zehn Steiermark-Spots bringt das allerdings wenig: Open-Meteo trifft die
// Höhe von sich aus auf 0 bis 17 Meter genau, der Unterschied in der
// Nachttemperatur lag bei höchstens 0,1 °C. Der Parameter bleibt trotzdem
// drin — er kostet nichts und fängt den Fall ab, dass das Geländemodell einen
// Spot einmal deutlich verfehlt. Wer hier eine große Wirkung erwartet, wird
// enttäuscht; das ist nachgeprüft und kein Versprechen.
//
// ----------------------------------------------------------------------------
// Ohne Netz
//
// Die Vorhersage wird bewusst NICHT für offline aufgehoben. Ein zwei Tage
// altes Wetter ist schlimmer als gar keins: Man würde ihm glauben. Am Berg
// steht deshalb ehrlich da, dass es dafür Empfang braucht.
// ============================================================================

(() => {
  // Die Wettercodes der Weltorganisation für Meteorologie. Nur die Gruppen,
  // die in Österreich vorkommen — zusammengefasst, damit die Zeile kurz bleibt.
  const CODES = {
    0: ['Klar', '☀'],
    1: ['Überwiegend klar', '🌤'],
    2: ['Teils bewölkt', '⛅'],
    3: ['Bedeckt', '☁'],
    45: ['Nebel', '🌫'], 48: ['Reifnebel', '🌫'],
    51: ['Nieselregen', '🌦'], 53: ['Nieselregen', '🌦'], 55: ['Starker Niesel', '🌦'],
    56: ['Gefrierender Niesel', '🌧'], 57: ['Gefrierender Niesel', '🌧'],
    61: ['Leichter Regen', '🌦'], 63: ['Regen', '🌧'], 65: ['Starker Regen', '🌧'],
    66: ['Gefrierender Regen', '🌧'], 67: ['Gefrierender Regen', '🌧'],
    71: ['Leichter Schneefall', '🌨'], 73: ['Schneefall', '🌨'], 75: ['Starker Schneefall', '❄'],
    77: ['Schneegriesel', '🌨'],
    80: ['Regenschauer', '🌦'], 81: ['Regenschauer', '🌧'], 82: ['Heftige Schauer', '⛈'],
    85: ['Schneeschauer', '🌨'], 86: ['Starke Schneeschauer', '❄'],
    95: ['Gewitter', '⛈'], 96: ['Gewitter mit Hagel', '⛈'], 99: ['Gewitter mit Hagel', '⛈'],
  };

  const codeText = (c) => (CODES[c] ?? ['—', '·'])[0];
  const codeZeichen = (c) => (CODES[c] ?? ['—', '·'])[1];

  const uhr = (iso) => {
    if (!iso) return '–';
    // Open-Meteo liefert "2026-08-12T20:34" in der angefragten Zeitzone.
    const t = String(iso).split('T')[1] ?? '';
    return t.slice(0, 5) + ' Uhr';
  };

  function tagName(iso, index) {
    if (index === 0) return 'Heute';
    if (index === 1) return 'Morgen';
    const d = new Date(iso + 'T12:00');
    return d.toLocaleDateString('de-AT', { weekday: 'long' });
  }

  // Der Platzhalter, der sofort erscheint. Gefüllt wird er nachgeladen —
  // die Detailansicht soll nicht auf das Wetter warten müssen.
  window.wetterPlatzhalter = () =>
    '<h3>Bedingungen</h3>'
    + '<div class="wetter" id="wetter-block">'
    + '<p class="wetter-laedt">Wetter wird geholt …</p>'
    + '</div>';

  // Holt die Vorhersage und füllt den Platzhalter. Fehler sind hier nie
  // schlimm: Dann steht eben kein Wetter da, der Rest der Seite bleibt heil.
  // ==========================================================================
  // Welche Nacht ist die richtige?
  //
  // Für eine Nacht draußen zählt anderes als für einen Tag draußen. Die
  // Reihenfolge ist bewusst diese:
  //
  //   1. Trocken. Nasses Zelt und nasser Schlafsack verderben alles andere,
  //      und zwar bis zum nächsten Tag.
  //   2. Windstill. Wind kühlt aus und macht Lärm — man schläft nicht.
  //   3. Warm genug. Unter null wird es eine Frage der Ausrüstung.
  //   4. Klar. Der Grund, warum man überhaupt draußen schläft.
  //
  // Es sind Abzüge von hundert, keine Punkte: So sieht man dem Ergebnis an,
  // was der Nacht fehlt, statt nur eine Zahl zu bekommen.
  // ==========================================================================
  function nachtBewerten(t, i) {
    const regen  = Number(t.precipitation_sum?.[i]) || 0;
    const wind   = Number(t.wind_speed_10m_max?.[i]) || 0;
    const kalt   = Number(t.temperature_2m_min?.[i]);
    const code   = Number(t.weather_code?.[i]) || 0;

    let punkte = 100;

    // Regen: schon ein halber Millimeter ist eine nasse Nacht.
    if (regen >= 5)        punkte -= 60;
    else if (regen >= 1)   punkte -= 38;
    else if (regen >= 0.2) punkte -= 18;

    // Wind: ab 25 km/h steht kein Zelt mehr ruhig.
    if (wind >= 40)      punkte -= 30;
    else if (wind >= 25) punkte -= 16;
    else if (wind >= 15) punkte -= 6;

    // Kälte: unter null braucht es Ausrüstung, die nicht jeder hat.
    if (Number.isFinite(kalt)) {
      if (kalt <= -5)     punkte -= 26;
      else if (kalt <= 0) punkte -= 14;
      else if (kalt <= 3) punkte -= 6;
    }

    // Klar ist ein Gewinn, nicht nur die Abwesenheit von Regen.
    if (code === 0)      punkte += 8;
    else if (code <= 2)  punkte += 4;

    return punkte;
  }

  // Was der Nacht fehlt, in einem Halbsatz — damit die Empfehlung begründet
  // ist und nicht behauptet.
  function nachtGrund(t, i) {
    const regen = Number(t.precipitation_sum?.[i]) || 0;
    const wind  = Number(t.wind_speed_10m_max?.[i]) || 0;
    const kalt  = Number(t.temperature_2m_min?.[i]);

    const gut = [];
    if (regen < 0.2) gut.push('trocken');
    if (wind < 15)   gut.push('windstill');
    if (Number.isFinite(kalt) && kalt > 3) gut.push('mild');
    if (Number(t.weather_code?.[i]) === 0) gut.push('klar');

    if (!gut.length) return 'die brauchbarste der Woche';
    return gut.join(', ');
  }

  window.wetterLaden = async function wetterLaden(lat, lng, hoehe) {
    const block = document.getElementById('wetter-block');
    if (!block) return;

    // Mit Plus sieben Nächte, ohne Plus drei. Die Zahl steht hier und nicht
    // weiter unten, weil sie in die Adresse muss — es werden gar nicht erst
    // mehr Tage geholt, als gezeigt werden dürfen.
    const hatPlus = !!(window.WILDSPOT_PLUS && window.WILDSPOT_PLUS.hat());
    const tage = hatPlus ? 7 : 3;

    try {
      const felder = [
        'weather_code', 'temperature_2m_max', 'temperature_2m_min',
        'precipitation_sum', 'precipitation_probability_max',
        'wind_speed_10m_max', 'sunrise', 'sunset',
      ].join(',');

      let adresse = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`
        + `&daily=${felder}&timezone=Europe%2FVienna&forecast_days=${tage}`;

      // Die echte Höhe des Spots, falls bekannt — siehe Kopf der Datei.
      if (Number.isFinite(hoehe)) adresse += `&elevation=${Math.round(hoehe)}`;

      const res = await fetch(adresse, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const json = await res.json();
      const t = json?.daily;
      if (!t?.time?.length) throw new Error('keine Vorhersage geliefert');

      const zeilen = [];

      // ---- Die wichtigste Zahl zuerst: wie kalt wird die kommende Nacht ----
      const nachts = t.temperature_2m_min?.[0];
      if (Number.isFinite(nachts)) {
        const frostig = nachts <= 3;
        zeilen.push(
          `<div class="wetter-nacht${frostig ? ' frostig' : ''}">`,
          `<b>${Math.round(nachts)} °C</b>`,
          '<span>kälteste Stunde der kommenden Nacht'
          + (frostig ? ' — warmer Schlafsack nötig' : '') + '</span>',
          '</div>'
        );
      }

      // ---- Die beste Nacht der Woche (nur mit Plus) ----
      //
      // Erst ab der zweiten Nacht: Die kommende steht schon groß darüber, und
      // „die beste Nacht ist heute" wäre keine Auskunft, sondern eine
      // Wiederholung.
      let besteNacht = -1;
      if (hatPlus && t.time.length > 3) {
        let bestesErgebnis = -Infinity;
        for (let i = 0; i < t.time.length - 1; i++) {
          const p = nachtBewerten(t, i);
          if (p > bestesErgebnis) { bestesErgebnis = p; besteNacht = i; }
        }
        if (besteNacht >= 0) {
          zeilen.push(
            '<div class="wetter-beste">',
            '<span class="wb-zeichen" aria-hidden="true">',
            '<svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>',
            '</span>',
            '<div>',
            `<b>Beste Nacht: ${tagName(t.time[besteNacht], besteNacht)}</b>`,
            `<span>${escapeHtml(nachtGrund(t, besteNacht))}` +
            (Number.isFinite(t.temperature_2m_min?.[besteNacht])
              ? ` · ${Math.round(t.temperature_2m_min[besteNacht])} °C` : '') +
            '</span>',
            '</div>',
            '</div>'
          );
        }
      }

      // ---- Die Tage in je einer Zeile ----
      zeilen.push('<div class="wetter-tage">');
      for (let i = 0; i < t.time.length; i++) {
        const regen = t.precipitation_sum?.[i];
        const wahrsch = t.precipitation_probability_max?.[i];
        const wind = t.wind_speed_10m_max?.[i];

        const nass = Number.isFinite(regen) && regen >= 0.2
          ? `${regen.toFixed(1).replace('.', ',')} mm`
            + (Number.isFinite(wahrsch) ? ` · ${wahrsch} %` : '')
          : 'trocken';

        zeilen.push(
          `<div class="wetter-tag${i === besteNacht ? ' ist-beste' : ''}">`,
          `<span class="wt-tag">${tagName(t.time[i], i)}</span>`,
          `<span class="wt-bild" title="${escapeHtml(codeText(t.weather_code?.[i]))}">`
          + `${codeZeichen(t.weather_code?.[i])}</span>`,
          `<span class="wt-temp"><b>${Math.round(t.temperature_2m_max?.[i])}°</b>`
          + `<i>${Math.round(t.temperature_2m_min?.[i])}°</i></span>`,
          `<span class="wt-rest">${nass}`
          + (Number.isFinite(wind) ? ` · Wind ${Math.round(wind)} km/h` : '')
          + '</span>',
          '</div>'
        );
      }
      zeilen.push('</div>');

      // ---- Hell und dunkel ----
      if (t.sunrise?.[0] && t.sunset?.[0]) {
        zeilen.push(
          '<div class="wetter-sonne">',
          `<span>Sonnenaufgang <b>${uhr(t.sunrise[0])}</b></span>`,
          `<span>Sonnenuntergang <b>${uhr(t.sunset[0])}</b></span>`,
          '</div>'
        );
      }

      // ---- Was ohne Plus fehlt ----
      //
      // Kein Schloss und keine leere Fläche, sondern ein Satz darunter. Wer
      // drei Tage sieht, weiß sonst gar nicht, dass es sieben gäbe — und ein
      // Angebot, das man nicht kennt, nimmt niemand an.
      if (!hatPlus) {
        zeilen.push(
          '<button type="button" class="wetter-mehr" id="wetter-mehr">',
          '<span class="wm-zeichen" aria-hidden="true">',
          '<svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>',
          '</span>',
          '<span class="wm-text"><b>Sieben Nächte statt drei</b>',
          '<small>Mit Plus siehst du die ganze Woche — und welche Nacht davon '
          + 'die richtige ist.</small></span>',
          '<span class="wm-pfeil" aria-hidden="true">›</span>',
          '</button>'
        );
      }

      zeilen.push('<p class="wetter-quelle">Vorhersage von Open-Meteo'
        + (Number.isFinite(hoehe) ? `, gerechnet für ${Math.round(hoehe)} m` : '')
        + '. Im Gebirge kann das Wetter kleinräumig anders sein.</p>');

      block.innerHTML = zeilen.join('');

      const mehr = document.getElementById('wetter-mehr');
      if (mehr) {
        mehr.addEventListener('click', () => {
          if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('plus');
        });
      }
    } catch (e) {
      // Kein Netz ist der wahrscheinlichste Fall — am Berg der Normalzustand.
      const ohneNetz = !navigator.onLine || /abort|timeout|failed|network/i.test(String(e));
      block.innerHTML = `<p class="wetter-laedt">${ohneNetz
        ? 'Kein Netz — die Vorhersage braucht Empfang. Sie wird bewusst nicht '
          + 'gespeichert: Ein zwei Tage altes Wetter wäre schlimmer als keins.'
        : 'Die Vorhersage ist gerade nicht erreichbar.'}</p>`;
    }
  };
})();
