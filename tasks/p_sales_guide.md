# P-Sales Human-in-Loop Revenue Pipeline — Használati Útmutató

Ez a dokumentum összefoglalja a P-Sales projekt 85%-os készültségi állapotát és a használat lépéseit.

---

## 1. Technikai Összetevők (Mi készült el?)

### ✅ Webhook Intake Endpoint
- **URL:** `http://localhost:3000/api/v1/webhook/onboarding-intake`
- **Védelem:** HMAC Token (`X-Brunella-Token` fejléc)
- **Funkció:** Fogadja a külső űrlapok (Typeform/Tally) adatait, és `pending_approval` állapotú jobokat hoz létre a Dashboardon.

### ✅ Lead Mining Agent (Kiterjesztve)
- **Képességek:** LinkedIn scraping (Apify), Weboldal elemzés (Researcher), Email validáció.
- **CRM Szinkron:** Automatikus mentés Google Sheets-be a `KKV_Leads` és `Brand_Leads` fülekre.

### ✅ Outreach Sablonok
- **Helyszín:** `src/config/outreachTemplates.ts`
- **Tartalom:** Professzionális LinkedIn és Email szövegek KKV és Prémium Márka kategóriákra.

---

## 2. Lépésről Lépésre Útmutató

### 1. Lépés: n8n Workflow Importálása
1. Nyisd meg az n8n felületét.
2. Importáld a `n8n/workflows/psales_onboarding_intake.json` fájlt.
3. Állítsd be a `Brunella Header Auth` hitelesítést a `.env`-ben található titkos kulccsal.

### 2. Lépés: LinkedIn Profil Frissítése
1. Másold ki a szövegeket a `tasks/linkedin_profile_texts.md` fájlból.
2. Frissítsd a Headline-t és az About szekciót a LinkedIn profilodon.

### 3. Lépés: A Pilot Kampány Indítása
Futtasd a következő parancsot az első 25-25 éles lead begyűjtéséhez:
```bash
npx tsx scripts/launch_p_sales_pilot.ts
```
*Az ágens automatikusan elvégzi a scrapinget, az elemzést és a Sheets szinkront.*

### 4. Lépés: Jóváhagyás (Human-in-Loop)
1. Nyisd meg a Brunella Dashboardot.
2. A "Pending Approvals" szekcióban látni fogod a beérkező leadeket.
3. Hagyd jóvá azokat, akiknek ki szeretnéd küldeni az üzenetet.

---

## 3. Fontos Fájlok Listája
- `scripts/launch_p_sales_pilot.ts` — Kampányindító
- `n8n/workflows/psales_onboarding_intake.json` — n8n workflow
- `src/config/outreachTemplates.ts` — Üzenet sablonok
- `tasks/linkedin_profile_texts.md` — LinkedIn szövegek
- `tasks/case_study_varga_viktoria.md` — Case Study anyag

---
*Generálva: 2026. április 12. — Brunella Agent System*
