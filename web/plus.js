// ============================================================================
// plus.js — Wild Spot Plus
//
// Der bezahlte Teil der App. Diese Datei macht drei Dinge:
//
//   1. Sie weiß, ob jemand Plus hat (window.WILDSPOT_PLUS.hat()).
//   2. Sie baut die Schranken, die an gesperrten Funktionen stehen.
//   3. Sie bedient die Plus-Seite: Tarif wählen, vormerken.
//
// Was sie NICHT macht: Geld einnehmen. Dafür braucht es einen
// Zahlungsdienstleister (Stripe oder Paddle), ein Gewerbe und ein Konto —
// nichts davon ist eingerichtet. Statt das zu verschweigen und einen Knopf zu
// bauen, der ins Leere führt, sagt die Seite es offen und sammelt
// E-Mail-Adressen für den Start.
//
// Das ist nicht nur ehrlicher, es ist auch nützlicher: Bevor man Wochen in
// eine Bezahlstrecke steckt, will man wissen, ob überhaupt jemand zahlen will.
// Die Warteliste beantwortet genau das.
//
// ----------------------------------------------------------------------------
// WIE PLUS SPÄTER ANGESCHALTET WIRD
//
// In der Datenbank steht pro Nutzer ein Datum: profiles.plus_until. Ist es in
// der Zukunft, hat er Plus. Sonst nicht. Mehr ist es nicht.
//
// Setzen darf das Datum nur der Server — ein Trigger aus Migration 017 hält
// jeden davon ab, es sich selbst einzutragen. Wenn eines Tages Stripe dazu
// kommt, schreibt dessen Webhook dieses eine Feld, und alles hier funktioniert
// ohne eine weitere Zeile Änderung.
// ============================================================================

(() => {
  const auth = window.WILDCAMP_AUTH;
  const sb   = auth.client;
  const $    = (id) => document.getElementById(id);

  // ==========================================================================
  // 1. HAT DIESER NUTZER PLUS?
  // ==========================================================================

  let plusBis   = null;    // Date oder null
  let plusTarif = null;

  function hatPlus() {
    // Wer die App verwaltet, hat Plus. Nicht als Geschenk, sondern aus
    // Notwendigkeit: Ein Admin, der die gesperrten Funktionen nicht sehen
    // kann, prüft blind — er würde jeden Fehler darin erst von Nutzern
    // erfahren.
    //
    // In der Datenbank steht dasselbe (db/023 setzt plus_until für Admins).
    // Diese Zeile hier wirkt zusätzlich sofort, ohne dass ein frisch
    // ernannter Admin auf den nächsten Lauf warten muss.
    if (auth.nutzer && auth.nutzer.istAdmin === true) return true;

    return plusBis instanceof Date && plusBis.getTime() > Date.now();
  }

  async function plusHolen() {
    if (!auth.nutzer) { plusBis = null; plusTarif = null; return; }

    const { data, error } = await sb
      .from('profiles')
      .select('plus_until, plus_tarif')
      .eq('id', auth.nutzer.id)
      .maybeSingle();

    // Fehler heißt hier fast immer: Migration 017 ist noch nicht eingespielt.
    // Dann gibt es die Spalte nicht — und ohne Spalte eben kein Plus. Das ist
    // der richtige Ausgang: im Zweifel nicht freischalten.
    if (error || !data) { plusBis = null; plusTarif = null; return; }

    plusBis   = data.plus_until ? new Date(data.plus_until) : null;
    plusTarif = data.plus_tarif || null;

    document.body.classList.toggle('hat-plus', hatPlus());
    plusSeiteAuffrischen();
  }

  // ==========================================================================
  // 2. DIE SCHRANKE
  //
  // Sie steht dort, wo eine Funktion Plus verlangt. Bewusst als Angebot und
  // nicht als Mauer: Sie erklärt, was es gäbe, und führt mit einem Tipp zur
  // Plus-Seite. Wer nicht will, scrollt daran vorbei.
  // ==========================================================================

  function schrankeBauen(zeichen, titel, text) {
    const k = document.createElement('button');
    k.className = 'schranke';
    k.type = 'button';
    k.innerHTML =
      `<span class="zeichen">${zeichen}</span>
       <span class="was">
         <b>${titel}</b>
         <small>${text}</small>
       </span>
       <span class="pfeil">›</span>`;
    k.addEventListener('click', () => {
      if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('plus');
    });
    return k;
  }

  // Der kurze Weg: eine Meldung und ab zur Plus-Seite. Wird von screens.js
  // gerufen, wenn jemand einen zweiten Filter setzen will.
  function schranke(was) {
    const alt = $('plus-hinweis');
    if (alt) alt.remove();

    const balken = document.createElement('button');
    balken.id = 'plus-hinweis';
    balken.type = 'button';
    // Derselbe Gold-auf-Nacht-Ton wie die Plus-Seite: Wer den Balken antippt,
    // landet dort — und soll die Farbe wiedererkennen, statt zu erschrecken.
    balken.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);' +
      'top:calc(max(12px, env(safe-area-inset-top)) + 56px);z-index:78;' +
      'max-width:min(86vw,420px);padding:11px 17px;border:0;border-radius:999px;' +
      'background:linear-gradient(140deg,var(--plus-grund-2),var(--plus-grund));' +
      'color:var(--plus-gold);font:inherit;font-size:13px;' +
      'font-weight:600;line-height:1.35;cursor:pointer;text-align:center;' +
      'box-shadow:0 6px 22px var(--sch2);' +
      'animation:plus-balken 0.32s cubic-bezier(0.2,0.7,0.3,1) both';
    balken.innerHTML =
      `${was} gibt es mit Plus <span style="opacity:0.7;font-weight:400">· ansehen</span>`;
    balken.addEventListener('click', () => {
      balken.remove();
      if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('plus');
    });
    document.body.appendChild(balken);
    setTimeout(() => balken.remove(), 6000);
  }

  // ==========================================================================
  // 3. DER KASTEN IM PROFIL
  // ==========================================================================

  function profilKasten() {
    const kasten = document.createElement('div');

    if (hatPlus()) {
      const bis = plusTarif === 'immer' || plusTarif === 'gruender'
        ? 'für immer'
        : 'bis ' + plusBis.toLocaleDateString('de-AT', { day: '2-digit', month: 'long', year: 'numeric' });

      kasten.className = 'menue';
      kasten.innerHTML =
        `<div class="menue-zeile" style="cursor:default">
           <svg viewBox="0 0 24 24" style="stroke:var(--plus-gold-2)">
             <path d="M12 2.5l2.5 6.2 6.2 2.5-6.2 2.5-2.5 6.2-2.5-6.2L3.3 11.2l6.2-2.5z"/></svg>
           <span class="was">Wild Spot Plus<small>Aktiv ${bis}</small></span>
           <span class="wert" style="color:var(--plus-gold-2)">aktiv</span>
         </div>`;
      return kasten;
    }

    // Kein Plus: ein Streifen, der zur Seite führt. Er sieht anders aus als
    // die Menüzeilen darunter — er verkauft etwas, und das soll man sehen.
    const k = document.createElement('button');
    k.type = 'button';
    // Ein Stück Nachthimmel im hellen Profil — dieselbe Nacht, in die der Tipp
    // führt. Der Schein hinter dem Zeichen ist derselbe Bogen wie dort oben,
    // nur klein.
    k.style.cssText =
      'position:relative;overflow:hidden;' +
      'display:flex;align-items:center;gap:13px;width:100%;padding:16px;' +
      'margin-bottom:22px;border:0;border-radius:16px;cursor:pointer;' +
      'background:radial-gradient(ellipse 70% 120% at 14% 0%,' +
        'color-mix(in srgb,var(--plus-nord) 22%,transparent),transparent 62%),' +
      'radial-gradient(ellipse 60% 110% at 74% 10%,' +
        'color-mix(in srgb,var(--plus-nacht) 20%,transparent),transparent 66%),' +
      'linear-gradient(135deg,var(--plus-grund-2),var(--plus-grund));' +
      'color:var(--plus-text);font:inherit;text-align:left;' +
      '-webkit-tap-highlight-color:transparent';
    k.innerHTML =
      `<span style="display:grid;place-items:center;width:42px;height:42px;flex-shrink:0;
                    border-radius:12px;background:color-mix(in srgb,var(--plus-gold) 16%,transparent);
                    border:1px solid color-mix(in srgb,var(--plus-gold) 26%,transparent);
                    color:var(--plus-gold)"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg></span>
       <span style="flex:1;min-width:0">
         <b style="display:block;font-size:15.5px;font-weight:800;letter-spacing:-0.02em">
           Wild Spot Plus</b>
         <small style="display:block;margin-top:3px;font-size:12.5px;line-height:1.45;
                       color:color-mix(in srgb,var(--plus-text) 62%,transparent)">
           Karten fürs Funkloch, die beste Nacht der Woche, und wo du sein darfst</small>
       </span>
       <span style="flex-shrink:0;color:color-mix(in srgb,var(--plus-gold) 70%,transparent);font-size:18px">›</span>`;
    k.addEventListener('click', () => {
      if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('plus');
    });

    kasten.appendChild(k);
    return kasten;
  }

  // ==========================================================================
  // 4. DIE PLUS-SEITE
  // ==========================================================================

  let tarif = 'jahr';

  // Was in der mitlaufenden Leiste unten steht — pro Tarif einmal, damit der
  // Preis nicht an zwei Stellen im Code steht und irgendwann auseinanderläuft.
  const TARIFE = {
    monat: { preis: '3,49 €',  wort: 'monatlich · jederzeit kündbar' },
    jahr:  { preis: '24,99 €', wort: 'jährlich · 2,08 € im Monat' },
    immer: { preis: '59 €',    wort: 'einmalig · für immer' },
  };

  function leisteBeschriften() {
    const p = $('plus-leiste-preis');
    const w = $('plus-leiste-wort');
    const t = TARIFE[tarif];
    if (!p || !w || !t) return;
    p.textContent = t.preis;
    w.textContent = t.wort;
  }

  for (const knopf of document.querySelectorAll('#preise [data-tarif]')) {
    knopf.addEventListener('click', () => {
      tarif = knopf.dataset.tarif;
      for (const k of document.querySelectorAll('#preise [data-tarif]')) {
        k.setAttribute('aria-pressed', String(k.dataset.tarif === tarif));
      }
      leisteBeschriften();
    });
  }
  leisteBeschriften();

  // Der Kaufknopf. Solange es keine Bezahlstrecke gibt, führt er zur
  // Warteliste — und sagt auch, warum.
  function zurWarteliste() {
    const kasten = $('plus-warteliste');
    if (!kasten) return;
    kasten.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Kurz aufleuchten lassen. Ohne das landet man nach dem Scrollen vor einer
    // Wand aus Text und sucht, was jetzt gemeint ist.
    kasten.classList.remove('zeigt-her');
    void kasten.offsetWidth;          // erzwingt den Neustart der Animation
    kasten.classList.add('zeigt-her');

    const feld = $('plus-mail');
    if (feld) {
      // Wer angemeldet ist, muss seine Adresse nicht abtippen.
      if (!feld.value && auth.nutzer && auth.nutzer.email) feld.value = auth.nutzer.email;
      setTimeout(() => feld.focus(), 400);
    }
  }

  const kaufKnopf = $('plus-kaufen');
  if (kaufKnopf) kaufKnopf.addEventListener('click', zurWarteliste);

  const leistenKnopf = $('plus-leiste-knopf');
  if (leistenKnopf) leistenKnopf.addEventListener('click', zurWarteliste);

  function meldung(text, art) {
    const m = $('plus-meldung');
    if (!m) return;
    m.textContent = text;
    m.className = 'plus-meldung sichtbar ' + art;
  }

  const vormerkKnopf = $('plus-vormerken');
  if (vormerkKnopf) {
    vormerkKnopf.addEventListener('click', async () => {
      const feld = $('plus-mail');
      const mail = (feld.value || '').trim();

      // Die Prüfung steht auch in der Datenbank (Migration 017). Hier ist sie
      // nur da, damit man nicht auf eine Antwort warten muss, um zu erfahren,
      // dass das @ fehlt.
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
        meldung('Das sieht noch nicht nach einer E-Mail-Adresse aus.', 'fehl');
        return;
      }

      vormerkKnopf.disabled = true;
      vormerkKnopf.textContent = 'Einen Moment…';

      const { error } = await sb.from('plus_warteliste').insert({
        email: mail,
        tarif,
        user_id: auth.nutzer ? auth.nutzer.id : null,
      });

      vormerkKnopf.disabled = false;
      vormerkKnopf.textContent = 'Platz sichern';

      if (error) {
        // 23505 = derselbe Eintrag gibt es schon. Das ist kein Fehler, den
        // jemand sehen müsste — er hat sich einfach zweimal eingetragen.
        if (String(error.code) === '23505' || /duplicate|unique/i.test(error.message || '')) {
          meldung('Du stehst schon auf der Liste — wir melden uns zum Start.', 'ok');
          return;
        }
        if (/relation .* does not exist/i.test(error.message || '')) {
          meldung('Die Liste ist noch nicht eingerichtet. (Für den Betreiber: ' +
                  'db/017-merken-und-plus.sql einspielen.)', 'fehl');
          return;
        }
        meldung('Hat nicht geklappt: ' + error.message, 'fehl');
        return;
      }

      // Dasselbe Versprechen wie im Angebotsfenster und auf der Seite darüber:
      // ein Euro. Hier stand einmal "gratis" — zwei Preise für dieselbe Sache
      // in derselben App fallen auf und kosten mehr Vertrauen, als der
      // stärkere Anreiz einbringt.
      meldung('Steht. Du bekommst zum Start den Gründerpreis und den ersten ' +
              'Monat um 1 € — und sonst keine Post.', 'ok');
      feld.value = '';
      try { localStorage.setItem('wildspot-vorgemerkt', '1'); } catch (e) {}
    });
  }

  // Der Zustand oben auf der Seite: Wer Plus hat, soll keine Preise sehen.
  function plusSeiteAuffrischen() {
    const zustand = $('plus-zustand');
    const kauf    = $('plus-kauf');
    if (!zustand || !kauf) return;

    if (hatPlus()) {
      const bis = plusTarif === 'immer' || plusTarif === 'gruender'
        ? 'Für immer freigeschaltet'
        : 'Läuft bis ' + plusBis.toLocaleDateString('de-AT');
      zustand.innerHTML =
        `<div class="plus-aktiv">
           <span class="zeichen"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg></span>
           <span><b>Du hast Plus</b><span>${bis}</span></span>
         </div>`;
      kauf.hidden = true;
    } else {
      zustand.innerHTML = '';
      kauf.hidden = false;
    }

    // Wer gerade freigeschaltet wurde, soll die Kaufleiste im selben Moment
    // loswerden und nicht erst beim nächsten Scrollen.
    if (window.WILDSPOT_PLUS_LEISTE) window.WILDSPOT_PLUS_LEISTE();
  }

  // Der Punkt am Plus-Zeichen in der Leiste unten verschwindet, sobald die
  // Seite einmal offen war. Ein Punkt, der immer da ist, wird zu Tapete.
  const plusTab = document.querySelector('[data-tab="plus"]');
  const punkt   = $('plus-punkt');
  try {
    if (punkt && localStorage.getItem('wildspot-plus-gesehen')) punkt.hidden = true;
  } catch (e) {}
  if (plusTab && punkt) {
    plusTab.addEventListener('click', () => {
      punkt.hidden = true;
      try { localStorage.setItem('wildspot-plus-gesehen', '1'); } catch (e) {}
    });
  }

  // ==========================================================================
  // 5. DAS LEBEN AUF DER SEITE
  //
  // Drei Dinge, die eine Verkaufsseite von einer Liste unterscheiden:
  //
  //   a) Der Kopf geht auf, wenn man die Seite öffnet.
  //   b) Jeder Punkt kommt, wenn man bei ihm ankommt — es kommt sichtbar noch
  //      etwas, also scrollt man weiter.
  //   c) Der Kaufknopf ist immer erreichbar, auch mitten im Text.
  //
  // Alles davon ist Zugabe: Fällt das Skript aus, steht die Seite trotzdem
  // vollständig da. Deshalb setzt erst dieser Code die Klasse „wartet" —
  // ohne ihn wird nichts versteckt, was man nicht wieder einblenden kann.
  // ==========================================================================

  const schirm = $('schirm-plus');
  const ruhig  = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // --- a) und b) -----------------------------------------------------------

  const punkte = schirm ? [...schirm.querySelectorAll('.plus-punkt')] : [];

  if (schirm && punkte.length && 'IntersectionObserver' in window && !ruhig) {
    for (const p of punkte) p.classList.add('wartet');

    const augen = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        // Die Verzögerung richtet sich nach der Reihenfolge im Bild, nicht nach
        // der Position in der Liste: Wer mitten in die Seite springt, soll die
        // drei sichtbaren Punkte nacheinander sehen und nicht nach zwei
        // Sekunden Wartezeit den vierten.
        const i = eintraege.filter((x) => x.isIntersecting).indexOf(e);
        setTimeout(() => {
          e.target.classList.remove('wartet');
          e.target.classList.add('da');
        }, Math.min(i, 4) * 85);
        augen.unobserve(e.target);
      }
    }, { root: schirm, rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    for (const p of punkte) augen.observe(p);
  }

  // Der Kopf geht auf, sobald die Seite sichtbar wird — und nur dann. Beobachtet
  // wird das „hidden" am Schirm selbst: So ist es egal, ob jemand über die
  // Leiste unten, über das Profil oder über eine Schranke hierher kommt.
  if (schirm && 'MutationObserver' in window) {
    let warOffen = !schirm.hidden;

    const aufgehen = () => {
      schirm.classList.remove('faellt-auf');
      void schirm.offsetWidth;
      schirm.classList.add('faellt-auf');
      // Die Klasse wieder abnehmen, damit die Animation beim nächsten Öffnen
      // von vorn läuft und nicht als „schon gelaufen" hängen bleibt.
      setTimeout(() => schirm.classList.remove('faellt-auf'), 900);
    };

    new MutationObserver(() => {
      const offen = !schirm.hidden;
      if (offen && !warOffen) {
        schirm.scrollTop = 0;
        if (!ruhig) aufgehen();
      }
      warOffen = offen;
    }).observe(schirm, { attributes: true, attributeFilter: ['hidden'] });
  }

  // --- c) Die mitlaufende Leiste -------------------------------------------
  //
  // Sie zeigt sich, sobald der Kopf oben aus dem Bild ist, und zieht sich
  // zurück, sobald der echte Kaufknopf selbst im Bild steht. Zwei Kaufknöpfe
  // übereinander wären albern, und ein Balken über dem, was man gerade liest,
  // ist eine Zumutung.

  const leiste = $('plus-leiste');

  if (leiste && schirm && kaufKnopf && 'IntersectionObserver' in window) {
    const himmel = schirm.querySelector('.plus-himmel');
    let kopfDa = true;
    let knopfDa = false;

    function leisteRichten() {
      // Wer Plus schon hat, bekommt hier nie etwas zu kaufen angeboten.
      const soll = !hatPlus() && !kopfDa && !knopfDa;
      leiste.hidden = false;
      leiste.classList.toggle('da', soll);
    }

    const wache = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (e.target === himmel)    kopfDa  = e.isIntersecting;
        if (e.target === kaufKnopf) knopfDa = e.isIntersecting;
      }
      leisteRichten();
    }, { root: schirm, threshold: 0 });

    if (himmel) wache.observe(himmel);
    wache.observe(kaufKnopf);

    // Auch nach dem Freischalten muss sie verschwinden — plusSeiteAuffrischen
    // läuft immer dann, wenn sich am Plus-Zustand etwas geändert hat.
    window.WILDSPOT_PLUS_LEISTE = leisteRichten;
  }

  // ==========================================================================
  // 5b. DAS ANGEBOT — der erste Monat für 1 €
  //
  // Ein Balken unten, der nach einer Weile hereinfährt. Er soll den ersten
  // Schritt kosten lassen, was er wert ist: fast nichts.
  //
  // Die Regeln drumherum sind wichtiger als der Balken selbst. Werbung, die
  // bei jedem Start aufpoppt, ist der schnellste Weg, eine App loszuwerden:
  //
  //   - Nur wer kein Plus hat. Wer zahlt, bekommt nie wieder ein Angebot.
  //   - Nicht beim allerersten Start. Da läuft die Einführung, und wer die
  //     App noch nicht kennt, weiß gar nicht, wofür er zahlen soll.
  //   - Nicht auf der Plus-Seite. Dort steht das Angebot ohnehin groß.
  //   - Höchstens alle drei Tage.
  //   - Wer ihn dreimal weggetippt hat, sieht ihn nicht mehr. Ein Nein, das
  //     man dreimal sagen muss, ist schon eines zu viel.
  // ==========================================================================

  const ANGEBOT_ZULETZT  = 'wildspot-angebot-zuletzt';
  const ANGEBOT_WEGGETIPPT = 'wildspot-angebot-weg';
  const ANGEBOT_WARTEN   = 15000;                 // 15 Sekunden
  const ANGEBOT_PAUSE    = 3 * 24 * 60 * 60 * 1000;  // drei Tage
  const ANGEBOT_GENUG    = 3;                     // so oft darf man Nein sagen

  // Das große Fenster ist die laute Fassung desselben Angebots. Es kommt
  // zuerst und viel seltener: Ein Vollbild, das man wegklicken muss, verzeiht
  // man einmal — beim dritten Mal löscht man die App.
  const GROSS_ZULETZT = 'wildspot-angebot-gross-zuletzt';
  const GROSS_WEG     = 'wildspot-angebot-gross-weg';
  const GROSS_PAUSE   = 14 * 24 * 60 * 60 * 1000;   // zwei Wochen
  const GROSS_GENUG   = 2;                          // zweimal Nein reicht
  const GROSS_DANACH  = 4000;                       // dann kommt der Balken

  // Die Bedingungen, die für beide gelten.
  function grundsaetzlichErlaubt() {
    if (hatPlus()) return false;

    // Die Einführung läuft noch, oder sie war noch nie zu Ende.
    try {
      if (localStorage.getItem('wildspot-intro-gesehen') !== 'ja') return false;
    } catch (e) { return false; }

    const intro = $('intro');
    if (intro && !intro.hidden) return false;

    // Nicht ins eigene Schaufenster stellen.
    const plusSchirm = $('schirm-plus');
    if (plusSchirm && !plusSchirm.hidden) return false;

    return true;
  }

  function darfBalkenZeigen() {
    if (!grundsaetzlichErlaubt()) return false;
    try {
      if (Number(localStorage.getItem(ANGEBOT_WEGGETIPPT) || 0) >= ANGEBOT_GENUG) return false;
      const zuletzt = Number(localStorage.getItem(ANGEBOT_ZULETZT) || 0);
      if (zuletzt && Date.now() - zuletzt < ANGEBOT_PAUSE) return false;
    } catch (e) { return false; }
    return true;
  }

  function darfGrossZeigen() {
    if (!grundsaetzlichErlaubt()) return false;
    try {
      if (Number(localStorage.getItem(GROSS_WEG) || 0) >= GROSS_GENUG) return false;
      const zuletzt = Number(localStorage.getItem(GROSS_ZULETZT) || 0);
      if (zuletzt && Date.now() - zuletzt < GROSS_PAUSE) return false;
    } catch (e) { return false; }
    return true;
  }

  // ohnePause: Nach dem großen Fenster soll der Balken auch dann kommen, wenn
  // seine Drei-Tage-Frist noch läuft — er ist dann die leise Fortsetzung
  // desselben Angebots, nicht ein zweites.
  function angebotZeigen({ ohnePause = false } = {}) {
    if (ohnePause) {
      if (!grundsaetzlichErlaubt()) return;
      try {
        if (Number(localStorage.getItem(ANGEBOT_WEGGETIPPT) || 0) >= ANGEBOT_GENUG) return;
      } catch (e) { return; }
    } else if (!darfBalkenZeigen()) {
      return;
    }
    if ($('plus-angebot')) return;

    try { localStorage.setItem(ANGEBOT_ZULETZT, String(Date.now())); } catch (e) {}

    const balken = document.createElement('div');
    balken.id = 'plus-angebot';
    balken.className = 'plus-angebot';
    balken.innerHTML =
      `<button type="button" class="angebot-haupt">
         <span class="zeichen" aria-hidden="true">
           <svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>
         </span>
         <span class="text">
           <b>Ersten Monat um 1 €</b>
           <small>Alle Karten, offline und ohne Werbung — danach 3,49 €, jederzeit kündbar</small>
         </span>
         <span class="pfeil" aria-hidden="true">›</span>
       </button>
       <button type="button" class="angebot-zu" aria-label="Angebot schließen">×</button>`;

    balken.querySelector('.angebot-haupt').addEventListener('click', () => {
      balken.remove();
      if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('plus');
    });

    balken.querySelector('.angebot-zu').addEventListener('click', () => {
      balken.classList.remove('da');
      setTimeout(() => balken.remove(), 260);
      try {
        const weg = Number(localStorage.getItem(ANGEBOT_WEGGETIPPT) || 0) + 1;
        localStorage.setItem(ANGEBOT_WEGGETIPPT, String(weg));
      } catch (e) {}
    });

    document.body.appendChild(balken);
    // Erst im nächsten Bild die Klasse setzen, sonst fährt er nicht herein,
    // sondern steht einfach da.
    requestAnimationFrame(() => balken.classList.add('da'));
  }

  // --------------------------------------------------------------------------
  // Das große Fenster
  // --------------------------------------------------------------------------

  function grossZeigen() {
    if (!darfGrossZeigen()) return;
    if ($('plus-gross')) return;

    try { localStorage.setItem(GROSS_ZULETZT, String(Date.now())); } catch (e) {}

    const hg = document.createElement('div');
    hg.id = 'plus-gross';
    hg.className = 'plus-gross-hg';
    hg.setAttribute('role', 'dialog');
    hg.setAttribute('aria-modal', 'true');
    hg.setAttribute('aria-label', 'Wild Spot Plus — Angebot');
    hg.innerHTML =
      `<div class="plus-gross-box">
         <div class="gross-schein" aria-hidden="true"></div>
         <button type="button" class="gross-zu" aria-label="Schließen">×</button>

         <span class="gross-zeichen" aria-hidden="true">
           <svg viewBox="0 0 24 24"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg>
         </span>

         <p class="gross-ueber">Wild Spot Plus</p>
         <p class="gross-preis"><b>1 €</b><span>für den ersten Monat</span></p>
         <p class="gross-unter">Danach 3,49 € im Monat. Jederzeit kündbar.</p>

         <ul class="gross-liste">
           <li>Alle vier Karten — Gelände, Satellit und Wandern</li>
           <li>Ganze Gebiete vorab laden, fürs Funkloch</li>
           <li>Mehrere Filter gleichzeitig</li>
           <li>Die beste Nacht der Woche, für jeden Spot</li>
         </ul>

         <button type="button" class="gross-haupt">Für 1 € starten</button>
         <button type="button" class="gross-spaeter">Vielleicht später</button>
       </div>`;

    // Schließen — und danach die leise Fassung nachschieben. Wer das große
    // Fenster wegklickt, hat nicht unbedingt Nein zum Angebot gesagt, sondern
    // zum Moment. Der Balken lässt ihm die Wahl, ohne ihn aufzuhalten.
    const schliessen = (zaehlen) => {
      if (zaehlen) {
        try {
          const weg = Number(localStorage.getItem(GROSS_WEG) || 0) + 1;
          localStorage.setItem(GROSS_WEG, String(weg));
        } catch (e) {}
      }
      hg.classList.remove('da');
      setTimeout(() => hg.remove(), 240);
      document.removeEventListener('keydown', beiTaste);
      setTimeout(() => angebotZeigen({ ohnePause: true }), GROSS_DANACH);
    };

    function beiTaste(e) { if (e.key === 'Escape') schliessen(true); }

    hg.querySelector('.gross-haupt').addEventListener('click', () => {
      hg.classList.remove('da');
      setTimeout(() => hg.remove(), 240);
      document.removeEventListener('keydown', beiTaste);
      if (window.WILDSPOT_BEREICH) window.WILDSPOT_BEREICH('plus');
    });

    hg.querySelector('.gross-zu').addEventListener('click', () => schliessen(true));
    hg.querySelector('.gross-spaeter').addEventListener('click', () => schliessen(true));

    // Klick daneben schließt auch — aber ohne als Absage zu zählen. Danebenzu
    // tippen ist oft ein Versehen.
    hg.addEventListener('click', (e) => { if (e.target === hg) schliessen(false); });
    document.addEventListener('keydown', beiTaste);

    document.body.appendChild(hg);
    requestAnimationFrame(() => hg.classList.add('da'));
  }

  // Der Zeitgeber läuft einmal pro Sitzung. plusHolen() ist beim Start noch
  // unterwegs — deshalb wird erst beim Ablauf entschieden, nicht jetzt.
  //
  // Erst das große Fenster, und nur wenn das gerade nicht dran ist, der
  // Balken. Beides gleichzeitig wäre eine Belagerung.
  setTimeout(() => {
    if (darfGrossZeigen()) grossZeigen();
    else angebotZeigen();
  }, ANGEBOT_WARTEN);

  // ==========================================================================
  // 6. NACH AUSSEN
  // ==========================================================================

  window.WILDSPOT_PLUS = {
    hat: hatPlus,
    bis: () => plusBis,
    tarif: () => plusTarif,
    schranke,
    schrankeBauen,
    profilKasten,
    neuLaden: plusHolen,
  };

  auth.beiWechsel.push(() => { plusHolen(); });
  plusHolen();
})();
