/**
 * Pohánka & Társa — Teljes weboldal audit script
 * Playwright + Chrome DevTools: SEO, Performance, Accessibility, Network, Mobile
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE_URL = 'https://www.pohankaestarsa.com';
const PAGES = [
  { name: 'Főoldal', path: '/' },
  { name: 'Portfolio', path: '/portfolio' },
  { name: 'Szolgáltatások', path: '/szolgaltatasok' },
  { name: 'Kapcsolat', path: '/kapcsolat' },
];

async function auditPage(page, url, pageName) {
  const report = {
    url,
    pageName,
    consoleErrors: [],
    networkErrors: [],
    metaTags: {},
    headings: {},
    images: {},
    links: {},
    performance: {},
    accessibility: {},
    openGraph: {},
    structuredData: [],
    loadTime: 0,
  };

  page.on('console', msg => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });

  const networkErrors = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({ url: response.url(), status: response.status() });
    }
  });

  const startTime = Date.now();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  report.loadTime = Date.now() - startTime;
  report.networkErrors = networkErrors;

  report.metaTags = await page.evaluate(() => {
    const get = (sel) => document.querySelector(sel)?.getAttribute('content') || null;
    const getAttr = (sel, attr) => document.querySelector(sel)?.getAttribute(attr) || null;
    return {
      title: document.title,
      titleLength: document.title.length,
      description: get('meta[name="description"]'),
      descriptionLength: get('meta[name="description"]')?.length || 0,
      robots: get('meta[name="robots"]'),
      canonical: getAttr('link[rel="canonical"]', 'href'),
      viewport: get('meta[name="viewport"]'),
      lang: document.documentElement.lang,
      themeColor: get('meta[name="theme-color"]'),
    };
  });

  report.openGraph = await page.evaluate(() => {
    const og = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(m => {
      og[m.getAttribute('property')] = m.getAttribute('content');
    });
    document.querySelectorAll('meta[name^="twitter:"]').forEach(m => {
      og[m.getAttribute('name')] = m.getAttribute('content');
    });
    return og;
  });

  report.structuredData = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return Array.from(scripts).map(s => {
      try { return JSON.parse(s.textContent); } catch { return 'parse error'; }
    });
  });

  report.headings = await page.evaluate(() => {
    const result = {};
    for (let i = 1; i <= 6; i++) {
      const elements = document.querySelectorAll('h' + i);
      result['h' + i] = {
        count: elements.length,
        texts: Array.from(elements).slice(0, 5).map(h => h.textContent.trim().slice(0, 80))
      };
    }
    return result;
  });

  report.images = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    const missing = [];
    const withAlt = [];
    imgs.forEach(img => {
      const src = img.src || img.getAttribute('src') || '';
      const alt = img.getAttribute('alt');
      if (!alt || alt.trim() === '') {
        missing.push(src.slice(-60));
      } else {
        withAlt.push({ src: src.slice(-60), alt: alt.slice(0, 50) });
      }
    });
    return {
      total: imgs.length,
      missingAlt: missing,
      withAltCount: withAlt.length,
      sample: withAlt.slice(0, 5),
    };
  });

  report.links = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href]');
    const internal = [], external = [], noText = [];
    links.forEach(a => {
      const href = a.href;
      const text = a.textContent.trim();
      if (!text && !a.querySelector('img')) noText.push(href.slice(0, 80));
      if (href.includes('pohankaestarsa.com') || href.startsWith('/')) {
        internal.push({ href: href.slice(0, 80), text: text.slice(0, 40) });
      } else if (href.startsWith('http')) {
        external.push({ href: href.slice(0, 80), text: text.slice(0, 40) });
      }
    });
    return { total: links.length, internalCount: internal.length, externalCount: external.length, noText: noText.slice(0, 5), externalLinks: external.slice(0, 10) };
  });

  report.performance = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find(p => p.name === 'first-contentful-paint');
    return {
      domContentLoaded: Math.round((nav && nav.domContentLoadedEventEnd - nav.fetchStart) || 0),
      loadComplete: Math.round((nav && nav.loadEventEnd - nav.fetchStart) || 0),
      ttfb: Math.round((nav && nav.responseStart - nav.fetchStart) || 0),
      fcp: Math.round((fcp && fcp.startTime) || 0),
      domInteractive: Math.round((nav && nav.domInteractive - nav.fetchStart) || 0),
      transferSize: Math.round((nav && nav.transferSize || 0) / 1024) + ' KB',
      decodedBodySize: Math.round((nav && nav.decodedBodySize || 0) / 1024) + ' KB',
      resourceCount: performance.getEntriesByType('resource').length,
    };
  });

  report.accessibility = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    const unlabeledInputs = [];
    inputs.forEach(function(input) {
      const id = input.id;
      const hasLabel = id && document.querySelector('label[for="' + id + '"]');
      const hasAriaLabel = input.getAttribute('aria-label');
      if (!hasLabel && !hasAriaLabel) {
        unlabeledInputs.push((input.type || input.tagName) + (input.placeholder ? '(' + input.placeholder + ')' : ''));
      }
    });
    const buttons = document.querySelectorAll('button');
    const emptyButtons = [];
    buttons.forEach(function(btn) {
      if (!btn.textContent.trim() && !btn.getAttribute('aria-label')) {
        emptyButtons.push(btn.className.slice(0, 60));
      }
    });
    return {
      unlabeledInputs: unlabeledInputs,
      emptyButtons: emptyButtons,
      focusableCount: document.querySelectorAll('a, button, input, select, textarea, [tabindex]').length,
      hasSkipLink: !!document.querySelector('a[href="#main"], a[href="#content"], [class*="skip"]'),
      hasMainLandmark: !!document.querySelector('main'),
      hasNavLandmark: !!document.querySelector('nav'),
      hasFooterLandmark: !!document.querySelector('footer'),
      hasHeaderLandmark: !!document.querySelector('header'),
    };
  });

  return report;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  console.log('=== POHÁNKA & TÁRSA — WEBOLDAL AUDIT ===\n');

  for (const pageConfig of PAGES) {
    const url = BASE_URL + pageConfig.path;
    console.log('\n--- ' + pageConfig.name + ' (' + url + ') ---');

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    try {
      const report = await auditPage(page, url, pageConfig.name);
      allResults.push(report);

      console.log('Betöltési idő: ' + report.loadTime + 'ms');
      console.log('TTFB: ' + report.performance.ttfb + 'ms | FCP: ' + report.performance.fcp + 'ms | Load: ' + report.performance.loadComplete + 'ms');
      console.log('Oldalméret: ' + report.performance.transferSize + ' (tömörítve) / ' + report.performance.decodedBodySize + ' (kicsomagolva)');
      console.log('Resource count: ' + report.performance.resourceCount);
      console.log('Title (' + report.metaTags.titleLength + ' kar): "' + report.metaTags.title + '"');
      console.log('Description (' + report.metaTags.descriptionLength + ' kar): ' + (report.metaTags.description ? '"' + report.metaTags.description.slice(0, 100) + '"' : 'HIÁNYZIK!'));
      console.log('Canonical: ' + (report.metaTags.canonical || 'HIÁNYZIK!'));
      console.log('Lang: ' + (report.metaTags.lang || 'HIÁNYZIK!'));
      console.log('Robots: ' + (report.metaTags.robots || 'nincs'));
      console.log('H1: ' + report.headings.h1.count + ', H2: ' + report.headings.h2.count + ', H3: ' + report.headings.h3.count);
      console.log('H1 szöveg: ' + (report.headings.h1.texts.join(' | ') || 'nincs'));
      console.log('Képek: ' + report.images.total + ' db | Alt nélkül: ' + report.images.missingAlt.length);
      if (report.images.missingAlt.length > 0) {
        console.log('  Alt nelkuli kepek: ' + report.images.missingAlt.join(', '));
      }
      console.log('JSON-LD: ' + report.structuredData.length + ' db');
      console.log('OG tagek: ' + Object.keys(report.openGraph).join(', '));
      console.log('Console hibak: ' + report.consoleErrors.length);
      if (report.consoleErrors.length > 0) {
        report.consoleErrors.forEach(function(e) { console.log('  HIBA: ' + e.slice(0, 120)); });
      }
      console.log('Halozati hibak: ' + report.networkErrors.length);
      if (report.networkErrors.length > 0) {
        report.networkErrors.forEach(function(e) { console.log('  ' + e.status + ': ' + e.url.slice(-80)); });
      }
      console.log('Skip link: ' + (report.accessibility.hasSkipLink ? 'VAN' : 'NINCS'));
      console.log('Label nelkuli inputok: ' + report.accessibility.unlabeledInputs.join(', '));
      console.log('Ures gombok: ' + report.accessibility.emptyButtons.length);
      console.log('Kulso linkek: ' + report.links.externalLinks.map(function(l) { return l.href; }).join(', '));
    } catch (err) {
      console.log('HIBA: ' + err.message);
    }

    await context.close();
  }

  fs.writeFileSync('f:/mcp-brunella-core/temp/audit-results.json', JSON.stringify(allResults, null, 2));
  console.log('\n\nKesz! JSON mentve: temp/audit-results.json');

  await browser.close();
}

main().catch(function(err) { console.error(err); });
