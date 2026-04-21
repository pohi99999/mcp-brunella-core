# BAS Architecture v2 - The Swarm & Phoenix Protocol

*(Az eredeti specifikacio alapján)*

## 1. Rendszer Logika
- **Orchestrator:** Központi vezérlő.
- **Data & Sandbox:** Elkülönített nyers adat, strukturált adat és sandbox.
- **Kimenet:** Üzleti funkciók.

## 2. Professzionális Architektúra
### A. Adatbeviteli (Ingestion) Réteg - "Harvester Swarm"
- **Eszközök:** Playwright, RSS, Apify.
- **Feladat:** Nyers stream (FB, X, YT, Web) -> Raw Lake.

### B. Tudásbázis (Refiner Factory)
- **Eszközök:** Python (Pandas), Unstructured.io.
- **Feladat:** ETL. Zajszűrés -> Tiszta adat.
- **Tárolás:** LanceDB (Vektor), SQLite (Strukturált).

### C. Ügynök-Orkesztráció
- **Eszközök:** Agent Manager.
- **Feladat:** Dispatch, Pool kezelés.

### D. Biztonság (Guardrails)
- **Eszközök:** Biztonsági főnök, Ops Agent.

## 3. Akcióterv
1. **Prompt Pipeline:** Láncolt logika.
2. **Reinforcement Learning:** Visszacsatolási hurok.
3. **Sandbox Izoláció:** Docker/PythonShell szeparálás.

## 4. Szerepkörök
- **Kutató (Harvester):** Adatgyűjtés.
- **Adattudós (Refiner):** Adattisztítás.
- **Tanító (Incubator):** Modellek finomhangolása.
- **Elemző:** Vektoros keresés.
