 # Implementációs terv — Ugyfelszolgalati AI


1) Csatorna mapping & ingestion (2d)
2) Klasszifikációs modell/LLM prompttervezés (3d)
3) RAG bevezetés: LanceDB index + retrieval (3d)
4) Automatikus reply template-ek + human override (3d)
5) Escalation és SLA pipeline (2d)
6) Tesztelés, monitoring, dokumentáció (2d)

Össz-idő: ~15 nap

---
Részletes feladatok (TASK-CS-xxx):

- TASK-CS-001: Csatorna mapping és bejövő ingestion (assignee: Developer)
	- Leírás: Email, chat és web webhook mapping; sample payload gyűjtés
	- Acceptance: Minden csatornáról érkező mintapéldány beérkezik és persistálódik
	- Idő: 2d

- TASK-CS-002: Intent/Classify prototípus & prompt design (assignee: ML Engineer)
	- Leírás: LLM prompt + shadow classifier implementáció; chokepoint analízis
	- Acceptance: Klasszifikáció minta-ADATON >= 0.85 pontosság
	- Idő: 3d

- TASK-CS-003: RAG indexálás (assignee: DataEngineer)
	- Leírás: LanceDB index létrehozása, batch index pipeline + enkóder beállítások
	- Acceptance: Teszt lekérdezés releváns találatot ad 3-ból 2 esetben
	- Idő: 3d

- TASK-CS-004: Automatikus válasz + human override UI (assignee: Developer)
	- Leírás: Template engine + human-override webhook/UI; versioning
	- Acceptance: Automatikus válasz javaslat megjelenik és ember felülírhatja
	- Idő: 3d

- TASK-CS-005: Escalation flow (assignee: Developer/DevOps)
	- Leírás: SLA monitor, n8n pipeline az eszkalációhoz, Slack értesítés
	- Acceptance: SLA breach esetén automatikus élesítés és notifikáció
	- Idő: 2d

Következő lépések (ma): TASK-CS-001 payload minták gyűjtése és egy egyszerű ingest flow implementálása (n8n skeleton), majd TASK-CS-002 prompttervezés kezdeti iteráció.
