# mcp-brunella-core: 

**Dátum:** 2026. január 31., szombat

## 1. Projekt Áttekintés és Stratégiai Célok

Az `mcp-brunella-core` egy élvonalbeli, mesterséges intelligencia alapú fejlesztési keretrendszer, amely a Model Context Protocol (MCP) köré épül. Fő célja a szoftverfejlesztési életciklus teljes automatizálása, a tervezéstől a tesztelésig és a telepítésig. Egy innovatív, többügynökös architektúrát alkalmaz, ahol specializált AI ügynökök koordináltan dolgoznak együtt komplex feladatok megoldásában.

A projekt a manuális, ismétlődő és hibalehetőségeket rejtő fejlesztési folyamatokra nyújt áttörő megoldást. Hosszú távú víziója egy olyan jövő megteremtése, ahol az AI radikálisan növeli a szoftverfejlesztés hatékonyságát és minőségét. Befektetői szempontból ez egy kiemelkedő megtérülési potenciállal rendelkező, piacformáló innováció, amely az AI-vezérelt fejlesztés új paradigmáját honosítja meg.

## 2. Architektúra és Kulcstechnológiák

Az `mcp-brunella-core` egy moduláris, többügynökös rendszer, melynek gerincét a Model Context Protocol (MCP) és a Conductor keretrendszer adja. A hierarchikus architektúra élén egy `OrchestratorAgent` (LLM Planner) áll, amely delegálja a feladatokat az alsóbb szintű, domain-specifikus ügynököknek.

### Architektúra Alapelvek
*   **Többügynökös Design:** Specializált AI ügynökök (Developer, Evaluator, Orchestrator, DataScientist, Researcher stb.) közötti koordinált együttműködés.
*   **MCP-központú kommunikáció:** Standardizált protokoll az ügynökök és külső eszközök közötti interakcióra.
*   **Moduláris és Bővíthető:** Könnyű integráció új eszközökkel és ügynökökkel.

### Kulcstechnológiák (Tech Stack)
*   **Backend:**
    *   **Node.js (TypeScript):** Vezérlőlogika, CLI, Dashboard backend, MCP szerverek.
    *   **Python (FastAPI/FastMCP):** AI/ML feladatok, adatfeldolgozás, mikroszolgáltatások.
    *   **Automatizálási Platform: n8n (API-val vezérelve):** Munkafolyamatok automatizálása és orchestrációja.
    *   **SQLite:** Könnyűsúlyú adatbázis feladatkezeléshez (Task Queue).
*   **Modellek:**
    *   **Ollama:** Lokális LLM futtatás (deepseek-coder:6.7b, llama3.1:8b, qwen2.5-coder:7b, gemma3:4b stb.), prioritizálva a költséghatékonyság miatt.
    *   **Egyéb LLM-ek:** (pl. Gemini API) szükség esetén, alacsonyabb prioritással.
*   **Frontend (Dashboard UI):**
    *   **React:** Modern, komponens-alapú UI.
    *   **Vitest:** Tesztelési keretrendszer.
    *   **Tailwind CSS:** Gyors UI fejlesztés.
*   **Konténerizáció és Deploy:**
    *   **Docker, Docker Compose:** Izolált, reprodukálható környezetek a fejlesztéshez, teszteléshez és éles üzemhez.
    *   **Hibrid környezet:** Node.js és Python erősségeinek kombinálása.

## 3. Fejlesztési Státusz és "Track" Történet

A projekt a Conductor keretrendszerrel, egy "Track" alapú, specifikáció-vezérelt módszertannal halad, biztosítva a strukturált és iteratív fejlesztést. Minden jelentős fejlesztési "track" `[x] Completed` státuszban van, ami a projekt érettségét és stabilitását mutatja.

### Főbb Elért Mérföldkövek:
*   **CLI & Ügynök Fejlesztés:** Teljes CLI újraírás, `DeveloperAgent`, `EvaluatorAgent` és `OrchestratorAgent` implementálása.
*   **API & Dokumentáció:** Swagger UI integráció, automatikus API dokumentáció.
*   **Infrastruktúra & Konténerizáció:** Docker és Docker Compose bevezetése, platformfüggetlen működés.
*   **Python Alrendszer:** FastAPI alapú refaktorálás, optimalizált AI/ML képességek.
*   **Tesztelés:** Tesztelési infrastruktúra konszolidálása Vitesttel, magas minőség biztosítása.
*   **BAS Scale-Up & Stabilization (Cursor ügynök által):** LangSmith telemetria (LangChain tracer `src/core/llm_client.ts`, `src/pipeline/llmPipeline.ts`, `src/server/web.ts`), hibrid LanceDB memóriarendszer (`src/utils/rag.ts`, `myai/refiner_logic.py`), strukturált böngésző kimenet (`myai/browser_worker.py`) implementálva. A build hibák javításra kerültek.
    *   **LangSmith Integráció:** Minden LLM hívás LangSmithba kerül, ha a `LANGCHAIN_API_KEY` be van állítva. Ez kiterjed az `OrchestratorAgent`, `DynamicAgent`, `ollamaTool`, `llmPipeline`, `/api/ollama/generate` funkciókra.
    *   **LanceDB Hibrid Memória:** LanceDB (Node.js) és Python oldali (LanceDB batch írás `myai/refiner_logic.py`) integráció.
    *   **Strukturált Böngésző Kimenet:** Pydantic alapú kimenet a `myai/browser_worker.py` fájlban.
    *   **Build Státusz:** A `npm run build` és `npm test -- test/telemetry.test.ts` sikeresen lefutottak.
*   **Robotkéz n8n Sandbox és Edzésterv:** Implementálva a "Robotkéz n8n Sandbox és Edzésterv" track. A kezdeti UI automatizálási kísérletek (browser-use) problémái miatt API-alapú n8n integrációra váltottunk, amely sikeresen létrehozza, átnevezi és törli a munkafolyamatokat. Ezzel biztosítva van a Robotkéz számára egy stabil és automatizálható edzési környezet.
*   **Dashboard UI:** Valós idejű, interaktív Dashboard UI fejlesztése, számos REST API endpointtal.
*   **Ügynök Swarm:** `AgentManager` refaktorálás, `DataScientist` és `Researcher` ügynökök bevezetése.

## 4. Rendszer Képességei és Funkcionalitása

Az `mcp-brunella-core` széles körű AI-vezérelt képességeket kínál:

*   **Többügynökös (Multi-Agent) Rendszer:** Specializált ügynökök (Developer, Evaluator, Orchestrator, DataScientist, Researcher, Project Organizer, Agent Architect) autonóm és koordinált munkája.
*   **Önálló Döntéshozatal és Automatizálás:** Feladatok elemzése, tervezése, delegálása és automatikus végrehajtása.
*   **Rugalmas Bővíthetőség (MCP):** Új eszközök és ügynökök zökkenőmentes integrációja.
*   **Külső Eszközök és Platformok Integrációja:**
    *   **Ollama:** Lokális LLM futtatás a költséghatékonyság és a testreszabhatóság érdekében.
    *   **AnythingLLM:** RAG (Retrieval Augmented Generation) képességek, tudáskezelés.
    *   **n8n:** Munkafolyamat automatizálás API-vezérelve.
    *   **GitHub MCP:** Integráció a GitHub API-val.
    *   **LangSmith:** Observability és ügynöki végrehajtás nyomon követése.
*   **Parancssori Interfész (CLI):** Hatékony szöveges interakció a fejlesztők számára.
*   **Webes Vezérlőpult (Dashboard UI):** Intuitív grafikus felület a rendszer monitorozásához és kezeléséhez.

## 5. Működési Környezet és Interakciók

A platform a rugalmas működést és a széles körű interakciókat helyezi előtérbe:

*   **Fejlesztési Környezetek:** Hibrid (Node.js/Python), konténerizált (Docker/Docker Compose), platformfüggetlen.
*   **Felhasználói Interakciók:**
    *   **CLI:** Parancssori interakció ügynökökkel és feladatokkal.
    *   **Dashboard UI:** Grafikus felület valós idejű monitorozással és kezeléssel.
*   **Rendszerközi Interakciók:**
    *   **MCP:** Standard kommunikációs protokoll ügynökök és eszközök között.
    *   **Külső API-k:** Integráció GitHub, Google szolgáltatások, Snyk stb. API-jával.
    *   **Ollama, AnythingLLM:** Lokális LLM és RAG interakciók.
*   **Adatkezelés:** SQLite (Task Queue), Brunella memóriakezelés a kontextus megőrzéséért.

## 6. Erősségek és Jövőbeli Potenciál

Az `mcp-brunella-core` projekt nem csupán egy technológiai megoldás, hanem egy stratégiai befektetés a szoftverfejlesztés jövőjébe, számos kiemelkedő erősséggel és jelentős jövőbeli potenciállal:

*   **Innovatív AI-alapú Megközelítés:** Az AI központi szerepe a fejlesztési folyamatban, páratlan hatékonyságot és minőséget eredményezve, különös tekintettel a költséghatékony lokális LLM modellek kihasználására.
*   **Maximális Automatizálás:** A Conductor keretrendszer és az ügynökök révén a fejlesztési feladatok nagymértékben automatizálódnak, csökkentve a költségeket és a hibalehetőségeket.
*   **Skálázhatóság és Rugalmasság:** Az MCP alapú, moduláris architektúra könnyű skálázhatóságot és bővíthetőséget biztosít.
*   **Megbízhatóság és Minőség:** Az `EvaluatorAgent` és a tesztelési infrastruktúra garantálja a magas kódminőséget és a rendszer stabilitását.
*   **Transzparencia és Ellenőrizhetőség:** A Dashboard UI és a LangSmith integráció valós idejű betekintést nyújt a rendszer működésébe, az ügynöki döntéshozatalba és a feladatok végrehajtásába. Ez biztosítja az átláthatóságot és az ellenőrizhetőséget, ami kritikus az AI alapú rendszerekben.
*   **Jövőbeli Bővítési Lehetőségek:**
    *   Specifikus Domain Ügynökök fejlesztése.
    *   Fejlettebb AI/ML modellek integrálása.
    *   Mélyebb Observability és Prediktív Karbantartás.
    *   Felhasználói élmény (UX) további finomítása.
    *   Teljes CI/CD pipeline automatizálása.

### Befektetői Perspektíva
Az `mcp-brunella-core` egy forradalmi platform, amely átalakíthatja a szoftverfejlesztés iparágát, jelentős versenyelőnyt biztosítva. Az AI-alapú automatizálás, a skálázhatóság és a folyamatos innovációs potenciál rendkívül vonzó befektetési lehetőséget kínál egy gyorsan növekvő piacon. A projekt már bizonyította alapvető stabilitását és funkcionalitását a számos sikeresen lezárt fejlesztési "track" révén.

---

### Diagramok és Ábrák Megjegyzések
A Markdown fájlba közvetlenül nem illeszthető be ábra, de egy befektetői prezentációhoz az alábbiakban leírt diagramok és vizuális elemek lennének ideálisak:

1.  **Rendszerarchitektúra Diagram:**
    *   **Típus:** Blokkdiagram vagy komponensdiagram.
    *   **Elemei:** Felhasználói interfészek (CLI, Dashboard UI), Központi vezérlő (OrchestratorAgent/Conductor), AI Ügynökök réteg, MCP Kommunikációs Réteg, Külső Eszközök és Integrációk (Ollama, AnythingLLM, GitHub, Google API-k, Snyk), Adatkezelési réteg (SQLite, Memória), Konténerizációs réteg (Docker).
    *   **Célja:** Vizualizálni a rendszer moduláris felépítését és az egyes komponensek közötti adatfolyamot.

2.  **Fejlesztési Munkafolyamat Diagram (Conductor/PDCA):**
    *   **Típus:** Folyamatábra vagy állapotgép.
    *   **Elemei:** Tervezés (Plan) -> Tervezés (Design) -> Megvalósítás (Do) -> Ellenőrzés (Check) -> Beavatkozás (Act) ciklus. "Track" kiválasztása, állapotfrissítés, feladatok végrehajtása, Dokumentáció szinkronizálás.
    *   **Célja:** Bemutatni a projekt menedzsment módszertanát és az automatizált fejlesztési ciklust.

3.  **Ügynök Interakciós Diagram:**
    *   **Típus:** Szereplő-használati eset (UML Use Case) vagy szekvenciadiagram.
    *   **Elemei:** Felhasználó -> OrchestratorAgent -> Specializált Ügynökök -> Külső Eszközök (MCP). Például: "Kód refaktorálása" feladat menete.
    *   **Célja:** Illusztrálni az ügynökök közötti kollaborációt és a feladatok delegálását.

4.  **Értékajánlat Grafikon/Infografika:**
    *   **Típus:** Bár vagy vonaldiagram vagy infografika.
    *   **Elemei:** Idő/Költség megtakarítás az automatizálás révén, Minőségi növekedés (hibák csökkenése), Fejlesztési sebesség növelése, Piaci versenyképesség növelése.
    *   **Célja:** Kvantitatív és kvalitatív adatokkal alátámasztani a befektetési megtérülést.