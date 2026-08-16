// ============================================================================
// leute.js — die anderen finden, und sehen, was sie tun
//
// Seit Migration 018 kann man jemandem folgen. Nur gab es dafür keinen
// Eingang: Man konnte nur folgen, wem gerade zufällig ein Beitrag im Feed
// stand. Wer wissen wollte, ob ein Bekannter überhaupt dabei ist, hatte keine
// Möglichkeit, das herauszufinden.
//
// Diese Datei baut deshalb zwei Dinge:
//
//   Leute      Suche nach Namen, Vorschläge für den Anfang, die
//              Gipfel-Bestenliste, und die Listen „Follower" und „folgt".
//
//   Aktivität  Was in der Gemeinschaft gerade passiert — nicht nur Beiträge,
//              sondern auch: jemand war auf einem Gipfel, jemand hat einen
//              Platz eingetragen, jemand hat bewertet. Das ist der Strom, der
//              eine App lebendig aussehen lässt, auch wenn gerade niemand
//              einen langen Beitrag schreibt.
//
// Der Unterschied zum Feed in einem Satz: Der Feed zeigt Erzählungen, die
// Aktivität zeigt Bewegung.
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

  function adresse(eimer, pfad) {
    if (!pfad) return null;
    return sb.storage.from(eimer).getPublicUrl(pfad).data.publicUrl;
  }

  function vorWie(zeit) {
    const dann = new Date(zeit).getTime();
    if (!Number.isFinite(dann)) return '';
    const min = Math.floor((Date.now() - dann) / 60000);
    if (min < 1)    return 'gerade eben';
    if (min < 60)   return `vor ${min} Min`;
    const std = Math.floor(min / 60);
    if (std < 24)   return `vor ${std} h`;
    const tage = Math.floor(std / 24);
    if (tage === 1) return 'gestern';
    if (tage < 7)   return `vor ${tage} Tagen`;
    if (tage < 31)  return `vor ${Math.floor(tage / 7)} Wochen`;
    if (tage < 365) return `vor ${Math.floor(tage / 30)} Monaten`;
    return new Date(zeit).toLocaleDateString('de-AT');
  }

  // Dasselbe runde Bild wie im Feed. Es steht bewusst zweimal in der App
  // (hier und in feed.js): Beide Dateien sollen für sich funktionieren, auch
  // wenn eine davon einmal nicht geladen wird.
  function kopfbild(name, pfad, groesse = 40) {
    const url = adresse('avatars', pfad);
    if (url) {
      return `<img class="kopfbild" src="${sicher(url)}" alt="" loading="lazy"
                   style="width:${groesse}px;height:${groesse}px">`;
    }
    const b = String(name || '?').slice(0, 1).toUpperCase();
    return `<span class="kopfbild ohne-bild" style="width:${groesse}px;height:${groesse}px;
                 font-size:${Math.round(groesse * 0.42)}px">${sicher(b)}</span>`;
  }

  function profilOeffnen(id) {
    if (typeof window.WILDSPOT_PROFIL_ZEIGEN === 'function') {
      window.WILDSPOT_PROFIL_ZEIGEN(id);
    }
  }

  // ==========================================================================
  // 1. EINE PERSONENZEILE
  //
  // Sie steht in der Suche, in den Vorschlägen und in den Folgenlisten —
  // überall gleich, mit dem Folgen-Knopf rechts. Der Knopf schaltet sofort um
  // und nimmt sich nur zurück, wenn die Datenbank nein sagt.
  // ==========================================================================

  function personZeile(p) {
    const k = el('div');
    k.className = 'personzeile';

    const zahlen = [];
    if (Number(p.gipfel) > 0)    zahlen.push(`${zahl(p.gipfel)} Gipfel`);
    if (Number(p.spots) > 0)     zahlen.push(`${zahl(p.spots)} Spots`);
    if (Number(p.beitraege) > 0) zahlen.push(`${zahl(p.beitraege)} Beiträge`);
    if (Number(p.folgt_mir) > 0) zahlen.push(`${zahl(p.folgt_mir)} Follower`);

    k.innerHTML =
      `<button type="button" class="wer">
         ${kopfbild(p.username, p.avatar_path, 44)}
         <span class="text">
           <b>${sicher(p.username)}</b>
           <small>${zahlen.length ? sicher(zahlen.join(' · ')) : 'noch nichts eingetragen'}</small>
           ${p.bio ? `<small class="bio">${sicher(String(p.bio).slice(0, 70))}</small>` : ''}
         </span>
       </button>`;

    k.querySelector('.wer').addEventListener('click', () => profilOeffnen(p.id));

    const ich = auth.nutzer && auth.nutzer.id === p.id;
    if (!ich) {
      const f = el('button');
      f.type = 'button';
      f.className = 'folge-knopf klein';
      f.setAttribute('aria-pressed', String(!!p.ich_folge));
      f.textContent = p.ich_folge ? 'Du folgst' : 'Folgen';
      f.addEventListener('click', () => folgenUmschalten(p.id, f));
      k.appendChild(f);
    }

    return k;
  }

  async function folgenUmschalten(wemId, knopf) {
    if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

    const folgt = knopf.getAttribute('aria-pressed') === 'true';
    knopf.setAttribute('aria-pressed', String(!folgt));
    knopf.textContent = folgt ? 'Folgen' : 'Du folgst';

    const { error } = folgt
      ? await sb.from('follows').delete()
          .eq('follower_id', auth.nutzer.id).eq('followed_id', wemId)
      : await sb.from('follows')
          .insert({ follower_id: auth.nutzer.id, followed_id: wemId });

    if (error) {
      knopf.setAttribute('aria-pressed', String(folgt));
      knopf.textContent = folgt ? 'Du folgst' : 'Folgen';
    }
  }

  window.WILDSPOT_FOLGEN = folgenUmschalten;

  // ==========================================================================
  // 2. DIE LEUTE-SEITE
  // ==========================================================================

  let sucheZeit = null;
  let leuteGeladen = false;

  async function leuteFuellen({ neu = false } = {}) {
    if (leuteGeladen && !neu) return;
    leuteGeladen = true;

    vorschlaegeFuellen();
    bestenlisteFuellen();
  }

  async function vorschlaegeFuellen() {
    const kasten = $('leute-vorschlaege');
    if (!kasten) return;

    kasten.innerHTML =
      '<div class="platzhalter" style="height:62px;margin-bottom:8px"></div>'.repeat(3);

    const { data, error } = await sb.rpc('leute_vorschlaege', { anzahl: 12 });
    kasten.innerHTML = '';

    if (error || !data || !data.length) {
      kasten.innerHTML =
        '<p class="detail-leer">Hier steht bald mehr — noch sind wenige Leute dabei. ' +
        'Wer einen Spot einträgt oder von einer Nacht erzählt, taucht hier auf.</p>';
      return;
    }

    for (const p of data) kasten.appendChild(personZeile(p));
  }

  async function bestenlisteFuellen() {
    const kasten = $('leute-besten');
    if (!kasten) return;

    const { data, error } = await sb.rpc('gipfel_bestenliste', { anzahl: 10 });
    kasten.innerHTML = '';

    if (error || !data || !data.length) {
      const block = $('leute-besten-block');
      if (block) block.hidden = true;
      return;
    }

    data.forEach((p, i) => {
      const k = el('button');
      k.type = 'button';
      k.className = 'bestenzeile';
      k.innerHTML =
        `<span class="platz">${i + 1}</span>
         ${kopfbild(p.username, p.avatar_path, 36)}
         <span class="wo">
           <b>${sicher(p.username)}</b>
           <small>höchster: ${zahl(p.hoechster)} m · ${zahl(p.meter)} Gipfelmeter</small>
         </span>
         <span class="wert">${zahl(p.gipfel)}</span>`;
      k.addEventListener('click', () => profilOeffnen(p.id));
      kasten.appendChild(k);
    });
  }

  async function leuteSuchen(text) {
    const treffer = $('leute-treffer');
    const rest    = $('leute-rest');
    if (!treffer) return;

    if (!text || text.trim().length < 2) {
      treffer.innerHTML = '';
      treffer.hidden = true;
      if (rest) rest.hidden = false;
      return;
    }

    treffer.hidden = false;
    if (rest) rest.hidden = true;
    treffer.innerHTML =
      '<div class="platzhalter" style="height:62px;margin-bottom:8px"></div>'.repeat(2);

    const { data, error } = await sb.rpc('leute_suchen', { suche: text.trim(), anzahl: 20 });
    treffer.innerHTML = '';

    if (error) {
      treffer.innerHTML = '<p class="detail-leer">Die Suche kam nicht durch.</p>';
      return;
    }

    if (!data || !data.length) {
      treffer.innerHTML =
        `<p class="detail-leer">Niemanden gefunden, der „${sicher(text.trim())}" heißt. ` +
        'Namen werden beim Anlegen des Kontos vergeben — frag am besten direkt nach.</p>';
      return;
    }

    const kopf = el('p');
    kopf.className = 'abschnitt-unter';
    kopf.style.margin = '0 0 8px';
    kopf.textContent = `${data.length} ${data.length === 1 ? 'Treffer' : 'Treffer'}`;
    treffer.appendChild(kopf);

    for (const p of data) treffer.appendChild(personZeile(p));
  }

  // ==========================================================================
  // 3. FOLLOWER- UND FOLGENLISTE
  //
  // Sie liegen in einem eigenen Blatt, damit man vom Profil aus hineingehen
  // und mit dem × wieder genau dort landen kann.
  // ==========================================================================

  async function folgeListeOeffnen(wessenId, art, name) {
    const hg = $('leute-hg');
    const kasten = $('leute-hg-inhalt');
    const titel = $('leute-hg-titel');
    if (!hg || !kasten) return;

    hg.hidden = false;
    if (titel) {
      titel.textContent = art === 'folge'
        ? (name ? `${name} folgt` : 'Folgt')
        : (name ? `Follower von ${name}` : 'Follower');
    }
    kasten.innerHTML =
      '<div class="platzhalter" style="height:62px;margin-bottom:8px"></div>'.repeat(3);

    const { data, error } = await sb.rpc('folge_liste', {
      wessen_id: wessenId, art, anzahl: 100,
    });

    kasten.innerHTML = '';

    if (error || !data || !data.length) {
      kasten.innerHTML = art === 'folge'
        ? '<p class="detail-leer">Folgt noch niemandem.</p>'
        : '<p class="detail-leer">Noch keine Follower.</p>';
      return;
    }

    for (const p of data) kasten.appendChild(personZeile(p));
  }

  // ==========================================================================
  // 4. DIE AKTIVITÄT
  //
  // Fünf Arten von Ereignissen, jede mit eigenem Zeichen und eigenem Satz.
  // Der Satz ist wichtiger, als er aussieht: „war auf dem Hochschwab" liest
  // sich in einer Liste anders als eine Tabellenzeile mit Typ und Ziel.
  // ==========================================================================

  const ART_ZEICHEN = {
    beitrag:   '📷',
    gipfel:    '🏔️',
    spot:      '⛺',
    bewertung: '⭐',
    kommentar: '💬',
  };

  function satz(a) {
    const ziel = a.titel ? `<b>${sicher(a.titel)}</b>` : 'einen Platz';
    switch (a.art) {
      case 'gipfel':
        return `war auf ${ziel}${a.zahl ? ` <span class="meta">${zahl(a.zahl)} m</span>` : ''}`;
      case 'spot':
        return `hat ${ziel} eingetragen`;
      case 'bewertung':
        return `hat ${ziel} mit ${zahl(a.zahl)} ${Number(a.zahl) === 1 ? 'Stern' : 'Sternen'} bewertet`;
      case 'kommentar':
        return `war bei ${ziel}`;
      default:
        return a.titel ? `war bei ${ziel}` : 'hat etwas erzählt';
    }
  }

  let aktivLaeuft = false;
  let aktivAelteste = null;
  let aktivEnde = false;
  let welcheAktivitaet = 'alle';

  async function aktivitaetLaden({ weiter = false, wo = 'aktivitaet-liste', welcher = null } = {}) {
    const kasten = $(wo);
    if (!kasten || aktivLaeuft) return;
    aktivLaeuft = true;

    if (!weiter) {
      aktivAelteste = null;
      aktivEnde = false;
      kasten.innerHTML =
        '<div class="platzhalter" style="height:56px;margin-bottom:8px"></div>'.repeat(5);
    }

    const { data, error } = await sb.rpc('aktivitaeten', {
      welcher: welcher || welcheAktivitaet,
      wessen_id: null,
      anzahl: 30,
      ab: weiter ? aktivAelteste : null,
    });

    if (!weiter) kasten.innerHTML = '';
    aktivLaeuft = false;

    if (error) {
      if (!weiter) {
        kasten.innerHTML =
          '<p class="detail-leer">Die Aktivität kam nicht durch. Ohne Netz gibt es ' +
          'keine neuen Ereignisse — die Karte und deine gemerkten Spots gehen weiter.</p>';
      }
      return;
    }

    const liste = data || [];

    if (!liste.length && !weiter) {
      kasten.innerHTML =
        '<p class="detail-leer">Hier ist gerade nichts los. Sobald jemand einen ' +
        'Gipfel einträgt, einen Platz anlegt oder von einer Nacht erzählt, steht ' +
        'es hier.</p>';
      return;
    }

    for (const a of liste) kasten.appendChild(aktivitaetZeile(a));

    if (liste.length) aktivAelteste = liste[liste.length - 1].zeit;
    if (liste.length < 30) aktivEnde = true;
  }

  function aktivitaetZeile(a) {
    const z = el('div');
    z.className = 'aktivzeile art-' + sicher(a.art);

    const bild = a.art === 'beitrag'
      ? adresse('post-photos', a.foto_pfad)
      : adresse('spot-photos', a.foto_pfad);

    z.innerHTML =
      `<button type="button" class="wer" aria-label="Profil">
         ${kopfbild(a.username, a.avatar_path, 38)}
         <span class="zeichen">${ART_ZEICHEN[a.art] || '•'}</span>
       </button>
       <div class="was">
         <p class="kopf"><b class="name">${sicher(a.username)}</b> ${satz(a)}</p>
         ${a.inhalt ? `<p class="text">${sicher(String(a.inhalt).slice(0, 160))}${
             String(a.inhalt).length > 160 ? '…' : ''}</p>` : ''}
         <p class="wann">${sicher(vorWie(a.zeit))}</p>
       </div>
       ${bild ? `<span class="bild"><img src="${sicher(bild)}" alt="" loading="lazy"></span>` : ''}`;

    z.querySelector('.wer').addEventListener('click', () => profilOeffnen(a.user_id));

    // Die ganze Zeile führt dorthin, wovon sie handelt: zum Spot oder zum
    // Gipfel. Nur beim Beitrag ohne Spot gibt es kein Ziel.
    const ziel = z.querySelector('.was');
    if (a.ziel_id && a.art === 'gipfel') {
      ziel.style.cursor = 'pointer';
      ziel.addEventListener('click', () => {
        if (window.WILDSPOT_GIPFEL) window.WILDSPOT_GIPFEL.oeffnen(a.ziel_id, a.titel);
      });
    } else if (a.ziel_id) {
      ziel.style.cursor = 'pointer';
      ziel.addEventListener('click', () => {
        if (typeof window.spotDetailOeffnen === 'function') {
          window.spotDetailOeffnen(a.ziel_id, a.titel, Number(a.lat), Number(a.lng));
        }
      });
    }

    return z;
  }

  // Für das Profil: die letzten Ereignisse einer Person, ohne Nachladen.
  async function aktivitaetBauen(wessenId, anzahl = 12) {
    const kasten = el('div');
    kasten.className = 'aktivliste';
    kasten.innerHTML =
      '<div class="platzhalter" style="height:56px;margin-bottom:8px"></div>'.repeat(3);

    const { data, error } = await sb.rpc('aktivitaeten', {
      welcher: 'wer', wessen_id: wessenId, anzahl, ab: null,
    });

    kasten.innerHTML = '';

    if (error || !data || !data.length) {
      kasten.innerHTML = '<p class="detail-leer">Noch keine Aktivität.</p>';
      return kasten;
    }

    for (const a of data) kasten.appendChild(aktivitaetZeile(a));
    return kasten;
  }

  // ==========================================================================
  // 5. VERDRAHTEN
  // ==========================================================================

  function verdrahten() {
    const feld = $('leute-suchfeld');
    if (feld) {
      feld.addEventListener('input', () => {
        clearTimeout(sucheZeit);
        const wert = feld.value;
        sucheZeit = setTimeout(() => leuteSuchen(wert), 260);
      });
    }

    const leeren = $('leute-suche-leeren');
    if (leeren && feld) {
      leeren.addEventListener('click', () => {
        feld.value = '';
        leuteSuchen('');
        feld.focus();
      });
    }

    const zu = $('leute-hg-zu');
    if (zu) zu.addEventListener('click', () => { $('leute-hg').hidden = true; });

    for (const k of document.querySelectorAll('#aktivitaet-reiter [data-akt]')) {
      k.addEventListener('click', () => {
        welcheAktivitaet = k.dataset.akt;
        for (const a of document.querySelectorAll('#aktivitaet-reiter [data-akt]')) {
          a.setAttribute('aria-pressed', String(a.dataset.akt === welcheAktivitaet));
        }
        aktivitaetLaden();
      });
    }

    // Nachladen beim Scrollen — dieselbe Mechanik wie beim Feed.
    const schirm = $('schirm-entdecken');
    if (schirm) {
      schirm.addEventListener('scroll', () => {
        if (aktivEnde || aktivLaeuft) return;
        const tafel = $('entdecken-aktivitaet');
        if (!tafel || tafel.hidden) return;
        if (schirm.scrollTop + schirm.clientHeight > schirm.scrollHeight - 600) {
          aktivitaetLaden({ weiter: true });
        }
      });
    }

    auth.beiWechsel.push(() => {
      leuteGeladen = false;
      const tafel = $('entdecken-leute');
      if (tafel && !tafel.hidden) leuteFuellen({ neu: true });
    });
  }

  document.addEventListener('DOMContentLoaded', verdrahten);
  if (document.readyState !== 'loading') verdrahten();

  window.WILDSPOT_LEUTE = {
    fuellen: leuteFuellen,
    suchen: leuteSuchen,
    aktivitaetLaden,
    aktivitaetBauen,
    folgeListeOeffnen,
    personZeile,
  };
})();
