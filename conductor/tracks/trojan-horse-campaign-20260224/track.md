# Track: Trójai Faló B2B Kampány (2026-02-24)

## 🎯 Célkitűzés
Ingyen "minta" lead lista generálása (50 budapesti fogorvos) és kiküldése 10 marketing ügynökségnek a BAS rendszer validálása céljából.

## 📋 Feladatok

### Fázis 1: Minta leadek előkészítése ✅
- [x] 1. Környezet validálás (APIFY_TOKEN, Google Auth)
- [x] 2. Scrape: 50 budapesti fogorvos kigyűjtése (Apify) - SIKER
- [x] 3. Táblázat: Eredmények tisztítása és HTML riport generálása - SIKER
- [x] 4. Google Sheets feltöltés (Apps Script) - SIKER

### Fázis 2: Ügynökség outreach ✅
- [x] 5. Célpontok: 10 marketing ügynökség email címekkel (Gemini CLI) - SIKER
- [x] 6. Outreach email sablonok (10 személyre szabott) - SIKER
- [x] 7. Email piszkozatok elkészítve Gmailben (Gemini CLI, 10db) ✅

### Fázis 3: Lead Intelligence Automatizálás ✅ (2026-02-25)
- [x] 8. **Cloudflare Worker** - Lead Intelligence Worker deployed ✅
- [x] 9. **Google Places API** - Valódi lead kutatás beállítva ✅
- [x] 10. **D1 + KV Storage** - bas-metadata database csatolva ✅
- [x] 11. **Cron automatizálás** - Naponta 02:00 kutatás (kozmetika, fitness, fogorvos) ✅
- [x] 12. **Google Sheets sablon** - Unified dashboard (Leads + Outreach + Tracking) ✅
- [x] 13. **Teszt futtatás** - 30 valódi budapesti kozmetika lead (score 0-61) ✅

### Fázis 4: Email küldés + követés
- [x] 14. Email küldés: 2026-02-26 10:00h — **ELKÜLDVE ✅** (10 marketing ügynökség)
- [ ] 15. Response tracking (7 nap monitoring) — Határidő: 2026-03-05
- [ ] 16. Follow-up email ha 5 nap múlva csend: 2026-03-03

### Fázis 5: Wave 2 Bővítés ⏳ (2026-02-27)
- [ ] 17. Wave 2 email küldés: 2026-02-27 10:00 — 20 új célpont (webdesign + SEO + PR)
- [ ] 18. Worker bővítés deploy: ügyvéd + ingatlan + könyvelő iparágak ✅ (kód kész)
- [ ] 19. Worker deploy: vidéki városok (Debrecen, Miskolc, Pécs, Győr) ✅ (kód kész)
- [ ] 20. Wave 3 tervezés: ügyvéd/ingatlan leadek alapján (2026-03-01)

## 📊 Állapot

- **Státusz:** ACTIVE — Wave 2 tervezés folyamatban
- **Wave 1:** 10 marketing ügynökség ✅ elküldve 2026-02-26 10:00
- **Wave 2:** 20 webdesign/SEO/PR cég → küldés: 2026-02-27 10:00
- **Worker URL:** https://brunella-lead-intelligence.iam-dd1.workers.dev
- **Worker bővítve:** ügyvéd, ingatlan, könyvelő + Debrecen, Miskolc, Pécs, Győr
- **Auto-kutatás:** Minden nap 02:00 (~250 új lead/nap, 4 város, 6 iparág)
