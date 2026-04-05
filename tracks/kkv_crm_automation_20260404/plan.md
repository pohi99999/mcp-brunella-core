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

---
Részletes feladatok (TASK-CRM-xxx):

- TASK-CRM-001: CRM sandbox hozzáférés validálása (assignee: DevOps/Product)
   - Leírás: HubSpot és egy másik CRM sandbox hitelesítés, OAuth kliens létrehozása
   - Acceptance: OAuth token lekérése és egyszerű /me lekérés sikeresen
   - Idő: 1d

- TASK-CRM-002: n8n ingest flow skeleton (assignee: Developer)
   - Leírás: Webhook listener → transform → temp store (JSON file vagy SQLite) → unit test payload
   - Acceptance: Bejövő mintapéldány feldolgozva és persistálva
   - Idő: 2d

- TASK-CRM-003: Deduplikációs modul (assignee: Developer)
   - Leírás: Dedup logika implementálása (email/phone/hash), konfigurálható küszöb
   - Acceptance: Dedup >=99% a megadott tesztfájlokon
   - Idő: 3d

- TASK-CRM-004: HubSpot connector + OAuth refresh (assignee: Developer)
   - Leírás: Token refresh, hibakezelés, egyszerű lead push endpoint
   - Acceptance: End-to-end lead push teszt sikeres
   - Idő: 3d

- TASK-CRM-005: Lead scoring config & rule engine (assignee: Developer/Product)
   - Leírás: YAML alapú szabályok + egyszerű pontozás; top-10% routolása
   - Acceptance: Scoring pipeline lefut és routolás működik a mintákon
   - Idő: 4d

- TASK-CRM-006: Human-in-loop Slack approval (assignee: Developer)
   - Leírás: Slack interaktív message + decision webhook; audit log
   - Acceptance: Jóváhagyás vagy elutasítás rögzítve, döntés hat a lead státuszra
   - Idő: 2d

Következő lépések (ma): TASK-CRM-001 és TASK-CRM-002 elkezdése. Hozz létre n8n skeleton flow-t és egy README-t a deploy-hoz.
