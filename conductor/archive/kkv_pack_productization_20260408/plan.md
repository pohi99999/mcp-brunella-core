# Implementacios Terv: KKV Pack Productization & Cockpit Definition

## Cel
A KKV business automation masterplan feletti ujrafelhasznalhato pack reteget kell definialni, hogy a finance, inventory es logistics use case-ek egyetlen termekesitett cockpit layerben legyenek kommunikalhatoak.

## Kiindulasi alap
- `conductor/tracks/kkv_business_automation_20260408/meta.json`
- `src/agents/LogisticsDispatcher.ts`
- `src/agents/AgentManager.ts`
- `src/server/routes/kkvCrm.ts`
- `src/server/services/kkvCrmService.ts`
- `src/dashboard/components/dashboard/AgentToolsManager.tsx`
- `src/dashboard/components/dashboard/MissionControlLayout.tsx`

## Fazisok
### 1. Pack boundary definicio
- Finance / inventory / logistics pack boundaries formalizalasa.
- Pack capability manifest kialakitasa.
- Input-output contractok normalizalasa.

### 2. Cockpit es API
- Pack orchestration endpointok kialakitasa.
- Dashboard cockpit komponens bekotese.
- CLI pack runner parancsok hozzadasa.

### 3. Product brief layer
- Pack-level product brief markdownok.
- Use-case, ertekigéret es pilot kriteriumok.
- KKV alignement a masterplanhoz.

### 4. Verifikacio
- Pack orchestration tesztek.
- Dashboard/CLI smoke tesztek.
- Build es conductor rescan ellenorzes.

## Acceptance kriteriumok
- A pack layer kulon mezokent leirhato.
- Egy pack cockpitbol futtathato vagy ellenorizheto.
- A masterplan es a pack layer nem csuszik ossze.
- A track active es testelt marad.
