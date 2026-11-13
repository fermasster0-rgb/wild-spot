async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('wildspot-intro-gesehen','ja'); localStorage.setItem('wildcamp-hinweis-gelesen','ja'); localStorage.setItem('wildspot-angebot-weg','9'); localStorage.setItem('wildspot-angebot-gross-weg','9'); localStorage.setItem('wildspot-angebot-gross-zuletzt', String(Date.now())); localStorage.setItem('wildspot-angebot-zuletzt', String(Date.now())); } catch(e){} });
  const B = 'http://127.0.0.1:5173/';
  await p.goto(B, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  await p.goto(B + '?los=karte', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  const r = {};
  const zustand = () => p.evaluate(() => {
    const d = document.getElementById('detail');
    const t = document.querySelector('.tableiste');
    return { halb: d.classList.contains('stufe-halb'), voll: d.classList.contains('stufe-voll'),
      top: Math.round(d.getBoundingClientRect().top), offen: !d.hidden,
      leiste: getComputedStyle(t).opacity };
  });
  await p.evaluate(() => spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.048, 9.7388));
  await p.waitForTimeout(1200);
  r.karteHalb = await zustand();
  await p.click('#detail .detail-kopf h2');
  await p.waitForTimeout(700);
  r.nachTippVoll = await zustand();
  await p.click('#detail .detail-kopf h2');
  await p.waitForTimeout(700);
  r.nachTippHalb = await zustand();
  await p.click('#detail-zu');
  await p.waitForTimeout(700);
  r.zu = await zustand();
  await p.evaluate(() => WILDSPOT_BEREICH('entdecken'));
  await p.waitForTimeout(800);
  await p.evaluate(() => spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.048, 9.7388));
  await p.waitForTimeout(1000);
  r.listeVoll = await zustand();
  await p.screenshot({ path: 'C:/Users/ferma/AppData/Local/Temp/claude/c69ec4d21e3ea372/17583e80-e64b-4452-9af9-7a48518bde3a/scratchpad/t3-liste.png' });
  await p.click('#detail-zu');
  await p.evaluate(() => WILDSPOT_BEREICH('karte'));
  await p.waitForTimeout(800);
  await p.evaluate(() => spotDetailOeffnen('00b2d44c-1a5f-46b0-8b85-4e946657b677', 'Lünersee', 47.048, 9.7388));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'C:/Users/ferma/AppData/Local/Temp/claude/c69ec4d21e3ea372/17583e80-e64b-4452-9af9-7a48518bde3a/scratchpad/t3-halb.png' });
  // Touch-Zug am Griff nach oben
  const zug = async (von, bis, ms) => {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: von }] });
    const n = 8;
    for (let i = 1; i <= n; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: von + (bis - von) * i / n }] });
      await p.waitForTimeout(ms / n);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(700);
  };
  const kopfY = await p.evaluate(() => Math.round(document.querySelector('#detail .detail-kopf').getBoundingClientRect().top + 20));
  await zug(kopfY, kopfY - 200, 160);
  r.zugHoch = await zustand();
  // Inhalt scrollen in voll, dann nach unten ziehen aus Inhalt darf nicht schließen
  await p.evaluate(() => { document.getElementById('detail-koerper').scrollTop = 200; });
  await zug(600, 750, 300);
  r.scrollNichtZu = await zustand();
  const kopfY2 = await p.evaluate(() => Math.round(document.querySelector('#detail .detail-kopf').getBoundingClientRect().top + 20));
  await zug(kopfY2, kopfY2 + 250, 400);
  r.zugRunterHalb = await zustand();
  r.kopfY2 = kopfY2; r.el2 = await p.evaluate((y) => { const e = document.elementFromPoint(195, y); return (e.className||e.tagName) + '|' + document.getElementById('detail-koerper').scrollTop; }, kopfY2);
  const kopfY3 = await p.evaluate(() => Math.round(document.querySelector('#detail .detail-kopf').getBoundingClientRect().top + 20));
  await zug(kopfY3, kopfY3 + 200, 400);
  r.zugRunterZu = await zustand();
  await ctx.close();
  return r;
}
