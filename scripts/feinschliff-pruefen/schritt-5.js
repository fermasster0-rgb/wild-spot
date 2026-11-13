async (page) => {
  const browser = page.context().browser();
  const SP = 'C:/Users/ferma/AppData/Local/Temp/claude/c69ec4d21e3ea372/17583e80-e64b-4452-9af9-7a48518bde3a/scratchpad/';
  const init = () => { try { localStorage.setItem('wildspot-intro-gesehen','ja'); localStorage.setItem('wildcamp-hinweis-gelesen','ja'); localStorage.setItem('wildspot-angebot-weg','9'); localStorage.setItem('wildspot-angebot-gross-weg','9'); localStorage.setItem('wildspot-angebot-gross-zuletzt', String(Date.now())); localStorage.setItem('wildspot-angebot-zuletzt', String(Date.now())); } catch(e){} };
  const sichtbar = (sel) => { const e = document.querySelector(sel); if (!e) return 'fehlt'; return !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); };
  const r = {};
  for (const thema of ['tag', 'nacht']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.addInitScript(init);
    await p.addInitScript((t) => { try { localStorage.setItem('wildspot-thema', t); } catch (e) {} }, thema);
    await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => { for (const x of await navigator.serviceWorker.getRegistrations()) await x.unregister(); for (const k of await caches.keys()) await caches.delete(k); });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(4000);
    const a = await p.evaluate((sichtbarSrc) => {
      const sichtbar = eval(sichtbarSrc);
      const k = document.getElementById('entdecken-karussell');
      const reihen = [...document.querySelectorAll('.ws-reihe')].map((x) => x.querySelectorAll('.ws-reihenkarte, .ws-wissen-karte').length);
      const suche = document.getElementById('entdecken-suche');
      return {
        karten: k ? k.querySelectorAll('.ws-hero').length : -1,
        reihen,
        sucheUeberKarussell: !!(k && suche && suche.getBoundingClientRect().bottom <= k.getBoundingClientRect().top),
        reiter: sichtbar('#entdecken-reiter'), heute: sichtbar('#entdecken-heute-block'),
        gipfel: sichtbar('#entdecken-gipfel-block'), kacheln: sichtbar('#entdecken-kacheln'),
        filter: sichtbar('#entdecken-filter'),
      };
    }, sichtbar.toString());
    await p.screenshot({ path: SP + 't5-start-' + thema + '.png' });
    await p.waitForTimeout(4600);
    a.scrollNach46 = await p.evaluate(() => { const k = document.getElementById('entdecken-karussell'); return k ? Math.round(k.scrollLeft) : -1; });
    if (thema === 'tag') {
      await p.evaluate(() => document.getElementById('schirm-entdecken').scrollTo(0, 700));
      await p.waitForTimeout(500);
      await p.screenshot({ path: SP + 't5-reihen.png' });
      const karte = await p.$('.ws-reihenkarte');
      if (karte) { await karte.click(); await p.waitForTimeout(900); }
      a.reihenkarteBlatt = await p.evaluate(() => document.getElementById('detail').className + '|' + !document.getElementById('detail').hidden);
      await p.click('#detail-zu').catch(() => {});
      await p.waitForTimeout(500);
      const w = await p.$('.ws-wissen-karte');
      if (w) { await w.click(); await p.waitForTimeout(500); }
      a.leseBlatt = await p.evaluate((s) => eval(s)('#lesen-blatt'), sichtbar.toString());
      await p.screenshot({ path: SP + 't5-lesen.png' });
      await p.click('#lesen-blatt-zu').catch(() => {});
      await p.waitForTimeout(400);
      a.leseBlattZu = await p.evaluate((s) => eval(s)('#lesen-blatt'), sichtbar.toString());
      await p.evaluate(() => WILDSPOT_BEREICH('karte'));
      await p.waitForTimeout(4600);
      a.timerAusserhalb = await p.evaluate(() => Math.round(document.getElementById('entdecken-karussell')?.scrollLeft ?? -1));
    }
    r[thema] = a;
    await ctx.close();
  }
  // Datenbank weg
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(init);
  await p.route('**/rest/v1/rpc/**', (x) => x.abort());
  await p.goto('http://127.0.0.1:5173/?los=entdecken', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(5000);
  r.ohneDb = await p.evaluate(() => ({ leer: !!document.querySelector('.ws-hero-leer'), reihen: document.querySelectorAll('.ws-reihe').length, karten: document.querySelectorAll('#entdecken-karussell .ws-hero').length }));
  await ctx.close();
  return r;
}
