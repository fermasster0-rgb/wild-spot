async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('wildspot-intro-gesehen','ja'); localStorage.setItem('wildcamp-hinweis-gelesen','ja'); localStorage.setItem('wildspot-angebot-weg','9'); localStorage.setItem('wildspot-angebot-gross-weg','9'); localStorage.setItem('wildspot-angebot-gross-zuletzt', String(Date.now())); localStorage.setItem('wildspot-angebot-zuletzt', String(Date.now())); } catch(e){} });
  const B = 'http://127.0.0.1:5173/';
  await p.goto(B, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  await p.goto(B + '?los=karte', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4500);
  const lage = (lat, lng) => p.evaluate(([lat, lng]) => {
    const pt = karte.project([lng, lat]);
    const chips = document.querySelector('.karte-chips') || document.querySelector('.suche');
    return { zoom: +karte.getZoom().toFixed(2), x: Math.round(pt.x), y: Math.round(pt.y),
      chipsUnten: Math.round(chips.getBoundingClientRect().bottom), blattOben: Math.round(innerHeight * 0.54),
      pins: document.querySelectorAll('.spot-pin').length };
  }, [lat, lng]);
  const r = {};
  await p.evaluate(() => spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.048, 9.7388));
  await p.waitForTimeout(1600);
  r.erster = await lage(47.048, 9.7388);
  await p.screenshot({ path: 'C:/Users/ferma/AppData/Local/Temp/claude/c69ec4d21e3ea372/17583e80-e64b-4452-9af9-7a48518bde3a/scratchpad/t4-halb.png' });
  // zweiter Spot (Eberlsee) schnell danach
  await p.evaluate(() => spotDetailOeffnen('test-2', 'Zweiter', 47.4014, 14.5428));
  await p.waitForTimeout(150);
  await p.evaluate(() => spotDetailOeffnen('test-3', 'Dritter', 47.2, 13.0));
  await p.waitForTimeout(1600);
  r.dritter = await lage(47.2, 13.0);
  r.stufe = await p.evaluate(() => document.getElementById('detail').className);
  await p.click('#detail-zu');
  await p.waitForTimeout(500);
  r.nachZu = await p.evaluate(() => document.querySelectorAll('.spot-pin').length);
  // von der Startseite + Auf der Karte anzeigen
  await p.evaluate(() => WILDSPOT_BEREICH('entdecken'));
  await p.waitForTimeout(600);
  await p.evaluate(() => spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.048, 9.7388));
  await p.waitForTimeout(2500);
  r.listePins = await p.evaluate(() => document.querySelectorAll('.spot-pin').length);
  await p.click('#detail-zur-karte').catch(e => r.zurKarteFehlt = true);
  await p.waitForTimeout(1800);
  r.nachZurKarte = await lage(47.048, 9.7388);
  r.stufeNachZurKarte = await p.evaluate(() => document.getElementById('detail').className + '|' + WILDSPOT_BEREICH_JETZT());
  await ctx.close();
  return r;
}
