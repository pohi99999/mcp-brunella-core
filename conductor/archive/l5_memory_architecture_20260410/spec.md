# L5 Memory Architecture - Structured, Preference es Cognitive Memory Layer — Spec

## Objective
Formalize Brunella's multi-surface memory subsystem as a single L5 architecture layer that persists reusable task outcomes, user preferences, and cognitive feedback while exposing stable operator-facing API, CLI, and dashboard controls.

## Problem Statement
The repository already contained several memory-related capabilities, but they were spread across structured task memory, preference storage, context discovery, agent reuse, and cognitive bridge modules without canonical conductor truth. Before downstream predictive work can rely on this layer, the memory architecture must be validated and archived as a coherent L5 capability.

## Scope
- Validate `structuredMemory` as the reusable task-result and pattern-reuse substrate.
- Validate user preference and context-memory utilities as the user-facing memory branch.
- Confirm agent/runtime integrations through `BaseAgent`, pattern reuse, and the Copilot cognitive bridge.
- Confirm operator visibility through REST, CLI, and dashboard surfaces.
- Add any missing focused regression coverage needed for confident archival.

## Non-Goals
- Replacing GraphRAG or the broader knowledge graph stack.
- Building predictive decision orchestration inside this track.
- Redesigning the database schema beyond what is needed for validation and safe observability.

## Candidate Implementation Targets
- `src/core/structuredMemory.ts`
- `src/utils/memoryContext.ts`
- `src/tools/memoryTool.ts`
- `src/server/memoryRoutes.ts`
- `src/cli/memoryCommands.ts`
- `src/dashboard/components/dashboard/MemoryPanel.tsx`
- `src/dashboard/components/dashboard/CognitiveMemoryPanel.tsx`
- `src/core/copilotCognitiveBridge.ts`
- `src/core/copilotFeedbackChannel.ts`
- `src/agents/BaseAgent.ts`
- `test/memory/structuredMemory.test.ts`
- `test/memory_context.test.ts`
- `test/memoryCommands.test.ts`
- `test/memoryRoutes.golden.test.ts`
- `test/dashboard/components/MemoryPanel.test.tsx`
- `src/dashboard/components/dashboard/CognitiveMemoryPanel.test.tsx`

## Acceptance Criteria
- Structured memory supports save/query/purge flows that agents can reuse safely.
- User/context memory discovery and preference retrieval remain functional.
- BaseAgent and the cognitive bridge both consume the memory layer as part of normal runtime behavior.
- Operator surfaces exist and are validated across backend, CLI, and dashboard paths.
- Focused regression tests and repo builds pass after the track is formalized.

## Dependency Note
This track has no blocking conductor prerequisite in the current repo state. It instead becomes a dependency-enabling substrate for downstream predictive-decision and financial-pulse work.
