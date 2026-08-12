// ============================================================================
// Die Verwaltung — das Admin-Fenster
//
// Vier Bereiche: Spots, Fotos, Kommentare, Nutzer & Zahlen.
//
// ----------------------------------------------------------------------------
// Wichtig zum Verständnis
//
// Diese Datei entscheidet NICHTS über Rechte. Sie zeigt nur an und schickt
// Anfragen los. Ob jemand einen fremden Spot ändern darf, entscheidet allein
// die Datenbank über die Regeln aus Migration 013 — dort steht ist_admin().
//
// Wer hier im Browser den Knopf sichtbar macht oder das "hidden" entfernt,
// bekommt dadurch kein einziges Recht dazu: Jede Änderung würde an der
// Datenbank abprallen. Das ist der Grund, warum die Prüfung dort liegt und
// nicht hier.
//
// ----------------------------------------------------------------------------
// Warum Löschen zweistufig ist
//
// Ein versehentlicher Klick auf "Löschen" nimmt einen Spot samt Bewertungen,
// Kommentaren und Fotos mit. Ein window.confirm() wäre der übliche Weg, ist
// hier aber verboten: Dialoge dieser Art blockieren die ganze Seite. Deshalb
// verwandelt sich der Knopf beim ersten Klick in "Wirklich löschen?" und
// springt nach fünf Sekunden von selbst zurück.
// ============================================================================

(() => {
  const auth = window.WILDCAMP_AUTH;
  if (!auth) return;

  const hg          = document.getElementById('admin-hg');
  const inhalt      = document.getElementById('admin-inhalt');
  const knopfOeffne = document.getElementById('knopf-admin');
  const knopfZu     = document.getElementById('admin-schliessen');
  const reiter      = [...document.querySelectorAll('.admin-reiter button')];

  if (!hg || !inhalt) return;

  let aktiv = 'spots';
  let suchtext = '';

  // --------------------------------------------------------------------------
  // Kleine Helfer
  // --------------------------------------------------------------------------

  const sb = () => auth.client;

  function html(text) {
    return String(text ?? '').replace(/[&<>"']/g, (z) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]
    ));
  }

  function datum(wert) {
    if (!wert) return '–';
    return new Date(wert).toLocaleDateString('de-AT',
      { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function meldung(text, art = 'ok') {
    const alt = inhalt.querySelector('.admin-meldung');
    if (alt) alt.remove();
    const el = document.createElement('div');
    el.className = `admin-meldung ${art}`;
    el.textContent = text;
    inhalt.prepend(el);
    if (art === 'ok') setTimeout(() => el.remove(), 4000);
  }

  function laedt() {
    inhalt.innerHTML = '<p class="admin-leer">Wird geladen …</p>';
  }

  // Zweistufiges Löschen. Beim ersten Klick fragt der Knopf nach, beim
  // zweiten führt er aus. Ohne blockierenden Dialog.
  function loeschKnopf(beschriftung, ausfuehren) {
    const b = document.createElement('button');
    b.className = 'admin-gefahr';
    b.textContent = beschriftung;
    let scharf = false;
    let uhr = null;

    b.addEventListener('click', async () => {
      const zeile = b.closest('.admin-zeile');
      if (!scharf) {
        scharf = true;
        b.textContent = 'Wirklich löschen?';
        zeile?.classList.add('fragt');
        uhr = setTimeout(() => {
          scharf = false;
          b.textContent = beschriftung;
          zeile?.classList.remove('fragt');
        }, 5000);
        return;
      }
      clearTimeout(uhr);
      b.disabled = true;
      b.textContent = 'Löscht …';
      await ausfuehren();
    });
    return b;
  }

  // --------------------------------------------------------------------------
  // Bereich 1 — Spots
  // --------------------------------------------------------------------------

  async function zeigeSpots() {
    laedt();
    // admin_spots statt spots: dieselbe Liste, aber mit lat/lon als Zahlen
    // (siehe Migration 013). Geändert und gelöscht wird trotzdem in spots —
    // eine Ansicht ist nur eine gespeicherte Abfrage.
    const { data, error } = await sb()
      .from('admin_spots')
      .select('id, name, description, elevation_m, legal_status, above_treeline, '
        + 'created_by, created_at, lat, lon')
      .order('created_at', { ascending: false });

    if (error) return fehler(error);

    // Wer hat welchen Spot angelegt? Namen in einem Rutsch nachschlagen.
    const namen = await profilnamen(data.map((s) => s.created_by));
    const fotos = await fotoAnzahl();

    inhalt.innerHTML = '';
    inhalt.appendChild(sucheFeld('Spot suchen …', zeigeSpots));

    const liste = data.filter((s) => passt(s.name, s.description));
    if (!liste.length) return leer('Keine Spots gefunden.');

    for (const s of liste) {
      const zeile = document.createElement('div');
      zeile.className = 'admin-zeile';

      const marken = [
        s.elevation_m ? `<span class="admin-marke">${s.elevation_m} m</span>` : '',
        s.legal_status === 'erlaubt'
          ? '<span class="admin-marke gruen">erlaubt</span>'
          : `<span class="admin-marke warn">${html(s.legal_status ?? 'unklar')}</span>`,
        fotos[s.id]
          ? `<span class="admin-marke">${fotos[s.id]} Foto${fotos[s.id] > 1 ? 's' : ''}</span>`
          : '<span class="admin-marke">kein Foto</span>',
      ].join('');

      zeile.innerHTML = `
        <div class="titel">${html(s.name)}</div>
        <div class="unter">
          ${marken}<br>
          von ${html(namen[s.created_by] ?? 'unbekannt')} · angelegt ${datum(s.created_at)}
        </div>`;

      const knoepfe = document.createElement('div');
      knoepfe.className = 'knoepfe';

      const zeigen = document.createElement('button');
      zeigen.textContent = 'Auf der Karte';
      zeigen.addEventListener('click', () => zurKarte(s));
      knoepfe.appendChild(zeigen);

      const bearbeiten = document.createElement('button');
      bearbeiten.textContent = 'Bearbeiten';
      bearbeiten.addEventListener('click', () => spotBearbeiten(s, zeile));
      knoepfe.appendChild(bearbeiten);

      knoepfe.appendChild(loeschKnopf('Löschen', async () => {
        const { error: e } = await sb().from('spots').delete().eq('id', s.id);
        if (e) return fehler(e);
        zeile.remove();
        meldung(`„${s.name}" gelöscht.`);
      }));

      zeile.appendChild(knoepfe);
      inhalt.appendChild(zeile);
    }
  }

  // Schlankes Bearbeiten direkt in der Zeile. Bewusst nur die Felder, die man
  // beim Aufräumen wirklich braucht — das große Formular zum Anlegen bleibt
  // in spot-form.js.
  function spotBearbeiten(spot, zeile) {
    if (zeile.querySelector('.admin-bearbeiten')) return;

    const box = document.createElement('div');
    box.className = 'admin-bearbeiten';
    box.style.marginTop = '10px';
    box.innerHTML = `
      <input class="admin-suche" id="ab-name" value="${html(spot.name)}"
             maxlength="80" placeholder="Name">
      <textarea class="admin-suche" id="ab-text" rows="5"
                placeholder="Beschreibung">${html(spot.description ?? '')}</textarea>
      <select class="admin-suche" id="ab-recht">
        ${['erlaubt', 'geduldet', 'verboten', 'unklar'].map((w) =>
          `<option value="${w}"${spot.legal_status === w ? ' selected' : ''}>Rechtslage: ${w}</option>`).join('')}
      </select>
      <select class="admin-suche" id="ab-baum">
        <option value=""${spot.above_treeline == null ? ' selected' : ''}>Baumgrenze: keine Angabe</option>
        <option value="true"${spot.above_treeline === true ? ' selected' : ''}>über der Baumgrenze</option>
        <option value="false"${spot.above_treeline === false ? ' selected' : ''}>unter der Baumgrenze</option>
      </select>`;

    const knoepfe = document.createElement('div');
    knoepfe.className = 'knoepfe';

    const speichern = document.createElement('button');
    speichern.textContent = 'Speichern';
    speichern.addEventListener('click', async () => {
      speichern.disabled = true;
      speichern.textContent = 'Speichert …';
      const baum = box.querySelector('#ab-baum').value;
      const { error } = await sb().from('spots').update({
        name: box.querySelector('#ab-name').value.trim(),
        description: box.querySelector('#ab-text').value.trim() || null,
        legal_status: box.querySelector('#ab-recht').value,
        above_treeline: baum === '' ? null : baum === 'true',
      }).eq('id', spot.id);

      if (error) { speichern.disabled = false; speichern.textContent = 'Speichern'; return fehler(error); }
      await zeigeSpots();
      meldung('Gespeichert.');
    });

    const abbrechen = document.createElement('button');
    abbrechen.textContent = 'Abbrechen';
    abbrechen.addEventListener('click', () => box.remove());

    knoepfe.append(speichern, abbrechen);
    box.appendChild(knoepfe);
    zeile.appendChild(box);
  }

  // --------------------------------------------------------------------------
  // Bereich 2 — Fotos
  // --------------------------------------------------------------------------

  async function zeigeFotos() {
    laedt();
    const { data: spots, error } = await sb()
      .from('spots').select('id, name, created_by').order('name');
    if (error) return fehler(error);

    const { data: bilder, error: e2 } = await sb()
      .from('spot_photos').select('id, spot_id, storage_path, sort_order')
      .order('sort_order');
    if (e2) return fehler(e2);

    const proSpot = {};
    for (const b of bilder) (proSpot[b.spot_id] ??= []).push(b);

    inhalt.innerHTML = '';
    inhalt.appendChild(sucheFeld('Spot suchen …', zeigeFotos));

    const liste = spots.filter((s) => passt(s.name));
    if (!liste.length) return leer('Keine Spots gefunden.');

    for (const s of liste) {
      const zeile = document.createElement('div');
      zeile.className = 'admin-zeile';
      const meine = proSpot[s.id] ?? [];
      zeile.innerHTML = `
        <div class="titel">${html(s.name)}</div>
        <div class="unter">${meine.length
          ? `${meine.length} Foto${meine.length > 1 ? 's' : ''}`
          : 'noch kein Foto'}</div>`;

      if (meine.length) {
        const streifen = document.createElement('div');
        streifen.className = 'admin-fotos';
        for (const b of meine) {
          const fig = document.createElement('figure');
          const bild = document.createElement('img');
          bild.loading = 'lazy';
          bild.alt = '';
          bild.src = sb().storage.from('spot-photos').getPublicUrl(b.storage_path).data.publicUrl;
          const weg = document.createElement('button');
          weg.textContent = '×';
          weg.title = 'Foto löschen';
          weg.addEventListener('click', async () => {
            weg.disabled = true;
            await sb().storage.from('spot-photos').remove([b.storage_path]);
            const { error: e3 } = await sb().from('spot_photos').delete().eq('id', b.id);
            if (e3) { weg.disabled = false; return fehler(e3); }
            fig.remove();
            meldung('Foto gelöscht.');
          });
          fig.append(bild, weg);
          streifen.appendChild(fig);
        }
        zeile.appendChild(streifen);
      }

      // Hochladen. Verkleinert wie in der App auf 1600 Pixel — sonst wäre der
      // kostenlose Speicher nach gut hundert Handyfotos voll.
      const knoepfe = document.createElement('div');
      knoepfe.className = 'knoepfe';
      const feld = document.createElement('input');
      feld.type = 'file';
      feld.accept = 'image/*';
      feld.multiple = true;
      feld.hidden = true;
      const knopf = document.createElement('button');
      knopf.textContent = 'Foto hinzufügen';
      knopf.addEventListener('click', () => feld.click());
      feld.addEventListener('change', async () => {
        if (!feld.files.length) return;
        knopf.disabled = true;
        let n = 0;
        for (const datei of feld.files) {
          knopf.textContent = `Lädt ${++n}/${feld.files.length} …`;
          const ok = await fotoHochladen(s.id, datei, (proSpot[s.id]?.length ?? 0) + n);
          if (!ok) break;
        }
        await zeigeFotos();
        meldung(`${n} Foto${n > 1 ? 's' : ''} hochgeladen.`);
      });
      knoepfe.append(knopf, feld);
      zeile.appendChild(knoepfe);
      inhalt.appendChild(zeile);
    }
  }

  async function fotoHochladen(spotId, datei, reihe) {
    try {
      const klein = await verkleinern(datei);
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const pfad = `${auth.nutzer.id}/${spotId}/${name}`;

      const { error } = await sb().storage.from('spot-photos')
        .upload(pfad, klein, { contentType: 'image/jpeg' });
      if (error) { fehler(error); return false; }

      const { error: e2 } = await sb().from('spot_photos').insert({
        spot_id: spotId, uploaded_by: auth.nutzer.id,
        storage_path: pfad, sort_order: reihe,
      });
      if (e2) { fehler(e2); return false; }
      return true;
    } catch (e) {
      fehler(e);
      return false;
    }
  }

  // Bild im Browser auf 1600 Pixel bringen. Aus 8 MB werden so etwa 300 KB.
  function verkleinern(datei) {
    return new Promise((fertig, schiefgelaufen) => {
      const bild = new Image();
      bild.onload = () => {
        const max = 1600;
        const faktor = Math.min(1, max / Math.max(bild.width, bild.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bild.width * faktor);
        c.height = Math.round(bild.height * faktor);
        c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
        c.toBlob((b) => b ? fertig(b) : schiefgelaufen(new Error('Bild ließ sich nicht umwandeln.')),
          'image/jpeg', 0.82);
        URL.revokeObjectURL(bild.src);
      };
      bild.onerror = () => schiefgelaufen(new Error('Bild ließ sich nicht lesen.'));
      bild.src = URL.createObjectURL(datei);
    });
  }

  // --------------------------------------------------------------------------
  // Bereich 3 — Kommentare und Bewertungen
  // --------------------------------------------------------------------------

  async function zeigeKommentare() {
    laedt();
    const [k, b, s] = await Promise.all([
      sb().from('comments').select('*').order('created_at', { ascending: false }).limit(200),
      sb().from('ratings').select('*').order('created_at', { ascending: false }).limit(200),
      sb().from('spots').select('id, name'),
    ]);
    if (k.error) return fehler(k.error);
    if (b.error) return fehler(b.error);

    const spotName = Object.fromEntries((s.data ?? []).map((x) => [x.id, x.name]));
    const namen = await profilnamen([
      ...(k.data ?? []).map((x) => x.user_id),
      ...(b.data ?? []).map((x) => x.user_id),
    ]);

    inhalt.innerHTML = '';
    inhalt.appendChild(sucheFeld('In Kommentaren suchen …', zeigeKommentare));

    const eintraege = [
      ...(k.data ?? []).map((x) => ({ ...x, art: 'kommentar' })),
      ...(b.data ?? []).map((x) => ({ ...x, art: 'bewertung' })),
    ].sort((x, y) => new Date(y.created_at) - new Date(x.created_at));

    const liste = eintraege.filter((x) =>
      passt(x.body ?? '', spotName[x.spot_id] ?? ''));

    if (!liste.length) return leer('Noch keine Kommentare oder Bewertungen.');

    for (const e of liste) {
      const wer = namen[e.user_id] ?? 'unbekannt';
      const text = e.body ?? '';
      const zeile = document.createElement('div');
      zeile.className = 'admin-zeile';
      zeile.innerHTML = `
        <div class="titel">
          <span class="admin-marke">${e.art === 'kommentar' ? 'Kommentar' : 'Bewertung'}</span>
          ${html(spotName[e.spot_id] ?? 'gelöschter Spot')}
        </div>
        <div class="unter">
          ${e.art === 'bewertung'
            ? `${'★'.repeat(e.stars ?? 0)}${'☆'.repeat(Math.max(0, 5 - (e.stars ?? 0)))}`
            : html(text)}
          <br>von ${html(wer)} · ${datum(e.created_at)}
          ${e.visited_on ? ` · war dort am ${datum(e.visited_on)}` : ''}
        </div>`;

      const knoepfe = document.createElement('div');
      knoepfe.className = 'knoepfe';
      knoepfe.appendChild(loeschKnopf('Löschen', async () => {
        const tabelle = e.art === 'kommentar' ? 'comments' : 'ratings';
        const { error } = await sb().from(tabelle).delete().eq('id', e.id);
        if (error) return fehler(error);
        zeile.remove();
        meldung('Gelöscht.');
      }));
      zeile.appendChild(knoepfe);
      inhalt.appendChild(zeile);
    }
  }

  // --------------------------------------------------------------------------
  // Bereich 4 — Nutzer und Zahlen
  // --------------------------------------------------------------------------

  async function zeigeNutzer() {
    laedt();
    const [z, p] = await Promise.all([
      sb().from('admin_zahlen').select('*').maybeSingle(),
      sb().from('profiles').select('id, username, is_admin, created_at')
        .order('created_at', { ascending: false }),
    ]);
    if (z.error) return fehler(z.error);
    if (p.error) return fehler(p.error);

    const zahlen = z.data ?? {};
    inhalt.innerHTML = `
      <div class="admin-kacheln">
        ${[['Spots', zahlen.spots], ['Fotos', zahlen.fotos],
           ['Kommentare', zahlen.kommentare], ['Bewertungen', zahlen.bewertungen],
           ['Nutzer', zahlen.nutzer], ['neu diese Woche', zahlen.spots_diese_woche]]
          .map(([t, w]) => `<div class="admin-kachel"><b>${w ?? 0}</b><span>${t}</span></div>`)
          .join('')}
      </div>
      <h3 style="margin:0 0 10px;font-size:13px;color:var(--text-weak)">Konten</h3>`;

    // Wie viele Spots hat wer? Eine Abfrage, dann im Browser zählen.
    const { data: spots } = await sb().from('spots').select('created_by');
    const proNutzer = {};
    for (const s of spots ?? []) proNutzer[s.created_by] = (proNutzer[s.created_by] ?? 0) + 1;

    for (const n of p.data ?? []) {
      const zeile = document.createElement('div');
      zeile.className = 'admin-zeile';
      zeile.innerHTML = `
        <div class="titel">
          ${html(n.username)}
          ${n.is_admin ? '<span class="admin-marke gruen">Admin</span>' : ''}
        </div>
        <div class="unter">
          ${proNutzer[n.id] ?? 0} Spot${(proNutzer[n.id] ?? 0) === 1 ? '' : 's'}
          · dabei seit ${datum(n.created_at)}
        </div>`;
      inhalt.appendChild(zeile);
    }
  }

  // --------------------------------------------------------------------------
  // Gemeinsames
  // --------------------------------------------------------------------------

  async function profilnamen(ids) {
    const eindeutig = [...new Set(ids.filter(Boolean))];
    if (!eindeutig.length) return {};
    const { data } = await sb().from('profiles').select('id, username').in('id', eindeutig);
    return Object.fromEntries((data ?? []).map((p) => [p.id, p.username]));
  }

  async function fotoAnzahl() {
    const { data } = await sb().from('spot_photos').select('spot_id');
    const zahl = {};
    for (const f of data ?? []) zahl[f.spot_id] = (zahl[f.spot_id] ?? 0) + 1;
    return zahl;
  }

  function passt(...felder) {
    if (!suchtext) return true;
    return felder.some((f) => String(f ?? '').toLowerCase().includes(suchtext));
  }

  function sucheFeld(platzhalter, neuzeichnen) {
    const feld = document.createElement('input');
    feld.className = 'admin-suche';
    feld.placeholder = platzhalter;
    feld.value = suchtext;
    let uhr = null;
    feld.addEventListener('input', () => {
      clearTimeout(uhr);
      uhr = setTimeout(async () => {
        suchtext = feld.value.trim().toLowerCase();
        await neuzeichnen();
        // Nach dem Neuzeichnen ist das Feld ein anderes — Fokus zurückholen,
        // sonst kann man nicht weitertippen.
        const neu = inhalt.querySelector('.admin-suche');
        if (neu) { neu.focus(); neu.setSelectionRange(neu.value.length, neu.value.length); }
      }, 250);
    });
    return feld;
  }

  function leer(text) {
    const p = document.createElement('p');
    p.className = 'admin-leer';
    p.textContent = text;
    inhalt.appendChild(p);
  }

  function fehler(e) {
    console.error('[admin]', e);
    meldung(e?.message
      ? `Ging nicht: ${e.message}`
      : 'Ging nicht. Ohne Netz lässt sich hier nichts verwalten.', 'fehl');
  }

  function zurKarte(spot) {
    const karte = window.WILDCAMP_KARTE;
    if (karte && spot.lat != null && spot.lon != null) {
      schliessen();
      karte.flyTo({ center: [spot.lon, spot.lat], zoom: 14 });
    } else {
      meldung('Für diesen Spot lässt sich die Position gerade nicht lesen.', 'fehl');
    }
  }

  // --------------------------------------------------------------------------
  // Öffnen, Schließen, Reiter
  // --------------------------------------------------------------------------

  const bereiche = {
    spots: zeigeSpots,
    fotos: zeigeFotos,
    kommentare: zeigeKommentare,
    nutzer: zeigeNutzer,
  };

  async function wechseln(name) {
    aktiv = name;
    suchtext = '';
    for (const r of reiter) r.setAttribute('aria-selected', String(r.dataset.reiter === name));
    inhalt.scrollTop = 0;
    await bereiche[name]();
  }

  function oeffnen() {
    if (!auth.nutzer?.istAdmin) return;
    hg.hidden = false;
    document.body.style.overflow = 'hidden';
    wechseln(aktiv);
  }

  function schliessen() {
    hg.hidden = true;
    document.body.style.overflow = '';
  }

  knopfOeffne?.addEventListener('click', oeffnen);
  knopfZu?.addEventListener('click', schliessen);
  for (const r of reiter) r.addEventListener('click', () => wechseln(r.dataset.reiter));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !hg.hidden) schliessen();
  });

  // Der Knopf im Einstellungsmenü erscheint nur für Admins — und verschwindet
  // beim Abmelden zusammen mit dem Fenster.
  auth.beiWechsel.push((nutzer) => {
    const darf = !!nutzer?.istAdmin;
    if (knopfOeffne) knopfOeffne.hidden = !darf;
    if (!darf && !hg.hidden) schliessen();
  });
})();
