# Tasks: Könyvelés automatizálása — kezdeti teendők

## Aktuális státusz
- Discovery (mezőtérképek & minta adathalmaz) — in progress

## Kezdő feladatok

1. Discovery & Data mapping — felelős: ProjectConductor
   - Output: `conductor/tracks/konyveles_automatizalas/resources/mappings/` + `samples/`
   - Feladatok:
     - NAV XML mezők listázása
     - PDF mezők elvárt sémája (OCR output)
     - Bank CSV/JSON mező térkép készítése

2. Email-Agent skeleton — felelős: robotkez / Developer
   - Output: `src/agents/emailAgent.ts` (skeleton) + `data/invoices/`

3. NAV-API Agent skeleton — felelős: Developer
   - Output: `src/agents/navAgent.ts` + `data/nav/`

4. OCR/LLM extraction prototype — felelős: DataScientist
   - Output: `scripts/ocr_extract.sh` vagy `myai/` Python prototípus

5. Matching Engine design doc — felelős: Architect
   - Output: `conductor/tracks/konyveles_automatizalas/design/matching_engine.md`

## Következő lépések (ma)
- Létrehozom a `resources/mappings/` mappát és egy `sample_nav_fields.csv` + `sample_pdf_fields.csv` fájlt példa mezőkkel.
