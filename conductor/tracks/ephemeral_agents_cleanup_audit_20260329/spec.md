# Specifikáció: Ephemeral Agents — Cleanup és Audit

**Track ID:** `ephemeral_agents_cleanup_audit_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Státusz:** ARCHIVED  
**Prioritás:** MEDIUM  
**Függőségek:** `ephemeral_agents_ttl_budget_20260329`

## 1. Cél

Az ideiglenes ágensek ne hagyjanak hátra szemetet: minden fontos döntés, artifact és lezárási ok auditálható legyen, a többi erőforrás tisztán felszabaduljon.

## 2. Scope

### Benne van

- Artifact retention és purge policy
- Termination reason és execution trail audit
- Temp state és resource cleanup
- Supervisor számára áttekinthető postmortem summary

### Nincs benne

- Hosszú távú cold storage rendszer
- Federated cross-org audit export
- Általános teljes rendszer log management

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/ephemeralAudit.ts`
- Érintett vagy várható fő fájl/modul: `src/core/ephemeralLeaseManager.ts`
- Érintett vagy várható fő fájl/modul: `src/core/ephemeralAgentManager.ts`
- Érintett vagy várható fő fájl/modul: `logs/`
- Érintett vagy várható fő fájl/modul: `src/dashboard/components/dashboard/`

## 4. Fő deliverable-ek

- Ephemeral audit schema
- Artifact cleanup / retention szabályok
- Termination summary generator
- Postmortem nézethez szükséges metaadatok

## 5. Sikerkritériumok

- Minden ephemeral agent lezárás audit trail-t hagy maga után
- Ideiglenes state és foglalások felszabadulnak
- A fontos artifactek retention policy szerint megmaradnak
- A supervisor vagy dashboard képes rövid postmortem összefoglalót megjeleníteni

## 6. Guardrail-ek és kockázatok

- Túl agresszív cleanup törölhet fontos bizonyítékot
- Túl laza cleanup felesleges állapotot és költséget hagy maga után
- Hiányos audit trail megnehezíti a hibakeresést
