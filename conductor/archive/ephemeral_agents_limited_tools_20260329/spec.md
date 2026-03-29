# Specifikáció: Ephemeral Agents — Limited Tools

**Track ID:** `ephemeral_agents_limited_tools_20260329`  
**Fázis:** Fázis 3 — Ephemeral Agents  
**Státusz:** ARCHIVED  
**Prioritás:** HIGH  
**Függőségek:** `ephemeral_agents_runtime_spawn_20260329`

## 1. Cél

A dinamikusan generált ágensek csak minimálisan szükséges eszközökhöz férhessenek hozzá, hogy a rendszer biztonságos maradjon.

## 2. Scope

### Benne van

- Per-agent tool allowlist és denylist
- File/network scope enforcement
- DynamicToolRegistry integráció scoped view-val
- Composed chain-ekre is érvényes scope ellenőrzés

### Nincs benne

- TTL/budget enforcement
- Partneri federated trust
- Teljes OS-level sandboxing minden runtime-ra

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/dynamicToolRegistry.ts`
- Érintett vagy várható fő fájl/modul: `src/core/toolComposition.ts`
- Érintett vagy várható fő fájl/modul: `src/core/rbac/agentPermissions.ts`
- Érintett vagy várható fő fájl/modul: `src/core/sandbox/networkPolicy.ts`
- Érintett vagy várható fő fájl/modul: `src/core/ephemeralAgentManager.ts`

## 4. Fő deliverable-ek

- Scoped tool registry wrapper
- Ephemeral tool permission model
- File/network guardrail integráció
- Sandbox violation audit események

## 5. Sikerkritériumok

- Ephemeral agent csak a kiosztott toolokat látja és hívja
- Fájl- vagy hálózati scope sértése blokkolódik és auditálódik
- Tool composition esetén is érvényes a scope
- A supervisor látja a kiosztott capability készletet

## 6. Guardrail-ek és kockázatok

- A scope túl laza lesz és ki lehet lépni a homokozóból
- A scope túl szűk lesz és használhatatlan ágensek születnek
- A dinamikus tool láncok megkerülhetik a kontrollt
