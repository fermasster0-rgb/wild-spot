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

  return ergebnis;
}
