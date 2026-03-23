# Agent Diagnostics & Routing Modernization

## Objective
Professzionálisabb agent platformréteg kialakítása a Brunella rendszerben az alábbi négy területen:

1. startup / load diagnosztika
2. registry schema validation
3. capability-alapú routing modernizáció
4. egységes agent metadata standard

## Scope
- backend agent registry validáció és normalizáció
- agent load diagnosztikai állapotok gyűjtése
- új REST diagnosztikai endpoint
- dashboard panel a betöltési és validációs állapotokhoz
- CLI diagnosztikai parancs
- routing fejlesztés trigger + capability + runtime health + cost bias alapján

## Non-Goals
- registry.json kézi átírása
- AgentManager teljes újraírása
- package.json build hook módosítása

## Success Criteria
- hibás registry-bejegyzések felismerhetők és riportálhatók
- agent exportfeloldás, load státusz és runtime állapot dashboardon is látszik
- a routeTask már nem csak szabály/trigger alapján dönt, hanem capability és runtime szempontokat is használ
- build és célzott tesztek zöldek
