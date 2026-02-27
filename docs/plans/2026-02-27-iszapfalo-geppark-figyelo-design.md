# Iszapfaló - Géppark és Eszköz "Egészség" Figyelő (Prediktív Karbantartás)

## 1. Célkitűzés
Egy független, API-n (Webhookon) keresztül hívható AI modul létrehozása, amely a munkatársak által beküldött szabad szöveges hibajelentéseket és gépállapot-információkat elemzi. A modul azonosítja az érintett gépet, a hiba jellegét, meghatározza a sürgősséget, és a belső tudásbázis alapján javaslatot tesz a karbantartási lépésekre és a szükséges alkatrészekre. 

## 2. Architektúra: All-in-One n8n (Advanced AI)
A modul teljes logikája, beleértve az AI hívásokat és a tudásbázist is, **kizárólag az n8n rendszeren belül** épül fel, az `@n8n/n8n-nodes-langchain` (Advanced AI) node-ok segítségével. Nincs szükség külön Langflow vagy vektor-adatbázis szerver üzemeltetésére.

### 2.1. A Workflow Komponensei
*   **Trigger (Webhook):** Fogadja a bejövő kéréseket (POST), például a Telegram botból érkező szövegeket (szimulálva).
*   **AI Agent Node:** A folyamat agya. Megkapja a felhasználó üzenetét és a rendszer-promptot (hogy ő egy prediktív karbantartási asszisztens). 
*   **LLM Model Node (pl. OpenAI Chat Model):** Az AI Agent-hez kötve biztosítja a nyelvi modell képességeit (pl. gpt-4o).
*   **Tudásbázis Szerszám (ToolCustom Node):** Az AI Agent-hez kötött eszköz, amely szövegesen tartalmazza a teljes (mock) gépkönyvet, a hibajelenségeket és a szükséges alkatrészek cikkszámait. Az Agent ebből olvassa ki a megoldást.
*   **JSON Parszoló (Code Node):** Biztosítja, hogy az LLM által visszaadott strukturált szöveget az n8n valid JSON objektumként kezelje tovább.
*   **Értesítés (Telegram Node):** A feldolgozott, strukturált adatok (Gép, Kategória, Sürgősség, Teendők) formázott továbbítása a vezetőségnek.

### 2.2. Kimeneti Struktúra
A workflow egy szigorú JSON struktúrát állít elő az alábbi formátumban:
```json
{
  "gep_id": "string (A felismert gép azonosítója, pl. Truxor-02)",
  "hiba_kategoria": "string (pl. Motor, Hidraulika, Szerkezet)",
  "surgosseg": "string (Kritikus, Magas, Normál, Alacsony)",
  "javasolt_lepes": "string (Mit kell tenni a gépkönyv alapján)",
  "szukseges_alkatreszek": ["lista", "a", "cikkszámokkal"]
}
```

## 3. Integrációs Stratégia az Iszapfaló számára
Mivel ez a megoldás egy független n8n Webhookon csücsül, az Iszapfaló meglévő rendszerébe (ahol már van Telegram és n8n) rendkívül egyszerű a bekötése:
A meglévő "Telegram Bejövő Üzenetek Feldolgozása" workflow-jukba csak egyetlen **HTTP Request node**-ot kell tenniük, amely a hibajelentéseket (POST kéréssel) átdobja erre a "Géppark Figyelő" Webhookra, majd a kapott JSON választ elmentik a saját Airtable adatbázisukba.