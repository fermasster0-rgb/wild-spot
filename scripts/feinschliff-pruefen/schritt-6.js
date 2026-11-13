async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('wildspot-intro-gesehen','ja'); localStorage.setItem('wildcamp-hinweis-gelesen','ja'); localStorage.setItem('wildspot-angebot-weg','9'); localStorage.setItem('wildspot-angebot-gross-weg','9'); localStorage.setItem('wildspot-angebot-gross-zuletzt', String(Date.now())); localStorage.setItem('wildspot-angebot-zuletzt', String(Date.now())); } catch(e){} });
  await p.goto('http://127.0.0.1:5173/?los=karte', { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { for (const x of await navigator.serviceWorker.getRegistrations()) await x.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  const r = {};
  // Angemeldet vortäuschen (nur im Test): dann gäbe es „Von hier erzählen" und die Folgezeile
  await p.evaluate(() => { WILDCAMP_AUTH.nutzer = { id: '00000000-0000-0000-0000-000000000000', username: 'test', istAdmin: false }; });
  await p.evaluate(() => spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.048, 9.7388));
  await p.waitForTimeout(2500);
  r.erzaehlen = await p.evaluate(() => !!document.getElementById('detail-erzaehlen'));
  await p.click('#detail-zu');
  await p.evaluate(() => WILDSPOT_BEREICH('profil'));
  await p.waitForTimeout(2500);
  r.folgezeile = await p.evaluate(() => !!document.querySelector('#schirm-profil .folge-zeile'));
  await p.evaluate(() => WILDSPOT_BEREICH('karte'));
  await p.waitForTimeout(800);
  r.chipsMaske = await p.evaluate(() => getComputedStyle(document.getElementById('karte-chips')).webkitMaskImage || getComputedStyle(document.getElementById('karte-chips')).maskImage);
  await p.screenshot({ path: 'C:/Users/ferma/AppData/Local/Temp/claude/c69ec4d21e3ea372/17583e80-e64b-4452-9af9-7a48518bde3a/scratchpad/t6-karte.png' });
  await ctx.close();
  return r;
}
