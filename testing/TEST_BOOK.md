# Semantic Test Book: Cogella Core

This document defines the semantic test scenarios for Jules (or any Agent) to execute.
Goal: Verify the system's integrity from a user perspective.

## Guidelines for Jules
1. Read a Scenario.
2. Execute the steps using available tools (`browser`, `system`, `agent`).
3. Report success or failure for each step.
4. If a step fails, try to diagnose why.

## Scenario 1: System Health Check
**Goal:** Verify that the backend is running and the dashboard is accessible.

**Steps:**
1. Check system metrics.
   - Tool: `monitor_get_metrics`
   - Expectation: Returns valid JSON with uptime > 0.
2. Verify MCP connection and Agent Registry.
   - Tool: `agent_list`.
   - Expectation: Returns list of agents (Researcher, Developer).

## Scenario 2: Knowledge Base Verification
**Goal:** Verify RAG functionality.

**Steps:**
1. Perform a semantic search.
   - Tool: `knowledge_semantic_search` with query "What is Cogella Core?".
   - Expectation: Returns results with content related to the product definition.

## Scenario 3: Agent Capabilities
**Goal:** Verify that agents are registered and active.

**Steps:**
1. List agents.
   - Tool: `agent_list`.
   - Expectation: Contains "researcher" and "developer".
2. Delegate a simple task to "researcher".
   - Tool: `agent_delegate` with agent "researcher" and task "Summarize the tech stack".
   - Expectation: Returns a summary based on `tech-stack.md`.
