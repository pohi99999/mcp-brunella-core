# Specifikáció: Brunella 2.0 - Gemini-fication

**Dátum:** 2026. február 4.
**Track ID:** `brunella_2_0_geminification_20260204`
**Prioritás:** HIGH

## 1. Célkitűzés

A Brunella Agent System (BAS) interaktív és poliglott képességeinek implementálása a "Brunella 2.0" terv szerint. Ez magában foglalja a Multi-Provider LLM támogatást a Gemini API integrálásával, egy állapot-nyilvántartó CLI chat ciklus létrehozását, és az Orchestrator intelligencia szintjének növelését a dinamikus modellválasztás képességével.

## 2. Követelmények

### 2.1. Multi-Provider LLM Architektúra
- **Új függőségek telepítése:**
  - Node.js: `@google/generative-ai`, `@anthropic-ai/sdk`, `readline-sync`, `chalk@4.1.2`
  - Python: `google-generativeai`, `langsmith`
- **Új Típusdefiníciók (`src/types/llm.ts`):**
  - `LLMProvider` típus létrehozása: `'ollama' | 'gemini' | 'claude' | 'openai'`.
  - `IConversationContext` interfész definiálása a beszélgetés előzményeinek és a kontextusnak a tárolására.
- **Központi LLM Kliens (`src/core/llm_client.ts`):**
  - Egy `generateResponse` függvény implementálása, amely képes kezelni a `gemini` és `ollama` szolgáltatókat.
  - A Gemini hívásokhoz a `gemini-1.5-flash` modellt kell használni.
  - A kliensnek automatikus fallback mechanizmussal kell rendelkeznie: Gemini hiba esetén váltson vissza Ollama-ra.
  - Minden LLM hívást a `langsmith` `traceable` funkciójával kell becsomagolni a "Glass Box" protokollnak megfelelően.

### 2.2. Rendszerszintű Integráció
- **`OrchestratorAgent` frissítése:** Az ügynöknek az új `generateResponse` függvényt kell használnia a `chatWithOllama` helyett, és képesnek kell lennie a `context`-ből kapott `provider` alapján modellt váltani.
- **CLI Chat Loop (`src/cli.ts`):**
  - A `brunella chat` parancsot interaktívvá és állapot-nyilvántartóvá kell tenni.
  - A beszélgetés előzményeit egy `history` tömbben kell tárolni.
  - Implementálni kell a `/switch <provider>` parancsot a szolgáltatók közötti dinamikus váltáshoz.
- **Dashboard Neural Link:** A `NeuralLinkChat.tsx` komponens backend hívásainak (közvetve, az API végponton keresztül) az új `generateResponse` logikát kell használniuk.

### 2.3. Verifikáció és Tesztelés
- **Új Teszt Fájl (`test/llm_provider.test.ts`):**
  - Egy Vitest tesztcsomag létrehozása, amely ellenőrzi az alábbiakat:
    1. Az `ollama` szolgáltató alapértelmezettként működik.
    2. A rendszer helyesen vált vissza `ollama`-ra, ha a `gemini` API hívás (pl. hiányzó API kulcs miatt) hibát ad.

## 3. Végrehajtási Protokoll
- A fejlesztés minden lépését a Conductor protokollok szerint kell végrehajtani.
- A "0-Hiba Stratégia" és a "Glass Box" elvek betartása kötelező.
- A folyamat végén a `conductor sync` paranccsal kell frissíteni a projekt dokumentációját.
