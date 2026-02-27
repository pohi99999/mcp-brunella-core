# Használati és Beüzemelési Útmutató
**Modul:** Géppark és Eszköz "Egészség" Figyelő (Prediktív Karbantartás)

Ez az útmutató lépésről lépésre bemutatja, hogyan tudod a saját, független környezetedben (Langflow + n8n) beüzemelni és tesztelni a géppark figyelő modult.

---

## 1. Előkészületek (Tudásbázis)
Mielőtt bármit elindítasz, szükséged lesz a gépkönyvre, amiből az AI dolgozni fog.
1. Keresd meg a generált `iszapfalo_gepkonyv_mock.md` fájlt a `docs/Egyéb/Iszap2/` mappában.
2. Töltsd le ezt a fájlt a saját gépedre, mert fel kell majd töltened a Langflow-ba.

---

## 2. A Langflow Ágens (Az "Agy") beüzemelése
A Langflow végzi a szövegértést és a JSON generálást.

1. Nyisd meg a saját **Langflow** felületedet (pl. `http://localhost:7860`).
2. Kattints a **"New Project"**, majd a **"Blank Flow"** gombra.
3. Építs fel egy egyszerű RAG (Retrieval-Augmented Generation) láncot az alábbi komponensekből (húzd be őket a bal oldali menüből):
   *   **Chat Input**: Ide érkezik majd az üzenet.
   *   **File Loader** (pl. Text/Markdown loader): Ide töltsd fel a letöltött `iszapfalo_gepkonyv_mock.md` fájlt.
   *   **Text Splitter**: Kösd össze a File Loader kimenetével (darabolja a szöveget).
   *   **Vector Store** (pl. ChromaDB vagy AstraDB): Ebbe mentsd a feldarabolt szöveget, és állíts be egy Embedding modellt (pl. OpenAI Embeddings vagy Nomic).
   *   **Prompt**: Ebbe a node-ba **KÖTELEZŐ** bemásolnod a `docs/plans/langflow_prompt_template.md` fájl tartalmát. Ügyelj rá, hogy a `{context}` és a `{question}` változók szerepeljenek benne!
   *   **LLM** (pl. OpenAI, Gemini vagy Ollama): Kösd össze a Prompttól jövő szöveget ezzel. **Fontos:** Ha a modelled támogatja (pl. OpenAI), kapcsold be a "JSON Mode" vagy "Structured Output" funkciót, hogy biztosan tiszta JSON-t kapj vissza!
   *   **Chat Output**: Ide megy az LLM kimenete.
   *   *Ne felejtsd el a Vector Store keresési eredményét (Retriever) bekötni a Prompt `{context}` bemenetébe, a Chat Inputot pedig a `{question}` bemenetébe!*
4. Kattints a "Play" (Run) gombra, és teszteld le a flow-t a beépített chat ablakban egy üzenettel: *"Füstöl a kettes Truxor motorja, fogy az olaj"*. Ha tiszta JSON-t kapsz vissza a javaslattal és cikkszámokkal, a flow tökéletes.
5. Kattints jobb felül az **"API"** gombra. Itt találod meg a Flow ID-t és a curl példát. Erre az URL-re lesz szükségünk az n8n-ben!

---

## 3. Az n8n Workflow (A "Ragasztó") beüzemelése
Az n8n fogadja a külső kérést, hívja a Langflow-t, és formázza az eredményt.

1. Nyisd meg a saját **n8n** felületedet.
2. Kattints az **"Add Workflow"** gombra.
3. Jobb felül kattints a három pontra (`...`), majd válaszd az **"Import from File"** lehetőséget.
4. Töltsd be a generált `docs/Egyéb/Iszap2/iszapfalo_geppark_modul_n8n_workflow.json` fájlt.
5. **Konfiguráld a "Hívás Langflow felé" (HTTP Request) node-ot:**
   *   Kattints rá duplán.
   *   Cseréld ki az URL-t (`http://localhost:7860/api/v1/run/YOUR_LANGFLOW_ID`) arra, amit a 2.5-ös pontban a Langflow-ból kimásoltál.
   *   Ha a Langflow-d jelszóval/API kulccsal védett, állítsd be az `Authorization` headert a megfelelő értékre.
6. **Konfiguráld a "Vezetőség Értesítése" (Telegram) node-ot (Opcionális):**
   *   Ha szeretnéd látni a végeredményt Telegramon, kattints a node-ra.
   *   Hozd létre a Telegram Credentials-t (ha még nincs).
   *   Írd be a saját Chat ID-dat.

---

## 4. Tesztelés és Használat
Most kipróbáljuk a teljes rendszert "kívülről" egy Postman vagy az n8n beépített eszköze segítségével.

1. Az n8n-ben kattints alul a **"Test Workflow"** gombra. A Webhook node most figyel.
2. Kattints duplán a **"Webhook"** node-ra, és másold ki a "Test URL"-t.
3. Nyiss egy új böngészőlapot, vagy használj Postmant/Terminált (cURL), és küldj egy POST kérést a másolt URL-re ezzel a JSON tartalommal:
   ```json
   {
     "message": "Borzasztóan zörög a nagy Honda szivattyú csapágya, és fura hangja van."
   }
   ```
4. Figyeld az n8n-t! Ha mindent jól csináltál, végigfut a folyamat, a Langflow kielemzi a MOCK gépkönyv alapján, és te megkapod a Telegram üzenetet (vagy láthatod a kimenetet az n8n-ben):
   *Gép azonosító: Honda WB30XT*
   *Kategória: Csapágy / Mechanika*
   *Sürgősség: Magas*
   *Javasolt lépés: Leállítás...*

## 5. Átadás az Iszapfaló Kft-nek
Ha a prototípus működik, az Iszapfaló meglévő rendszerébe való integráláshoz csak annyit kell tenniük, hogy a saját Telegram-üzenet feldolgozó n8n workflow-jukban elhelyeznek egy **HTTP Request node**-ot, ami a te végleges (Production) n8n Webhook URL-edre küldi át azokat az üzeneteket, amiket az ő AI-juk "GÉPHIBA" vagy "MEGJEGYZÉS" kategóriába sorolt.