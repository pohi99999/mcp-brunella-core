# KKV CRM és lead-utanakovetes automatizálás

Dátum: 2026-04-04
ID: kkv_crm_automation_20260404

Leírás:
Ez a track célja, hogy kis- és középvállalkozások számára teljes körű CRM-integrációs és lead-utánkövetési automatizálási csomagot hozzon létre. Tartalmazza a bejövő leadek fogadását (webhookok, űrlapok), deduplikációt, lead scoringot, automatisált értesítéseket és emberi jóváhagyási folyamatokat (human-in-loop), valamint riportálást és monitoringot.

Fő komponensek:

- Integrációk: HubSpot, Pipedrive, Zoho CRM (prioritás: HubSpot)
- Ingest pipeline: webhook → n8n flow → dedupe → lead store
- Lead scoring: szabályalapú + LLM segédlet (prototípus)
- Routing & notifications: Slack/Email/CRM-assignee
- Human-in-loop: jóváhagyási felület vagy Slack-interaktív üzenet
- Monitoring & reporting: napi összegzések, funnel metrikák

Success criteria (acceptance):

- Bejövő lead sikeres fogadása és tárolása (end-to-end flow teszt)
- Automatikus deduplikáció 99%+ a teszt adatokon
- Lead scoring működik alap-szabályokkal; a top-10% leadek routolása automatikus
- Legalább egy CRM-connector (HubSpot) OAuth alapon működik teszt környezetben
- Dokumentáció: spec.md, plan.md, meta.json, deployment útmutató

Korlátozások / Out-of-scope:
- Teljes, gyártás szintű ML modellépítés
- Egyedi CRM edge-case API-k kezelése (külön sub-track)

Függőségek:
- n8n telepítve és elérhető (staging)
- CRM rendszerek hozzáférés (sandbox)
- DevOps: CI/CD pipeline a n8n flows számára

Stakeholders: Product Owner, Sales lead, DevOps
