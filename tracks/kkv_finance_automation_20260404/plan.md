 # Implementációs terv — Pénzügyi automatizálás


1) Számla ingestion mapping (2d)
2) Dedupe & match logic (3d)
3) Approval flow (n8n) + notificaton (2d)
4) Integráció könyvelési rendszerrel (2d)
5) Teszt & compliance checks (2d)

Össz-idő: ~11 nap

---
Részletes feladatok (TASK-FIN-xxx):

- TASK-FIN-001: Számla ingest mapping (assignee: Developer)
	- Leírás: PDF/CSV/Email parserek mapolása → normalized JSON
	- Acceptance: 95% helyes mezőkinyerés a mintaállományon
	- Idő: 2d

- TASK-FIN-002: OCR/parse pipeline + fallback (assignee: DataEngineer)
	- Leírás: OCR beállítás, LLM post-process a kinyert mezők normalizálására
	- Acceptance: OCR+LLM pipeline lefut és normalizált JSON-t ad
	- Idő: 3d

- TASK-FIN-003: Match & reconcile algó (assignee: Developer)
	- Leírás: Bank feed → tranzakció match a számlákkal, fuzzy matching
	- Acceptance: Match ratio > 90% az előre definiált mintákon
	- Idő: 3d

- TASK-FIN-004: Approval flow + audit log (assignee: Developer)
	- Leírás: Jóváhagyási webhookok, audit trail SQLite/DB
	- Acceptance: Audit trail minden jóváhagyásról, visszakereshető
	- Idő: 2d

Következő lépések (ma): TASK-FIN-001 minták gyűjtése és egy alap parse pipeline prototípus készítése.
