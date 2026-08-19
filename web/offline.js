// ============================================================================
// Aus der Website wird eine App.
//
// Drei Dinge passieren hier:
//
//   1. Der Service Worker wird angemeldet (sw.js) — der sorgt dafür, dass die
//      App ohne Empfang startet und die Karte da bleibt, wo man schon war.
//
//   2. "App installieren" — ein Knopf in den Einstellungen. Android bietet die
//      Installation von selbst an, aber gut versteckt im Browsermenü; am
//      iPhone geht sie nur von Hand über "Teilen → Zum Home-Bildschirm". Beides
//      findet niemand, dem es keiner sagt.
//
//   3. Ein Hinweis, wenn kein Netz da ist — damit ein leerer Kartenrand als
//      Funkloch erkennbar ist und nicht als kaputte App.
// ============================================================================

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // --------------------------------------------------------------------------
  // 1. Den Service Worker anmelden
  //
  // Nur über https (oder auf dem eigenen Rechner). Der Browser lässt es sonst
  // nicht zu, aus gutem Grund: Ein Programm, das jede Anfrage mitliest, darf
  // nicht über eine Leitung kommen, in die jeder hineinschreiben kann.
  // --------------------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // updateViaCache: 'none' ist hier der entscheidende Teil.
        //
        // GitHub Pages schickt auf jede Datei "Cache-Control: max-age=600"
        // mit — auch auf sw.js. Ohne diese Angabe darf der Browser den
        // Service Worker also zehn Minuten lang aus seinem eigenen Speicher
        // nehmen, statt beim Server nachzufragen. Er merkt dann schlicht
        // nicht, dass es eine neue Fassung gibt, und am Handy bleibt die alte
        // App stehen, obwohl längst veröffentlicht wurde.
        //
        // 'none' heißt: die Datei sw.js wird beim Prüfen immer frisch geholt.
        // Nur diese eine Datei — für alles andere bleibt der Speicher wie er
        // ist, sonst wäre die App offline nicht mehr brauchbar.
        const reg = await navigator.serviceWorker.register('./sw.js',
                                                           { updateViaCache: 'none' });

        // Kommt eine neue Fassung, wartet sie zunächst nur. Ohne Hinweis
        // bliebe am Handy ewig die alte kleben — die klassische Falle bei
        // Apps, die offline können.
        reg.addEventListener('updatefound', () => {
          const neu = reg.installing;
          if (!neu) return;
          neu.addEventListener('statechange', () => {
            if (neu.state === 'installed' && navigator.serviceWorker.controller) {
              neueFassungAnbieten(reg);
            }
          });
        });

        // Beim Zurückkommen in die App nachsehen, ob es etwas Neues gibt.
        //
        // Eine installierte App wird selten wirklich neu geladen — man
        // schiebt sie in den Hintergrund und holt sie wieder hervor. Ohne
        // diese Prüfung fragt der Browser von sich aus nur beim Anmelden des
        // Service Workers nach, also praktisch nie.
        //
        // Höchstens alle zwei Minuten, damit nicht jeder Blick auf die App
        // eine Anfrage auslöst.
        let zuletzt = Date.now();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          if (Date.now() - zuletzt < 120000) return;
          zuletzt = Date.now();
          reg.update().catch(() => {});
        });
      } catch (err) {
        console.warn('Service Worker nicht angemeldet:', err);
      }
    });

    // Nach dem Übernehmen einmal neu laden, damit die neuen Dateien greifen.
    //
    // Die Abfrage davor ist wichtig, und sie hat gefehlt: Beim allerersten
    // Aufruf — und nach jedem Leeren des Speichers — gibt es noch keinen
    // Service Worker. Dann läuft folgendes ab:
    //
    //   Seite lädt → sw.js meldet sich an → install → skipWaiting →
    //   activate → clients.claim() übernimmt die offene Seite →
    //   controllerchange feuert → und hier wurde blind neu geladen.
    //
    // Die App lud also jedes erste Mal doppelt. Sichtbar als kurzes Flackern
    // und eine zweite Start-Animation.
    //
    // Neu laden muss man nur, wenn die Seite vorher schon von einem Service
    // Worker bedient wurde — nur dann liegen alte Dateien im Zugriff, die
    // durch neue ersetzt gehören. Beim ersten Mal kam ohnehin alles frisch
    // aus dem Netz, da gibt es nichts aufzufrischen.
    //
    // Übersprungen wird deshalb genau EIN Wechsel: der von "noch kein Service
    // Worker" auf "der erste hat übernommen". Jeder weitere ist ein echtes
    // Update und muss neu laden. Würde man stattdessen den Zustand vom
    // Seitenstart festhalten, bliebe ein Update wirkungslos, das in derselben
    // Sitzung nach der Erstinstallation hereinkommt — die App liefe mit
    // neuen Dateien im Speicher und alten im Fenster weiter.
    let hatController = !!navigator.serviceWorker.controller;
    let laedtNeu = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hatController) { hatController = true; return; }
      if (laedtNeu) return;
      laedtNeu = true;
      window.location.reload();
    });
  }

  function neueFassungAnbieten(reg) {
    const balken = document.createElement('button');
    balken.className = 'neue-fassung';
    balken.innerHTML = 'Neue Fassung da — antippen zum Aktualisieren';
    balken.addEventListener('click', () => {
      reg.waiting?.postMessage('jetzt-uebernehmen');
      balken.remove();
    });
    document.body.appendChild(balken);

    // Wer nicht antippt, bekommt sie beim nächsten Start. Der Balken soll
    // nicht ewig im Weg stehen.
    setTimeout(() => balken.remove(), 20000);
  }

  // --------------------------------------------------------------------------
  // 2. Installieren
  // --------------------------------------------------------------------------
  let installEreignis = null;

  const bereich   = $('app-installieren');
  const knopf     = $('knopf-installieren');
  const anleitung = $('install-anleitung');

  // Android/Chrome meldet sich, sobald die App installierbar ist. Genau dann
  // — und nur dann — hat ein eigener Knopf einen Sinn.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();               // das Standard-Banner unterdrücken
    installEreignis = e;
    if (bereich) bereich.hidden = false;
    if (knopf) knopf.hidden = false;
  });

  knopf?.addEventListener('click', async () => {
    if (!installEreignis) return;
    installEreignis.prompt();
    const { outcome } = await installEreignis.userChoice;
    installEreignis = null;
    if (outcome === 'accepted' && bereich) bereich.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    if (bereich) bereich.hidden = true;
  });

  // Am iPhone gibt es dieses Ereignis nicht — Safari kennt nur den Weg über
  // das Teilen-Menü. Dort steht deshalb die Anleitung statt eines Knopfes.
  const istIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                 (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const laeuftAlsApp = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

  if (istIOS && !laeuftAlsApp) {
    if (bereich) bereich.hidden = false;
    if (anleitung) anleitung.hidden = false;
  }

  // --------------------------------------------------------------------------
  // 3. Funkloch sichtbar machen
  //
  // Ohne Hinweis wirkt eine Karte, die nur noch die schon geladenen Kacheln
  // zeigt, wie eine kaputte App.
  // --------------------------------------------------------------------------
  const netzbalken = document.createElement('div');
  netzbalken.className = 'kein-netz';
  netzbalken.textContent = 'Kein Netz — Karte und Spots vom letzten Mal';
  netzbalken.hidden = true;
  document.body.appendChild(netzbalken);

  function netzPruefen() {
    netzbalken.hidden = navigator.onLine;
  }
  window.addEventListener('online', netzPruefen);
  window.addEventListener('offline', netzPruefen);
  netzPruefen();

  // --------------------------------------------------------------------------
  // 4. Der Kartenspeicher: zeigen, wie viel liegt — und leeren können
  //
  // Wer wissen will, ob die Tour wirklich gespeichert ist, bekommt hier eine
  // Zahl. Und wer den Platz zurück will, kann sie wegwerfen.
  // --------------------------------------------------------------------------
  const speicherText = $('speicher-text');

  async function speicherAnzeigen() {
    if (!speicherText) return;
    try {
      const cache = await caches.open('wildspot-karten');
      const anzahl = (await cache.keys()).length;

      let platz = '';
      if (navigator.storage?.estimate) {
        const { usage } = await navigator.storage.estimate();
        if (usage) platz = ` · rund ${Math.round(usage / 1048576)} MB`;
      }

      speicherText.textContent = anzahl
        ? `${anzahl.toLocaleString('de-AT')} Kartenausschnitte gespeichert${platz}`
        : 'Noch nichts gespeichert — was du auf der Karte anschaust, bleibt da.';
    } catch {
      speicherText.textContent = 'Der Speicherstand lässt sich hier nicht lesen.';
    }
  }

  $('knopf-speicher-leeren')?.addEventListener('click', async () => {
    await caches.delete('wildspot-karten');
    await caches.delete('wildspot-fotos');
    speicherAnzeigen();
  });

  // Beim Öffnen der Einstellungen aktualisieren — dort steht die Zahl.
  $('knopf-einstellungen')?.addEventListener('click', () => {
    setTimeout(speicherAnzeigen, 50);
  });
  speicherAnzeigen();

  // ==========================================================================
  // EIN GEBIET IM VORAUS LADEN
  //
  // Bisher blieb liegen, was man einmal angesehen hat — man musste die Gegend
  // zu Hause abfahren und hoffen. Hier wird sie gezielt geholt: den sichtbaren
  // Ausschnitt einmal in allen Zoomstufen, die man draußen braucht.
  //
  // ----------------------------------------------------------------------------
  // Woher die Adressen kommen
  //
  // Nicht aus einer eigenen Liste, sondern aus der laufenden Karte:
  // karte.getStyle().sources kennt jede Quelle, die gerade gezeichnet wird —
  // samt Kachelvorlage. Damit lädt dieser Code die Karte vor, die der Nutzer
  // tatsächlich eingestellt hat, ohne dass hier jemals ein Kartendienst
  // eingetragen werden muss. Eine Liste hier würde beim nächsten Kartenwechsel
  // stillschweigend das Falsche laden.
  //
  // ----------------------------------------------------------------------------
  // Warum Zoom 10 bis 15
  //
  // Darunter sieht man Landschaft, aber keinen Weg; darüber wird die Zahl der
  // Kacheln unbrauchbar groß (jede Stufe vervierfacht sie). 15 ist nah genug,
  // um einen Steig zu erkennen — und das ist es, wofür man offline eine Karte
  // dabeihat.
  // ==========================================================================

  // Jede Stufe vervierfacht die Zahl der Kacheln. 14 ist nah genug, um einen
  // Steig zu erkennen; 15 wäre schöner und würde denselben Ausschnitt viermal
  // so teuer machen.
  const ZOOM_VON = 11;
  const ZOOM_BIS = 14;
  const HOECHSTENS = 2500;   // darüber wird abgelehnt statt lange geladen

  // Slippy-Map-Rechnung: Längengrad und Breitengrad in Kachelnummern.
  function kachelX(lng, z) {
    return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
  }
  function kachelY(lat, z) {
    const r = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
  }

  // Alle Kacheladressen für einen Ausschnitt, über alle Zoomstufen.
  //
  // Zwei Feinheiten, die beim Prüfen aufgefallen sind:
  //
  //   1. Nur SICHTBARE Quellen. Die Karte führt alle vier Grundkarten
  //      gleichzeitig mit, drei davon ausgeblendet. Über getStyle().sources
  //      wären also immer alle vier geladen worden — vierfaches Datenvolumen
  //      für Karten, die man gar nicht eingestellt hat.
  //
  //   2. Die Vorlagen über karte.getSource() holen, nicht aus getStyle().
  //      Die Standardkarte ist ein Vektorstil, dessen Quellen erst zur
  //      Laufzeit aus einer TileJSON-Datei aufgelöst werden. Im Stil steht
  //      dort nur eine Adresse, keine Kachelvorlage — genau die wichtigste
  //      Karte wäre stillschweigend übersprungen worden.
  function adressenFuerGebiet(karte) {
    const b = karte.getBounds();
    const stil = karte.getStyle();
    const vorlagen = [];

    const sichtbar = new Set();
    for (const ebene of stil?.layers || []) {
      if (!ebene.source) continue;
      try {
        if (karte.getLayoutProperty(ebene.id, 'visibility') !== 'none') {
          sichtbar.add(ebene.source);
        }
      } catch { /* Ebene inzwischen weg */ }
    }

    for (const name of sichtbar) {
      const quelle = karte.getSource(name);
      // Nur echte Kachelquellen. Was die Karte sonst noch führt — die eigenen
      // Punkte, die Maske, die Route — sind GeoJSON-Quellen ohne Vorlage und
      // fallen hier von selbst heraus.
      if (!Array.isArray(quelle?.tiles) || !quelle.tiles.length) continue;
      vorlagen.push({
        vorlage: quelle.tiles[0],
        minzoom: Number.isFinite(quelle.minzoom) ? quelle.minzoom : 0,
        maxzoom: Number.isFinite(quelle.maxzoom) ? quelle.maxzoom : 22,
      });
    }

    const adressen = new Set();

    for (const { vorlage, minzoom, maxzoom } of vorlagen) {
      for (let z = ZOOM_VON; z <= ZOOM_BIS; z++) {
        // Über die Grenze der Quelle hinaus gibt es nichts zu holen — die
        // Karte selbst zeigt dort die letzte vorhandene Stufe vergrößert.
        if (z < minzoom || z > maxzoom) continue;

        const x1 = kachelX(b.getWest(), z);
        const x2 = kachelX(b.getEast(), z);
        const y1 = kachelY(b.getNorth(), z);
        const y2 = kachelY(b.getSouth(), z);

        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            adressen.add(vorlage
              .replace('{z}', z).replace('{x}', x).replace('{y}', y)
              .replace('{ratio}', '').replace('{a-c}', 'a'));
          }
        }
      }
    }

    return [...adressen];
  }

  // Holen heißt hier nur: einmal anfragen. Der Service Worker fängt jede
  // Kartenanfrage ab und legt sie in seinen Speicher (sw.js, istKarte) — es
  // braucht also keinen zweiten Weg, der dasselbe noch einmal verwaltet.
  //
  // Acht gleichzeitig: genug, dass es zügig geht, wenig genug, dass kein
  // Kartendienst die Anfragen für einen Angriff hält.
  async function adressenHolen(adressen, melden) {
    let fertig = 0, misslungen = 0;
    const reihe = [...adressen];

    async function arbeiter() {
      while (reihe.length) {
        const adresse = reihe.pop();
        try {
          const antwort = await fetch(adresse, { mode: 'cors', credentials: 'omit' });
          if (!antwort.ok) misslungen++;
        } catch {
          misslungen++;
        }
        fertig++;
        if (fertig % 10 === 0 || !reihe.length) melden(fertig, adressen.length, misslungen);
      }
    }

    await Promise.all(Array.from({ length: 8 }, arbeiter));
    return { fertig, misslungen };
  }

  // Die Karte ist in app.js ein top-level const und liegt damit im globalen
  // Bereich, aber NICHT auf window — deshalb dieser Umweg statt window.karte.
  function dieKarte() {
    return typeof karte !== 'undefined' ? karte : null;
  }

  // Nach außen für screens.js — dort sitzt der Knopf.
  window.WILDSPOT_GEBIET = {
    // Wie viele Kacheln der aktuelle Ausschnitt bedeutet. Damit kann der Knopf
    // vorher sagen, worauf man sich einlässt.
    schaetzen() {
      const k = dieKarte();
      if (!k) return { anzahl: 0, zuGross: true };
      const anzahl = adressenFuerGebiet(k).length;
      return { anzahl, zuGross: anzahl > HOECHSTENS };
    },

    async laden(melden) {
      const k = dieKarte();
      if (!k) throw new Error('Die Karte ist noch nicht bereit.');
      const adressen = adressenFuerGebiet(k);
      if (!adressen.length) throw new Error('Für diesen Ausschnitt gibt es nichts zu laden.');
      if (adressen.length > HOECHSTENS) {
        throw new Error('Der Ausschnitt ist zu groß. Zoom ein Stück näher heran '
          + 'und lade lieber zwei Gebiete nacheinander.');
      }
      return adressenHolen(adressen, melden || (() => {}));
    },
  };
})();
