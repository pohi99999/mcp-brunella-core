# Track: Gemini-fication & Web UI 2.0

**Status**: COMPLETED
**Date**: 2026.01.27
**Goal**: A Brunella CLI és Web UI "felokosítása" a Gemini CLI szintjére (streaming, tool use, modern chat).

## Changes
1.  **Core Architecture**:
    *   `LLMClient` implementálása: Egységes felület az Ollama/AnythingLLM elérésére, streaming támogatással.
    *   `McpClientManager` refaktor: Singleton minta a stabil MCP kapcsolatokért.

2.  **CLI Updates**:
    *   `npm run cli -- chat`: Új, interaktív chat mód.
    *   `/model`, `/url` parancsok a menet közbeni váltáshoz.
    *   Szigorú TypeScript típusosság bevezetése.

3.  **Web UI Upgrade**:
    *   Backend (`src/server/web.ts`) átírása az új `LLMClient` használatára.
    *   Frontend (`ChatInterface.tsx`, `useMCP.ts`) felkészítése a streaming üzenetek fogadására (`bot_message_chunk`).
    *   Automatikus MCP szerver csatlakozás indításkor.

4.  **Localization**:
    *   A rendszer alapértelmezett modellje mostantól `llava-llama3:latest`, amely kiválóan beszél magyarul.

## Verification
- CLI teszt: SIKERES (Streaming chat, model váltás).
- Web UI teszt: SIKERES (Streaming chat, auto-connect).
- Build: SIKERES (`tsc` backend + `vite` frontend).
