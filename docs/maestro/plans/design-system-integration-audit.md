---
title: Brunella System-wide Integration & Intelligence Audit (n8n, Cloudflare, RAG)
date: 2026-04-16
task_complexity: complex
design_depth: deep
status: approved
---

## 1. Problem Statement
The Brunella Agent System (BAS) needs its external integrations (n8n business logic, Cloudflare Edge Worker proxies, Robotkez automation) and internal memory (RAG/AnythingLLM) to function seamlessly and transparently via the PAIOS Hungarian chat interface. Currently, long-running asynchronous tasks (webhook timeouts, slow scraping) cause the Orchestrator to block or present raw technical errors to the user. Additionally, memory retrieval needs to be faster and more integrated into the conversation without waiting for dedicated Research agents.

## 2. Approach: Asynchronous Pre-Retrieval & Shadow Debugging
This design adopts a three-pronged strategy to ensure 100% fluid Hungarian communication on the frontend while securely executing complex backend tasks:

*   **Asynchronous Fire-and-Forget Polling:** For n8n and Cloudflare Edge calls, the Orchestrator will immediately acknowledge the command in Hungarian ("Elindítottam a feladatot..."), dispatch the payload, and return a `taskId`. A background polling mechanism in `AgentManager` will monitor the completion status and push updates via `Socket.IO` when finished.
*   **Hybrid Pre-Retrieval (RAG):** Before the LLM generates a response in `UniversalOrchestratorService`, it will perform a fast, hybrid semantic search (via LanceDB/AnythingLLM) against local documents and past conversations. This context is injected directly into the Orchestrator's prompt, allowing it to answer fact-based questions instantly.
*   **Invisible Debug Channel:** A new `system:debug` WebSocket event will stream raw JSON payloads, webhook responses, and Playwright (Robotkez) trace logs. The PAIOS UI will feature a hidden or toggleable "Debug Console" that displays this stream, ensuring developers can diagnose issues without breaking the end-user's fluent conversational experience.

*Alternative Considered:* Synchronous blocking for all webhook calls was rejected as it leads to poor UX (timeouts and frozen UI). Relying solely on `Researcher` agents for all memory queries was rejected due to unnecessary latency for simple factual lookups.

## 3. Requirements & Constraints
*   **Functional:** The Orchestrator MUST handle n8n/Cloudflare tool calls asynchronously. It MUST inject RAG context before answering. The UI MUST display a debug toggle for developers.
*   **Technical:** Modifying `UniversalOrchestratorService`, `AgentManager` (polling logic), and `SocketService` (new debug events).
*   **Resilience:** Polling mechanisms must have exponential backoff and absolute timeouts (e.g., 5 minutes) to prevent zombie processes.
*   **Quality:** The new async flows and debug channel must be verified with Playwright E2E tests simulating a complex business process (e.g., P-Sales invoice processing).

## 4. Architecture & Data Flow
1.  **User Input:** User requests a complex task (e.g., "Keresd meg az új lead-eket az n8n-en").
2.  **Pre-Retrieval:** `UniversalOrchestratorService` queries LanceDB/AnythingLLM for context related to "leadek".
3.  **Tool Execution:** The LLM decides to call the `n8n_trigger` tool.
4.  **Async Dispatch:** `AgentManager` fires the webhook, gets a `taskId`, and immediately returns control to the LLM.
5.  **User Feedback:** LLM replies: "Elindítottam a lead keresést..."
6.  **Polling & Debug:** `AgentManager` polls the task status. Raw webhook responses are emitted via `system:debug` to the UI's invisible debug channel.
7.  **Completion:** Upon completion, a `system:log` or `agent:chatter` event notifies the UI, and the user receives the final Hungarian summary.

## 5. Security & Privacy
*   Debug logs (`system:debug`) containing sensitive raw webhook payloads MUST NOT be stored in the primary chat history (`messages` array) that is sent back to the LLM, to prevent context window bloat and prompt injection.
*   Polling mechanisms must enforce strict timeouts.

## 6. Test Plan
*   **Unit Tests:** Test the async polling logic in `AgentManager` with mocked external APIs.
*   **Integration Tests:** Verify the Pre-Retrieval (RAG) injection in `UniversalOrchestratorService`.
*   **E2E Tests (Playwright):** Simulate an n8n webhook call from the PAIOS chat, verify the "invisible" debug console receives the payload, and ensure the chat remains responsive during the background task.