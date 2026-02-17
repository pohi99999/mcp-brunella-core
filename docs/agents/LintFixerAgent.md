# LintFixerAgent

**Agent Name:** `LintFixer`
**Source:** `src/agents/LintFixerAgent.ts`
**Role:** Karbantartó - ESLint hibák automatikus javítása

## Description

Mikro-ügynök ami detektálja és javítja az ESLint/TypeScript hibákat. Képes automatikus fix-re és javítási javaslatok generálására.

## Capabilities

- `lint_check`
- `auto_fix`
- `suggest_fix`
- `type_check`
- `batch_fix`

## Inputs / Outputs

- **Primary input:** Task string + optional context object.
- **Primary output:** Agent result/response object.

## Operational Notes

- Generated automatically by `ProjectConductorAgent` during `conductor sync`.
- Replace placeholders and expand with concrete examples over time.

## TODO

- [ ] Add real-world usage examples
- [ ] Add failure modes and recovery notes
- [ ] Add integration touchpoints
