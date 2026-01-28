# Integrációs Terv (A `G:\Brunella` örökség alapján)

A `konyvtarfa.md` elemzése alapján az alábbi komponenseket azonosítottuk, mint potenciális bővítményeket az `mcp-brunella-core` szerverhez.

## 1. Python Scriptek Integrációja (`08_SCRIPTS`)
A meglévő Python scriptek becsatornázása az `interpreter_tool` vagy dedikált `script_tool` alá.

*   **`google_workspace.py`**: Valószínűleg Drive/Gmail/Calendar wrapper.
    *   *Terv:* Tool készítése: `python_workspace_action(service="gmail", action="send", ...)`
*   **`vertex_ai.py`**: Google Vertex AI hívások.
    *   *Terv:* Ha jobb, mint a jelenlegi Claude/Ollama, integráljuk LLM providerként.
*   **`agent_handler.py`**: Régi ügynök logika.
    *   *Terv:* Elemzés, hogy van-e benne olyan "skill", ami hiányzik a mostani pipeline-ból.

## 2. Brunella V4 Logika (`02_PROJECTS/[ACTIVE]_Projekt ManaggerV5`)
A Flask alapú rendszerből kinyerhető modulok.

*   **SchedulerGem / ResearcherGem**: Ha ezek Python osztályok, át lehetne emelni őket az MCP szerver `utils/python_modules` mappájába, és meghívni őket.

## 3. Tudásbázis Indexelése (`01_CONTEXT`)
Az `AI_CONTROL_CENTER` dokumentumai kritikus fontosságúak a rendszer "öntudata" szempontjából.

*   **Teendő:** Futtatni a `knowledge_index_file` toolt ezekre a fájlokra:
    - `01_CONTEXT/system_architecture.md`
    - `01_CONTEXT/AI_CONTROL_CENTER/OPERATING_MODEL.md`
    - `01_CONTEXT/user_profile.md`

## 4. Egyéb Eszközök
*   **`GeminiCLI_ComputerUse_Extension`**: Összehasonlítani a most épített Playwright-os browser tool-al. Ha a régi jobb, vagy tud olyat, amit ez nem, akkor portolni.

---
**Státusz:** Tervezési fázis. A megvalósításhoz használd a `conductor` vagy `jules` toolokat.
