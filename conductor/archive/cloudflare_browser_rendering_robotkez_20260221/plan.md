# Plan: Cloudflare Browser Rendering — Robotkez Engine

**Track ID:** `cloudflare_browser_rendering_robotkez_20260221`
**Prioritás:** HIGH
**Státusz:** ACTIVE
**Progress:** 0%

---

## Miért szükséges?

A lokális Playwright Google consent popup és bot detection problémákkal küzd.
Cloudflare Browser Rendering managed Chrome-ot biztosít — az oldaltulajdonosok nem tudják megkülönböztetni a valódi felhasználótól. Nincs consent háború, nincs /sorry oldal.

---

## Phase 1: CF Worker bővítése Browser Rendering API-val

### `bas-orchestrator` Worker módosítás (Wrangler)

```javascript
// wrangler.toml bővítés
[[browser]]
binding = "MY_BROWSER"

// Worker kód: /browser endpoint
export default {
  async fetch(request, env) {
    const { action, url, selector, text } = await request.json();
    const browser = await puppeteer.launch(env.MY_BROWSER);
    const page = await browser.newPage();

    if (action === 'navigate') {
      await page.goto(url, { waitUntil: 'networkidle0' });
      // Google consent kezelés
      await handleConsent(page);
      const screenshot = await page.screenshot({ encoding: 'base64' });
      await browser.close();
      return Response.json({ status: 'success', screenshot, url: page.url() });
    }
    // ... click, type, extract, screenshot
  }
}
```

**Cloudflare Puppeteer:** `import puppeteer from "@cloudflare/puppeteer"`

**Becslés:** ~2 óra

---

## Phase 2: CloudflareBrowser adapter Node.js-ben

### `src/utils/cloudflareBrowser.ts`

```typescript
export class CloudflareBrowser {
  private workerUrl = process.env.CLOUDFLARE_WORKER_URL;

  async sendCommand(cmd: BrowserCommand): Promise<BrowserResponse> {
    const res = await fetch(`${this.workerUrl}/browser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth': process.env.CF_WORKER_SECRET },
      body: JSON.stringify(cmd)
    });
    return res.json();
  }
}

export const cloudflareBrowser = new CloudflareBrowser();
```

### `src/utils/persistentBrowser.ts` bővítés

```typescript
// ROBOTKEZ_ENGINE=cloudflare → CloudflareBrowser
// ROBOTKEZ_ENGINE=local → PersistentBrowser (jelenlegi Playwright)
export async function getBrowserEngine(): Promise<BrowserEngine> {
  if (process.env.ROBOTKEZ_ENGINE === 'cloudflare') {
    return cloudflareBrowser;
  }
  return persistentBrowser;
}
```

**Becslés:** ~1.5 óra

---

## Phase 3: Tesztelés és Dashboard

### Consent tesztelés CF engine-nel

- Google search: consent popup megjelenik-e? (várhatóan nem)
- Willhaben.at: cookie banner kezelés
- AutoScout24: GDPR popup

### Dashboard badge

```tsx
// RobotkezPanel widget
<Badge color={engine === 'cloudflare' ? 'blue' : 'gray'}>
  {engine === 'cloudflare' ? '☁ CF Browser' : '🖥 Local'}
</Badge>
```

**Becslés:** ~1 óra

---

## Összesített TODO

```
[ ] 1. wrangler.toml: browser binding hozzáadása
[ ] 2. bas-orchestrator Worker: /browser endpoint
[ ] 3. wrangler deploy — CF Browser Rendering worker live
[ ] 4. src/utils/cloudflareBrowser.ts létrehozása
[ ] 5. src/utils/persistentBrowser.ts: engine selector
[ ] 6. .env: ROBOTKEZ_ENGINE=cloudflare
[ ] 7. Tesztelés: Google search consent nélkül ✓
[ ] 8. Dashboard: engine badge
[ ] 9. npm test — ALL GREEN
[ ] 10. meta.json: progress: 100, status: completed
```

---

## Kockázatok

| Kockázat | Megoldás |
|----------|----------|
| CF Browser Rendering quota (paid: 6000 session/nap) | EV Huntert lokálisan tartjuk, Robotkez CF-en |
| Worker CPU limit 15 perc (paid) | Elegendő böngésző feladatokhoz |
| Consent CF-en is megjelenik | Worker-ben handleConsent() implementálás |
| Wrangler deploy hiba | Lokális fallback automatikusan aktív |
