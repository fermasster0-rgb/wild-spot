// ============================================================================
// Die Einführung beim allerersten Start
//
// Sie läuft genau einmal pro Gerät und dauert unter einer Minute. Danach geht
// es sofort zur Karte — wer die App zum zweiten Mal öffnet, will nicht wieder
// begrüßt werden.
//
// Warum überhaupt Fragen und nicht nur drei Bilder zum Wegwischen:
// Die Antworten stellen die Karte ein. Wer sagt "ich suche Bergseen", sieht
// danach die Bergseen und nicht 16.000 Trinkbrunnen. Eine Frage, die nichts
// bewirkt, ist Zeitverschwendung — dann lieber gar nicht fragen.
//
// Der Rechtshinweis ist als eigener Schritt eingebaut. Er muss ohnehin einmal
// gezeigt werden, und zwei Fenster hintereinander wären eins zu viel.
// ============================================================================

'use strict';

const INTRO_SCHLUESSEL = 'wildspot-intro-gesehen';
const INTRO_ANTWORTEN  = 'wildspot-antworten';

// ============================================================================
// 1. DIE SCHRITTE
//
// art 'text'   → nur lesen, Knopf weiter
// art 'wahl'   → eine Antwort, geht nach dem Antippen von selbst weiter
// art 'mehr'   → mehrere Antworten, Knopf weiter
// art 'regeln' → der Rechtshinweis
// art 'ende'   → Anmelden oder später
// ============================================================================

const SCHRITTE = [
  {
    art: 'text',
    zeichen: true,
    titel: 'Wild&nbsp;Spot',
    text: 'Die Karte für Plätze, an denen man wirklich übernachten kann — ' +
          'eingetragen von Leuten, die dort waren. Zu Hause in Österreich, ' +
          'Spots gehen in ganz Europa.',
    knopf: 'Los geht\'s',
  },

  {
    art: 'wahl',
    id: 'erfahrung',
    titel: 'Warst du schon mal wildcampen?',
    // Diese Antwort ändert nichts an der App, und das darf der Text nicht
    // anders behaupten. Vorher stand hier "damit wir wissen, wie viel wir
    // erklären sollen" — erklärt wird aber nichts Unterschiedliches.
    text: 'Nur aus Neugier — die Karte sieht für alle gleich aus.',
    optionen: [
      { wert: 'nie',    emoji: '🌱', text: 'Noch nie — will ich aber' },
      { wert: 'paar',   emoji: '⛺', text: 'Ein paar Mal' },
      { wert: 'oft',    emoji: '🏔️', text: 'Oft — ich kenne mich aus' },
    ],
  },

  {
    art: 'mehr',
    id: 'suche',
    titel: 'Wonach suchst du?',
    text: 'Mehreres geht. Die Karte stellt sich danach darauf ein.',
    optionen: [
      { wert: 'seen',       emoji: '🏔️', text: 'Bergseen' },
      { wert: 'wasserfall', emoji: '💦', text: 'Wasserfälle' },
      { wert: 'wasser',     emoji: '💧', text: 'Trinkwasser unterwegs' },
      { wert: 'unterstand', emoji: '🏠', text: 'Hütten und Unterstände' },
    ],
  },

  {
    art: 'wahl',
    id: 'angeln',
    titel: 'Angelst du?',
    text: 'Bei Spots am Wasser kannst du eintragen, welche Fische es gibt ' +
          'und wo man die Lizenz bekommt.',
    optionen: [
      { wert: 'ja',       emoji: '🎣', text: 'Ja, Rute ist immer dabei' },
      { wert: 'manchmal', emoji: '🐟', text: 'Ab und zu' },
      { wert: 'nein',     emoji: '🎒', text: 'Nein' },
    ],
  },

  {
    art: 'regeln',
    titel: 'Kurz das Wichtigste vorweg',
    regeln: [
      { emoji: '⚖️', text: 'Wildcampen ist in Österreich <b>Ländersache</b> und vielerorts ' +
                           'verboten. Auf fremdem Grund brauchst du die Erlaubnis des Eigentümers.' },
      { emoji: '🌍', text: 'Spots gehen in <b>ganz Europa</b> — aber jedes Land hat eigene ' +
                           'Regeln. In Skandinavien erlaubt, in Kroatien teuer verboten. ' +
                           'Vorher nachlesen.' },
      { emoji: '🔥', text: 'Feuer nur, wo es <b>ausdrücklich erlaubt</b> ist — und nie bei ' +
                           'Waldbrandgefahr.' },
      { emoji: '🌿', text: 'Nichts dalassen außer plattem Gras. Alles, was du hochträgst, ' +
                           'trägst du auch wieder runter.' },
      { emoji: '💬', text: 'Alle Angaben hier stammen von Nutzern und sind <b>keine ' +
                           'Rechtsauskunft</b>. Jeder ist selbst verantwortlich.' },
    ],
    knopf: 'Verstanden',
  },

  {
    art: 'ende',
    // Nicht "Fertig": man ist es ja noch nicht, hier steht die letzte
    // Entscheidung an.
    titel: 'Das war\'s schon',
    text: 'Mit einem Konto kannst du <strong>eigene Spots anlegen</strong>, ' +
          'Fotos hochladen, bewerten und kommentieren. Zum Anschauen brauchst ' +
          'du keins.',
  },
];

// ============================================================================
// 2. AUFBAU
// ============================================================================

const introEl        = document.getElementById('intro');
const introSchritt   = document.getElementById('intro-schritt');
const introWeiter    = document.getElementById('intro-weiter');
const introSpringen  = document.getElementById('intro-ueberspringen');
const introBalken    = document.getElementById('intro-fortschritt');

let nr = 0;
const antworten = {};

function introZeigen() {
  introEl.hidden = false;
  // Solange die Einführung läuft, soll darunter nichts scrollen.
  document.body.style.overflow = 'hidden';
  schrittZeichnen();
}

function fortschrittSetzen() {
  // Der Balken zeigt, wie weit man ist — beim letzten Schritt ist er voll.
  introBalken.style.width = Math.round((nr / (SCHRITTE.length - 1)) * 100) + '%';
}

function schrittZeichnen() {
  const s = SCHRITTE[nr];
  const teile = [];

  if (s.zeichen) {
    // Ein Zelt, das sich selbst zeichnet. Dieselbe Form wie in der Legende.
    teile.push(
      '<svg class="intro-zeichen" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 3 3 20h18L12 3Z"/><path d="M12 3v17"/><path d="m8.4 20 3.6-6 3.6 6"/>' +
      '</svg>'
    );
  }

  teile.push(`<h${s.art === 'text' ? 1 : 2}>${s.titel}</h${s.art === 'text' ? 1 : 2}>`);
  if (s.text) teile.push(`<p>${s.text}</p>`);

  if (s.art === 'wahl' || s.art === 'mehr') {
    teile.push('<div class="intro-wahl">');
    for (const o of s.optionen) {
      const an = s.art === 'mehr'
        ? (antworten[s.id] || []).includes(o.wert)
        : antworten[s.id] === o.wert;
      teile.push(
        `<button type="button" data-wert="${o.wert}" aria-pressed="${an}">` +
        `<span class="emoji">${o.emoji}</span><span>${o.text}</span>` +
        '<span class="haken">✓</span></button>'
      );
    }
    teile.push('</div>');
  }

  if (s.art === 'regeln') {
    teile.push('<div class="intro-regeln">');
    for (const r of s.regeln) {
      teile.push(
        '<div class="intro-regel">' +
        `<span class="emoji">${r.emoji}</span><p>${r.text}</p>` +
        '</div>'
      );
    }
    teile.push('</div>');
  }

  introSchritt.className = 'intro-schritt kommt';
  introSchritt.innerHTML = teile.join('');

  // Die Knöpfe unten richten sich nach dem Schritt. Der grüne ist immer die
  // Hauptsache — bei einer Frage ist das die Antwort selbst, deshalb
  // verschwindet er dort und "Überspringen" steht klein darunter.
  if (s.art === 'ende') {
    introWeiter.hidden = false;
    introWeiter.textContent = 'Anmelden oder Konto anlegen';
    introSpringen.textContent = 'Später anmelden';
    introSpringen.hidden = false;

  } else if (s.art === 'wahl') {
    introWeiter.hidden = true;
    introSpringen.textContent = 'Überspringen';
    introSpringen.hidden = false;

  } else if (s.art === 'mehr') {
    introWeiter.hidden = false;
    introWeiter.textContent = 'Weiter';
    introSpringen.hidden = true;

  } else {
    introWeiter.hidden = false;
    introWeiter.textContent = s.knopf || 'Weiter';
    introSpringen.hidden = true;
  }

  fortschrittSetzen();
  verdrahtenIntro(s);
}

function verdrahtenIntro(s) {
  if (s.art !== 'wahl' && s.art !== 'mehr') return;

  for (const b of introSchritt.querySelectorAll('.intro-wahl button')) {
    b.onclick = () => {
      if (s.art === 'mehr') {
        // Mehrfach: an- und abwählen, weiter erst per Knopf.
        const liste = antworten[s.id] || [];
        const drin = liste.includes(b.dataset.wert);
        antworten[s.id] = drin
          ? liste.filter((w) => w !== b.dataset.wert)
          : [...liste, b.dataset.wert];
        b.setAttribute('aria-pressed', String(!drin));
      } else {
        // Einfach: kurz aufleuchten lassen, dann weiter. Ohne die kleine
        // Pause sieht man seine eigene Antwort nicht mehr.
        antworten[s.id] = b.dataset.wert;
        for (const x of introSchritt.querySelectorAll('.intro-wahl button')) {
          x.setAttribute('aria-pressed', String(x === b));
        }
        setTimeout(weiter, 260);
      }
    };
  }
}

// ============================================================================
// 3. WEITERBLÄTTERN
// ============================================================================

function weiter() {
  if (nr >= SCHRITTE.length - 1) return;

  introSchritt.classList.add('geht');
  setTimeout(() => {
    nr++;
    schrittZeichnen();
  }, 200);
}

introWeiter.onclick = () => {
  const s = SCHRITTE[nr];

  if (s.art === 'ende') {
    beenden();
    window.WILDCAMP_AUTH.anmeldenZeigen();
    return;
  }
  weiter();
};

// Der flache Knopf heißt zweierlei: bei einer Frage überspringt er nur diese
// eine, ganz am Ende beendet er die Einführung ohne Anmeldung.
introSpringen.onclick = () => {
  if (SCHRITTE[nr].art === 'ende') beenden();
  else weiter();
};

// ============================================================================
// 4. BEENDEN
//
// Die Antworten stellen die Karte ein, dann verschwindet die Einführung —
// und kommt auf diesem Gerät nicht wieder.
// ============================================================================

function beenden() {
  ebenenAusAntworten();

  localStorage.setItem(INTRO_SCHLUESSEL, 'ja');
  localStorage.setItem(INTRO_ANTWORTEN, JSON.stringify(antworten));

  // Der Rechtshinweis war Teil der Einführung — also nicht noch einmal zeigen.
  localStorage.setItem('wildcamp-hinweis-gelesen', 'ja');
  document.getElementById('hinweis-hg').hidden = true;

  introEl.style.transition = 'opacity 0.3s';
  introEl.style.opacity = '0';
  setTimeout(() => {
    introEl.hidden = true;
    introEl.style.opacity = '';
    document.body.style.overflow = '';
    // Die Karte stand die ganze Zeit dahinter, hat aber die Fenstergröße
    // nicht richtig mitbekommen — einmal nachfassen.
    if (typeof karte !== 'undefined') karte.resize();
  }, 300);
}

// Was jemand sucht, wird eingeschaltet — der Rest bleibt aus. Wer nichts
// angibt, bekommt die Voreinstellung und merkt nichts davon.
function ebenenAusAntworten() {
  const gesucht = antworten.suche;
  if (!gesucht || !gesucht.length) return;

  for (const gruppe of ['seen', 'wasserfall', 'wasser', 'unterstand']) {
    const an = gesucht.includes(gruppe);
    if (ebenen[gruppe] === an) continue;

    ebenen[gruppe] = an;
    const knopf = document.getElementById('knopf-' + gruppe);
    if (knopf) knopf.setAttribute('aria-pressed', String(an));
  }

  ebenenAnwenden();

  punkteLaden();
}

// ============================================================================
// 5. START
// ============================================================================

if (localStorage.getItem(INTRO_SCHLUESSEL) === 'ja') {
  // Schon gesehen — der Rechtshinweis übernimmt wie bisher, falls er noch
  // nicht weggeklickt wurde.
  introEl.hidden = true;
} else {
  introZeigen();
}
