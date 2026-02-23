# PropertyAnalystAgent

**Agent Name:** `PropertyAnalyst`
**Source:** `src/agents/PropertyAnalystAgent.ts`
**Role:** Ingatlan Elemző

## Description

Ingatlan dokumentumokat (PDF/JPG/PNG) elemez Gemini Vision OCR-rel. Kinyeri a HRSZ-t, alapterületet, közműveket, és alapértékelést végez.

## Capabilities

- `property_ocr`
- `document_ingestion`
- `property_valuation`
- `hrsz_extraction`

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
