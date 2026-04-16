---
title: Brunella System-wide Integration & Intelligence Audit (n8n, Cloudflare, RAG)
status: approved
---

## Work Breakdown

### Phase 1: Asynchronous Fire-and-Forget Webhook/Task Polling
- **Agent**: `coder`
- **Goal**: Implement background polling in `AgentManager` and update external tools (e.g., n8n triggers, Cloudflare API clients) to use "Fire-and-Forget" execution returning `taskId` immediately. Handle timeouts gracefully. Ensure `phoenixEventBus` emits updates on these tasks asynchronously.
- **Dependencies**: None
- **Validation**: Write/update unit tests to verify async task dispatching doesn't block the main thread and correctly resolves/errors over time.

### Phase 2: Hybrid Pre-Retrieval (RAG) Integration
- **Agent**: `data_engineer`
- **Goal**: Integrate a fast semantic retrieval step (via AnythingLLM or LanceDB logic) into `UniversalOrchestratorService` before generating the LLM response. Update `MAGYAR_SYSTEM_PROMPT` to ingest this dynamic context and provide factual, un-hallucinated answers.
- **Dependencies**: Phase 1
- **Validation**: Integration tests verifying that context strings from mock databases are correctly injected into the final system prompt.

### Phase 3: Invisible Debug Channel (UI & Backend)
- **Agent**: `frontend_specialist`
- **Goal**: Add `system:debug` broadcast support to `SocketService`. Update `PAIOSOrchestratorChat.tsx` or create a new `DebugConsole.tsx` component in the Dashboard to capture and display raw JSON payloads and trace logs, toggleable via a developer switch. Ensure these logs are excluded from the main LLM conversation history.
- **Dependencies**: Phase 1, Phase 2
- **Validation**: Playwright E2E test simulating a failing/long-running n8n task and verifying the raw payload appears in the debug panel but not in the chat UI.

### Phase 4: Final Review & Quality Gate
- **Agent**: `code_reviewer`
- **Goal**: Review async patterns, RAG integration, and React state management against Brunella EPP v2 and performance guidelines.
- **Dependencies**: Phase 3
- **Validation**: Zero unresolved critical/major review findings. Ensure `npm run test:fast` and `npm run test:e2e` pass perfectly.