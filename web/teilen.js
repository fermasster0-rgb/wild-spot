// ============================================================================
// Einen Spot teilen — und einen geteilten Link öffnen
//
// ----------------------------------------------------------------------------
// Was das löst
//
// Bisher konnte man einen Spot nur beschreiben: "der See südlich von Krakau,
// scroll mal ein bisschen nach links". Jetzt gibt es einen Link, der genau
// diesen einen Platz aufmacht:
//
//   https://fermasster0-rgb.github.io/wild-spot/?spot=8c1b0bde-…
//
// Wer ihn öffnet, landet auf der Karte am richtigen Fleck, mit aufgeklappter
// Leiste. Ohne Konto, ohne Installation — der Link ist die ganze Einladung.
//
// ----------------------------------------------------------------------------
// Warum die ID und keine Koordinaten
//
// Ein Link mit lat/lng wäre kürzer, würde aber nur auf eine Stelle der Karte
// zeigen, nicht auf den Spot. Wird der Spot umbenannt, bekommt er neue Fotos
// oder wandert er ein paar Meter, zeigt die ID immer noch auf dasselbe —
// Koordinaten zeigten dann ins Leere daneben.
//
// ----------------------------------------------------------------------------
// Ohne Netz
//
// Zuerst wird im Offline-Speicher der Karte nachgesehen (dieselbe Liste, aus
// der die Karte am Berg ihre Spots holt). Erst wenn der Spot dort fehlt, wird
// die Datenbank gefragt. Ein Link auf einen Spot, den man schon einmal gesehen
// hat, funktioniert dadurch auch im Funkloch.
// ============================================================================

'use strict';

(() => {
  const FELD = 'spot';

  // --------------------------------------------------------------------------
  // 1. DEN LINK BAUEN
  // --------------------------------------------------------------------------

  function linkZu(id) {
    // Ein abschließendes "index.html" fliegt raus: Der Link soll aussehen wie
    // die Adresse, die man ohnehin herumreicht — nicht wie ein Dateipfad.
    const pfad = location.pathname.replace(/index\.html$/, '');
    return `${location.origin}${pfad}?${FELD}=${encodeURIComponent(id)}`;
  }
  window.spotLink = linkZu;

  // --------------------------------------------------------------------------
  // 2. DER KNOPF IN DER LEISTE
  // --------------------------------------------------------------------------

  const knopf = document.getElementById('detail-teilen');

  // Welcher Spot gerade offen ist. Wird von spot-detail.js gesetzt, sobald
  // die Leiste aufgeht — der Knopf im Kopf lebt außerhalb des Bereichs, der
  // bei jedem Neuzeichnen ersetzt wird, und braucht deshalb sein eigenes
  // Gedächtnis.
  let offeneId = null;

  window.teilenAnmelden = function teilenAnmelden(id) {
    offeneId = id || null;
    if (knopf) knopf.hidden = !offeneId;

    // Die Adresszeile mitführen: Wer den Link lieber von dort kopiert oder die
    // Seite neu lädt, bekommt denselben Spot. replaceState statt pushState —
    // sonst müsste man sich durch jeden angesehenen Spot zurücktippen.
    if (offeneId) adresseSetzen(linkZu(offeneId));
  };

  window.teilenAbmelden = function teilenAbmelden() {
    offeneId = null;
    if (knopf) knopf.hidden = true;

    // Zurück auf die nackte Adresse — sonst zeigt ein neu geladenes Fenster
    // einen Spot, den man längst zugemacht hat.
    adresseSetzen(location.pathname + location.hash);
  };

  function adresseSetzen(adresse) {
    try {
      history.replaceState(history.state, '', adresse);
    } catch { /* bei einer direkt geöffneten Datei verbietet das der Browser */ }
  }

  if (knopf) {
    knopf.onclick = async () => {
      if (!offeneId) return;
      const adresse = linkZu(offeneId);

      try {
        await navigator.clipboard.writeText(adresse);
        status('Link kopiert — wer ihn öffnet, landet direkt bei diesem Spot.',
               { dauer: 3500 });
      } catch {
        // Ohne Zwischenablage (älterer Browser, unsichere Verbindung) hilft
        // nur: den Link zeigen, damit man ihn von Hand nehmen kann.
        status('Kopieren geht in diesem Browser nicht. Der Link lautet:<br>' +
               `<span class="meta">${escapeHtml(adresse)}</span>`,
               { warnung: true, dauer: 12000 });
      }
    };
  }

  // --------------------------------------------------------------------------
  // 3. EINEN GETEILTEN LINK ÖFFNEN
  // --------------------------------------------------------------------------

  function idAusAdresse() {
    const id = new URLSearchParams(location.search).get(FELD);
    if (!id) return null;

    // Nur echte IDs durchlassen. Was hier hereinkommt, steht in einer Adresse,
    // die jeder Fremde geschickt haben kann — es geht zwar nur in eine
    // Datenbankabfrage mit festem Muster, aber Prüfen ist billiger als
    // Vertrauen.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id : null;
  }

  // Im Offline-Speicher der Karte nachsehen (app.js, SPOT_SPEICHER).
  function ausSpeicher(id) {
    try {
      const alle = JSON.parse(localStorage.getItem('wildspot-spots-offline') || '[]');
      const treffer = alle.find((f) => f?.properties?.id === id);
      if (!treffer) return null;
      const [lng, lat] = treffer.geometry.coordinates;
      return { id, name: treffer.properties.name, lat, lng };
    } catch {
      return null;
    }
  }

  async function ausDatenbank(id) {
    const { data, error } = await window.WILDCAMP_AUTH.client
      .rpc('spot_by_id', { spot_id: id });
    if (error) throw error;
    const s = Array.isArray(data) ? data[0] : data;
    return s ? { id: s.id, name: s.name, lat: Number(s.lat), lng: Number(s.lng) } : null;
  }

  // Solange die Einführung oder der Rechtshinweis über der Karte liegt, wäre
  // ein aufspringendes Spot-Fenster dahinter nur verwirrend. Also warten —
  // aber nicht ewig.
  function freieBahn() {
    return new Promise((fertig) => {
      const versperrt = () => {
        const intro = document.getElementById('intro');
        const hinweis = document.getElementById('hinweis-hg');
        return (intro && !intro.hidden) || (hinweis && !hinweis.hidden);
      };
      if (!versperrt()) return fertig();

      let versuche = 0;
      const uhr = setInterval(() => {
        if (!versperrt() || ++versuche > 300) {   // höchstens zwei Minuten
          clearInterval(uhr);
          fertig();
        }
      }, 400);
    });
  }

  // Hinfliegen und warten, bis die Karte steht. Zoom 14 zeigt das Tal
  // drumherum — näher heran wäre ein grüner Fleck ohne Zusammenhang. Ist die
  // Karte schon näher dran, bleibt es dabei.
  function hinfliegen(lng, lat) {
    return new Promise((fertig) => {
      let erledigt = false;
      const ende = () => { if (!erledigt) { erledigt = true; fertig(); } };

      karte.once('moveend', ende);
      // Sicherheitsnetz: Bleibt moveend aus — abgeschaltete Bewegung, ein
      // Wisch mitten hinein —, geht es trotzdem weiter.
      setTimeout(ende, 2500);

      karte.flyTo({
        center: [lng, lat],
        zoom: Math.max(karte.getZoom(), 14),
        duration: 1200,
      });
    });
  }

  async function geteiltenSpotOeffnen() {
    const id = idAusAdresse();
    if (!id) return;

    let spot = ausSpeicher(id);

    if (!spot) {
      try {
        spot = await ausDatenbank(id);
      } catch {
        status('Der geteilte Spot konnte nicht geladen werden — ohne Netz ' +
               'geht das nur bei Spots, die du schon einmal gesehen hast.',
               { warnung: true, dauer: 6000 });
        return;
      }
    }

    if (!spot) {
      status('Diesen Spot gibt es nicht mehr. Vielleicht hat ihn der ' +
             'Ersteller gelöscht.', { warnung: true, dauer: 6000 });
      // Die Adresse aufräumen: Beim nächsten Neuladen soll die Meldung nicht
      // wieder kommen.
      adresseSetzen(location.pathname);
      return;
    }

    // Erst hinfliegen, dann aufklappen — und zwar wirklich nacheinander.
    // Das Aufklappen schiebt die Karte selbst noch ein Stück zur Seite, damit
    // der Spot nicht unter der Leiste verschwindet; passiert das mitten im
    // Flug, bricht es ihn ab und man landet irgendwo auf halber Strecke.
    await hinfliegen(spot.lng, spot.lat);
    await freieBahn();

    if (typeof window.spotDetailOeffnen === 'function') {
      window.spotDetailOeffnen(spot.id, spot.name, spot.lat, spot.lng);
    }
  }

  // --------------------------------------------------------------------------
  // 4. LOSLEGEN, ABER ERST WENN DIE KARTE STEHT
  //
  // Sofort losfliegen geht nicht: Die Karte passt beim Start erst einmal ganz
  // Österreich ins Bild (begrenzungSetzen in app.js) und würde ein früheres
  // Ziel überschreiben.
  //
  // Gewartet wird auf "idle" — fertig gezeichnet, nichts mehr in Bewegung —
  // und nicht auf "load": load feuert je nach Ladeweg mehrfach, und
  // isStyleLoaded() meldet beim Start eine ganze Weile false, obwohl die
  // Karte längst dasteht. Beides hat den Link vorher ins Leere laufen lassen.
  // Das Flag sorgt dafür, dass der Spot höchstens einmal aufspringt.
  // --------------------------------------------------------------------------

  let schonGestartet = false;

  function starten() {
    if (schonGestartet) return;
    schonGestartet = true;
    geteiltenSpotOeffnen();
  }

  if (idAusAdresse()) {
    if (karte.loaded()) starten();
    else karte.once('idle', starten);
  }
})();
