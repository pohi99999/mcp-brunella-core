# Brunella Chief of Staff & AGI Foundation Workflow Design

**Date:** 2026-04-18
**Status:** Approved
**Topic:** Architectural Separation & AI "Chief of Staff" Workflow

## 1. Executive Summary

This document outlines a structural and operational paradigm shift for the Brunella Agent System (BAS). As the system scales towards AGI (Agent-to-Agent negotiation, Zero-prompt strategy, self-healing), the manual orchestration overhead has become a bottleneck. This design introduces the **"Visionary-Architect" symbiotic workflow**, formally separates the BAS Core from Client Projects, and establishes a foundation for an **"Autocleaning Swarm"** to eliminate technical debt (orphan code, unused endpoints, duplicate agents).

## 2. Architectural Separation (Workspace Isolation)

To eliminate the "40GB noise" in the `F:\mcp-brunella-core` directory and establish clear boundaries between the engine and its products:

### 2.1 The Core Engine (`F:\mcp-brunella-core`)
- Remains the central orchestrator and intelligence hub (Paios chat).
- Will be purged of external client project files (e.g., removing client worktrees).
- Focuses exclusively on:
  - Agent definitions (`src/agents/`)
  - Conductor tracking (`conductor/tracks/`)
  - LLM Routing (Bifrost Gateway)
  - Core MCP Tools

### 2.2 The Client Projects (`Z:\.000_PROJEKTEK\`)
- All client work (Nova_Assiss, Toura, P-Books, P-Ber, P-Search, ViktoriaVarga) will reside here as distinct, independent Git repositories.
- **Orchestration:** Brunella will manage these remote directories using absolute paths via its MCP filesystem tools (`read_file`, `write_file`, `run_shell_command`).
- **Conductor Tracking:** The overarching project status and tasks for these client projects will still be tracked centrally within `F:\mcp-brunella-core\conductor\tracks\`, but under dedicated category labels (e.g., `[Client: Nova]`).

### 2.3 The Incubator (`F:\mcp-brunella-core\myai\incubator`)
- A designated "safe zone" for rapid prototyping, zero-prompt experiments, and A2A integration testing.
- Code here is exempt from strict EPP v2 rules during the ideation phase, allowing the Visionary to brainstorm freely with the AI.
- Once proven, the Chief of Staff (AI Architect) will refactor, test, and migrate the code to the stable Core.

## 3. The "Chief of Staff" AI Interaction Model

The primary AI interface (e.g., this Gemini instance via Paios chat) will assume the role of **Chief of Staff / Lead Architect**. The interaction model shifts from passive coding assistant to proactive system guardian:

1. **Vision Intake:** The user (Visionary) provides natural language goals (e.g., "Build an A2A negotiation loop").
2. **System Awareness Check:** The Chief of Staff automatically runs `codebase_investigator` or `SocratiCode` to check for existing, similar, or abandoned implementations to prevent duplication.
3. **Design & Delegation:** The Chief of Staff drafts a `plan.md`. Upon approval, it delegates atomic tasks to specialized sub-agents (`coder`, `tester`, `devops`) rather than writing monolithic code blocks.
4. **EPP v2 Enforcement:** The Chief of Staff acts as a strict gatekeeper, ensuring no track is marked `completed` without passing tests (`npm run test:fast`), successful builds, and updated documentation (`.ai/<agent>.md`).

## 4. The Autocleaning Swarm (Technical Debt Eradication)

To prepare for L5 autonomy, the system must be aware of its own components. A massive cleanup effort is required to remove legacy clutter.

### 4.1 Phase 1: The Great Audit (Immediate Action)
A dedicated track will be launched immediately after this design's approval to map the entire `mcp-brunella-core`.
- **Agents Involved:** `DependencyGraphAgent`, `ProjectMaintainer`, `Evaluator`.
- **Objectives:**
  1. Identify and list orphan files (code not imported anywhere).
  2. Identify deprecated API endpoints (routes not used by the dashboard or external clients).
  3. Detect duplicated agent capabilities or conflicting TOML configurations.
  4. Safely remove client-specific worktrees from the `F:\` drive.

### 4.2 Phase 2: Continuous Observability
- Activation of the `system-observability-admin` skill to monitor agent health and tool usage continuously.
- Implementing periodic, automated "garbage collection" cycles managed by the `ProjectMaintainer` agent.

## 5. Success Criteria

1. The `Z:\.000_PROJEKTEK\` directory is fully established as the target for all client development.
2. The `F:\mcp-brunella-core\.worktrees` directory is safely archived/deleted, reducing project size.
3. A "Great Audit" track is successfully completed, yielding a comprehensive list of technical debt to be removed.
4. The Visionary can confidently issue high-level commands via Paios chat, knowing the Chief of Staff will handle the structural integrity and delegation.
