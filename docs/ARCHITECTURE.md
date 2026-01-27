# Brunella Agent System (BAS) - Architektúra és Fehér Könyv Implementáció

> **Filozófia:** A rendszer a Technikai Fehér Könyv szerinti **"Üvegdoboz" (Transparent Box)** elvet követi. Minden folyamat, döntés és adatfolyam látható, naplózott és ellenőrizhető.

## 1. A Négy Réteg

A rendszer architektúrája négy fő funkcionális rétegre épül:

### 1.1. Tápláló (Ingestion Layer)
Az a réteg, amelyen keresztül az adatok beáramlanak a rendszerbe.
- **Implementáció:**
    - `workspace` tools: Fájlrendszer hozzáférés.
    - `googleWorkspace`: Drive és Dokumentumok elérése.
    - `anythingllm`: Külső dokumentumtárak.
    - Browser tools: Webes adatgyűjtés.

### 1.2. Tudásbázis (Knowledge Layer)
A feldolgozott információk strukturált tárolása és visszakeresése (Vektoros memória).
- **Implementáció:**
    - `knowledge` tools: LanceDB alapú RAG (Retrieval-Augmented Generation).
    - `knowledge_semantic_search`: Szemantikus keresés a memóriában.
    - `mcp-brunella-core/knowledge`: Az adatok indexeléséért felelős modulok.

### 1.3. Agypiac (Marketplace / Orchestration Layer)
Ahol az ügynökök közötti munkamegosztás és koordináció zajlik. Ez a rendszer "agya".
- **Implementáció:**
    - **Karmester (Conductor):** `AgentManager` és `agent_delegate`. Ő felel a feladatok kiosztásáért.
    - `agent_registry` / `registry.json`: Az elérhető ügynökök (szerepkörök) nyilvántartása.
    - `agent_list`: A "piacon" elérhető munkások listázása.

### 1.4. Immunrendszer (Immune System / Guardrails)
A rendszer stabilitását és egészségét védő mechanizmusok.
- **Implementáció:**
    - **Folyamat Figyelő:** `monitor` tools (`monitor_get_metrics`, `monitor_tail_logs`).
    - **LogViewer:** A "Glass Box" vizualizációja a Dashboard-on.
    - `logs/`: Központi naplózás minden aktivitásról.

---

## 2. Raj-szerepkörök (Swarm Roles)

A rendszer "munkásai" (Agents) speciális szerepköröket töltenek be a Fehér Könyv szerint:

| Fehér Könyv Szerepkör | MCP Brunella Megfelelés | Feladat |
|-----------------------|-------------------------|---------|
| **Kutató (Harvesters)** | Researcher, Browser tools | Információgyűjtés külső és belső forrásokból. |
| **Adattudás (Refiners)** | Knowledge module, LanceDB | A nyers adat "tudássá" alakítása és indexelése. |
| **Tanítók (Incubators)** | llmPipeline, myai | Kódgenerálás, öngyógyítás és "kis modellek" (script) futtatása. |

---

## 3. Jövőkép és Roadmap

A jelenlegi implementáció a Core rétegeket fedi le. A Fehér Könyv további víziói a következőképpen illeszkednek:

- **LangSmith / BOV:** A teljes döntési fa vizualizációja jelenleg a LogViewer-ben valósul meg részlegesen. Későbbi fejlesztési irány.
- **Több ezer ügynök skálázás:** A jelenlegi Core architektúra moduláris, így később Kubernetes alapú skálázásra (Agent Factory) felkészíthető.
