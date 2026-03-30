# Specifikáció: Zero-Prompt Core — Approval Router

**Track ID:** `zero_prompt_approval_router_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `zero_prompt_policy_engine_20260329`

## 1. Cél

A BAS ne csak értesítsen, hanem strukturáltan kezelje a jóváhagyás-kérést, timeoutot, lejáratot és a visszatérő végrehajtást.

## 2. Scope

### Benne van
- Approval request adatmodell és lifecycle
- Approve / reject / expire / cancel állapotgép
- Tokenizált vagy aláírt approval callback mechanizmus
- Kapcsolat az esemény és a végrehajtási terv között

### Nincs benne
- Slack/Discord/email transport kliens részletes implementáció
- Teljes negotiated B2B workflow
- Tanítóadat-generálás

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/approvalRouter.ts`
- Érintett vagy várható fő fájl/modul: `src/utils/notificationService.ts`
- Érintett vagy várható fő fájl/modul: `src/server/routes/webhooks.ts`
- Érintett vagy várható fő fájl/modul: `src/core/policyEngine.ts`
- Érintett vagy várható fő fájl/modul: `src/core/phoenixEventBus.ts`

## 4. Fő deliverable-ek

- src/core/approvalRouter.ts
- Approval request storage és state model
- Approval callback endpoint vagy command handler
- Timeout / escalation logika

## 5. Sikerkritériumok

- A guarded policy decision strukturált approval requestet hoz létre
- Approve után a függő végrehajtás folytatható ugyanazzal a kontextussal
- Reject vagy timeout után a rendszer nem hajt végre veszélyes akciót
- Az approval flow auditálható és visszajátszható

## 6. Guardrail-ek és kockázatok

- Approval link vagy token védelme kritikus
- State drift esetén jóváhagyott akció elveszhet
- Több csatornán jövő válaszok duplikációt okozhatnak
