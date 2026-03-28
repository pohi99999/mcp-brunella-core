# GoldenIntelligencia20260327 — Session Plan

## Problem
A Brunella-nak szüksége van egy olyan intelligencia rétegre, amely public business, társadalmi, politikai, pénzügyi és technológiai jeleket gyűjt, majd ezeket kurált, visszakereshető tudássá alakítja.

## Approach
1. Először legyen tiszta a forrás-taxonomy és a governance.
2. Utána épüljön meg a gyűjtés, normalizálás és jelzés-kivonás pipeline.
3. Ezután jöjjön a bizonyíték-alapú scoring, dedupe és ellentmondáskezelés.
4. A jóváhagyott elemek kerüljenek csak a golden datasetbe és a releváns tudásbázisokba.
5. A rendszer kapjon dashboard panelt és CLI belépőt a monitorozáshoz és kurációhoz.

## Todo list
- [ ] Forrás-taxonomy és guardrail-ek definiálása.
- [ ] Signal / evidence séma megtervezése.
- [ ] Scoring, dedupe és contradiction rules kialakítása.
- [ ] Dataset- és knowledge base promotion contract megírása.
- [ ] Dashboard panel és CLI parancs kialakítása.
- [ ] Eval és feedback loop bekötése.

## Notes
- Csak public, licencelt vagy egyébként engedélyezett források.
- Személyes profilozás nincs.
- Politikai és társadalmi jelzéseknél provenance és bias label kötelező.
- A heti scout pipeline upstream forrásként újrahasznosítható ehhez a trackhez.
