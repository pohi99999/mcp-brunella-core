# Iszapfaló Canonical Release Map v2 (tisztított)

Dátum: 2026-03-18
Cél: egyértelmű importforrás kijelölése, duplikációk megszüntetése.

## 1) PRODUCTION CORE (ezt élesítsük)

| # | Canonical workflow | Választott forrásfájl | Miért ez? | Kötelező credential-ek |
|---|---|---|---|---|
| 1 | Error Monitoring & Logging | `IMPORTRA_KESZ\Iszapfalo - Error Monitoring es Logging.json` | különálló, modern trigger mix, SOS prioritás | airtableTokenApi, anthropicApi, telegramApi (+ opcionális googleCalendarOAuth2Api) |
| 2 | Gmail kategorizáló | `IMPORTRA_KESZ\Gmail kategorizáló.json` | legfrissebb, legtöbb node (40), javított ágak | gmailOAuth2, anthropicApi, airtableTokenApi, telegramApi |
| 3 | AI Agent Asszisztens v2 | `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\02_ai_agent_asszisztens_v2_javitott.json` | import-ready + stabil 10 node-os csomag | telegramApi, airtableTokenApi, anthropicApi, googleCalendarOAuth2Api |
| 4 | Telegram parancsok (/statusz,/het) | `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\06_telegram_parancsok_statusz_het.json` | import-ready + célzott funkció | telegramApi, airtableTokenApi |
| 5 | Géppark karbantartás (All-in-One) | `IMPORTRA_KESZ\Iszapfalo - Geppark Karbantartas (All-in-One).json` | külön webhookos modul, egyszerű élesítés | openAiApi, telegramApi |
| 6 | Heti emlékeztető (csütörtök 16:00) | `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\05_heti_emlekezteto_csutortok_1600.json` | import-ready, tiszta cron modul | airtableTokenApi, telegramApi |

## 2) OPTIONAL / SECOND WAVE (nem blokkere az indulásnak)

| Workflow | Fájl |
|---|---|
| Airtable → Google Calendar feladat készítő | `...\IMPORT_READY_PACK_2026_03_13 n8n workflow\03_airtable_google_calendar_feladat_keszito.json` |
| Google Calendar → Airtable szinkron | `...\IMPORT_READY_PACK_2026_03_13 n8n workflow\04_google_calendar_airtable_szinkron.json` |
| Kimenő ajánlatok/dokumentumok | `...\IMPORT_READY_PACK_2026_03_13 n8n workflow\08_kimeno_ajanlatok_dokumentumok.json` |
| Telegram hangvezérlés | `...\IMPORT_READY_PACK_2026_03_13 n8n workflow\07_telegram_hangvezerles_teljes_rendszer.json` |

## 3) NE IMPORTÁLD (archív/prototípus)

- `...\mi csináltuk workflow\pohi-workflows\I_p5deBtbiA0eU6PMBDZY-My_workflow.json`
- `...\mi csináltuk workflow\pohi-workflows\ztb2UOnE25b5aLQu-AI_Agent_workflow.json`
- Nem kanonikus duplikátumok a `1. Legfontosabb...` és `IMPLEMENTED_2026_03_13` mappában, ha már import-ready megfelelő párjuk kiválasztva.

## 4) Döntési szabály (végleges)

1. Elsőbbség: `IMPORT_READY_PACK_2026_03_13`
2. Ha nincs ott: `IMPORTRA_KESZ`
3. Ha ott sincs: `IMPLEMENTED_2026_03_13`
4. A `1. Legfontosabb...` mappa csak referencia/forrás.

## 5) Kritikus biztonsági teendő indulás előtt

- `heti_kontextus_generator.py` hardcoded Airtable kulcsot tartalmaz.
- Teendő: API key azonnali rotáció + script env var alapra átállítása (`AIRTABLE_KEY`, `BASE_ID`).

## 6) Go/No-Go minimum feltétel

- [ ] Base ID minden workflow-ban: `appU3xQMuAmpmmCEy`
- [ ] Credential hozzárendelés minden node-ra kész
- [ ] Telegram tesztek PASS: "Kezdem a munkát", "5000 Ft üzemanyag", `/statusz`, `/het`
- [ ] Gmail kategorizáló parser/model hiba megszűnt
- [ ] Error monitoring riasztás működik
