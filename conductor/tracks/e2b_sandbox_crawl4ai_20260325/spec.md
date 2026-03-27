# E2B Sandbox Crawl4AI

## Cél
A Crawl4AI webcrawling izolálása E2B sandbox környezetben a biztonságosabb végrehajtás érdekében.

## Háttér
- A `crawl4ai_worker.py` jelenleg patchright-alapú fallback-kel működik (crawl4ai ANTIBOT bug Windows-on)
- Az `src/security/e2b_sandbox_manager.ts` már létezik izolált Python futtatáshoz
- Alacsony prioritás, mert a jelenlegi megoldás stabil

## TODO
- [ ] E2B sandbox integráció a crawl4ai_worker-hez
- [ ] Sandbox timeout és erőforrás-korlátok beállítása
- [ ] Fallback: ha E2B nem elérhető, lokális futtatás
- [ ] Tesztek
