# Specifikáció: Ephemeral Agents — TTL és Budget

**Track ID:** `ephemeral_agents_ttl_budget_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Státusz:** ARCHIVED  
**Prioritás:** HIGH  
**Függőségek:** `ephemeral_agents_runtime_spawn_20260329`, `ephemeral_agents_limited_tools_20260329`

## 1. Cél

A dinamikus ágensek ne fussanak korlátlanul: legyen TTL, költségkeret, retry-limit és supervisor által kontrollált lease.

## 2. Scope

### Benne van

- Lease és TTL model
- Token/cost/step budget követés
- Supervisor kill-switch és graceful termination
- Escalation ha a budget elfogy

### Nincs benne

- Cleanup/audit mély archívum logika
- Federated partner költségelszámolás
- Általános minden agentre kiterjesztett budget rendszer

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/ephemeralLeaseManager.ts`
- Érintett vagy várható fő fájl/modul: `src/core/ephemeralAgentManager.ts`
- Érintett vagy várható fő fájl/modul: `src/core/telemetry.ts`
- Érintett vagy várható fő fájl/modul: `src/core/modelRouter.ts`
- Érintett vagy várható fő fájl/modul: `src/core/checkpoint.ts`

## 4. Fő deliverable-ek

- Ephemeral lease manager
- Budget counter és policy hook
- Kill-switch / termination stratégia
- Budget exhaustion események

## 5. Sikerkritériumok

- TTL lejárat után az ephemeral agent nem marad aktív
- Költség vagy token budget túllépés leállítja vagy approval-ra viszi a futást
- A supervisor valós időben látja a budget állapotot
- A limitált agent nem tud végtelen retry loopba kerülni

## 6. Guardrail-ek és kockázatok

- Pontatlan költségbecslés rossz cutoffokat okozhat
- TTL expiry közben elveszhet fontos intermediate state
- Kill-switch hibás implementáció félbehagyott erőforrásokat hagyhat hátra
