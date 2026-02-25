# Terv: Magyar Nyelvű Orkesztráció

1.  **Feltárás (Diagnózis)**
    *   [x] `BRUNELLA_MASTER_CONTEXT.md` és `CLAUDE.md` elemzése: a magyar nyelvű irányítás követelményének azonosítása.
    *   [x] `src/core/intentAnalyzer.ts` elemzése: a magyar kulcsszavak hiányosságainak felismerése.
    *   [x] `src/core/llm_client.ts` elemzése: a semleges, angol nyelvű rendszer-utasítások ("You are a helpful AI assistant.") beazonosítása.
    *   [x] `bas-cloudflare-orchestrator/src/index.ts` elemzése: a felhő oldali magyar nyelvi támogatás megerősítése.

2.  **Hangolás (Implementáció)**
    *   [x] `BRUNELLA_MASTER_CONTEXT.md` frissítése a magyar nyelv, mint elsődleges kommunikációs csatorna rögzítésével.
    *   [x] `src/core/intentAnalyzer.ts`: A `LOCAL_KEYWORDS` és `EDGE_KEYWORDS` listák kibővítése ~10 új, releváns magyar kifejezéssel.
    *   [x] `src/core/llm_client.ts`: A GPT-4o és Gemini hívások kiegészítése egy részletes, magyar nyelvű "Master Orchestrator Protocol" rendszer-utasítással.

3.  **Verifikáció (Ellenőrzés)**
    *   [x] `test/llm_client.test.ts` frissítése, hogy a teszt most már a magyar nyelvű promptot várja el a Gemini hívásnál.
    *   [x] A módosítások után a teljes tesztcsomag sikeres futtatása.
