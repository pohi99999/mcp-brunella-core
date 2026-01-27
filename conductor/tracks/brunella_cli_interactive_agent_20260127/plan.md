# Implementation Plan - Brunella CLI Interactive Agent Mode

## Phase 1: Core Chat REPL Enhancement
- [x] Task: Persistent Chat Session
    - [x] Módosítsd a `src/cli/commands/chat.ts`-t, hogy támogassa a kontextus megőrzését (üzenetelőzmények).
    - [x] Implementáld a `/exit`, `/clear`, `/reset` belső parancsokat.
- [x] Task: Context Window Management
    - [x] Korlátozd a visszaküldött üzenetek számát a token-limit miatt.

## Phase 2: Tool Integration in CLI
- [x] Task: CLI Agent Orchestrator
    - [x] Kösd össze a CLI chatet az `AgentManager.executePlan` metódusával.
    - [x] Implementáld a "Thought" (Gondolat) és "Action" (Művelet) vizualizációt a terminálban (Chalk animációk/színek).
- [x] Task: Tool Approval Flow
    - [x] (Opcionális) Adj lehetőséget a felhasználónak, hogy jóváhagyja a kód futtatását (Safe Mode).

## Phase 3: Interpreter & System Feedback
- [x] Task: Live Output Streaming
    - [x] Biztosítsd, hogy a Python/Node.js outputok azonnal megjelenjenek.
- [x] Task: Error Handling & Self-Healing
    - [x] Ha a kód hibás, a CLI-ben futó ügynök próbálja meg automatikusan javítani.

## Phase 4: Verification
- [x] Task: End-to-End CLI Test
    - [x] Teszt: "Számold ki a Fibonacci sorozat 10. elemét Pythonban és írd ki."
- [x] Task: Conductor - User Manual Verification

