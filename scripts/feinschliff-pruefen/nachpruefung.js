async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('wildspot-intro-gesehen','ja'); localStorage.setItem('wildcamp-hinweis-gelesen','ja'); localStorage.setItem('wildspot-angebot-weg','9'); localStorage.setItem('wildspot-angebot-gross-weg','9'); localStorage.setItem('wildspot-angebot-gross-zuletzt', String(Date.now())); localStorage.setItem('wildspot-angebot-zuletzt', String(Date.now())); } catch(e){} });
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { for (const x of await navigator.serviceWorker.getRegistrations()) await x.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);
  const r = await p.evaluate(() => {
    const reihen = {};
    for (const b of document.querySelectorAll('#entdecken-reihen .block')) {
      reihen[b.querySelector('h2').textContent] = [...b.querySelectorAll('.ws-reihenkarte .eck')].map((e) => e.textContent).slice(0, 2).concat(b.querySelectorAll('.ws-reihenkarte, .ws-wissen-karte').length);
    }
    const reihe = document.querySelector('.ws-reihe');
    return { reihen, touch: reihe ? getComputedStyle(reihe).touchAction : 'fehlt' };
  });
  // Senkrecht wischen, Finger startet auf einer Reihenkarte
  const schirm = 'schirm-entdecken';
  const karte = await p.evaluate(() => { const k = document.querySelector('#entdecken-reihen .ws-reihenkarte'); k.scrollIntoView({ block: 'center' }); const b = k.getBoundingClientRect(); return { x: Math.round(b.left + 40), y: Math.round(b.top + 40) }; });
  const vorher = await p.evaluate((s) => document.getElementById(s).scrollTop, schirm);
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: karte.x, y: karte.y }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: karte.x, y: karte.y - 25 * i }] }); await p.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(600);
  r.senkrechtGescrollt = (await p.evaluate((s) => document.getElementById(s).scrollTop, schirm)) - vorher;
  await ctx.close();
  return r;
}
