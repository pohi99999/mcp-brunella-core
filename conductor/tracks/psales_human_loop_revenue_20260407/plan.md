# Plan — P-Sales Human-in-Loop Revenue Pipeline

## Stratégiai döntés

A két SEL dokumentum összehasonlítása után a **leggyorsabb bevétel** útja:
1. **LinkedIn + Malt KKV outreach** (azonnali, meglévő szövegekkel)
2. **Brand Accelerator STARTER pilot** (1-2 hetes zárás, Varga Viktória case study-val)

Mindkettőhöz **kritikus előfeltétel**: a P-Sales Human-in-Loop Pipeline el kell készülnie, különben a jogi kockázat és a márkakár elfogadhatatlan.

---

## Fázis 1 — Human-in-Loop safety gate (KRITIKUS BLOKKOLÓ)

### Teendők
- [ ] `POST /api/v1/webhook/onboarding-intake` endpoint létrehozása a Brunella szerverben
  - Fogadja a Typeform/Google Form webhookot
  - Elindítja a megfelelő Brunella agent pipeline-t (KKV vs Brand routing)
  - Visszaad `{ status: "ok", job_id: "..." }`
- [ ] P-Sales jóváhagyási kapu n8n node-ban: minden outreach üzenet "PENDING_APPROVAL" státuszba kerül, ki KELL hagyni
- [ ] `.env` kibővítés: `BRUNELLA_WEBHOOK_SECRET`, `APIFY_API_TOKEN`, `LEADS_SHEET_ID`

### Delegálás
- **`bas-lead-developer`** → webhook endpoint TypeScript implementáció
- **`bas-automation-architect`** → n8n jóváhagyási logika

### Elfogadás
- Teszt form beküldés → Brunella fogadja → agent elindul → email érkezik → jóváhagyás nélkül semmi nem megy ki

---

## Fázis 2 — Apify integráció + lead scraping

### Teendők
- [ ] Apify account létrehozás (pohanka@pohankaestarsa.com)
- [ ] `APIFY_API_TOKEN` beírása `.env`-be
- [ ] `ApifyScraping` agent tesztelése: KKV célcsoport (Zala/Vas/Győr megye, ügyvezető, 10-100 fő)
- [ ] `ApifyScraping` agent tesztelése: Brand célcsoport (Instagram hashtag scraping: #magyardesign, #kézművesdivat)
- [ ] Első 25+25 lead exportálása → Google Sheets-be

### Scraping konfig (KKV)
```json
{ "platform": "linkedin", "query": "ügyvezető Zala megye 10-100 fő", "max": 25 }
```

### Scraping konfig (Brand)
```json
{
  "platform": "instagram",
  "hashtags": ["magyardesign", "kézművesdivat", "slowfashionhungary", "magyardivat"],
  "filters": { "min_followers": 2000, "max_followers": 80000, "bio_keywords": ["alapító","tervező"] },
  "max_results": 25
}
```

### Elfogadás
- 50 sor Google Sheets-ben (25 KKV, 25 Brand), minden sorban: cégnév, kontakt, iparág, icebreaker draft

---

## Fázis 3 — n8n intake workflow beüzemelés

### Teendők
- [ ] KKV onboarding n8n workflow JSON importálása (a sel.md-ből kész)
- [ ] Brand onboarding n8n workflow JSON importálása (a sel.md-ből kész)
- [ ] Gmail node OAuth hitelesítés
- [ ] Google Sheets node hitelesítés
- [ ] Cloudflare Tunnel publikus URL → Typeform webhook-ba
- [ ] Teszt beküldés mindkét kérdőívvel

### Környezeti változók
```env
N8N_BASE_URL=http://localhost:5678
BRUNELLA_WEBHOOK_SECRET=brunella_secret_min32karakter
LEADS_SHEET_ID=<Google Sheets ID>
TYPEFORM_SECRET=<Typeform webhook secret>
```

### Elfogadás
- Form beküldés → n8n fogad → Brunella agent trigger → email neked + ügyfélnek + Sheets sor

---

## Fázis 4 — LinkedIn + Upwork piaci megjelenés

### Teendők
- [ ] LinkedIn Headline beillesztése (sel.md-ből kész szöveg)
- [ ] LinkedIn About szekció beillesztése (sel.md-ből kész szöveg)
- [ ] LinkedIn connection request + follow-up sablon beállítása
- [ ] Upwork Agency profil létrehozása: "Pohánka AI — Business Automation Agency"
- [ ] Upwork profil Overview szöveg megírása (sel.md séma alapján: számok, eredmény, garancia, portfolio)
- [ ] pohankaestarsa.com-on "Csomagok" szekció frissítése mindkét csomag-struktúrával

### Elfogadás
- LinkedIn profil live, Upwork profil submitted
- pohankaestarsa.com-on látható a KKV és Brand csomag

---

## Fázis 5 — Kérdőívek + CRM tracker

### Teendők
- [ ] Prémium Brand Typeform (15 kérdés) — sel.md-ből kész
- [ ] KKV Általános Typeform (15 kérdés) — sel.md-ből kész
- [ ] Google Sheets: KKV_Leads lap (oszlopok: timestamp, cégnév, email, iparág, probléma, heti_orak, csomag, státusz)
- [ ] Google Sheets: Brand_Leads lap (oszlopok: timestamp, márka, email, instagram, pilot_termek, heti_orak, csomag, státusz)

---

## Fázis 6 — Brand Accelerator termékesítés

### Teendők
- [ ] Case Study PDF véglegesítése (Varga Viktória — sel.md-ből kész sablon)
- [ ] Brand Accelerator 3 csomag árlista PDF (sel.md-ből kész)
- [ ] STARTER pilot onboarding SOP dokumentum (sel.md-ből kész, PDF-be kell szedni)
- [ ] Kickoff call agenda sablon (sel.md-ből kész)
- [ ] 30 napos záró meeting agenda sablon

---

## Fázis 7 — Pilot kampány indítás

### Teendők
- [ ] Első 5 KKV lead: manuális LinkedIn connection request (sel.md sablon alapján)
- [ ] Első 5 Brand lead: manuális Instagram DM (sel.md sablon alapján)
- [ ] Minden üzenet human jóváhagyással (Fázis 1 gate kötelező!)
- [ ] Eredmény mérés: válaszarány, meeting arány

### Siker kritérium
- Min. 1 booking 30 napon belül

---

## Kockázatok

| Kockázat | Valószínűség | Kezelés |
|---|---|---|
| LinkedIn scraping tiltás | MAGAS | Apify residential proxy + alacsony rate, GDPR comply |
| Fázis 1 nélküli indítás | KRITIKUS | Blokkoló — tilos kihagyni |
| Apify token nincs | KÖZEPES | Ingyenes tier elegendő az első 50 leadhez |
| Varga Viktória case study publikus? | ALACSONY | Névtelenítés opció ("egy prémium divatmárka") |

---

## Azonnali következő 3 lépés

1. **MA**: Fázis 1 — webhook endpoint + human-in-loop gate (delegálás: `bas-lead-developer`)
2. **HOLNAP**: Apify account + `.env` + első 25 KKV lead teszt
3. **3. NAP**: n8n workflow import + Gmail/Sheets hitelesítés

---

## Hivatkozások

- `sel.md` — `.worktrees/sel.md` (1827 sor, Perplexity AI stratégiai conversation)
- `sel2.md` — `.worktrees/sel2.md` (478 sor, KKV lead-gen monetizáció)
- P-Sales20260327 — `completed`, ingatlanplatform (különálló, nem releváns)
- `registry.json` — SalesHunterAgent, LeadMiningAgent, CampaignGeneratorAgent, ApifyScraping, copywriter ✅

---

## Munkamenet állapot — 2026-04-07

### Elkészült
- A `/api/v1/webhook/onboarding-intake` endpoint és a route mount kész.
- A KKV és Brand n8n workflow JSON-ok lokálisan importálva vannak.
- A `docker-compose.yml` átadja a `LEADS_SHEET_ID` értéket az n8n sandboxnak.
- Az `onboarding_forms_spec.json` elkészült a későbbi form builderhez.

### Hol hagytuk abba
- A `GOOGLE_PLACES_API_KEY` még hiányzik, ezért a Cloudflare secret lépés maradt.
- A végleges Tally/Typeform builder kiválasztása még külső kézi lépés.
- Az `APIFY_API_TOKEN` egységesítése és a további scraping finomhangolás külön kör.

### Következő lépés
- add meg a Google Places secretet,
- döntsd el a végleges form providert,
- és ha kell, folytatjuk a LinkedIn/Upwork csatornákkal.
