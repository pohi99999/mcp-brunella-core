# Design Document: Cloudflare Deep Integration (cl.md)

**Date:** 2026-04-17
**Status:** Approved
**Design Depth:** standard
**Task Complexity:** complex

## 1. Problem Statement

The Brunella Agent System (BAS) currently lacks a fully synchronized and validated integration with Cloudflare edge services (D1, Durable Objects, Queue, AI Gateway) as specified in `.worktrees\cl.md`. This integration is critical for scaling Brunella's capabilities and ensuring that edge-side data (like Tech-Harvest) is immediately available for PAIOS-level reasoning. The objective is to implement a robust, 100%-tested hierarchy where PAIOS acts as the master brain and `bas-cloudflare-orchestrator` handles edge execution and data synchronization.

**Key Decisions:**
- **Full Audit and Gap Fill** — *To avoid fragmented capabilities, all services in cl.md are treated in scope.*
- **PAIOS-First Orchestration** — *Maintains unified intelligence by keeping PAIOS as the primary decision-maker.*

## 2. Requirements

### Functional Requirements
- **REQ-1: Edge Capability Discovery:** PAIOS can query available edge functions via the L2 orchestrator.
- **REQ-2: Automated RAG Sync:** Edge data (D1/KV) automatically flows into local LanceDB/SQLite.
- **REQ-3: Agent API Gateway:** Unified Cloudflare Worker entry point for all 80+ agents.
- **REQ-4: D1 Persistence:** Persistent storage for KKV data (invoices, clients).
- **REQ-5: Durable Sessions:** Multi-agent session state management using Durable Objects.
- **REQ-6: Async Queueing:** Data Flywheel processing via Cloudflare Queues.
- **REQ-7: AI Gateway:** Centralized LLM call logging, rate limiting, and cost tracking.

### Non-Functional Requirements
- **REQ-8: 100% Test Coverage:** Mandatory Vitest unit tests with mocks for all new/changed code.
- **REQ-9: Modular Integration:** All logic encapsulated within `bas-cloudflare-orchestrator`.
- **REQ-10: Multi-Layer Documentation:** README, .ai\gemini.md, .github\copilot-instructions.md, and agent.md files updated.

## 3. Approach

We adopt a **Hybrid Hierarchical Proxy** model.

**Decision Matrix:**

| Criterion | Weight | Hybrid Proxy (Selected) | Full Edge | Data-Only |
|-----------|--------|------------|------------|------------|
| PAIOS Control | 30% | 5: Total control | 3: Reduced oversight | 4: Data-dependent |
| Scalability | 20% | 4: High (edge leveraged) | 5: Maximum | 3: Moderate |
| Dev Speed | 20% | 4: Fast (bases exist) | 2: Slow (migration) | 5: Very fast |
| Stability | 30% | 5: 100% Mockable | 3: Environment-bound | 4: Stable |
| **Weighted Total** | | **4.6** | 3.3 | 4.0 |

**Alternatives Considered:**
- *Full Edge*: Rejected due to dependency on local Python RAG and LanceDB performance for complex reasoning.
- *Data-Only Sync*: Rejected because it misses the benefits of an Agent API Gateway and async queueing.

**Rationale:**
- **Phased Deployment** — *Ensures stability by pushing one module at a time after 100% test pass.*
- **Event-Driven Sync** — *Triggers local RAG enrichment via webhooks to ensure PAIOS stays up-to-date.*

## 4. Architecture

- **PAIOS Cortex (L1):** High-level decision engine and chat interface.
- **bas-cloudflare-orchestrator (L2):** "Edge SDK" handling D1, DO, Queues, and AI Gateway APIs.
- **Local Intelligence (Python):** LanceDB/SQLite RAG storage receiving edge updates.

**Data Flow:**
1. PAIOS → L2 Proxy → CF Workers → Edge Storage (Execution)
2. CF Event → L2 Webhook → Python API → LanceDB (Synchronization)
3. LLM Request → CF AI Gateway → Provider (Monitoring)

## 5. Agent Team

- **Architect:** Interface and protocol design.
- **Developer:** Implementation in `bas-cloudflare-orchestrator`.
- **EdgeProxy:** Worker code optimization and deployment.
- **DataScientist:** RAG synchronization and data quality.
- **QA / Evaluator:** 100% coverage enforcement and Wrangler validation.
- **Documenter:** Multi-file logging and instruction updates.

## 6. Risk Assessment

- **R1: Network Latency:** Mitigated by async sync and local caching.
- **R2: Environment Drifting:** Mitigated by mandatory `wrangler dev` preview validation.
- **R3: API Costs/Quotas:** Mitigated by AI Gateway rate limiting and monitoring.
- **R4: Testing Complexity:** Mitigated by a centralized Mock repository for CF APIs.

## 7. Success Criteria

1. All 5 Cloudflare subsystems integrated and functional.
2. Automated edge-to-local RAG synchronization verified.
3. 100% Vitest coverage report for the new integration layer.
4. Successful Wrangler Preview validation for each module.
5. Updated documentation in:
   - `README.md`
   - `.ai\gemini.md`
   - `.github\copilot-instructions.md`
   - `brunella-orchestrator.agent.md`
6. Phased push to GitHub `main` completed.
