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
        const reg = await navigator.serviceWorker.register('./sw.js');

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
      } catch (err) {
        console.warn('Service Worker nicht angemeldet:', err);
      }
    });

    // Nach dem Übernehmen einmal neu laden, damit die neuen Dateien greifen.
    let laedtNeu = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
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
})();
