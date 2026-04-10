# Specifikáció: Agent Instability Chaos Testing

## Háttér
Az LLM ügynökök (különösen a kódolást és webes elérést végzők, mint a `DeveloperAgent` és a `RobotkezV2`) nagymértékben támaszkodnak külső eszközökre (tools, API-k, böngésző futtatókörnyezet). A `Chaeos-env` kutatás (2026-04-09.md) rámutatott, hogy az ügynökök tesztelése "tool instability" (eszköz-instabilitás) környezetben kritikus.

## Célkitűzés
Egy robusztus kiértékelési környezet (`ChaosAgent` sandbox) létrehozása a Brunella Agent System (BAS) `Phoenix Protocol v2` képességének kiterjesztésére, szimulálva az időtúllépéseket (timeouts), a rate limit-eket, és az adatkorrupciókat.

## Követelmények
1. **Chaos Decorator/Middleware:** A `src/tools/` mappában lévő MCP eszközöket egy chaos wrapperrel kell ellátni teszt üzemmódban, ami véletlenszerűen vagy determinisztikusan injektál hibákat.
2. **EvaluatorAgent Bővítés:** Az `EvaluatorAgent`-nek tudnia kell futtatni egy `chaos_test_suite`-ot.
3. **Phoenix Protocol Finomhangolás:** A Phoenix Auto-Reset logikának kezelnie kell a rate-limit (`429`) és a timeout (`504`) hibákat degradált üzemmóddal, mielőtt a feladatot teljes egészében megszakítja.
4. **Dashboard Integráció:** A Mission Control Dashboard-on jelenjenek meg a "Chaos" események.

## Sikerességi Kritériumok
- 30 különböző MCP eszköz tesztelése 3-féle hiba (timeout, rate limit, corruption) injektálásával.
- Az Orchestrator / Phoenix Protocol képes sikeresen végrehajtani a feladatok legalább 80%-át a degradált környezet ellenére (retry + alternative tool fallback).
- EPP v2 Dashboard és CLI command integráció kész.