# Cloudflare Edge Browser Orchestration

Ez a dokumentum a Brunella Cloudflare-alapú browser orchestration mintáját írja le.

## Cél

A Browser Copilot és a Robotkez/harvest rétegek ugyanazt a browser workfow-t tudják használni:

- a browser endpoint lehet Cloudflare tunnel vagy helyi Chrome ACP/CDP végpont,
- a végrehajtási terv JSON-ban visszaadható,
- a Cloudflare Browser Rendering REST API külön rétegként ad screenshot/content/snapshot támogatást,
- a diagnosztikai információk külön csatornán elérhetők.

## Endpoint-felbontás

A Browser Copilot a következő prioritással választ browser végpontot:

1. `CLOUDFLARE_TUNNEL_BROWSER_URL`
2. `CHROME_ACP_URL`
3. `BROWSER_ACP_URL`
4. `http://localhost:9315`

A kiválasztott érték a session state-ben is megjelenik `browserEndpoint` mezőként, így a dashboard és a CLI is látja, hogy melyik browser oldali célpont aktív.

## n8n / HTTP indítási contract

Ajánlott hívási minta:

```http
POST /api/v1/browser-copilot/session/configure
Content-Type: application/json

{
  "mode": "guide",
  "enginePreference": "chrome-acp",
  "overlayEnabled": true
}
```

Ezután a workflow vagy a dashboard elküldheti az instrukciót:

```http
POST /api/v1/browser-copilot/message
Content-Type: application/json

{
  "instruction": "Nyisd meg az oldalt, majd készíts rövid összefoglalót."
}
```

## Robotkez / harvest contract

Az agent oldali browser futtatásnak két fő útja van:

- `RobotkezV2Agent` – interaktív, lépésenkénti böngésző automatizálás
- `CloudflareBrowserAPI` – renderelt oldal tartalom, screenshot, markdown, snapshot, json és links lekérése

A Cloudflare REST API különösen hasznos azokra a feladatokra, ahol nem kell teljes interaktív böngészőállapot, csak stabilan visszaadott strukturált eredmény.

## Diagnosztika

A trackhez kapcsolódó observability nyomok:

- `browserEndpoint` – melyik browser végpont az aktív
- `browser-copilot:update` socket esemény – session state frissítés
- `robotkez:plan` és `robotkez:step` socket események – végrehajtási terv és lépéskövetés
- `/api/cloudflare/config` – Cloudflare tunnel és browser endpoint állapot

## E2E validáció

Javasolt ellenőrzések:

```bash
npm run build
npx vitest run test/browserCopilotSessionService.test.ts
npx vitest run test/browserCopilotCommands.test.ts
npx vitest run test/browser_rendering.test.ts
npx vitest run test/cloudflareBrowser.test.ts
```

Ha a Browser Copilot session státuszában megjelenik a resolved endpoint, és a Robotkez a megfelelő engine-re tud váltani, a track edge-browser része késznek tekinthető.
