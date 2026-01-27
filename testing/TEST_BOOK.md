# Jules' Test Book

This document defines the standard QA scenarios for Cogella Core (MCP Brunella Core).
Jules uses these scenarios to verify system integrity.

A tesztforgatókönyvek a **Fehér Könyv** rétegeihez igazodnak (pl. monitor = Immunrendszer, knowledge = Tudásbázis, agent_list = Agypiac).

## Scenario 1: Basic Health Check
**Goal:** Verify the server is running and responsive.
**Steps:**
1.  Connect to the MCP server.
2.  Call `ping` tool.
3.  **Expect:** Response containing "Pong" or confirmation of activity.

## Scenario 2: System Metrics
**Goal:** Check if system monitoring is active.
**Steps:**
1.  Call `monitor_get_metrics` tool.
2.  **Expect:** JSON object with `uptime`, `memory`, and `cpu` fields.

## Scenario 3: Agent Registry
**Goal:** Verify agent definitions are loaded.
**Steps:**
1.  Call `agent_list` tool.
2.  **Expect:** A JSON list containing at least "Jules", "Brunella", "Researcher", "Developer".

## Scenario 4: RAG Functionality (Knowledge)
**Goal:** Verify semantic search is operational (requires LanceDB).
**Steps:**
1.  Call `knowledge_semantic_search` with query "What is Brunella?".
2.  **Expect:** A list of results (even empty is technically success for the tool call, but non-error).

## Scenario 5: Smoke Test (Script)
**Goal:** Run the provided smoke script.
**Steps:**
1.  Execute `npm run smoke`.
2.  **Expect:** Exit code 0 and "Protocol ping: OK".
