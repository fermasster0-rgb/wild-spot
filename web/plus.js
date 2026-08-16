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
    balken.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);' +
      'top:calc(max(12px, env(safe-area-inset-top)) + 56px);z-index:78;' +
      'max-width:min(86vw,420px);padding:11px 17px;border:0;border-radius:999px;' +
      'background:var(--orange);color:#fff;font:inherit;font-size:13px;' +
      'font-weight:600;line-height:1.35;cursor:pointer;text-align:center;' +
      'box-shadow:0 6px 22px var(--sch2)';
    balken.innerHTML =
      `${was} gibt es mit Plus <span style="opacity:0.8;font-weight:400">· ansehen</span>`;
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
           <svg viewBox="0 0 24 24" style="stroke:var(--orange)">
             <path d="M12 2.5l2.5 6.2 6.2 2.5-6.2 2.5-2.5 6.2-2.5-6.2L3.3 11.2l6.2-2.5z"/></svg>
           <span class="was">Wild Spot Plus<small>Aktiv ${bis}</small></span>
           <span class="wert" style="color:var(--orange)">aktiv</span>
         </div>`;
      return kasten;
    }

    // Kein Plus: ein Streifen, der zur Seite führt. Er sieht anders aus als
    // die Menüzeilen darunter — er verkauft etwas, und das soll man sehen.
    const k = document.createElement('button');
    k.type = 'button';
    k.style.cssText =
      'display:flex;align-items:center;gap:13px;width:100%;padding:16px;' +
      'margin-bottom:22px;border:0;border-radius:16px;cursor:pointer;' +
      'background:linear-gradient(135deg,#1f2416,#14170f);' +
      'color:#f4f2ea;font:inherit;text-align:left;' +
      '-webkit-tap-highlight-color:transparent';
    k.innerHTML =
      `<span style="display:grid;place-items:center;width:42px;height:42px;flex-shrink:0;
                    border-radius:12px;background:rgba(238,107,23,0.18);color:var(--orange)"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round"><path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9z"/></svg></span>
       <span style="flex:1;min-width:0">
         <b style="display:block;font-size:15.5px;font-weight:800;letter-spacing:-0.02em">
           Wild Spot Plus</b>
         <small style="display:block;margin-top:3px;font-size:12.5px;line-height:1.45;
                       color:rgba(244,242,234,0.62)">
           Karten fürs Funkloch, die beste Nacht der Woche, und wo du sein darfst</small>
       </span>
       <span style="flex-shrink:0;color:rgba(244,242,234,0.5);font-size:18px">›</span>`;
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

  for (const knopf of document.querySelectorAll('#preise [data-tarif]')) {
    knopf.addEventListener('click', () => {
      tarif = knopf.dataset.tarif;
      for (const k of document.querySelectorAll('#preise [data-tarif]')) {
        k.setAttribute('aria-pressed', String(k.dataset.tarif === tarif));
      }
    });
  }

  // Der Kaufknopf. Solange es keine Bezahlstrecke gibt, führt er zur
  // Warteliste — und sagt auch, warum.
  const kaufKnopf = $('plus-kaufen');
  if (kaufKnopf) {
    kaufKnopf.addEventListener('click', () => {
      const kasten = $('plus-warteliste');
      if (!kasten) return;
      kasten.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const feld = $('plus-mail');
      if (feld) {
        // Wer angemeldet ist, muss seine Adresse nicht abtippen.
        if (!feld.value && auth.nutzer && auth.nutzer.email) feld.value = auth.nutzer.email;
        setTimeout(() => feld.focus(), 400);
      }
    });
  }

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

      meldung('Steht. Du bekommst zum Start den Gründerpreis und den ersten ' +
              'Monat gratis — und sonst keine Post.', 'ok');
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
  // 5. NACH AUSSEN
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
