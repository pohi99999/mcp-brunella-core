# 🔧 Gap Analízis + Megoldási Terv
## P-Sales Human-Loop Revenue Track
_Generálva: 2026-04-07_

---

## 🔴 KRITIKUS BUGOK (azonnal javítandó)

### BUG-1: APIFY_TOKEN vs APIFY_API_TOKEN névütközés ✅ JAVÍTVA

**Probléma volt:** `ApifyScrapingAgent.ts` csak `APIFY_API_TOKEN`-t kereste, de `.env`-ben `APIFY_TOKEN` van.

**Alkalmazott megoldás:** `ApifyScrapingAgent.ts` line 159 módosítva:
```ts
// Előtte:
const token = process.env.APIFY_API_TOKEN;
// Utána:
const token = process.env.APIFY_API_TOKEN ?? process.env.APIFY_TOKEN;
```
Build: ✅ `npm run build` sikeres (2026-04-07)

---

### BUG-2: BRUNELLA_WEBHOOK_SECRET hiányzik ✅ JAVÍTVA

**Megoldva:** `.env`-be hozzáadva `BRUNELLA_WEBHOOK_SECRET=bas_wh_..._2026` (2026-04-07)
Elhelyezés: GITHUB_WEBHOOK_SECRET után, ugyanabban a szekcióban.

---

## 🟡 KÖZÉPTÁVÚ FELADATOK

### GAP-1: n8n Intake Workflow-ok importálása

**Hiány:** 2 db n8n workflow JSON kész a sel.md-ben, de nem importálva.
**Megoldás:**
1. `n8n-bas.trycloudflare.com` tunnel aktiválása VAGY `localhost:5678`
2. n8n UI → Import → JSON paste (sel.md-ből kimásolni)
3. Google Sheets credential konfigurálás n8n-ben
4. Test futtatás

**Felelős:** `bas-automation-architect`

---

### GAP-2: Cloudflare Lead Intelligence Worker konfigurálás

**Az infrastruktúra KÉSZ** — csak a Google Places API kulcs hiányzik:
```bash
cd cloudflare
wrangler secret put GOOGLE_PLACES_API_KEY --config wrangler.lead-intelligence.jsonc
# → Enter: [Google Cloud Console-ból Places API key]
```

**Ha nincs Google Places kulcs:** A Worker mock adatokkal is működik teszteléshez!

**Felelős:** `DevOps`

---

### GAP-3: Onboarding Form (Typeform alternatíva)

**Probléma:** Typeform fizetős, nincs API kulcs `.env`-ben.

**Ajánlott alternatíva: Tally.so**
- Ingyenes, korlátlan submission
- Webhook/Zapier/n8n integráció
- Typeform-szerű UX
- HTTPS: tally.so/r/[form-id]

**Cloudflare Workers alternatíva (legbiztonságosabb):**
- Új Worker: `brunella-onboarding-form`
- HTML form + Workers KV tárolás
- Saját domain: `form.peterpohanka.com` (Cloudflare Tunnel)
- NINCS külső függőség!

**Felelős:** `bas-web-architect` → implementálandó

---

### GAP-4: Human-in-Loop Approval Gate

**Ez a FÁZIS 1 BLOKKOLÓ** — semmi nem mehet ki jóváhagyás nélkül.

**Architektúra:**
```
Typeform/Tally.so form
    ↓ webhook
n8n workflow
    ↓
Brunella review queue (SQLite jobs tábla)
    ↓
Dashboard jóváhagyás gomb
    ↓ (approved)
outreach küldés (Email/LinkedIn)
```

**Szükséges implementáció:**
1. `POST /api/v1/webhook/onboarding-intake` route (TypeScript)
2. n8n jóváhagyási logic
3. Dashboard review panel (ha még nincs)

**Felelős:** `bas-lead-developer` (endpoint) + `bas-automation-architect` (n8n)

---

## 🟢 OPCIONÁLIS / ALACSONY PRIORITÁS

### GAP-5: LinkedIn scraping (GDPR/TOS kockázat)

**Probléma:** LinkedIn direkt scraping TOS sérti.
**Megoldás prioritás sorban:**
1. ✅ **Apollo.io** (freemium, GDPR-compliant, 50 lead/hó ingyen)
2. ✅ **PhantomBuster** (LinkedIn automation, $56/hó)
3. ✅ **Google Places API** (KKV-khoz tökéletes, TOS-safe)
4. ⚠️ **Apify LinkedIn actor** (csak nagyon óvatosan, residential proxy)

**Javasolt út:** Apollo.io API kulcs szerzés → `.env`-be `APOLLO_IO_API_KEY`

---

### GAP-6: Instagram Brand scraping

**sel.md config:** hashtag-alapú (#magyardesign, #kézművesdivat), 2K-80K follower szűrő

**Apify Instagram Scraper:**
```json
{
  "actorId": "apify/instagram-hashtag-scraper",
  "input": {
    "hashtags": ["magyardesign", "kezmuvesdivat", "handmade_hungary"],
    "resultsLimit": 100,
    "proxy": { "useApifyProxy": true, "apifyProxyGroups": ["RESIDENTIAL"] }
  }
}
```

**GDPR megjegyzés:** Csak publikus profilok, B2C nem közvetlen marketing → relatíve biztonságos

---

## ÖSSZEFOGLALÓ AKCIÓ LISTA

| # | Feladat | Prioritás | Felelős | Becsült effort |
|---|---|---|---|---|
| 1 | APIFY_TOKEN → APIFY_API_TOKEN alias `.env`-be | 🔴 Azonnal | orchestrator | 2 perc |
| 2 | BRUNELLA_WEBHOOK_SECRET generálás + `.env` | 🔴 Azonnal | orchestrator | 5 perc |
| 3 | `POST /api/v1/webhook/onboarding-intake` endpoint | 🔴 Fázis 1 | bas-lead-developer | 2 óra |
| 4 | Google Places API key → wrangler secret | 🟡 Magas | DevOps | 15 perc |
| 5 | n8n KKV + Brand intake workflow import | 🟡 Magas | bas-automation-architect | 1 óra |
| 6 | Tally.so / CF Workers form létrehozás | 🟡 Magas | bas-web-architect | 3 óra |
| 7 | Human-in-loop approval n8n flow | 🟡 Magas | bas-automation-architect | 2 óra |
| 8 | Apify Instagram scraper konfig tesztelés | 🟢 Közepes | bas-lead-developer | 1 óra |
| 9 | Apollo.io API kulcs szerzés + integráció | 🟢 Közepes | DigitalHeadhunter | 2 óra |
| 10 | LinkedIn / Upwork profil manuális létrehozás | 🟢 Manuális | Pohánka Péter | 3 óra |
