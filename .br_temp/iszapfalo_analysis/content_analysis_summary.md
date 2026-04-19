# Cross-folder Content Analysis (raw)

## Iszapfaló_Projekt_FO

- Dokumentum fájlok: **31**

- Workflow JSON fájlok: **30**


### Workflow inventory

- `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Airtable - Google Calendar feladat készítő.json` | name: `Airtable - Google Calendar feladat készítő` | nodes: 6 | triggers: n8n-nodes-base.gmailTrigger | creds: airtableTokenApi, anthropicApi, gmailOAuth2, googleCalendarOAuth2Api
- `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Feladatok státuszállítás telegram chat.json` | name: `Feladatok státuszállítás telegram chat` | nodes: 7 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi, telegramApi
- `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Gmail - Airtable kimenő ajánlat összeköttetés.json` | name: `Gmail - Airtable kimenő ajánlat összeköttetés` | nodes: 13 | triggers: n8n-nodes-base.scheduleTrigger | creds: airtableTokenApi, anthropicApi, gmailOAuth2, googleDriveOAuth2Api
- `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Gmail kategorizáló.json` | name: `Gmail kategorizáló` | nodes: 38 | triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger | creds: airtableTokenApi, anthropicApi, gmailOAuth2, telegramApi
- `1. Legfontosabb, megrendelő leírása nekünk ez az SOS, és ezekhez tartozó workflow-k\Kimenő ajánlatok_dokumentumok.json` | name: `Kimenő ajánlatok/dokumentumok` | nodes: 8 | triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger | creds: gmailOAuth2
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Airtable - Google Calendar feladat készítő.json` | name: `Airtable - Google Calendar feladat készítő` | nodes: 6 | triggers: n8n-nodes-base.gmailTrigger | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Feladatok státuszállítás telegram chat.json` | name: `Feladatok státuszállítás telegram chat` | nodes: 20 | triggers: n8n-nodes-base.scheduleTrigger, n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - AI Agent Asszisztens (v2 - Javított).json` | name: `Iszapfaló - AI Agent Asszisztens (v2 - Javított)` | nodes: 10 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Google Calendar → Airtable Szinkron.json` | name: `Iszapfaló - Google Calendar → Airtable Szinkron` | nodes: 6 | triggers: n8n-nodes-base.googleCalendarTrigger | creds: airtableTokenApi, googleCalendarOAuth2Api
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Heti Emlékeztető (Csütörtök 16_00).json` | name: `Iszapfaló - Heti Emlékeztető (Csütörtök 16:00)` | nodes: 6 | triggers: n8n-nodes-base.cron | creds: airtableTokenApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Iszapfaló - Telegram Parancsok (_statusz, _het).json` | name: `Iszapfaló - Telegram Parancsok (/statusz, /het)` | nodes: 8 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, telegramApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Kimenő ajánlatok_dokumentumok.json` | name: `Kimenő ajánlatok/dokumentumok` | nodes: 8 | triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger | creds: n/a
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPLEMENTED_2026_03_13 n8n workflow\Telegram Hangvezérlés - Teljes Rendszer.json` | name: `Telegram Hangvezérlés - Teljes Rendszer` | nodes: 9 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\01_feladat_status_telegram_chat.json` | name: `Feladatok státuszállítás telegram chat` | nodes: 20 | triggers: n8n-nodes-base.scheduleTrigger, n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\02_ai_agent_asszisztens_v2_javitott.json` | name: `Iszapfaló - AI Agent Asszisztens (v2 - Javított)` | nodes: 10 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\03_airtable_google_calendar_feladat_keszito.json` | name: `Airtable - Google Calendar feladat készítő` | nodes: 6 | triggers: n8n-nodes-base.gmailTrigger | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\04_google_calendar_airtable_szinkron.json` | name: `Iszapfaló - Google Calendar → Airtable Szinkron` | nodes: 6 | triggers: n8n-nodes-base.googleCalendarTrigger | creds: airtableTokenApi, googleCalendarOAuth2Api
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\05_heti_emlekezteto_csutortok_1600.json` | name: `Iszapfaló - Heti Emlékeztető (Csütörtök 16:00)` | nodes: 6 | triggers: n8n-nodes-base.cron | creds: airtableTokenApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\06_telegram_parancsok_statusz_het.json` | name: `Iszapfaló - Telegram Parancsok (/statusz, /het)` | nodes: 8 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, telegramApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\07_telegram_hangvezerles_teljes_rendszer.json` | name: `Telegram Hangvezérlés - Teljes Rendszer` | nodes: 9 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\IMPORT_READY_PACK_2026_03_13 n8n workflow\08_kimeno_ajanlatok_dokumentumok.json` | name: `Kimenő ajánlatok/dokumentumok` | nodes: 8 | triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger | creds: n/a
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\mi csináltuk workflow\pohi-workflows\I_p5deBtbiA0eU6PMBDZY-My_workflow.json` | name: `My workflow` | nodes: 1 | triggers: n8n-nodes-base.telegramTrigger | creds: telegramApi
- `2. ezeket a workflow-at már mi csináltuk vagy javítottuk az Iszapfalónak betötés!\mi csináltuk workflow\pohi-workflows\ztb2UOnE25b5aLQu-AI_Agent_workflow.json` | name: `AI Agent workflow` | nodes: 12 | triggers: n8n-nodes-base.manualTrigger, n8n-nodes-base.scheduleTrigger | creds: openAiApi
- `IMPORTRA_KESZ\Gmail kategorizáló.json` | name: `None` | nodes: 40 | triggers: n8n-nodes-base.gmailTrigger, n8n-nodes-base.manualTrigger | creds: n/a
- `IMPORTRA_KESZ\Iszapfalo - AI Agent Asszisztens (v2 - Javitott).json` | name: `None` | nodes: 10 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- `IMPORTRA_KESZ\Iszapfalo - Error Monitoring es Logging.json` | name: `None` | nodes: 23 | triggers: @n8n/n8n-nodes-langchain.chatTrigger, n8n-nodes-base.cron, n8n-nodes-base.respondToWebhook, n8n-nodes-base.telegramTrigger, n8n-nodes-base.webhook | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi
- `IMPORTRA_KESZ\Iszapfalo - Geppark Karbantartas (All-in-One).json` | name: `None` | nodes: 7 | triggers: n8n-nodes-base.webhook | creds: openAiApi, telegramApi
- `IMPORTRA_KESZ\Iszapfalo - Heti Emlekeztetö (Csütörtök 16.00).json` | name: `None` | nodes: 6 | triggers: n8n-nodes-base.cron | creds: airtableTokenApi, telegramApi
- `IMPORTRA_KESZ\Iszapfalo - Telegram Parancsok (statusz, het).json` | name: `None` | nodes: 8 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, telegramApi
- `IMPORTRA_KESZ\workflow.json` | name: `None` | nodes: 10 | triggers: n8n-nodes-base.telegramTrigger | creds: airtableTokenApi, anthropicApi, googleCalendarOAuth2Api, telegramApi

### Strategic docs quick scan

- `1. Ez a Minimum elvárt amit  meg kell oldanunk elöször.md` (10229 B) keywords={'airtable': 23, 'n8n': 8, 'workflow': 13, 'telegram': 18, 'calendar': 5, 'error': 2, 'claude': 1, 'gemini': 0, 'manus': 1, 'projekt': 0, 'késés': 0, 'munkaidő': 11}
- `EZT_Olvasd be elsőként!! Az Iszapfaló projekt előtörténete összefoglalva enélkül nem fogod tudni a projek felépítésének tervét.md` (15766 B) keywords={'airtable': 30, 'n8n': 12, 'workflow': 7, 'telegram': 8, 'calendar': 0, 'error': 2, 'claude': 15, 'gemini': 0, 'manus': 1, 'projekt': 21, 'késés': 16, 'munkaidő': 15}
- `Manus AI, Claude AI plan (értékelni, ha jó megcsinálni betötni\Iszapfalo_Intelligens_Asszisztens_Vizió_2026_PLAN.md` (12897 B) keywords={'airtable': 25, 'n8n': 12, 'workflow': 7, 'telegram': 8, 'calendar': 0, 'error': 2, 'claude': 13, 'gemini': 0, 'manus': 1, 'projekt': 19, 'késés': 16, 'munkaidő': 14}
- `Manus AI, Claude AI plan (értékelni, ha jó megcsinálni betötni\Iszapfaló_Kft._Hibrid_Folyamat-automatizálási_Rendszer_Fejlesztési_Terv.md` (15859 B) keywords={'airtable': 13, 'n8n': 28, 'workflow': 5, 'telegram': 11, 'calendar': 3, 'error': 0, 'claude': 1, 'gemini': 0, 'manus': 16, 'projekt': 10, 'késés': 0, 'munkaidő': 19}
- `osszefoglalo.md` (3115 B) keywords={'airtable': 3, 'n8n': 4, 'workflow': 4, 'telegram': 7, 'calendar': 0, 'error': 2, 'claude': 2, 'gemini': 0, 'manus': 0, 'projekt': 1, 'késés': 0, 'munkaidő': 3}
- `plan.md` (1724 B) keywords={'airtable': 2, 'n8n': 1, 'workflow': 3, 'telegram': 4, 'calendar': 0, 'error': 1, 'claude': 0, 'gemini': 0, 'manus': 0, 'projekt': 0, 'késés': 0, 'munkaidő': 1}
- `requirements_vision.txt` (13 B) keywords={'airtable': 0, 'n8n': 0, 'workflow': 0, 'telegram': 0, 'calendar': 0, 'error': 0, 'claude': 0, 'gemini': 0, 'manus': 0, 'projekt': 0, 'késés': 0, 'munkaidő': 0}
- `spec.md` (2089 B) keywords={'airtable': 3, 'n8n': 3, 'workflow': 0, 'telegram': 4, 'calendar': 1, 'error': 1, 'claude': 1, 'gemini': 0, 'manus': 0, 'projekt': 2, 'késés': 1, 'munkaidő': 4}

## Gemini_cli

- JSON fájlok: **10**

- TXT session/tool-output fájlok: **300**


### JSON files

- `checkpoint-isz7777.json` | type=dict | size=667597 | keys=['history', 'authType']
- `checkpoint-isz9.json` | type=dict | size=133725 | keys=['history', 'authType']
- `checkpoint-ppp999.json` | type=dict | size=692575 | keys=['history', 'authType']
- `logs.json` | type=list | size=1072405 | keys=[]
- `session-2026-03-14T23-21-14e62a33.json` | type=dict | size=27810 | keys=['sessionId', 'projectHash', 'startTime', 'lastUpdated', 'messages', 'kind']
- `session-2026-03-14T23-40-14e62a33.json` | type=dict | size=17726098 | keys=['sessionId', 'projectHash', 'startTime', 'lastUpdated', 'messages', 'kind']
- `session-2026-03-15T06-49-88282bf9.json` | type=dict | size=2585650 | keys=['sessionId', 'projectHash', 'startTime', 'lastUpdated', 'messages', 'kind']
- `session-2026-03-16T04-06-112b0cea.json` | type=dict | size=5887 | keys=['sessionId', 'projectHash', 'startTime', 'lastUpdated', 'messages', 'kind']
- `session-2026-03-16T04-09-1e6fdf2d.json` | type=dict | size=30050 | keys=['sessionId', 'projectHash', 'startTime', 'lastUpdated', 'messages', 'kind']
- `session-2026-03-16T04-10-1e6fdf2d.json` | type=dict | size=19738 | keys=['sessionId', 'projectHash', 'startTime', 'lastUpdated', 'messages', 'kind']

### Top tool-output categories (by count)

- mcp: 113
- run: 89
- take: 26
- evaluate: 22
- click: 12
- list: 9
- web: 6
- write: 4
- navigate: 4
- read: 3
- press: 3
- browser: 2
- pb: 2
- grep: 1
- new: 1
- select: 1
- type: 1
- upload: 1

### Keyword hits across Gemini txt corpus

- n8n: 2173
- workflow: 983
- airtable: 795
- error: 606
- telegram: 464
- claude: 223
- projekt: 196
- calendar: 140
- munkaidő: 75
- gemini: 51
- manus: 50
- késés: 2