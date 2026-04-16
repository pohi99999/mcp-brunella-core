---
name: knowledge-memory-intelligence
description: "Use when the user works with knowledge, memory, preferences, semantic recall, or vector statistics surfaces."
---

# Knowledge, Memory, and Intelligence

Use this skill for Brunella's recall / memory / semantic context surfaces.

## Trigger conditions

- knowledge
- memory
- cognitive memory
- user preferences
- vector stats
- semantic recall or context lookups

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`knowledge`, `memory`, `cognitive-memory`, `user-preferences`, `vector-stats`)
- `src/core/autonomousInfraRuntime.ts`
- `copilotFeedbackChannel`-backed reflection paths from `src/core/autonomousInfraRuntime.ts`
- `docs/ai/README.md`

## Do

- Use the existing memory / retrieval layer instead of inventing a new one.
- Make every write to memory or preferences explicit.
- Redact sensitive data before persisting or replaying it.
- Separate recall, summarization, and learning concerns.

## Don't

- Write memory silently.
- Treat memory as a general dump for arbitrary state.
- Leak private prompts, tokens, or personal data into logs.

## Validation

- The knowledge panel can explain where the data comes from.
- Memory updates are auditable and scoped.
- Vector statistics or recall results match the selected surface.
