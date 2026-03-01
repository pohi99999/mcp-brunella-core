# Kutatási Jelentés: PAIOS Orchestrator "Mock" Tervezés Eltávolítása

## A Probléma Okának Megállapítása
A PAIOS Orchestrator Chat felülete egy dedikált API végpontot (`/api/paios/chat`) hív meg, amely a `src/orchestrator/orchestratorCore.ts` fájlban található `processChat` függvényt használja. 
Ez a függvény **teljesen megkerüli** a frissített `OrchestratorAgent`-et (amelybe már beépítettük a ReAct Tool Calling hurkot). Ehelyett egy régi, dedikált markdown fájlt (`paios_orchestrator_prompt.md`) olvas be, meghívja a gateway-t, és elvárja, hogy a modell JSON-ben adja vissza a "tervet" (`plan`, `tasks`, `summary` mezőkkel).

Ez a hardcoded "tervező" logika az oka annak, hogy a dashboard továbbra is Markdown terveket generál, és nem cselekszik azonnal a Robotkézzel.

## A Megoldás
A `processChat` függvényt refaktorálni kell. Nem szabad újra implementálnia az LLM hívást és a JSON parse-olást. Ehelyett egyszerűen továbbítania (delegálnia) kell a kérést a már létező, "Zero-Mock" módban működő `OrchestratorAgent`-nek az `agentManager.delegate('orchestrator', message)` híváson keresztül.

A front-end kompatibilitás megőrzése érdekében a visszatérési értéket egyező formátumra (`OrchestratorResponse`) kell konvertálni, üres `plan` tömbbel (hiszen a valódi végrehajtásnál nincs fiktív terv).