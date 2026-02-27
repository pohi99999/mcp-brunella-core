# Iszapfaló - Géppark és Eszköz "Egészség" Figyelő (Prediktív Karbantartás)

## 1. Célkitűzés
Egy független, API-n keresztül hívható AI modul (mikroszolgáltatás) létrehozása, amely a munkatársak által (Telegramon) beküldött szabad szöveges hibajelentéseket és gépállapot-információkat elemzi. A modul azonosítja az érintett gépet, a hiba jellegét, meghatározza a sürgősséget, és egy belső tudásbázis (RAG) alapján javaslatot tesz a karbantartási lépésekre és a szükséges alkatrészekre. Ezt a modult az Iszapfaló Kft. a későbbiekben könnyen integrálhatja a meglévő n8n + Airtable rendszerébe.

## 2. Architektúra és Komponensek

A rendszer két fő rétegből áll, amelyeket a fejlesztés során saját, független környezetben szimulálunk.

### 2.1. Intelligencia Réteg: Langflow (Az "Agy")
A modul szíve egy Langflow-ban megépített RAG (Retrieval-Augmented Generation) alapú ágens lesz.
*   **Technológia:** Langflow, Ollama (lokális, pl. llama3.1:8b) vagy Gemini API (LLM), Vektor adatbázis (pl. ChromaDB vagy AstraDB a Langflow-n belül) a tudásbázishoz.
*   **Tudásbázis (Knowledge Base):** Egy általunk létrehozott mock dokumentum (pl. `iszapfalo_gepkonyv_mock.md` vagy `.txt`), amely tartalmazza a fiktív gépparkot (pl. Truxor T40, Honda vízszivattyú, Kotróhajó) és azok jellemző hibáit, karbantartási útmutatóit, valamint az alkatrészek cikkszámait.
*   **Működés:**
    1. Fogadja a bejövő szöveget (pl. *"Nagyon füstöl a kettes Truxor, és eszi az olajat."*).
    2. Vektoros kereséssel (RAG) kikeresi a "Truxor" és "füstöl/olajfogyasztás" kulcsszavakhoz tartozó karbantartási előírásokat a tudásbázisból.
    3. Az LLM szintetizálja az információt, és egy strukturált JSON választ generál.
*   **Kimenet:** Egy szigorú JSON struktúra:
    ```json
    {
      "gep_id": "string (A felismert gép azonosítója, pl. Truxor-02)",
      "hiba_kategoria": "string (pl. Motor, Hidraulika, Szerkezet)",
      "surgosseg": "string (Kritikus, Magas, Normál, Alacsony)",
      "javasolt_lepes": "string (Mit kell tenni a gépkönyv alapján)",
      "szukseges_alkatreszek": ["lista", "a", "cikkszámokkal"]
    }
    ```
*   **Interfész:** A Langflow Flow-t egy REST API végpontként (Endpoint) tesszük elérhetővé.

### 2.2. Orchestrációs és Teszt Réteg: n8n (A "Ragasztó" és Szimulátor)
Egy saját, Renderen hosztolt (vagy lokális) n8n példány, amely szimulálja az Iszapfaló jelenlegi rendszerét, és hívja a Langflow API-t.
*   **Technológia:** n8n.
*   **Workflow felépítése (Teszteléshez):**
    1.  **Trigger:** Egy Webhook node (szimulálja a Telegram bot bejövő üzenetét), VAGY egy egyszerű Inject node manuális teszteléshez.
    2.  **API Hívás:** Egy HTTP Request node, ami POST kérést küld a Langflow Endpointjának, átadva a hibaüzenetet.
    3.  **Adatfeldolgozás:** A visszakapott JSON strukturált szétbontása.
    4.  **Kimenet szimulációja (Opcionális):** Az eredmény mentése egy teszt Google Sheetbe (szimulálva az Airtable-t), vagy egy Telegram értesítés küldése a "Vezetőségnek" (nekünk).

## 3. Fejlesztési Lépések (Roadmap)

### 3.1. Fázis: Tudásbázis és Mock Adatok Előkészítése
1.  Létrehozni egy `iszapfalo_gepkonyv_mock.md` fájlt. Ez tartalmazzon legalább 3-4 géptípust, gyakori hibákkal, megoldásokkal és fiktív cikkszámokkal.
2.  Kitalálni 5-10 "teszt üzenetet" (promptot), amit majd a rendszerbe táplálunk (pl. *"Zörög a szivattyú csapágya"*, *"Eltört a Truxor vágókése"*).

### 3.2. Fázis: Langflow Ágens Felépítése
1.  Langflow környezet elindítása/megnyitása.
2.  **Flow összerakása:**
    *   `Chat Input` (Bejövő üzenet).
    *   `Prompt` komponens, ami instruálja a modellt, hogy "Te egy prediktív karbantartási AI vagy az Iszapfaló Kft-nél... Elemezd a hibaüzenetet a gépkönyv alapján, és adj vissza JSON-t."
    *   RAG integráció: Document Loader (a mock md fájlhoz), Text Splitter, Embedding (pl. nomic-embed-text vagy OpenAI), Vector Store. Ezt bekötni a Promptba, mint kontextus.
    *   LLM komponens (Gemini vagy Ollama). Szigorú utasítás (vagy strukturált kimenet beállítás), hogy **csak JSON**-t adjon vissza.
    *   `Chat Output`.
3.  A flow tesztelése a Langflow felületén a kitalált teszt üzenetekkel.
4.  A flow mentése, és az API Endpoint URL-jének (és a szükséges tokeneknek) kinyerése.

### 3.3. Fázis: n8n Workflow Felépítése
1.  Új workflow létrehozása a saját n8n példányon.
2.  Webhook trigger beállítása.
3.  HTTP Request node beállítása a Langflow API hívására (POST, body-ban az üzenettel).
4.  A visszatérő JSON adatok validálása és formázása egy Set vagy Code node segítségével.
5.  (Opcionális) Egy Google Sheets node hozzáadása, ami naplózza az eredményt (Dátum, Eredeti üzenet, Felismert Gép, Sürgősség, Javaslat).

### 3.4. Fázis: Integrációs Dokumentáció Készítése
Egy rövid dokumentáció (Markdown) írása az Iszapfaló Kft. számára:
*   Mi ez a modul és mit csinál?
*   Hogyan működik a "motorházető alatt"?
*   **Hogyan tudják integrálni:** A pontos n8n HTTP Request beállítások (URL, Headers, Body struktúra), amiket be kell másolniuk a saját meglévő "Telegram Bejövő Üzenetek Feldolgozása" workflow-juk "MEGJEGYZÉS" vagy "KIEMELKEDŐ" ágába.

## 4. Elvárt Eredmény
A folyamat végére egy működő prototípussal fogunk rendelkezni, amely egy n8n Webhook meghívásával képes bármilyen szöveges hibajelentést azonnal egy cselekvési tervet tartalmazó, strukturált adatbázis-bejegyzéssé (JSON) alakítani, anélkül, hogy hozzáférnénk a megrendelő éles adataihoz.