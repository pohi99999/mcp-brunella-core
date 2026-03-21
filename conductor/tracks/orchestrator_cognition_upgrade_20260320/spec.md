# Spec: Orchestrator Cognition Upgrade (2026-03-20)

## Track ID
`orchestrator_cognition_upgrade_20260320`

## Cél
1. Brunella természetesebb, magyar nyelvű csevegőtárssá váljon a dashboardon és CLI-ben.
2. Az orchestrator jobban érzékelje a rendszer állapotát: agentek, task queue, hibák, futó folyamatok.
3. Dönteni tudjon: kérdezzen vissza, delegáljon, ellenőrizzen, vagy hibakezelést indítson.
4. A működés közelítsen egy context-aware, tool-using AI operátorhoz.

## Phase 1 Scope
- Runtime context injektálása a universal orchestrator promptba
- Erősebb társalgási/delegálási magyar policy
- Dinamikus modellkatalógus a dashboard/CLI számára

## Következő fázisok
- Session memory + user preference memory
- Autonomous follow-up loop (ellenőrzés, retry, summarize)
- Error playbooks / delegation policies
- Background job observer + proactive notifications

## Elfogadási kritériumok
- A rendszerprompt tartalmaz futó task és agent állapot összefoglalót.
- A dashboard modelllista API-ból töltődik.
- A CLI interaktív provider/model váltása API-katalógust is tud használni.
- `npm run build` és `npm test` sikeres.
