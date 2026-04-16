---
name: paios
description: "Use when the user says /paios, PAIOS, or PAIOS Orchestrator and wants to steer Brunella from the dashboard or Copilot CLI."
---

# PAIOS Control

Use this skill for conversational control of the Brunella brain.

## Trigger conditions

- `/paios`
- PAIOS chat
- Brunella orchestrator chat
- any request to direct the system without changing code

## Relevant surfaces

- `src/components/dashboard/PAIOSOrchestratorChat.tsx`
- `src/dashboard/lib/navigation.tsx` (`paios`)
- `src/components/dashboard/CopilotOrchestratorPanel.tsx` when the request expands to broader orchestration

## Do

- Keep the request in the conversational / orchestration layer.
- Ask which system goal matters if the intent is ambiguous.
- Translate the request into a clear action plan or route it to the right Brunella agent.
- Preserve observability: if a task leaves the chat layer, say where it goes.

## Don't

- Invent a new protocol or hidden automation.
- Treat a PAIOS request as a code edit by default.
- Skip the existing dashboard navigation or MCP/tool path.

## Validation

- The `paios` navigation item exists and renders the chat surface.
- The command path is explicit enough to explain in a review.
- Any downstream action still uses the correct agent, tool, or track.
