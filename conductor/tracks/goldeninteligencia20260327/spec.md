# Specifikáció: GoldenIntelligencia20260327
**Track ID:** `goldeninteligencia20260327`
**Státusz:** proposed
**Prioritás:** HIGH

## 1. Cél
A track célja, hogy public business, társadalmi, politikai, pénzügyi és technológiai jelekből kurált intelligenciát állítson elő, és azt a golden datasetbe, valamint a releváns tudásbázisokba emelje.

## 2. Scope
- Public források gyűjtése és normalizálása.
- Evidence-backed claim-ek és kapcsolatok kinyerése.
- Golden dataset és knowledge base szinkron.
- Dashboard monitorozás és kuráció.
- CLI parancs a futtatáshoz, review-hoz vagy manual triggerhez.

## 3. Pipeline
1. Source discovery.
2. Retrieval.
3. Normalization.
4. Evidence extraction.
5. Scoring, dedupe és contradiction handling.
6. Human review.
7. Promotion a gold datasetbe és a KB-kbe.
8. Feedback loop és minőségértékelés.

## 4. Adatmodell
- source
- timestamp
- claim
- entity
- relation
- confidence
- bias label
- status
- provenance

## 5. Felületek
- Enterprise dashboard panel: `Intelligence Monitor`.
- CLI command: `brunella intelligence watch`.
- A panel futásokat, forrásokat, review queue-t és promotion státuszt mutat.

## 6. Guardrail-ek
- Nincs személyes profilozás.
- Nincs rejtett vagy engedély nélküli gyűjtés.
- A források licenc- és robots szabályait tiszteletben kell tartani.
- Érzékeny domain-eknél emberi validáció szükséges.
- Minden promotion auditálható legyen.

## 7. Sikerkritériumok
- Ismételhető signal-gyűjtés működik.
- A gold dataset növekedik, de csak kurált elemekkel.
- A tudásbázisok trace-elhetően frissülnek.
- A dashboard és a CLI támogatja a review-t és a monitorozást.
- A minőség javulása mérhető evalokon keresztül.
