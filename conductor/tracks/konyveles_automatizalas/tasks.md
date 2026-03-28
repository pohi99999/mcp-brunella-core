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

5. Matching Engine design doc — felelős: Architect (✔️ elkészült)
   - Output: `conductor/tracks/konyveles_automatizalas/design/matching_engine.md`

## Következő lépések (ma)
- Folyamatosan gyűjtsük a bank/NAV/email mintákat, és a design dokumentum alapján kezdjük összekötni a matching logikát az agent pipeline-nal.
   - Futtassuk a `scripts/konyveles_discovery_run.js`-t ütemezve, hogy bank CSV importálást automatizáljuk.
   - Illesszük be az EmailAgent / NavAgent outputot a `match` függvényhívásokba (adhatók `parsed` mezők).
   - Bővítsük a `src/matching/matcher.ts` és `data/bookkeeping_db.ts` modulokat, hogy a pontszámokat, kivételeket és státuszokat eltárolják.
