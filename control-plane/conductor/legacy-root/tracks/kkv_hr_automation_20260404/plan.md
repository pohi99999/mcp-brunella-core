# Implementációs terv — HR automatizálás

1) Onboarding/Offboarding trigger mapping (2d)
2) Account provisioning playbook (3d)
3) Leave request workflow + approvals (2d)
4) Integráció Google Workspace / Directory (2d)
5) Teszt + dokumentáció (2d)

Össz-idő: ~11 nap

---
Részletes feladatok (TASK-HR-xxx):

- TASK-HR-001: Onboarding trigger mapping & sample payloadok (assignee: Product/Developer)
	- Leírás: HRIS→webhook mapping, szükséges mezők definiálása
	- Acceptance: Mintapéldányok gyűjtve és validálva
	- Idő: 1d

- TASK-HR-002: Account provisioning playbook (assignee: Developer/DevOps)
	- Leírás: Google Workspace account provisioning script + slack invite lépések
	- Acceptance: Lokális sandboxban futó script létrehozva (dry-run)
	- Idő: 3d

- TASK-HR-003: Leave request workflow + approvals (assignee: Developer)
	- Leírás: Kérelem beérkezik → n8n flow → manager approval → calendar update
	- Acceptance: Teszt kérelmek jóváhagyása és naptárba írása
	- Idő: 2d

- TASK-HR-004: Directory sync és GCW integráció (assignee: DevOps)
	- Leírás: SCIM/Directory sync terv és sandbox validáció
	- Acceptance: SCIM sandbox sync validálva (read-only teszt)
	- Idő: 2d

Következő lépések (ma): TASK-HR-001 payload gyűjtés és egy provisioning dry-run elkészítése (TASK-HR-002 kezdeti munka).
