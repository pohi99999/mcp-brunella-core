# EmailAgent

**Agent Name:** `EmailAgent`
**Source:** `src/agents/EmailAgent.ts`
**Role:** Email/Drive watcher - PDF collector

## Description

Letölti a PDF számlákat IMAP/GDrive forrásból és menti a bookkeeping_db-be

## Capabilities

- `email_fetch`
- `pdf_store`
- `id_assign`

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
