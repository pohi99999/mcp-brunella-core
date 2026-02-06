# Implementation Plan: LangSmith Integration

## Phase 1: Environment Setup
- [ ] Task: **Update `.env` template.**
    - Add LangSmith placeholders to `.env`.
- [x] Task: **Install Dependencies.**
    - Run `npm install langsmith` in root.
    - Run `uv pip install langsmith` (or add to `requirements.txt`) in `myai/`.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Env' (Protocol in workflow.md)

## Phase 2: Python Subsystem Tracing
- [x] Task: **Instrument `myai/core/agent.py`.**
    - Import `traceable` from `langsmith`.
    - Decorate the `Agent.execute` method.
    - Pass through context metadata.
- [ ] Task: **Verify Python Tracing.**
    - Run a standalone Python agent test and check LangSmith.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Python Trace' (Protocol in workflow.md)

## Phase 3: Node.js Core Tracing
- [x] Task: **Instrument `src/core/llm_client.ts`.**
    - Wrap the `chatStream` call with LangSmith client.
    - Ensure tags (agent_name, task_id) are passed correctly.
- [ ] Task: **End-to-End Test.**
    - Call an agent via `brunella run cli agents`.
    - Verify the full trace (Node -> Python) appears in LangSmith.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: E2E Trace' (Protocol in workflow.md)
