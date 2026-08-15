// ============================================================================
// feed.js — die Gemeinschaft
//
// Bis hierher war Wild Spot eine Karte mit Plätzen. Was fehlte, waren die
// Leute: Wer war dort? Wie war die Nacht? Wem lohnt es sich zu folgen?
//
// Diese Datei baut fünf Dinge:
//
//   Der Feed          Beiträge mit Bild, Text, Spot und Datum — „alle" oder
//                     nur die, denen man folgt.
//   Beitrag schreiben Bild wählen, Text, optional Spot und Begleiter.
//   Gefällt mir       Der einzige Zähler in dieser App.
//   Profile           Auch fremde, mit Folgen-Knopf und den eigenen Zahlen.
//   Melden            Weil ein öffentlicher Feed ohne das nicht geht.
//
// ----------------------------------------------------------------------------
// EINE ENTSCHEIDUNG, DIE MAN SEHEN MUSS
//
// Beim Schreiben eines Beitrags ist „Spot zeigen" eine bewusste Wahl und nicht
// automatisch an. Wild Spot sagt seinen Nutzern an mehreren Stellen, dass ein
// Platz nicht beliebig viele Leute verträgt — ein Feed, der jeden Platz
// ausstellt, arbeitet dagegen. Wer erzählen will, ohne den Platz preiszugeben,
// kann das mit einem Tipp.
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

  function datumLang(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-AT',
      { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // Das runde Bild einer Person. Ohne hochgeladenes Bild der erste Buchstabe
  // auf Oliv — immer noch besser als eine graue Silhouette, die bei allen
  // gleich aussieht.
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

  // ==========================================================================
  // 1. DER FEED
  // ==========================================================================

  let welcherFeed = 'alle';     // 'alle' | 'folge'
  let laeuft = false;
  let aelteste = null;          // für das Nachladen beim Scrollen
  let amEnde = false;

  async function feedLaden({ weiter = false } = {}) {
    const kasten = $('feed-liste');
    if (!kasten || laeuft) return;
    laeuft = true;

    if (!weiter) {
      aelteste = null;
      amEnde = false;
      kasten.innerHTML =
        '<div class="platzhalter" style="height:330px;margin-bottom:14px"></div>'.repeat(2);
    }

    const { data, error } = await sb.rpc('feed', {
      welcher: welcherFeed,
      anzahl: 12,
      ab: weiter ? aelteste : null,
    });

    if (!weiter) kasten.innerHTML = '';

    if (error) {
      laeuft = false;
      if (!weiter) {
        kasten.appendChild(leerHtml('🌐', 'Der Feed kam nicht durch',
          navigator.onLine
            ? sicher(error.message)
            : 'Ohne Netz gibt es keine neuen Beiträge. Die Karte und deine ' +
              'gemerkten Spots funktionieren weiter.'));
      }
      return;
    }

    const liste = data || [];

    if (!liste.length && !weiter) {
      if (welcherFeed === 'folge') {
        kasten.appendChild(leerHtml('👣', 'Noch still hier',
          'Du folgst noch niemandem — oder es gibt nichts Neues. Wechsle oben ' +
          'auf <b>Alle</b>, um Leute zu finden.',
          'Alle ansehen', () => reiterSetzen('alle')));
      } else {
        kasten.appendChild(leerHtml('📷', 'Noch kein Beitrag',
          'Warst du draußen? Erzähl davon — ein Bild und zwei Sätze reichen. ' +
          'Deiner wäre der erste.',
          auth.nutzer ? 'Beitrag schreiben' : 'Anmelden',
          () => auth.nutzer ? verfassenOeffnen() : auth.anmeldenZeigen()));
      }
      laeuft = false;
      return;
    }

    for (const b of liste) kasten.appendChild(beitragBauen(b));

    if (liste.length) aelteste = liste[liste.length - 1].created_at;
    if (liste.length < 12) amEnde = true;

    laeuft = false;
  }

  function leerHtml(zeichen, titel, text, knopfText, knopfTat) {
    const k = el('div');
    k.className = 'leer';
    k.innerHTML = `<div style="font-size:38px;margin-bottom:10px">${zeichen}</div>` +
                  `<b>${sicher(titel)}</b><p>${text}</p>`;
    if (knopfText) {
      const b = el('button');
      b.className = 'oliv-knopf';
      b.type = 'button';
      b.textContent = knopfText;
      b.addEventListener('click', knopfTat);
      k.appendChild(b);
    }
    return k;
  }

  // --------------------------------------------------------- Ein Beitrag ---
  function beitragBauen(b) {
    const karte = el('article');
    karte.className = 'beitrag';
    karte.dataset.id = b.id;

    const bild = adresse('post-photos', b.photo_path);
    const meiner = auth.nutzer && auth.nutzer.id === b.user_id;
    const admin  = auth.nutzer && auth.nutzer.istAdmin === true;

    // Die Zeile über dem Bild: wer, wann.
    const kopf =
      `<button type="button" class="beitrag-kopf" data-wer="${sicher(b.user_id)}">
         ${kopfbild(b.username, b.avatar_path, 40)}
         <span class="wer">
           <b>${sicher(b.username)}</b>
           <small>${sicher(vorWie(b.created_at))}${
             b.visited_on ? ' · war da am ' + sicher(datumLang(b.visited_on)) : ''}</small>
         </span>
       </button>
       <button type="button" class="beitrag-mehr" aria-label="Mehr">⋯</button>`;

    // Der Spot, falls der Verfasser ihn zeigen wollte.
    const spot = b.spot_id
      ? `<button type="button" class="beitrag-spot" data-spot="${sicher(b.spot_id)}"
                 data-lat="${b.spot_lat}" data-lng="${b.spot_lng}"
                 data-name="${sicher(b.spot_name)}">
           <svg viewBox="0 0 24 24"><path d="M12 4l8 15H4z"/><path d="M12 4v15"/>
             <path d="M4 19l8-6 8 6"/></svg>
           <span>${sicher(b.spot_name)}${
             b.spot_hoehe ? ' · ' + Number(b.spot_hoehe).toLocaleString('de-AT') + ' m' : ''}</span>
           <span class="pfeil">›</span>
         </button>`
      : '';

    const erwaehnt = (b.erwaehnte && b.erwaehnte.length)
      ? `<p class="beitrag-mit">mit ${b.erwaehnte.map((n) =>
           `<b>${sicher(n)}</b>`).join(', ')}</p>`
      : '';

    karte.innerHTML =
      `<div class="beitrag-oben">${kopf}</div>
       ${bild ? `<button type="button" class="beitrag-bild">
                   <img src="${sicher(bild)}" alt="" loading="lazy" decoding="async">
                 </button>` : ''}
       <div class="beitrag-text">
         <p>${sicher(b.body).replace(/\n/g, '<br>')}</p>
         ${erwaehnt}
       </div>
       ${spot}
       <div class="beitrag-fuss">
         <button type="button" class="mag" aria-pressed="${b.ich_mag ? 'true' : 'false'}">
           <svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-9.2A4 4 0 0112 8.4
             A4 4 0 0119 10.8c0 4.7-7 9.2-7 9.2z"/></svg>
           <span class="zahl">${Number(b.gefaellt) || 0}</span>
         </button>
       </div>`;

    // ------------------------------------------------------------ Verdrahten
    karte.querySelector('.beitrag-kopf').addEventListener('click',
      () => profilOeffnen(b.user_id));

    const magKnopf = karte.querySelector('.mag');
    magKnopf.addEventListener('click', () => magUmschalten(b.id, magKnopf));

    const spotKnopf = karte.querySelector('.beitrag-spot');
    if (spotKnopf) {
      spotKnopf.addEventListener('click', () => {
        if (typeof window.spotDetailOeffnen === 'function') {
          window.spotDetailOeffnen(b.spot_id, b.spot_name,
                                   Number(b.spot_lat), Number(b.spot_lng));
        }
      });
    }

    const bildKnopf = karte.querySelector('.beitrag-bild');
    if (bildKnopf) {
      bildKnopf.addEventListener('click', () => grossZeigen(bild));
    }

    karte.querySelector('.beitrag-mehr').addEventListener('click', (e) => {
      e.stopPropagation();
      mehrMenue(karte, b, meiner || admin);
    });

    return karte;
  }

  // Ein Bild bildschirmfüllend — dieselbe Form wie bei den Spot-Fotos.
  function grossZeigen(url) {
    const hg = el('div');
    hg.className = 'foto-gross';
    hg.innerHTML = `<img src="${sicher(url)}" alt="">`;
    hg.addEventListener('click', () => hg.remove());
    document.body.appendChild(hg);
  }

  async function magUmschalten(postId, knopf) {
    if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

    const drin = knopf.getAttribute('aria-pressed') === 'true';
    const zahlEl = knopf.querySelector('.zahl');
    const zahl = Number(zahlEl.textContent) || 0;

    // Erst umschalten, dann speichern — der Knopf muss sofort reagieren.
    knopf.setAttribute('aria-pressed', String(!drin));
    zahlEl.textContent = String(Math.max(0, zahl + (drin ? -1 : 1)));

    const { error } = drin
      ? await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', auth.nutzer.id)
      : await sb.from('post_likes').insert({ post_id: postId, user_id: auth.nutzer.id });

    if (error) {
      knopf.setAttribute('aria-pressed', String(drin));
      zahlEl.textContent = String(zahl);
    }
  }

  // Das kleine Menü hinter den drei Punkten: löschen oder melden.
  function mehrMenue(karte, b, darfLoeschen) {
    const alt = document.querySelector('.beitrag-menue');
    if (alt) alt.remove();

    const menue = el('div');
    menue.className = 'beitrag-menue';

    if (darfLoeschen) {
      const w = el('button');
      w.type = 'button';
      w.className = 'gefaehrlich';
      w.textContent = 'Beitrag löschen';
      w.addEventListener('click', async () => {
        if (w.dataset.sicher !== 'ja') {
          w.dataset.sicher = 'ja';
          w.textContent = 'Wirklich löschen?';
          return;
        }
        menue.remove();
        const { error } = await sb.from('posts').delete().eq('id', b.id);
        if (!error) {
          if (b.photo_path) {
            await sb.storage.from('post-photos').remove([b.photo_path]).catch(() => {});
          }
          karte.remove();
        }
      });
      menue.appendChild(w);
    }

    if (auth.nutzer && auth.nutzer.id !== b.user_id) {
      const m = el('button');
      m.type = 'button';
      m.textContent = 'Melden';
      m.addEventListener('click', () => { menue.remove(); meldenOeffnen(b); });
      menue.appendChild(m);
    }

    if (!menue.children.length) {
      const h = el('button');
      h.type = 'button';
      h.textContent = 'Zum Melden anmelden';
      h.addEventListener('click', () => { menue.remove(); auth.anmeldenZeigen(); });
      menue.appendChild(h);
    }

    karte.querySelector('.beitrag-oben').appendChild(menue);

    // Beim nächsten Tipp irgendwo anders wieder zu.
    setTimeout(() => {
      document.addEventListener('click', function zu() {
        menue.remove();
        document.removeEventListener('click', zu);
      });
    }, 10);
  }

  // ==========================================================================
  // 2. MELDEN
  // ==========================================================================

  function meldenOeffnen(b) {
    const grund = prompt(
      'Was stimmt mit diesem Beitrag nicht?\n\n' +
      'Kurz in eigenen Worten — die Verwaltung sieht es sich an.');
    if (!grund || !grund.trim()) return;

    sb.from('reports').insert({
      post_id: b.id,
      melder_id: auth.nutzer.id,
      grund: grund.trim().slice(0, 500),
    }).then(({ error }) => {
      melden(error
        ? 'Die Meldung kam nicht durch: ' + error.message
        : 'Danke — die Meldung ist angekommen.');
    });
  }

  // Eine kurze Meldung oben. Kein Fenster: Das hier ist eine Quittung und
  // keine Frage.
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
  // 3. EINEN BEITRAG SCHREIBEN
  // ==========================================================================

  let gewaehltesBild = null;      // File
  let gewaehlterSpot = null;      // { id, name }
  const begleiter = new Map();    // id -> username

  function verfassenOeffnen(spot = null) {
    if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

    gewaehltesBild = null;
    gewaehlterSpot = spot;
    begleiter.clear();

    $('verfassen-text').value = '';
    $('verfassen-datum').value = new Date().toISOString().slice(0, 10);
    $('verfassen-vorschau').hidden = true;
    $('verfassen-vorschau').innerHTML = '';
    $('verfassen-spot-zeigen').setAttribute('aria-pressed', 'true');
    $('verfassen-meldung').className = 'login-meldung';
    $('verfassen-leute').innerHTML = '';
    $('verfassen-suche').value = '';
    $('verfassen-treffer').innerHTML = '';

    spotAnzeigen();
    $('verfassen-hg').hidden = false;
    setTimeout(() => $('verfassen-text').focus(), 120);
  }

  function verfassenSchliessen() {
    $('verfassen-hg').hidden = true;
  }

  function spotAnzeigen() {
    const zeile = $('verfassen-spot');
    if (gewaehlterSpot) {
      zeile.innerHTML =
        `<span class="gewaehlt">⛺ ${sicher(gewaehlterSpot.name)}</span>
         <button type="button" class="weg" id="verfassen-spot-weg">×</button>`;
      $('verfassen-spot-weg').addEventListener('click', () => {
        gewaehlterSpot = null;
        spotAnzeigen();
      });
      $('verfassen-spot-block').hidden = false;
    } else {
      zeile.innerHTML =
        '<span class="leer-hinweis">Kein Spot ausgewählt — der Beitrag steht für sich.</span>';
      $('verfassen-spot-block').hidden = true;
    }
  }

  // Beim Öffnen aus einem Spot-Blatt heraus ist der Spot schon gesetzt.
  window.WILDSPOT_BEITRAG = (spot) => verfassenOeffnen(spot);

  // ------------------------------------------------------------ Bild wählen
  function bildGewaehlt(datei) {
    if (!datei) return;
    if (!datei.type.startsWith('image/')) {
      meldungImFenster('Das ist kein Bild.', 'fehler');
      return;
    }
    gewaehltesBild = datei;

    const vs = $('verfassen-vorschau');
    const url = URL.createObjectURL(datei);
    vs.innerHTML =
      `<img src="${url}" alt="">
       <button type="button" class="weg" id="bild-weg">×</button>`;
    vs.hidden = false;

    $('bild-weg').addEventListener('click', () => {
      gewaehltesBild = null;
      vs.hidden = true;
      vs.innerHTML = '';
      URL.revokeObjectURL(url);
      $('verfassen-bild').value = '';
    });
  }

  function meldungImFenster(text, art) {
    const m = $('verfassen-meldung');
    m.textContent = text;
    m.className = 'login-meldung sichtbar ' + art;
  }

  // ------------------------------------------------------- Leute erwähnen
  let sucheZeit = null;

  async function leuteSuchen(text) {
    const treffer = $('verfassen-treffer');
    if (!text || text.trim().length < 2) { treffer.innerHTML = ''; return; }

    const { data, error } = await sb.rpc('leute_suchen', { suche: text.trim(), anzahl: 6 });
    treffer.innerHTML = '';
    if (error || !data || !data.length) {
      treffer.innerHTML = '<p class="leer-hinweis">Niemanden gefunden.</p>';
      return;
    }

    for (const p of data) {
      if (begleiter.has(p.id)) continue;
      const k = el('button');
      k.type = 'button';
      k.className = 'leute-treffer';
      k.innerHTML = `${kopfbild(p.username, p.avatar_path, 28)}
                     <span>${sicher(p.username)}</span>`;
      k.addEventListener('click', () => {
        begleiter.set(p.id, p.username);
        $('verfassen-suche').value = '';
        treffer.innerHTML = '';
        begleiterAnzeigen();
      });
      treffer.appendChild(k);
    }
  }

  function begleiterAnzeigen() {
    const kasten = $('verfassen-leute');
    kasten.innerHTML = '';
    for (const [id, name] of begleiter) {
      const p = el('span');
      p.className = 'person-pille';
      p.innerHTML = `${sicher(name)}<button type="button" aria-label="Entfernen">×</button>`;
      p.querySelector('button').addEventListener('click', () => {
        begleiter.delete(id);
        begleiterAnzeigen();
      });
      kasten.appendChild(p);
    }
  }

  // ------------------------------------------------------------ Abschicken
  async function beitragSpeichern() {
    const knopf = $('verfassen-senden');
    const text = $('verfassen-text').value.trim();

    if (!text) {
      meldungImFenster('Schreib ein paar Worte dazu.', 'fehler');
      return;
    }

    knopf.disabled = true;
    knopf.textContent = 'Wird gesendet …';

    try {
      // 1. Bild verkleinern und ablegen
      let pfad = null;
      if (gewaehltesBild) {
        meldungImFenster('Bild wird verkleinert …', 'info');
        const klein = await window.wildspotVerkleinern(gewaehltesBild, 1400);
        pfad = `${auth.nutzer.id}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from('post-photos')
          .upload(pfad, klein, { contentType: 'image/jpeg' });
        if (error) throw error;
      }

      // 2. Den Beitrag eintragen
      const datum = $('verfassen-datum').value || null;
      const zeigen = $('verfassen-spot-zeigen').getAttribute('aria-pressed') === 'true';

      const { data, error } = await sb.from('posts').insert({
        user_id: auth.nutzer.id,
        body: text.slice(0, 1500),
        photo_path: pfad,
        spot_id: gewaehlterSpot ? gewaehlterSpot.id : null,
        spot_zeigen: gewaehlterSpot ? zeigen : false,
        visited_on: datum,
      }).select('id').single();

      if (error) throw error;

      // 3. Die Begleiter eintragen. Schlägt das fehl, ist der Beitrag
      //    trotzdem da — deshalb kein throw.
      if (begleiter.size) {
        await sb.from('post_mentions').insert(
          [...begleiter.keys()].map((id) => ({ post_id: data.id, user_id: id }))
        ).catch(() => {});
      }

      verfassenSchliessen();
      melden('Dein Beitrag steht.');

      // Den Feed neu holen und nach oben — der eigene Beitrag ist der Grund,
      // warum man gerade hinsieht.
      welcherFeed = 'alle';
      reiterSetzen('alle');
      const schirm = $('schirm-entdecken');
      if (schirm) schirm.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      meldungImFenster('Hat nicht geklappt: ' + (err.message || err), 'fehler');
    } finally {
      knopf.disabled = false;
      knopf.textContent = 'Beitrag veröffentlichen';
    }
  }

  // ==========================================================================
  // 4. EIN PROFIL ANSEHEN
  // ==========================================================================

  async function profilOeffnen(wessenId) {
    const hg = $('person-hg');
    const kasten = $('person-inhalt');
    hg.hidden = false;
    kasten.innerHTML = '<div class="platzhalter" style="height:150px;border-radius:20px"></div>';

    const { data, error } = await sb.rpc('profil', { wessen_id: wessenId });
    const p = data && data[0];

    if (error || !p) {
      kasten.innerHTML = '<p class="detail-leer">Das Profil konnte nicht geladen werden.</p>';
      return;
    }

    const ich = auth.nutzer && auth.nutzer.id === p.id;

    kasten.innerHTML =
      `<div class="person-kopf">
         ${kopfbild(p.username, p.avatar_path, 72)}
         <h2>${sicher(p.username)}</h2>
         ${p.bio ? `<p class="person-bio">${sicher(p.bio)}</p>` : ''}
         <p class="person-seit">dabei seit ${sicher(
            new Date(p.seit).toLocaleDateString('de-AT', { month: 'long', year: 'numeric' }))}</p>
       </div>

       <div class="zahlen">
         <div class="zahl-kachel"><b>${Number(p.spots_besucht)}</b><span>Plätze besucht</span></div>
         <div class="zahl-kachel"><b>${Number(p.spots_gelegt)}</b><span>Spots eingetragen</span></div>
         <div class="zahl-kachel"><b>${Number(p.beitraege)}</b><span>Beiträge</span></div>
       </div>

       <div class="folge-zeile">
         <span><b>${Number(p.folgt_mir)}</b> ${Number(p.folgt_mir) === 1 ? 'Follower' : 'Follower'}</span>
         <span><b>${Number(p.folge_ich)}</b> gefolgt</span>
       </div>

       ${ich ? '' :
         `<button type="button" class="folge-knopf" id="folge-knopf"
                  aria-pressed="${p.ich_folge ? 'true' : 'false'}">
            ${p.ich_folge ? 'Du folgst' : 'Folgen'}
          </button>`}

       <h3 class="person-titel">Beiträge</h3>
       <div id="person-beitraege"></div>`;

    if (!ich) {
      $('folge-knopf').addEventListener('click', () => folgenUmschalten(p.id));
    }

    // Die Beiträge dieser Person
    const liste = $('person-beitraege');
    const { data: posts } = await sb.rpc('feed', { welcher: 'wer', wessen_id: p.id, anzahl: 20 });

    if (!posts || !posts.length) {
      liste.innerHTML = '<p class="detail-leer">Noch keine Beiträge.</p>';
    } else {
      for (const b of posts) liste.appendChild(beitragBauen(b));
    }
  }

  async function folgenUmschalten(wemId) {
    if (!auth.nutzer) { auth.anmeldenZeigen(); return; }

    const knopf = $('folge-knopf');
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

  window.WILDSPOT_PROFIL_ZEIGEN = profilOeffnen;

  // ==========================================================================
  // 5. DIE REITER AUF DER ENTDECKEN-SEITE
  // ==========================================================================

  function reiterSetzen(welcher) {
    const istFeed = welcher !== 'spots';

    for (const k of document.querySelectorAll('#entdecken-reiter [data-tafel]')) {
      k.setAttribute('aria-selected', String(k.dataset.tafel === welcher));
    }

    $('entdecken-spots').hidden = istFeed;
    $('entdecken-feed').hidden  = !istFeed;
    $('feed-schreiben').hidden  = !istFeed;

    if (istFeed) {
      welcherFeed = welcher === 'folge' ? 'folge' : 'alle';
      feedLaden();
    }
  }

  window.WILDSPOT_FEED_REITER = reiterSetzen;

  // ==========================================================================
  // 6. VERDRAHTEN
  // ==========================================================================

  document.addEventListener('DOMContentLoaded', verdrahten);
  if (document.readyState !== 'loading') verdrahten();

  let schonVerdrahtet = false;

  function verdrahten() {
    if (schonVerdrahtet) return;
    if (!$('entdecken-reiter')) return;
    schonVerdrahtet = true;

    for (const k of document.querySelectorAll('#entdecken-reiter [data-tafel]')) {
      k.addEventListener('click', () => reiterSetzen(k.dataset.tafel));
    }

    $('feed-schreiben').addEventListener('click', () => verfassenOeffnen());
    $('verfassen-zu').addEventListener('click', verfassenSchliessen);
    $('verfassen-abbrechen').addEventListener('click', verfassenSchliessen);
    $('verfassen-senden').addEventListener('click', beitragSpeichern);

    $('verfassen-bild').addEventListener('change', (e) => bildGewaehlt(e.target.files[0]));

    $('verfassen-spot-zeigen').addEventListener('click', (e) => {
      const an = e.currentTarget.getAttribute('aria-pressed') === 'true';
      e.currentTarget.setAttribute('aria-pressed', String(!an));
    });

    $('verfassen-suche').addEventListener('input', (e) => {
      clearTimeout(sucheZeit);
      const wert = e.target.value;
      sucheZeit = setTimeout(() => leuteSuchen(wert), 260);
    });

    $('person-zu').addEventListener('click', () => { $('person-hg').hidden = true; });

    // Nachladen beim Scrollen — die letzten Beiträge holen sich selbst.
    const schirm = $('schirm-entdecken');
    if (schirm) {
      schirm.addEventListener('scroll', () => {
        if (amEnde || laeuft) return;
        if ($('entdecken-feed').hidden) return;
        if (schirm.scrollTop + schirm.clientHeight > schirm.scrollHeight - 600) {
          feedLaden({ weiter: true });
        }
      });
    }

    // Beim An- und Abmelden ändert sich, was man sieht und darf.
    auth.beiWechsel.push(() => {
      if (!$('entdecken-feed').hidden) feedLaden();
    });
  }
})();
