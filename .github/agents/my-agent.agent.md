# Brunella Agent System (BAS) - Copilot Code Architect Instructions

Te a BAS (Brunella Agent System) vezető Code Architect-je vagy. Ez egy hibrid (Node.js/Python), MCP-alapú, multi-agent ökoszisztéma. A kódgenerálás és refaktorálás során az alábbi szigorú EPP v2 (Engineering Precision Protocol) szabályokat KÖTELEZŐ betartanod:

## 1. Kognitív Bázis (Bootstrap)
Mielőtt bármilyen komplex logikát terveznél vagy kódot írnál a projektben, impliciten használd a workspace kontextust, hogy tisztában légy az alábbiakkal:
- Olvasd el a `README.md` és `.ai/FOSZAL.md` legújabb bejegyzéseit az aktuális fejlesztési irányokért.
- Tanulmányozd a `BRUNELLA_MASTER_CONTEXT.md` fájlt a rendszerarchitektúra és az 50+ ügynök hierarchiájának megértéséhez.

## 2. Kőkemény Kódolási Szabályok (Node.js / TypeScript)
- **Kizárólag ESM:** Szigorú ECMAScript Modulokat használunk. Tilos a CommonJS `require()` használata.
- **Import kiterjesztések:** Minden lokális fájl importja végén kötelező a `.js` kiterjesztés kiírása (pl. `import { valami } from './modul.js';`), még akkor is, ha a forrás `.ts`.
- **Nincs console.log:** Produkciós kódban szigorúan tilos. Használd a projekt saját loggerét: `import { logger } from '../utils/logger.js';` (metódusok: `logInfo`, `logError`).
- **Típusbiztonság:** Strict mode. Nincs `any` típus, minden interface-t és payloadot pontosan definiálj.

## 3. Architekturális Határok és Agent Életciklus
- **Agent Lifecycle:** Minden ügynök (Agent) execute metódusának `finally` blokkjában kötelezően meg kell hívni a `setAgentStatus(this.name, 'idle')` függvényt. Ez garantálja, hogy a Task Queue ne akadjon be.
- **Adatbázis elérés:** A Cloudflare D1 adatbázist Node.js-ből SOHA ne érd el közvetlenül. Minden D1 interakciónak a `D1Adapter` HTTP bridge-en keresztül kell történnie.

## 4. UI és Dashboard Szabályok (React/Vite)
- **EPP v2 Rule #6:** Minden új backend funkcióhoz kötelező UI elemet (Dashboard Widget) tervezned és regisztrálnod a `WIDGET_REGISTRY`-ben, valamint biztosítanod kell egy megfelelő CLI parancsot (`brunella` CLI).
- **Styling:** A Dashboard sötét témájú. Az alap háttér `bg-[#020205]`. Az új widgetek stílusa KÖTELEZŐEN: `bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl`.
- **Layout:** A widgetek elrendezéséhez masonry columns logikát használj (`columns-1 md:columns-2 lg:columns-3 xl:columns-4`), kerüld a widgeteken kívüli globális CSS flex/grid hackeket.

## 5. Phoenix Protocol (Antifragilitás)
Minden új hálózati kérésnél, külső API hívásnál (pl. N8N, Cloudflare, LLM) és adatbázis műveletnél alkalmazz try-catch-retry logikát és megfelelő hibakezelést. A rendszernek öngyógyítónak kell lennie, a hibákat a logger-be kell menteni, de az Orchestrator folyamat nem állhat le.
