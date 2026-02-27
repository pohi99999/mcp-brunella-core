# Iszapfaló - "Okos" Ajánlatadó / Költségbecslő Asszisztens

## 1. Célkitűzés
Egy AI asszisztens létrehozása, amely beérkező ügyfél-megkeresések (szabad szöveges e-mailek, üzenetek) alapján automatikusan generál egy komplett, formázott árajánlat-tervezetet. A rendszer a cég belső árlistáit és teljesítménynormáit (tudásbázis) használja a gépidők és költségek kiszámításához.

## 2. Architektúra: All-in-One n8n (Advanced AI)
A tervezett megoldás tisztán az **n8n platformon**, a beépített Advanced AI node-ok segítségével valósul meg. Nincs szükség külső RAG/Langflow szolgáltatásra, így a telepítés, karbantartás és hordozhatóság maximálisan leegyszerűsödik.

### 2.1. A Workflow Komponensei
*   **Trigger (Webhook):** Fogadja a bejövő ajánlatkéréseket (ügyfél neve, e-mail címe, és az igény szöveges leírása). Ez szimulálja a már meglévő e-mail/űrlap feldolgozó rendszerüket.
*   **AI Agent Node:** Az "Agy". Az utasításai szerint ő az "Okos Ajánlatadó Asszisztens", akinek Markdown formátumú, ügyfél-kész e-mailt kell fogalmaznia, miután elvégezte a matematikai számításokat.
*   **LLM Model Node (pl. OpenAI Chat Model):** A nyelvi képességekért felelős (pl. gpt-4o), amely a logikai ugrásokat és a megfogalmazást végzi.
*   **Tudásbázis Szerszám (ToolCustom Node):** Rákötve az AI Agentre. Tartalmazza a gépek napidíjait (Truxor, Honda, Kotróhajó), a kiszállási díjak számítási módját, és a teljesítménynormákat (hány m2/nap, hány m3/nap). Az LLM ebből "puskázza" ki a számok alapjait.
*   **Értesítés (Telegram Node):** A kész ajánlat-tervezet azonnali továbbítása a Vezetőség felé (vagy közvetlenül beilleszthető egy e-mail küldő node-ba).

### 2.2. A Folyamat Logikája (Chain of Thought)
Amikor beérkezik az adat, a rendszer:
1.  Kinyeri a paramétereket (terület mérete, iszap köbméter, távolság).
2.  Lekéri a szerszámból a szükséges gép normáit és árait.
3.  Elvégzi a matematikai osztást/szorzást (pl. 800 m2 / 800 m2/nap = 1 nap * 180.000 Ft).
4.  Legenerál egy ügyfélbarát Markdown szöveget az eredménnyel.

## 3. Integrációs Stratégia az Iszapfaló számára
Az Iszapfaló már használ n8n-t és Gmail integrációt ("Gmail kategorizáló" workflow).
A beépítéshez csak össze kell kötniük a Gmail "Ajánlatkérés" ágát ezzel az Okos Ajánlatadó Webhookkal (egy HTTP Request segítségével), a kapott eredményt pedig az ő "Kimenő ajánlatok" workflow-juk automatikusan PDF-be forgathatja vagy elmentheti piszkozatként.