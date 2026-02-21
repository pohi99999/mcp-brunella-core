# Spec: Cloudflare Browser Rendering — Robotkez Engine

**Track ID:** `cloudflare_browser_rendering_robotkez_20260221`

---

## Cloudflare Browser Rendering API

```
Wrangler binding: MY_BROWSER (browser type)
Package: @cloudflare/puppeteer
Limit (Paid): 6000 session/nap, max 2 párhuzamos session
CPU limit: 15 perc/request (Workers Paid)
```

### wrangler.toml bővítés

```toml
[[browser]]
binding = "MY_BROWSER"
```

### Worker endpoint spec

```
POST {CLOUDFLARE_WORKER_URL}/browser
Content-Type: application/json
X-Auth: {CF_WORKER_SECRET}

Request:
{
  "action": "navigate" | "click" | "type" | "screenshot" | "extract" | "close",
  "url": "https://...",       // navigate-hoz
  "selector": ".btn",         // click/type/extract-hez
  "text": "keresett szó",     // type-hoz
  "timeout": 10000            // opcionális ms
}

Response:
{
  "status": "success" | "error",
  "url": "https://...",        // navigate után aktuális URL
  "screenshot": "base64...",   // PNG screenshot
  "content": "...",            // extract után szöveg
  "message": "..."             // hiba esetén
}
```

### Consent kezelés a Worker-ben

```javascript
async function handleConsent(page) {
  // Google consent.google.com
  const texts = ['accept all', 'agree to all', 'elfogadom az összeset', 'elfogadom'];
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await btn.evaluate(el => el.innerText) || '').toLowerCase();
    if (texts.some(t => text.includes(t))) {
      await btn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
      return;
    }
  }
}
```

### Node.js BrowserEngine interfész

```typescript
// src/utils/browserEngine.ts
export interface BrowserEngine {
  sendCommand(cmd: BrowserCommand): Promise<BrowserResponse>;
}

// Implementációk:
// - PersistentBrowser (lokális Playwright)
// - CloudflareBrowser (CF Browser Rendering API)

// Env alapján választ:
export function getBrowserEngine(): BrowserEngine {
  return process.env.ROBOTKEZ_ENGINE === 'cloudflare'
    ? cloudflareBrowser
    : persistentBrowser;
}
```

### Env változók

```env
ROBOTKEZ_ENGINE=cloudflare        # 'cloudflare' | 'local'
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.iam-dd1.workers.dev
CF_WORKER_SECRET=...               # Worker auth secret
```

### Tesztelési mátrix

| Oldal | Consent típus | Várható viselkedés |
|-------|--------------|-------------------|
| google.com/search | consent.google.com | CF: nincs / Handled |
| willhaben.at | Usercentrics | CF: auto dismiss |
| autoscout24.at | GDPR popup | CF: auto dismiss |
| machineseeker.com | Cookie banner | CF: auto dismiss |
