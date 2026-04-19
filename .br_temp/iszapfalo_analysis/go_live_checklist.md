# Iszapfaló Go-Live Import & Teszt Checklist

## A) Előkészítés
- [ ] n8n backup/export készítve a jelenlegi állapotról
- [ ] Airtable Base ID validálva minden importálandó workflow-ban: `appU3xQMuAmpmmCEy`
- [ ] Credential inventory rendelkezésre áll (Telegram, Airtable, Anthropic, OpenAI, Google Calendar, Gmail, Google Drive)
- [ ] Hardcoded kulcsok eltávolítva script-ekből (env változókra áttéve)

## B) Import sorrend (kanonikus)
- [ ] `error_monitoring_logging` → import from: `IMPORTRA_KESZ\Iszapfalo - Error Monitoring es Logging.json`
- [ ] `gmail_kategorizalo` → import from: `IMPORTRA_KESZ\Gmail kategorizáló.json`
- [ ] `ai_agent_asszisztens_v2` → import from: `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - AI Agent Asszisztens (v2 - Javított).json`
- [ ] `telegram_parancsok` → import from: `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Telegram Parancsok (_statusz, _het).json`
- [ ] `geppark_karbantartas` → import from: `IMPORTRA_KESZ\Iszapfalo - Geppark Karbantartas (All-in-One).json`
- [ ] `heti_emlekezteto` → import from: `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Heti Emlékeztető (Csütörtök 16_00).json`

## C) Kötelező post-import validáció
- [ ] Workflow név, active state és trigger helyes
- [ ] Minden node credential hozzárendelve
- [ ] Airtable táblák léteznek: MUNKAK, KOLTSEGEK, SZABADSAGOK, Munkaidő Nyilvántartás
- [ ] Telegram `/statusz` és `/het` dátumszűrők ellenőrizve
- [ ] Gmail kategorizáló parser/model binding hibamentes

## D) Acceptance tesztek
- [ ] Telegram: 'Kezdem a munkát' → munkaidő rekord létrejön
- [ ] Telegram: '5000 Ft üzemanyag' → költség rekord létrejön
- [ ] `/statusz` → napi adat visszajön
- [ ] `/het` → heti összegzés visszajön
- [ ] Gmail tesztmail feldolgozása és Airtable lekövetése
- [ ] Error monitoring riasztás tesztelve