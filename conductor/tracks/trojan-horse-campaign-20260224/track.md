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

### Fázis 4: Email küldés + követés ⏳
- [ ] 14. Email küldés: 2026-02-26 reggel 10:00h (csúcsidő!) 🕘
- [ ] 15. Response tracking (7 nap monitoring)
- [ ] 16. Google Sheet frissítése: +2 új ügynökség

## 📊 Állapot

- **Státusz:** ACTIVE — 100% KÜLDÉSRE KÉSZ ✅
- **Fázis:** Lead Intelligence Worker éles + 10 email piszkozat kész
- **Worker URL:** https://brunella-lead-intelligence.iam-dd1.workers.dev
- **Következő:** 2026-02-26 10:00 → Gmail → Piszkozatok → Mind kiküld
- **Auto-kutatás:** Minden nap 02:00 (kozmetika, fitness, fogorvos → D1)
