# InvoiceAutomationAgent

**Agent Name:** `InvoiceAutomation`
**Source:** `src/agents/InvoiceAutomationAgent.ts`
**Role:** Automated Invoice Processor

## Description

Számlák automatikus feldolgozása: Gmail letöltés, Gemini Vision elemzés, Drive mentés és Sheets rögzítés.

## Capabilities

- `gmail_read`
- `vision_extraction`
- `drive_organization`
- `sheets_logging`

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
