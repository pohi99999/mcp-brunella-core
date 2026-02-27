# Használati és Beüzemelési Útmutató
**Modul:** "Okos" Ajánlatadó / Költségbecslő Asszisztens

Ez az útmutató lépésről lépésre bemutatja, hogyan tudod a saját, független környezetedben (Langflow + n8n) beüzemelni és tesztelni az automatikus árajánlat-generáló modult.

---

## 1. Előkészületek (Árlista és Normák)
A modul a cég belső szabályai alapján számol.
1. Keresd meg a generált `iszapfalo_arlista_es_normak_mock.md` fájlt a `docs/Egyéb/Iszap2/` mappában.
2. Töltsd le ezt a fájlt a saját gépedre, mert ez lesz a Langflow RAG "agya".

---

## 2. A Langflow Ágens (A Kalkulátor és Író) beüzemelése
Itt hozunk létre egy ágenst, ami nem csak adatot keres, hanem logikailag "gondolkodik" is (szoroz, oszt) a normák alapján, majd Markdown formátumban ír.

1. Nyisd meg a saját **Langflow** felületedet (pl. `http://localhost:7860`).
2. Kattints a **"New Project"**, majd a **"Blank Flow"** gombra.
3. Építsd fel a RAG láncot (hasonlóan a Karbantartás figyelőhöz):
   *   **Chat Input**: Bemeneti szöveg (Az ügyfél kérése).
   *   **File Loader**: Ide töltsd fel a letöltött `iszapfalo_arlista_es_normak_mock.md` fájlt.
   *   **Text Splitter** -> **Vector Store** (Embeddinggel).
   *   **Prompt**: Ebbe a node-ba **KÖTELEZŐ** bemásolnod a `docs/plans/langflow_ajanlatado_prompt_template.md` fájl tartalmát. Ügyelj rá, hogy a `{context}` és a `{question}` bemenetek be legyenek kötve!
   *   **LLM**: Mivel itt komolyabb logikai ugrásokra (szövegértelmezés -> matematika -> levélírás) van szükség, egy "okosabb" modellt javaslok, pl. **Gemini 2.0 Flash**, OpenAI GPT-4o, vagy legalább egy Llama3 8B-Instruct (bár a matematika itt pontatlanabb lehet lokális kisebb modelleknél). A "JSON Mode" itt **NEM KELL**, mert Markdown szöveget várunk!
   *   **Chat Output**.
4. Kattints a "Play" (Run) gombra, és teszteld egy üzenettel: *"Egy 800 m2-es nádast kéne levágni és elvinni Érdtől 30 km-re, mennyibe kerülne?"*. Ha a válasz egy udvarias, tételesen levezetett árajánlat, akkor a flow jó!
5. Kattints az **"API"** gombra jobb felül, és másold ki a Flow ID-t (és az API kulcsot, ha használsz).

---

## 3. Az n8n Workflow beüzemelése
Ez a workflow szimulálja, ahogy egy bejövő e-mailből (vagy űrlapból) ajánlat lesz.

1. Nyisd meg a saját **n8n** felületedet.
2. Kattints az **"Add Workflow"** gombra, majd az **"Import from File"** lehetőségre.
3. Töltsd be a generált `docs/Egyéb/Iszap2/iszapfalo_okos_ajanlatado_n8n_workflow.json` fájlt.
4. **Konfiguráld a "Hívás Langflow felé (RAG)" node-ot:**
   *   Kattints rá duplán.
   *   Cseréld ki a `YOUR_LANGFLOW_ID_FOR_QUOTES` részt a 2.5-ös pontban kimásolt azonosítóra.
   *   Állítsd be az `Authorization` headert, ha szükséges.
   *   *Figyeld meg a Body részt: Itt összerakjuk a feladó nevét, e-mailjét és az üzenetet egyetlen szöveggé, amit elküldünk a Langflow-nak.*
5. **Konfiguráld a "Vezetőség Értesítése (Telegram)" node-ot:**
   *   Állítsd be a Telegram Credentials-t és a Chat ID-dat. Ez a node úgy van formázva, hogy szépen megmutassa a feladót és a Langflow által írt ajánlatot.

---

## 4. Tesztelés és Használat
Szimuláljunk egy bejövő ügyfélkérést!

1. Az n8n-ben kattints alul a **"Test Workflow"** gombra.
2. Kattints duplán a **"Webhook (Bejövő E-mail szimuláció)"** node-ra, és másold ki a "Test URL"-t.
3. Küldj egy POST kérést erre az URL-re (Postman-nel, vagy csak rakj egy "Inject" node-ot az n8n-be a Webhook helyére) ezzel a JSON-nel:
   ```json
   {
     "nev": "Tóth János",
     "email": "janos.toth@példamail.hu",
     "uzenet": "Üdvözlöm! Van egy Balaton parti nyaralóm, a kikötőt teljesen elzárta a nád, a vízmélység miatt már beállni se tudunk. Kb 1500 négyzetmétert kéne levágni Truxorral a víz alatt, a nád kiszedését is kérem. Érdtől kb 100 km. Kérek egy becslést."
   }
   ```
4. Az n8n végigfuttatja az adatokat. A Telegramodra egy értesítés fog érkezni, benne a Langflow által a gépkönyv (RAG) alapján kiszámolt árakkal (2 napos munka Truxorral, kiszállási díj 100km-re, stb.), ügyfélkész formátumban!

## 5. Átadás az Iszapfaló Kft-nek
Az Iszapfaló jelenleg egy "Kimenő ajánlatok_dokumentumok.json" workflow-t használ, valószínűleg Google Docs integrációval.
Ezt a mi AI modulunkat nagyon könnyen beépíthetik oda:
Amikor bejön egy ajánlatkérő e-mail (pl. a `Gmail kategorizáló` workflowjukban kiderül, hogy ez egy "Ajánlatkérés"), egy **HTTP Request node** segítségével átküldik a szöveget a te végleges n8n Webhookodra, a te rendszered megcsinálja a számolást és szöveggenerálást, majd visszaküldi nekik az eredményt (mint egy API response). Az ő rendszerük pedig ebből generál majd PDF-et vagy küld e-mailt az ügyfélnek.