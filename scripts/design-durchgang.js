// Prüfdurchgang Redesign Schritt 1: jeder Bereich bei Tag und Nacht, am
// Handy (390×844) und am PC (1280×800). Bilder nach pruefbilder/redesign/
// durchgang-*.png, dazu die Liste aller Seitenfehler (pageerror).
// Läuft über Playwright-MCP „browser_run_code_unsafe" mit filename.
async (page) => {
  const browser = page.context().browser();
  const dir = 'C:/Users/ferma/OneDrive - gwiku18/Desktop/claude code/wildcamp-at/pruefbilder/redesign/durchgang-';
  const fehler = [];
  const bilder = [];
  const groessen = [['handy', 390, 844], ['pc', 1280, 800]];
  // true = Karte/Ebenen/Filter/Blatt überspringen (schon geprüft), nur die Seiten.
  const NUR_SEITEN = true;

  for (const [geraet, b, h] of groessen) {
    for (const thema of ['tag', 'nacht']) {
      const ctx = await browser.newContext({ viewport: { width: b, height: h } });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => fehler.push(`${geraet}/${thema}: ${e.message}`));
      await p.addInitScript((t) => {
        try {
          localStorage.setItem('wildspot-intro-gesehen', 'ja');
          localStorage.setItem('wildcamp-hinweis-gelesen', 'ja');
          localStorage.setItem('wildspot-thema', t);
          // Das Plus-Angebot (plus.js) erscheint absichtlich nach einiger
          // Zeit — für den Rundgang als „schon weggetippt" markieren.
          localStorage.setItem('wildspot-angebot-weg', '3');
          localStorage.setItem('wildspot-angebot-gross-weg', '2');
        } catch (e) {}
      }, thema);
      await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
      await p.evaluate(async () => {
        for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        for (const k of await caches.keys()) await caches.delete(k);
      });
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(5000);
      const foto = async (name) => {
        const datei = `${dir}${geraet}-${thema}-${name}.png`;
        await p.screenshot({ path: datei });
        bilder.push(`${geraet}-${thema}-${name}`);
      };
      const tab = (name) => p.locator('#tableiste').getByText(name, { exact: true }).click({ timeout: 4000 }).catch(() => {});

      if (!NUR_SEITEN) {
        await foto('karte');
        await p.click('#knopf-ebenen').catch(() => {}); await p.waitForTimeout(500); await foto('ebenen');
        await p.mouse.click(5, h / 2); await p.waitForTimeout(300);
        await p.click('#knopf-filter').catch(() => {}); await p.waitForTimeout(700); await foto('filter');
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        await p.evaluate(() => window.spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.0485614328005, 9.73884919463683));
        await p.waitForTimeout(3500); await foto('blatt');
        await p.click('#detail-zu').catch(() => {}); await p.waitForTimeout(500);
      }
      await tab('Entdecken'); await p.waitForTimeout(4000); await foto('entdecken');
      for (const t of ['alle', 'aktivitaet', 'leute']) {
        await p.click(`#entdecken-reiter [data-tafel="${t}"]`).catch(() => {}); await p.waitForTimeout(1800); await foto('entdecken-' + t);
      }
      await tab('Merkliste'); await p.waitForTimeout(2000); await foto('merkliste');
      await tab('Plus'); await p.waitForTimeout(2000); await foto('plus');
      await tab('Profil'); await p.waitForTimeout(2000); await foto('profil');
      await p.click('#profil-anmelden, #knopf-anmelden, button:has-text("Anmelden oder Konto anlegen")').catch(() => {});
      await p.waitForTimeout(1200); await foto('anmelden');
      await ctx.close();
    }
  }
  return { anzahlBilder: bilder.length, fehler };
}
