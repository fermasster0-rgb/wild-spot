// Prüfungen für das Redesign (Schritt 1). Läuft über das Playwright-MCP-Werkzeug
// „browser_run_code_unsafe" mit filename = dieser Datei, gegen den lokalen
// Server (node web/server.mjs, Port 5173). Gibt pro Prüfung pass/fail zurück.
//
// Warum keine node:test-Datei: Die Oberfläche braucht einen echten Browser mit
// Karte, und Playwright ist bewusst nicht als Abhängigkeit im Projekt.
async (page) => {
  const browser = page.context().browser();
  const ergebnis = {};
  const pruef = (name, ok, ist) => { ergebnis[name] = (ok ? 'PASS' : 'FAIL') + (ist !== undefined ? ' · ' + JSON.stringify(ist) : ''); };

  async function seite(breite, hoehe) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe } });
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      try {
        localStorage.setItem('wildspot-intro-gesehen', 'ja');
        localStorage.setItem('wildcamp-hinweis-gelesen', 'ja');
        localStorage.setItem('wildspot-thema', 'tag');
      } catch (e) {}
    });
    await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      for (const k of await caches.keys()) await caches.delete(k);
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
    return { ctx, p };
  }

  // ---------------------------------------------------------------- Task 1
  {
    const { ctx, p } = await seite(390, 844);
    const tag = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
    pruef('T1 Grund Tag', tag === 'rgb(244, 245, 241)', tag);
    const nacht = await p.evaluate(() => { document.documentElement.dataset.thema = 'nacht'; return getComputedStyle(document.body).backgroundColor; });
    pruef('T1 Grund Nacht', nacht === 'rgb(11, 15, 12)', nacht);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Task 2
  {
    const { ctx, p } = await seite(390, 844);
    const r = await p.evaluate(() => {
      const el = document.getElementById('tableiste');
      const b = el.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height), u: Math.round(b.bottom), glas: getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter };
    });
    pruef('T2 Pille links 16', r.l === 16, r.l);
    pruef('T2 Pille rechts 374', r.r === 374, r.r);
    pruef('T2 Pille Höhe 64', r.h === 64, r.h);
    pruef('T2 Pille unten 826', r.u === 826, r.u);
    pruef('T2 Glas', /blur/.test(r.glas || ''), r.glas);
    await ctx.close();
    const breit = await seite(1280, 800);
    const l = await breit.p.evaluate(() => Math.round(document.getElementById('tableiste').getBoundingClientRect().left));
    pruef('T2 PC linke Spalte', l === 0, l);
    await breit.ctx.close();
  }

  // ---------------------------------------------------------------- Task 3
  {
    const { ctx, p } = await seite(390, 844);
    await p.locator('#tableiste').getByText('Entdecken', { exact: true }).click();
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const box = (s) => q(s) ? q(s).getBoundingClientRect() : null;
      return {
        titel: q('#entdecken-ueberschrift')?.textContent.trim() || null,
        suche: box('#entdecken-suche'),
        hero: box('#entdecken-hero'),
        anzahl: q('#kachel-anzahl .wert')?.textContent.trim() || null,
      };
    });
    pruef('T3 Titel Entdecken', r.titel === 'Entdecken', r.titel);
    pruef('T3 Suche über Hero', !!(r.suche && r.hero && r.suche.bottom < r.hero.top), r.suche && r.hero && [Math.round(r.suche.bottom), Math.round(r.hero.top)]);
    pruef('T3 Hero hoch', !!(r.hero && r.hero.height >= 380), r.hero && Math.round(r.hero.height));
    pruef('T3 Kachel Anzahl', /\d/.test(r.anzahl || ''), r.anzahl);
    await ctx.close();

    // Ohne Datenbank: die Startseite darf nicht ewig Platzhalter zeigen.
    const ohne = await seite(390, 844);
    await ohne.p.route('**/rest/v1/rpc/spots_entdecken**', (route) => route.abort());
    await ohne.p.locator('#tableiste').getByText('Entdecken', { exact: true }).click();
    await ohne.p.waitForTimeout(8000);
    const leer = await ohne.p.evaluate(() => document.querySelector('#entdecken-hero')?.innerText || '');
    pruef('T3 Leerzustand ohne DB', /keine Verbindung/i.test(leer), leer.slice(0, 80));
    await ohne.ctx.close();
  }

  // ---------------------------------------------------------------- Task 4
  {
    const { ctx, p } = await seite(390, 844);
    const vorher = await p.evaluate(() => (typeof window.WILDSPOT_EBENE_AN === 'function') ? window.WILDSPOT_EBENE_AN('wasser') : 'fehlt');
    await p.locator('#karte-chips [data-ebene="wasser"]').click({ timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({
      an: (typeof window.WILDSPOT_EBENE_AN === 'function') ? window.WILDSPOT_EBENE_AN('wasser') : 'fehlt',
      panel: document.getElementById('knopf-wasser')?.getAttribute('aria-pressed'),
      chip: document.querySelector('#karte-chips [data-ebene="wasser"]')?.getAttribute('aria-pressed') || null,
      sucheTop: Math.round(document.querySelector('.suche-feld').getBoundingClientRect().top),
      sucheH: Math.round(document.querySelector('.suche-feld').getBoundingClientRect().height),
      chipsTop: document.getElementById('karte-chips') ? Math.round(document.getElementById('karte-chips').getBoundingClientRect().top) : null,
      sucheUnten: Math.round(document.querySelector('.suche-feld').getBoundingClientRect().bottom),
    }));
    pruef('T4 Chip schaltet Ebene', vorher !== 'fehlt' && r.an === !vorher, [vorher, r.an]);
    pruef('T4 Panel gleich', r.panel === String(r.an), r.panel);
    pruef('T4 Chip zeigt Stand', r.chip === String(r.an), r.chip);
    pruef('T4 Suche oben', r.sucheTop >= 12, r.sucheTop);
    pruef('T4 Suche 50 hoch', r.sucheH === 50, r.sucheH);
    pruef('T4 Chips unter Suche', r.chipsTop !== null && r.chipsTop > r.sucheUnten, [r.chipsTop, r.sucheUnten]);
    await ctx.close();
  }

  // ---------------------------------------------------------------- Task 5
  // Lünersee hat (Stand 2026-11-10) keine berechnete Route → „Anfahrt".
  // Für den Weg-Fall wird die Antwort der Datenbank NUR im Browser um eine
  // Test-Route ergänzt (route_line + Parkplatz); in der Datenbank ändert sich nichts.
  const LUENERSEE = ['00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.0485614328005, 9.73884919463683];
  const TESTROUTE = [[9.7305, 47.0402], [9.7330, 47.0431], [9.7352, 47.0458], [9.7388, 47.0485]];
  {
    const { ctx, p } = await seite(390, 844);
    await p.evaluate((s) => window.spotDetailOeffnen(...s), LUENERSEE);
    await p.waitForTimeout(3500);
    const r = await p.evaluate(() => ({
      anfahrt: document.getElementById('blatt-anfahrt')?.getAttribute('href') || null,
      weg: !!document.getElementById('blatt-weg'),
      kacheln: [...document.querySelectorAll('.blatt-kachel .titel')].map((e) => e.textContent),
      zustieg: document.querySelectorAll('.blatt-kachel .wert')[1]?.textContent || null,
    }));
    pruef('T5 ohne Route: Anfahrt', /google\.com\/maps/.test(r.anfahrt || '') && !r.weg, r.anfahrt);
    pruef('T5 drei Kacheln', r.kacheln.join('|') === 'Höhe|Zustieg|Nacht', r.kacheln);
    pruef('T5 Zustieg befüllt', !!r.zustieg && r.zustieg !== '–', r.zustieg);
    await ctx.close();

    const mit = await seite(390, 844);
    await mit.p.route('**/rest/v1/spots_with_rating?*', async (route) => {
      const antwort = await route.fetch();
      let daten = await antwort.json();
      const ergaenzen = (s) => (s && s.id === LUENERSEE[0])
        ? { ...s, route_line: TESTROUTE, parking_lat: 47.0402, parking_lng: 9.7305, route_minutes: 75, route_ascent_m: 320, route_descent_m: 20, route_distance_m: 2400 }
        : s;
      daten = Array.isArray(daten) ? daten.map(ergaenzen) : ergaenzen(daten);
      await route.fulfill({ response: antwort, json: daten });
    });
    await mit.p.evaluate((s) => window.spotDetailOeffnen(...s), LUENERSEE);
    await mit.p.waitForTimeout(3500);
    const m = await mit.p.evaluate(() => ({
      weg: !!document.getElementById('blatt-weg'),
      zustieg: document.querySelectorAll('.blatt-kachel .wert')[1]?.textContent || null,
    }));
    pruef('T5 mit Route: Weg zum Spot', m.weg, m.weg);
    pruef('T5 Zustieg aus Route', m.zustieg === '1 h 15 min', m.zustieg);
    await mit.ctx.close();
  }

  // ---------------------------------------------------------------- Task 6
  async function mitTestroute(reduziert) {
    const s = await seite(390, 844);
    if (reduziert) await s.p.emulateMedia({ reducedMotion: 'reduce' });
    await s.p.route('**/rest/v1/spots_with_rating?*', async (route) => {
      const antwort = await route.fetch();
      let daten = await antwort.json();
      const ergaenzen = (x) => (x && x.id === LUENERSEE[0])
        ? { ...x, route_line: TESTROUTE, parking_lat: 47.0402, parking_lng: 9.7305, route_minutes: 75, route_ascent_m: 320, route_descent_m: 20, route_distance_m: 2400 }
        : x;
      daten = Array.isArray(daten) ? daten.map(ergaenzen) : ergaenzen(daten);
      await route.fulfill({ response: antwort, json: daten });
    });
    await s.p.evaluate((x) => window.spotDetailOeffnen(...x), LUENERSEE);
    await s.p.waitForTimeout(3500);
    return s;
  }
  const linienPunkte = (p) => p.evaluate(() => {
    const d = karte.getSource('route')?.serialize().data;
    const l = (d?.features || []).find((f) => f.geometry.type === 'LineString');
    return l ? l.geometry.coordinates.length : 0;
  });
  {
    const { ctx, p } = await mitTestroute(false);
    const fehler = [];
    p.on('pageerror', (e) => fehler.push(e.message));
    await p.click('#blatt-weg');
    // Kamera braucht bis ~0,8 s, dann wächst die Linie 1,5 s lang.
    const proben = [];
    for (const ms of [900, 600, 600, 900]) { await p.waitForTimeout(ms); proben.push(await linienPunkte(p)); }
    const chip = await p.evaluate(() => document.querySelector('.weg-chip:not([hidden])')?.textContent || '');
    pruef('T6 Linie wächst', proben[0] < proben[proben.length - 1] && proben[proben.length - 1] === TESTROUTE.length, proben);
    pruef('T6 Chip mit Werten', /1 h 15 min/.test(chip) && /320/.test(chip), chip);
    // Während einer neuen Animation einen anderen Spot öffnen: keine Ausnahme.
    await p.click('#blatt-weg').catch(() => {});
    await p.waitForTimeout(1000);
    await p.evaluate(() => window.spotDetailOeffnen('00000000-0000-0000-0000-000000000000', 'Test', 47.2, 11.4)).catch(() => {});
    await p.waitForTimeout(2500);
    pruef('T6 Wechsel ohne Fehler', fehler.length === 0, fehler.slice(0, 2));
    await ctx.close();

    const red = await mitTestroute(true);
    await red.p.click('#blatt-weg');
    await red.p.waitForTimeout(1200);
    const sofort = await linienPunkte(red.p);
    pruef('T6 Bewegung reduziert: sofort ganz', sofort === TESTROUTE.length, sofort);
    await red.ctx.close();
  }

  return ergebnis;
}
