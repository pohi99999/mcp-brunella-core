# Implementation Plan: Browser-Use Harvester with Structured JSON Output

## Track ID: browser_use_harvester_20260131

## Cél: `myai/browser_worker.py` modul továbbfejlesztése strukturált JSON adatkinyeréssel Pydantic modellek alapján.

## Feladatlista

### 1. Pydantic modellek implementálása és integráció a `browser_worker.py`-ba
- **Leírás:** Hozzon létre alapvető Pydantic modelleket (pl. `ExtractionSchema`, `ExtractionResult`) a várt strukturált kimenet definiálásához. Módosítsa a `browser_worker.py`-t, hogy elfogadjon egy Pydantic séma definíciót, és annak alapján végezze az adatkinyerést.
- **Részletek:**
    - Definiálja a Pydantic modelleket a `myai/pydantic_models.py` fájlban.
    - Frissítse a `browser_worker.py` függvény signature-jét egy `extraction_schema: str` (JSON string) paraméterrel.
    - Implementálja a logikát a `browser_worker.py`-ban, ami:
        - Parse-olja az `extraction_schema` stringet Pydantic modellé.
        - Használja a Gemini 1.5 Flash Vision képességeit az adatkinyerésre a weboldalról az adott séma alapján.
        - Validálja a kinyert adatokat a Pydantic modell ellenében.
        - Visszaadja a validált adatokat JSON formátumban.
- **Tesztelés:** Írjon unit teszteket a Pydantic modellek validációjára és a `browser_worker.py` által generált strukturált kimenet ellenőrzésére.
- **Állapot:** `[ ]`

### 2. ChromaDB (vagy LanceDB) integráció előkészítése
- **Leírás:** Vizsgálja meg a meglévő ChromaDB/LanceDB integrációs pontokat, és alakítsa ki azokat, hogy képesek legyenek fogadni a `browser_worker.py` által generált strukturált JSON adatokat, beleértve a metadata mezőket is.
- **Részletek:**
    - Elemezze a `testing/hirszerzes_test_1/docker-compose.yml` és `testing/hirszerzes_test_1/ai_research_pipeline.json` fájlokat, különösen a `storage_dual_write_1` node-ot.
    - Definiáljon egy absztrakt interfészt a `myai/vector_db_interface.py` fájlban a vektor adatbázis műveleteihez (pl. `add_document`, `query_documents`).
    - Implementálja a ChromaDB specifikus adaptert a `myai/chromadb_adapter.py` fájlban.
    - Frissítse a `myai/refiner_logic.py`-t, hogy ezt az adaptert használja.
- **Tesztelés:** Integrációs tesztek írása a strukturált adatok sikeres tárolására és lekérdezésére a vektor adatbázisból.
- **Állapot:** `[ ]`

### 3. Perplexity és ArXiv eszközök értékelése és potenciális integrációja
- **Leírás:** Tekintse át a `testing/hirszerzes_test_1` mappában található `perplexity_search_tool.py` és `arxiv_search_tool.py` fájlokat. Döntse el, hogy ezeket az eszközöket be kell-e építeni a Brunella Core MCP eszközkészletébe, vagy elegendő a "Robotkéz" képességeit bővíteni hasonló funkciókkal.
- **Részletek:**
    - Hasonlítsa össze a meglévő Brunella Core webes és keresési képességeit a Perplexity és ArXiv eszközök funkcionalitásával.
    - Ha az integráció indokolt, hozzon létre új MCP eszközöket ezekhez a funkcionalitásokhoz.
    - Frissítse a `Toolskeszlet.md` és `Brunella.md` fájlokat az új eszközökkel.
- **Állapot:** `[ ]`

### 4. Dokumentáció frissítése
- **Leírás:** A `Brunella.md` és `konyvtarfa.md` fájlok frissítése az új "Robotkéz" képességekkel és a strukturált adatkezeléssel kapcsolatos változásokkal.
- **Részletek:**
    - Részletesen dokumentálja a `myai/browser_worker.py` új `extraction_schema` paraméterét és a Pydantic alapú kimenetet.
    - Magyarázza el a strukturált adatgyűjtés és a vektor adatbázis integrációjának előnyeit.
    - Frissítse a `konyvtarfa.md`-t a `myai/pydantic_models.py` és `myai/vector_db_interface.py` új fájljaival.
- **Állapot:** `[ ]`
