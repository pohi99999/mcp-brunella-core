# Iszapfaló Canonical Release Map (workflow-konszolidáció)

## Döntési szabály
- Elsődleges jelölt: `IMPORT_READY_PACK_2026_03_13`
- Másodlagos: `IMPLEMENTED_2026_03_13 n8n workflow`
- Harmadlagos: `IMPORTRA_KESZ`
- Továbbiak: forrás / prototípus jelleg

## Kanonikus workflow lista

### 1. airtable_calendar_feladat
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\03_airtable_google_calendar_feladat_keszito.json`
- Nodes: 6 | Triggers: n8n-nodes-base.gmailTrigger
- Credentials: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api
- Alternative versions:
  - `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Airtable - Google Calendar feladat készítő.json` (nodes=6)
  - `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Airtable - Google Calendar feladat készítő.json` (nodes=6)

### 2. calendar_airtable_szinkron
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\04_google_calendar_airtable_szinkron.json`
- Nodes: 6 | Triggers: n8n-nodes-base.googleCalendarTrigger
- Credentials: airtableTokenApi, googleCalendarOAuth2Api
- Alternative versions:
  - `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Google Calendar → Airtable Szinkron.json` (nodes=6)

### 3. feladat_status_telegram
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\01_feladat_status_telegram_chat.json`
- Nodes: 20 | Triggers: n8n-nodes-base.scheduleTrigger, n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, anthropicApi
- Alternative versions:
  - `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Feladatok státuszállítás telegram chat.json` (nodes=20)
  - `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Feladatok státuszállítás telegram chat.json` (nodes=7)

### 4. iszapfaló - ai agent asszisztens v2
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\02_ai_agent_asszisztens_v2_javitott.json`
- Nodes: 10 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- Alternative versions: nincs

### 5. iszapfaló - heti emlékeztető
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\05_heti_emlekezteto_csutortok_1600.json`
- Nodes: 6 | Triggers: n8n-nodes-base.cron
- Credentials: airtableTokenApi
- Alternative versions: nincs

### 6. iszapfaló - telegram parancsok
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\06_telegram_parancsok_statusz_het.json`
- Nodes: 8 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, telegramApi
- Alternative versions: nincs

### 7. kimeno_ajanlatok_dokumentumok
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\08_kimeno_ajanlatok_dokumentumok.json`
- Nodes: 8 | Triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger
- Credentials: n/a
- Alternative versions:
  - `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Kimenő ajánlatok_dokumentumok.json` (nodes=8)
  - `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Kimenő ajánlatok_dokumentumok.json` (nodes=8)

### 8. telegram hangvezérlés - teljes rendszer
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\07_telegram_hangvezerles_teljes_rendszer.json`
- Nodes: 9 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, anthropicApi
- Alternative versions:
  - `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Telegram Hangvezérlés - Teljes Rendszer.json` (nodes=9)

### 9. ai_agent_asszisztens_v2
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - AI Agent Asszisztens (v2 - Javított).json`
- Nodes: 10 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- Alternative versions:
  - `IMPORTRA_KESZ\Iszapfalo - AI Agent Asszisztens (v2 - Javitott).json` (nodes=10)

### 10. heti_emlekezteto
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Heti Emlékeztető (Csütörtök 16_00).json`
- Nodes: 6 | Triggers: n8n-nodes-base.cron
- Credentials: airtableTokenApi
- Alternative versions:
  - `IMPORTRA_KESZ\Iszapfalo - Heti Emlekeztetö (Csütörtök 16.00).json` (nodes=6)

### 11. telegram_parancsok
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Telegram Parancsok (_statusz, _het).json`
- Nodes: 8 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, telegramApi
- Alternative versions:
  - `IMPORTRA_KESZ\Iszapfalo - Telegram Parancsok (statusz, het).json` (nodes=8)

### 12. error_monitoring_logging
- **Chosen path:** `IMPORTRA_KESZ\Iszapfalo - Error Monitoring es Logging.json`
- Nodes: 23 | Triggers: @n8n/n8n-nodes-langchain.chatTrigger, n8n-nodes-base.cron, n8n-nodes-base.respondToWebhook, n8n-nodes-base.telegramTrigger, n8n-nodes-base.webhook
- Credentials: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- Alternative versions: nincs

### 13. geppark_karbantartas
- **Chosen path:** `IMPORTRA_KESZ\Iszapfalo - Geppark Karbantartas (All-in-One).json`
- Nodes: 7 | Triggers: n8n-nodes-base.webhook
- Credentials: openAiApi, telegramApi
- Alternative versions: nincs

### 14. gmail_kategorizalo
- **Chosen path:** `IMPORTRA_KESZ\Gmail kategorizáló.json`
- Nodes: 40 | Triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger
- Credentials: n/a
- Alternative versions:
  - `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Gmail kategorizáló.json` (nodes=38)

### 15. workflow
- **Chosen path:** `IMPORTRA_KESZ\workflow.json`
- Nodes: 10 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- Alternative versions: nincs

### 16. gmail - airtable kimenő ajánlat összeköttetés
- **Chosen path:** `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Gmail - Airtable kimenő ajánlat összeköttetés.json`
- Nodes: 13 | Triggers: n8n-nodes-base.scheduleTrigger
- Credentials: airtableTokenApi, anthropicApi, gmailOAuth2, googleDriveOAuth2Api
- Alternative versions: nincs

### 17. ai_agent_workflow_proto
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\mi csináltuk workflow\pohi-workflows\ztb2UOnE25b5aLQu-AI_Agent_workflow.json`
- Nodes: 12 | Triggers: n8n-nodes-base.manualTrigger, n8n-nodes-base.scheduleTrigger
- Credentials: openAiApi
- Alternative versions: nincs

### 18. misc_workflow_proto
- **Chosen path:** `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\mi csináltuk workflow\pohi-workflows\I_p5deBtbiA0eU6PMBDZY-My_workflow.json`
- Nodes: 1 | Triggers: n8n-nodes-base.telegramTrigger
- Credentials: telegramApi
- Alternative versions: nincs

## Azonnali kockázati jelölések
- Több workflow név több forrásban is szerepel, kötelező a kanonikus lista alapján importálni.
- A `credentials: n/a` jelölésű workflow-knál az import után manuális credential bekötés ellenőrzendő.
- JSON-ban `name: None` jelölésű exportok (főleg IMPORTRA_KESZ) esetén névstandardizálás javasolt az n8n-ben.