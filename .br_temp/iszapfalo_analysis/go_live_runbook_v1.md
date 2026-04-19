# Iszapfaló Go-Live Runbook v1

Dátum: 2026-03-18
Cél: 60-90 perces kontrollált élesítési forgatókönyv.

## T-0: Biztonság és backup (10 perc)
1. n8n teljes backup/export.
2. Airtable key rotáció (ha korábban hardcoded volt).
3. Credential inventory ellenőrzés:
   - telegramApi
   - airtableTokenApi
   - anthropicApi
   - gmailOAuth2
   - googleCalendarOAuth2Api
   - googleDriveOAuth2Api
   - openAiApi

## T+10: Import sorrend (25 perc)
1. Error Monitoring
2. Gmail kategorizáló
3. AI Agent Asszisztens v2
4. Telegram parancsok (/statusz, /het)
5. Géppark karbantartás
6. Heti emlékeztető

## T+35: Konfiguráció (15 perc)
1. Minden workflow-ban Base ID: appU3xQMuAmpmmCEy.
2. `/statusz` és `/het` dátumformulák:
   - Mai: `IS_SAME({Dátum}, TODAY(), 'day')`
   - Heti: `IS_AFTER({Dátum}, DATEADD(TODAY(), -7, 'days'))`
3. Airtable táblák létezése:
   - MUNKAK
   - KOLTSEGEK
   - SZABADSAGOK
   - Munkaidő Nyilvántartás

## T+50: Acceptance teszt (20 perc)
1. Telegram: "Kezdem a munkát" -> munkaidő rekord létrejön.
2. Telegram: "5000 Ft üzemanyag" -> költség rekord létrejön.
3. Telegram: `/statusz` -> napi visszajelzés.
4. Telegram: `/het` -> heti összesítés.
5. Gmail teszt -> kategorizáló + Airtable nyom rögzül.
6. Kényszerített hiba -> Error Monitoring jelzés/napló.

## T+70: Stabilizáció (10 perc)
1. Aktiválási állapotok ellenőrzése (csak szükséges workflow-k active).
2. n8n execution log gyors áttekintés (nincs ismétlődő kritikus hiba).
3. Rövid státuszjelentés: PASS / FAIL + blokkoló okok.

## Rollback trigger
Azonnali rollback, ha:
- 2+ kritikus workflow fail 10 percen belül,
- Telegram parancsok nem adnak érvényes választ,
- Gmail kategorizáló ismét parser/model hibába esik.

Rollback lépés:
- import előtti backup visszatöltés,
- csak Error Monitoring maradjon aktív,
- újraindítás kontrollált körben.
