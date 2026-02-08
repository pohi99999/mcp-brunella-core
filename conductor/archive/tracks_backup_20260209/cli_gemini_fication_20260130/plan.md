# Plan: CLI Gemini-fication & Developer Agent Integration

**Track ID:** `cli_gemini_fication_20260130`
**Cél:** A Brunella CLI átalakítása "Gemini-szintű" eszközzé: interaktív menürendszer, közvetlen chat integráció az Orchestratorral, stabil MCP kapcsolatok és a Python kódolás (Developer Agent) támogatása.

## 1. Helyzetkép (Előtte)
- A CLI parancsok töredezettek voltak (`src/cli/index.ts` vs `src/cli.ts`).
- A `chat` parancs nem érte el a toolokat.
- Az `interpreter` parancs csak lokális stub volt.
- Windows környezetben az SSE (Server-Sent Events) kapcsolat instabil volt.
- Hiányzott a dedikált kódoló ügynök.

## 2. Elvégzett Lépések

- [x] **1. CLI Konszolidáció (`src/cli.ts`):**
    - Minden parancs (`chat`, `run`, `doctor`, `interpreter`) egyetlen, egységes belépési pontba került.
    - Argumentum nélküli indítás esetén automatikusan betölti az interaktív menüt.
- [x] **2. Interaktív Menü (`src/interactive.ts`):**
    - Új, felhasználóbarát menürendszer (Inquirer) a funkciók eléréséhez.
- [x] **3. Developer Agent Implementálása (`src/agents/DeveloperAgent.ts`):**
    - Új ügynök, amely képes Python kódot generálni és futtatni a `pythonShell` (illetve a mögötte lévő FastAPI) segítségével.
    - Regisztrálva a rendszerben (`src/server/registry.ts`).
- [x] **4. Orchestrator Felokosítása:**
    - A prompt dinamikusan olvassa be az ügynököket, így azonnal "látja" az új `Developer` és `Evaluator` ügynököket.
- [x] **5. Stabilitás Javítása (Windows Fix):**
    - A `BrunellaClient` (`src/utils/mcpClient.ts`) átállítva kényszerített `stdio` módra CLI használat esetén. Ez kiküszöböli a hálózati (SSE) hibákat és a `Session not found` problémákat.
- [x] **6. MCP Konfiguráció Tisztítása:**
    - `mcp_servers.json` tisztítva (csak stabil szerverek maradtak).
    - GitHub token beállítva.

## 3. Eredmény
A CLI mostantól egy robusztus, "all-in-one" eszköz, ahol a Chat-ben természetes nyelven lehet utasítani a rendszert kódolásra, ellenőrzésre vagy kutatásra.
