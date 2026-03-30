# Végrehajtási Terv: Zero-Prompt Core — Approval Router

**Track ID:** `zero_prompt_approval_router_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/approvalRouter.ts
- Approval request storage és state model
- Approval callback endpoint vagy command handler
- Timeout / escalation logika

## Todo lista

### 1. Modellezés

- [x] ApprovalRequest és ApprovalDecision típusok definiálása
- [x] Állapotgép és lejárati szabályok megírása
- [x] Link/callback biztonsági modell meghatározása
### 2. Implementáció

- [x] Approval Router core modul létrehozása
- [x] Pending request store kialakítása
- [x] Approve/reject callback kezelők implementálása
- [x] Timeout és escalation futások hozzáadása
### 3. Integráció

- [x] Policy Engine decision output fogadása
- [x] Notification channel adapter interface kialakítása
- [x] Orchestrator resume flow bekötése
### 4. Validáció

- [x] Approve flow end-to-end teszt
- [x] Reject flow és dead-letter kezelés teszt
- [x] Lejárt request timeout kezelési teszt

## Megjegyzések

- Elsődleges függőségek: `zero_prompt_policy_engine_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
