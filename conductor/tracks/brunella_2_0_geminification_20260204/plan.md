# Végrehajtási Terv: Brunella 2.0 - Gemini-fication

**Dátum:** 2026. február 4.
**Track ID:** `brunella_2_0_geminification_20260204`
**Státusz:** Lezárva

## 1. Függőségek Telepítése

- **Node.js:** `npm install @google/generative-ai @anthropic-ai/sdk readline-sync chalk@4.1.2` parancs sikeresen lefutott.
- **Python:** A `cd myai && pip install ...` parancs helyett a projektben használt `uv` csomagkezelővel telepítettem a függőségeket: `uv pip install google-generativeai langsmith` a `myai` könyvtárban.

## 2. Fájlok Létrehozása és Módosítása

- **`src/types/llm.ts`:** Létrehozva a specifikációban meghatározott `LLMProvider` és `IConversationContext` típusokkal.
- **`src/core/llm_client.ts`:** Létrehozva az új, `traceable` `generateResponse` függvénnyel, amely kezeli a `gemini` és `ollama` providereket és a fallback logikát.
- **TypeScript hibajavítás:**
    - Explicit típusokat adtam a `generateResponse` függvényhez a `TS7022` és `TS7024` hibák elkerülése érdekében.
    - A `logger` importot kiegészítettem a `.js` kiterjesztéssel (`../utils/logger.js`) a `TS2835` hiba javításához.
    - Módosítottam a `generateResponse` visszatérési értékét `Promise<string>`-re, hogy a hívó oldalon ne legyen `undefined` típusprobléma.

## 3. Integráció

- **`src/agents/OrchestratorAgent.ts`:** A `chatWithOllama` hívás lecserélve a `generateResponse(prompt, context?.provider)` hívásra.
- **`src/agents/DynamicAgent.ts`:** A `chatWithOllama` hívás lecserélve a `generateResponse`-ra, a `systemPrompt` a `prompt` elé fűzve.
- **`src/pipeline/llmPipeline.ts`:** A `chatWithOllama` hívás lecserélve `generateResponse`-ra.
- **`src/tools/ollamaTool.ts`:** A `chatWithOllama` hívás lecserélve `generateResponse`-ra.
- **`src/cli.ts`:** A `chat` parancs teljesen átírva:
    - Bevezetésre került egy `history` tömb a beszélgetés követésére.
    - Az `activeProvider` változó kezeli a kiválasztott LLM szolgáltatót.
    - Implementálva a `/switch <provider>` parancs a szolgáltató váltásához.
    - A `context` objektumban átadásra kerül a `history` és az `activeProvider` az `agent_delegate` eszköznek.
- **`src/server/web.ts`:** A `/api/ollama/generate` végpontban a `chatWithOllama` hívás lecserélve `generateResponse`-ra, hogy a Dashboard is az új logikát használja.

## 4. Verifikáció és Tesztelés

- **`test/llm_provider.test.ts`:** Létrehozva a specifikációnak megfelelő tesztekkel.
- **Teszt futtatás:**
    - A kezdeti `5000ms`-es időkorlát nem volt elegendő a hálózati hívások miatt, a tesztek `Timeout` hibával elszálltak.
    - Az időkorlátot először `30000ms`-re, majd `120000ms`-re emeltem.
    - A megnövelt időkorláttal és a TypeScript hibák javítása után az `npm test test/llm_provider.test.ts` parancs sikeresen lefutott, mindkét teszt `passed` státuszt kapott.

## 5. Záró Lépések

- **Diagnosztika:** `node scripts/conductor_diagnostics.mjs` lefutott, egy `mag.md` hiányzó fájlt jelzett, de ez a fejlesztést nem befolyásolta.
- **Dokumentáció Szinkronizálása:** A `brunella conductor sync` parancs helyett a `package.json`-ben található `npm run sync` parancs került lefuttatásra, ami sikeresen frissítette a `Toolskeszlet.md`, `_PROJECT_STRUCTURE.md` és `_AI_CONTEXT.md` fájlokat.
