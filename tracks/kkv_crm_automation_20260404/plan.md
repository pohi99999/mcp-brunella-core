# Implementációs terv — KKV CRM automatizálás

1) Discovery & integrációk kiválasztása (2d)
   - Validálni HubSpot / Pipedrive sandbox hozzáférést
   - Azonosítani a webhook formátumokat és mezőket
   - Acceptance: legalább 1 CRM sandbox elérhető

2) n8n flow építés — Ingest pipeline (3d)
   - Webhook listener, transform, dedupe, persist
   - Unit tesztek: bejövő mintákra

3) CRM connector (HubSpot) — OAuth2 autentikáció (3d)
   - Token refresh logika, hibakezelés
   - End-to-end teszt: lead push

4) Lead scoring & routing (4d)
   - Szabályalapú scoring motor implementálása
   - Routing: assign alapértelmezett owner vagy Slack értesítés

5) Human-in-loop (2d)
   - Slack interaktív jóváhagyás vagy egyszerű UI
   - Audit log és döntés tárolása

6) Monitoring, reporting, dokumentáció (2d)
   - Napi összegző pipeline, metrics dashboard
   - README + deploy lépések

7) Rollout & QA (2d)
   - Korlátozott hullámokban: 10 ügyfél → 50 ügyfél → teljes

Összes becsült idő: ~18 nap (team size: 2 dev, 1 devops, 1 product)
