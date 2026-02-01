# Specifikáció: BAS Scale-Up & Stabilization (2026-01-31)

Ez a specifikáció a **"BAS Scale-Up & Stabilization"** projekt technikai megvalósítását célozza, a **Zone I-III** (LangSmith, LanceDB RAG és Strukturált Browser kimenet) implementálására fókuszálva a Brunella Agent System (BAS) stabilizálása és skálázása érdekében.

## Zónák és Célok:
*   **Zone I: LangSmith Integráció:** LangSmith telemetria bevezetése az observability és költségfigyelés érdekében.
*   **Zone II: Hibrid Memóriarendszer:** LanceDB alapú memóriarendszer kiépítése valós idejű íráshoz és Retrieval Augmented Generation (RAG) támogatáshoz.
*   **Zone III: Strukturált Browser Kimenet:** A böngésző ügynök (Robotkéz) Pydantic alapú, strukturált JSON kimenetre való átállítása a `browser-use` könyvtár segítségével.

## Technikai Feladatok (Zones szerint):

### Zone I: LangSmith Integráció
*   Node.js függőség: `langchain @langchain/langsmith`
*   Python függőség: `langsmith`
*   `src/utils/telemetry.ts` fájl létrehozása.
*   `.env` frissítése: `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_PROJECT=Brunella_Core`, `LANGCHAIN_API_KEY=your_key`.
*   `src/index.ts` módosítása a tracer átadásához.
*   Tesztelés: `test/telemetry.test.ts` létrehozása és futtatása.

### Zone II: Hibrid Memóriarendszer (LanceDB RAG)
*   Node.js függőség: `@lancedb/lancedb`
*   Python függőség: `lancedb`
*   `src/utils/rag.ts` fájl létrehozása (LanceDB Node.js oldal).
*   `myai/refiner_logic.py` kiegészítése a LanceDB Python-oldali batch írási logikájával.

### Zone III: Strukturált Browser Kimenet
*   Python függőség: `pydantic browser-use`
*   `myai/browser_worker.py` fájl létrehozása a Pydantic alapú kimenethez.

## Elvárások:
*   Stabil és tesztelt integráció minden zónában.
*   A `browser_worker.py` által generált kimenet Pydantic modellel validált JSON.
*   LangSmith nyomon követés minden LLM hívásnál.
*   LanceDB alapú memóriarendszer működőképessége.
