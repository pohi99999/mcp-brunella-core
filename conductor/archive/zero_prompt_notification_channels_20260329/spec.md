# Specifikáció: Zero-Prompt Core — Slack/Discord/Email Jóváhagyás

**Track ID:** `zero_prompt_notification_channels_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Státusz:** PROPOSED  
**Prioritás:** MEDIUM  
**Függőségek:** `zero_prompt_approval_router_20260329`, `zero_prompt_signal_ingest_20260329`

## 1. Cél

A BAS ne csak belső approval objektumokat hozzon létre, hanem el is tudja juttatni a döntést kérő vagy státuszt jelző üzeneteket több csatornán.

## 2. Scope

### Benne van
- Channel abstraction Slack/Discord/email támogatással
- Approval és alert üzenetsablonok
- Retry, fallback és delivery audit
- Csatornánkénti minimal viable callback stratégia

### Nincs benne
- Teljes enterprise chatops platform kialakítása
- Vendor-specific advanced UI komponensek
- Federated external agent message routing

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/utils/notificationService.ts`
- Érintett vagy várható fő fájl/modul: `src/core/approvalRouter.ts`
- Érintett vagy várható fő fájl/modul: `cloudflare/src/workflows/daily-health-check.ts`
- Érintett vagy várható fő fájl/modul: `src/server/routes/webhooks.ts`
- Érintett vagy várható fő fájl/modul: `src/core/policyEngine.ts`

## 4. Fő deliverable-ek

- Notification channel adapter interface
- Slack, Discord és email alap adapterek
- Approval message template csomag
- Delivery log és hibakezelés

## 5. Sikerkritériumok

- Approval request legalább egy támogatott csatornára kimegy
- Hiba esetén fallback csatorna vagy delivery failure log keletkezik
- A felhasználó csatornánként más jelzési policy-t tud beállítani
- Az Approval Router integráltan hívja a transport réteget

## 6. Guardrail-ek és kockázatok

- Webhook credential kezelés érzékeny adatot érint
- Több csatorna esetén duplikált approval válaszok jöhetnek
- Email lassabb feedback loopot adhat, mint a chat csatornák
