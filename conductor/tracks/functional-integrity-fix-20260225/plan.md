# Terv: Funkcionális Integritás Javítása

1.  **Feltárás (Diagnózis)**
    *   [x] `functional_integrity.spec.ts` létrehozása.
    *   [x] Teszt futtatása: HIBA - a feladat nem jelenik meg a Task Queue-ban.
    *   [x] Gyökérok: A Dashboard a `/api/agents/:name/execute` végpontot hívja, de az nincs bekötve a `web.ts`-be.
    *   [x] Második gyökérok: A hívott `agentManager.delegate` függvény nem létezik a kódban.
    *   [x] Harmadik gyökérok: Az ügynök neve (`Orchestrator` vs `orchestrator`) case-sensitive.

2.  **Javítás (Bekötés)**
    *   [x] `src/server/web.ts`: `agents.ts` és `chat.ts` routerek importálása és beregisztrálása.
    *   [x] `src/server/routes/agents.ts`: Az `execute` végpont átírása, hogy a `queueTask` funkciót használja, biztosítva a feladat azonnali rögzítését.
    *   [x] `src/server/routes/agents.ts`: Kis- és nagybetű-független ügynökkeresés implementálása.
    *   [x] `test/llm_client.test.ts` frissítése, hogy a magyar nyelvű promptot várja.

3.  **Verifikáció (Ellenőrzés)**
    *   [x] A `functional_integrity.spec.ts` teszt újrafuttatása: SIKER - a feladat megjelenik a DB-ben.
    *   [x] Konklúzió: A Dashboard és a Backend közötti funkcionális híd helyreállítva.
