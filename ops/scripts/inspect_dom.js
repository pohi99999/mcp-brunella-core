(async()=>{
  const { chromium } = await import('playwright');
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  try {
    p.on('console', msg => console.log('PAGE_CONSOLE', msg.type(), msg.text()));
    p.on('pageerror', err => console.log('PAGE_ERROR', err.stack || err.message || err));
    await p.addInitScript(() => {
      window.addEventListener('error', e => {
        try { console.log('WIN_ERROR', e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack); } catch (err) { console.log('WIN_ERROR_ERR', err && err.stack || err); }
      });
      window.addEventListener('unhandledrejection', e => { try { console.log('UNHANDLED_REJECTION', e.reason && (e.reason.stack || e.reason)); } catch (err) { console.log('UNHANDLED_REJECTION_ERR', err && err.stack || err); } });
    });
    p.on('requestfailed', req => console.log('REQUEST_FAILED', req.url(), req.failure() && req.failure().errorText));

    await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    const sidebar = await p.$('nav, aside');
    console.log('sidebar?', !!sidebar);
    const cards = await p.$$eval('main [class*="card"], main [class*="Card"], main [class*="widget"], [data-testid="widget-grid"]', els => els.length);
    console.log('cardsCount', cards);
    const tabs = await p.$$eval('aside button[aria-label]', els => els.length);
    console.log('asideButtons', tabs);
    const agentsText = await p.$('text=Agents');
    console.log('agentsTextPresent', !!agentsText);
    const filesText = await p.$('text=Files');
    console.log('filesTextPresent', !!filesText);
    const mainText = await p.textContent('main').catch(()=>null);
    console.log('mainTextLen', mainText?mainText.length:0);

    // Show network fetch errors via page.on
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await b.close();
  }
})();
