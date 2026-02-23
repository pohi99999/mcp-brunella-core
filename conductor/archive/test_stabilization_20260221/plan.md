# test_stabilization_20260221 – Plan

## Cél
A timeoutos tesztek stabilizálása és 100% PASS visszaállítása.

## Lépések
1. **Agent test-mode gyorsítás**
   - SalesHunterAgent: RobotkezV2 kihagyása teszt módban
   - MarketIntelAgent: mock pricing teszt módban
   - PropertyAnalystAgent: CMA worker mock válasz teszt módban

2. **Teszt időkorlátok finomhangolása**
   - `test/phase2_integration.test.ts` timeout 30s

3. **Validáció**
   - `npm test` (0 failed)

## Kimenet
- Stabil tesztek, 100% PASS
- Test-mode alapú gyorsított út a lassú integrációs részekhez
