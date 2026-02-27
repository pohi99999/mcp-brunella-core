# Használati és Beüzemelési Útmutató
**Modul:** Géppark és Eszköz "Egészség" Figyelő (Prediktív Karbantartás) - *All-in-One n8n verzió*

Ez az útmutató lépésről lépésre bemutatja, hogyan tudod beüzemelni a tisztán n8n-alapú géppark figyelő modult, amelyhez nincs szükség külső Langflow szerverre.

---

## 1. Importálás és Beállítás az n8n-ben

Az egész folyamatot egyetlen JSON fájl tartalmazza, amelyben már benne van a tudásbázis (Gépkönyv) és a promptok is.

1. Nyisd meg az **n8n** felületedet (akár lokális, akár Renderen hosztolt).
2. Kattints a bal oldali menüben az **"Add Workflow"** (vagy "+" ikon) gombra.
3. A jobb felső sarokban kattints a három pontra (`...`), majd válaszd az **"Import from File"** lehetőséget.
4. Töltsd be a fájlt innen: `docs/Egyéb/Iszap2/iszapfalo_geppark_all_in_one_n8n.json`.
5. Amint betöltött, látni fogod a teljes felépített hálózatot.

---

## 2. API Kulcsok megadása

Két dolgot kell beállítanod, mielőtt tesztelnéd:

1.  **AI Modell beállítása (OpenAI Chat Model node):**
    *   Kattints duplán az **"OpenAI Chat Model"** node-ra (ez adja az agyat).
    *   A "Credential for OpenAI API" legördülőből válassz ki egy meglévő kulcsot, vagy hozz létre újat ("Create New Credential").
    *   Ide add meg a saját OpenAI API kulcsodat (sk-...). *(Ha mást használsz, pl. Anthropic, akkor ezt a node-ot ki is cserélheted Anthropic Chat Model-re).*
2.  **Telegram Értesítő (Opcionális):**
    *   Kattints duplán a legutolsó, **"Telegram Értesítés"** node-ra.
    *   Állítsd be a saját Telegram botod credentialjét és a saját Chat ID-dat.
    *   *(Ha nem akarod használni, egyszerűen kapcsold ki vagy töröld ezt a node-ot).*

---

## 3. Tesztelés

Teszteljük le a rendszert egy szimulált hibaüzenettel!

1.  Kattints alul a **"Test Workflow"** gombra. Ezzel a Webhook figyelő üzemmódba kapcsol.
2.  Kattints duplán az első node-ra: **"Webhook"**, és másold ki a "Test URL" címet.
3.  Nyiss meg egy terminált, Postman-t, vagy az n8n-en belül egy Inject node-ot, és küldj be egy POST kérést JSON formátumban:
    ```json
    {
      "message": "Füstöl a kettes Truxor motorja, és mintha enné az olajat."
    }
    ```
4.  Figyeld az n8n vásznat! Látni fogod, ahogy az adat beérkezik, az "AI Agent" a rákötött "Mock Gépkönyv" alapján kielemzi, a "JSON Parszolás" node tiszta adattá alakítja, és meg is kapod a Telegram értesítést.

---

## 4. Tudásbázis Frissítése
Ha a jövőben új gépet szeretnél hozzáadni, vagy módosítani a meglévő karbantartási adatokat:
*   Kattints duplán a **"Mock Gépkönyv (Szerszám)"** (ToolCustom) node-ra.
*   A "Text" dobozban látni fogod az összes gép leírását. Egyszerűen gépeld be az új gépeket ide szövegesen, mintha egy doksit írnál. Az AI automatikusan megtanulja és használni fogja a következő futásnál.

## 5. Integrálás az Iszapfaló Rendszerébe
Miután aktiváltad a Workflow-t (jobb felső sarok "Active" gomb), cseréld le a Webhookban a "Test URL"-t "Production URL"-re. 
Ezt a Production URL-t kell odaadni az Iszapfaló csapatának, hogy a saját Telegram botjukból ide továbbítsák a "GÉPHIBA" kategóriájú üzeneteket!