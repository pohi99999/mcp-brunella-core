# Innovation Bridge Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TRIZ-based cross-industry swarm solver.

**Architecture:** A multi-stage pipeline: Intent Analysis -> TRIZ Mapping -> Parallel Swarm Research -> Synthesis -> Storage.

**Tech Stack:** TypeScript, GPT-4o, Gemini 2.0 Flash, LanceDB, Inquirer.js.

---

### Task 1: TRIZ Knowledge Base
**Files:**
- Create: `src/data/triz_matrix.json`
- Create: `src/data/triz_principles.json`
- Test: `test/triz_data.test.ts`

**Step 1: Create the TRIZ Principles JSON** (The 40 inventive principles).
**Step 2: Create the Contradiction Matrix JSON** (39x39 mapping to principles).
**Step 3: Write test to verify data integrity.**
**Step 4: Commit.**

### Task 2: Innovation Bridge Agent Core
**Files:**
- Create: `src/agents/InnovationBridgeAgent.ts` (Implement BaseAgent)
- Modify: `src/agents/registry.json`
- Test: `test/innovation_bridge_core.test.ts`

**Step 1: Define InnovationBridgeAgent class.**
**Step 2: Implement `stage1_analyzeIntent`** (Extract TRIZ parameters).
**Step 3: Implement `stage2_mapPrinciples`** (Matrix lookup).
**Step 4: Register agent in `registry.json`.**
**Step 5: Write failing tests for intent analysis.**
**Step 6: Commit.**

### Task 3: Research Swarm Orchestration
**Files:**
- Modify: `src/agents/InnovationBridgeAgent.ts`
- Test: `test/innovation_bridge_swarm.test.ts`

**Step 1: Implement `stage3_launchSwarm`** (Parallel `AgentManager.execute` calls).
**Step 2: Define industry exclusion logic.**
**Step 3: Test parallel delegation.**
**Step 4: Commit.**

### Task 4: LanceDB Persistence
**Files:**
- Modify: `src/utils/lancedb_client.ts`
- Modify: `src/agents/InnovationBridgeAgent.ts`

**Step 1: Add `innovation_analogies` table schema to LanceDB client.**
**Step 2: Implement result storage logic.**
**Step 3: Test semantic retrieval of previous analogies.**
**Step 4: Commit.**

### Task 5: Dashboard & CLI
**Files:**
- Create: `src/dashboard/components/dashboard/InnovationBridgeWidget.tsx`
- Create: `src/cli/commands/innovate-hu.ts`

**Step 1: Build the Dashboard UI.**
**Step 2: Implement the CLI command.**
**Step 3: Final E2E system test.**
**Step 4: Commit.**
