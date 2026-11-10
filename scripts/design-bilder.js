// Bildschirmfotos aller Bereiche bei Tag und Nacht (Redesign-Prüfung).
// Läuft über Playwright-MCP „browser_run_code_unsafe" mit filename = dieser
// Datei. Legt die Bilder in pruefbilder/redesign/ (nicht im Repo).
async (page) => {
  const browser = page.context().browser();
  const dir = 'C:/Users/ferma/OneDrive - gwiku18/Desktop/claude code/wildcamp-at/pruefbilder/redesign/';
  const fertig = [];
  for (const thema of ['tag', 'nacht']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.addInitScript((t) => {
      try {
        localStorage.setItem('wildspot-intro-gesehen', 'ja');
        localStorage.setItem('wildcamp-hinweis-gelesen', 'ja');
        localStorage.setItem('wildspot-thema', t);
      } catch (e) {}
    }, thema);
    await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      for (const k of await caches.keys()) await caches.delete(k);
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(5000);
    await p.screenshot({ path: dir + 'karte-' + thema + '.png' });
    fertig.push('karte-' + thema);
    for (const name of ['Entdecken', 'Merkliste', 'Plus', 'Profil']) {
      await p.locator('#tableiste').getByText(name, { exact: true }).click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(3000);
      await p.screenshot({ path: dir + name.toLowerCase() + '-' + thema + '.png' });
      fertig.push(name.toLowerCase() + '-' + thema);
    }
    await ctx.close();
  }
  return fertig;
}
