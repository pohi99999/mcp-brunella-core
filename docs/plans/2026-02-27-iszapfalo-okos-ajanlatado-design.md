# Iszapfaló - "Okos" Ajánlatadó / Költségbecslő Asszisztens (RAG + Doc Gen)

## 1. Célkitűzés
Egy AI asszisztens létrehozása, amely beérkező ügyfél-megkeresések (szabad szöveges e-mailek, üzenetek) alapján automatikusan generál egy komplett, formázott árajánlat-tervezetet. A rendszer a cég belső árlistáit és teljesítménynormáit (tudásbázis/RAG) használja a becslések elkészítéséhez.

## 2. Architektúra (Az "A" Megközelítés)

Ennél a megközelítésnél az LLM (Langflow-n keresztül) nemcsak kinyeri az adatokat és számol, hanem egyből egy formázott, ügyfélbarát Markdown dokumentumot is generál végeredményként.

### 2.1. Intelligencia Réteg: Langflow
*   **Technológia:** Langflow, LLM (Gemini 2.0 Flash/Pro vagy erős lokális modell, mivel itt hosszú, koherens szöveget kell generálni).
*   **Tudásbázis (Knowledge Base):** Egy `iszapfalo_arlista_es_normak_mock.md` fájl. Ez tartalmazza:
    *   Gépek (Truxor, Szivattyúk) napidíjai/óradíjai.
    *   Kiszállási díjak kilométerenként.
    *   Teljesítménynormák (pl. 1 Truxor átlagosan hány m2 nádat vág ki 1 nap alatt, hány m3 iszapot szivattyúz).
    *   Emberi erőforrás költségek (rezsióradíjak).
*   **Működés:**
    1. Bemenet: Az ügyfél eredeti üzenete (pl. "200m2 nádvágás és 50m3 iszapkotrás Balatonfüreden").
    2. RAG kikeresi a "nádvágás", "iszapkotrás", "Truxor" díjait és normáit.
    3. Az LLM kiszámolja a várható időtartamot és költséget (gondolkodási lánc/Chain of Thought alkalmazásával).
    4. Az LLM legenerálja a Markdown formátumú árajánlatot.
*   **Kimenet:** Markdown formátumú szöveg, amely közvetlenül bemásolható egy e-mailbe vagy PDF generátorba.

### 2.2. Orchestrációs Réteg: n8n
*   **Workflow:**
    1. **Trigger:** Webhook (vagy Gmail trigger szimuláció). Kapja a "Feladó nevét", "Címet", és az "Üzenet szövegét".
    2. **Langflow hívás:** HTTP Request a Langflow felé, átadva az üzenetet.
    3. **Aktivitás:** Az n8n megkapja a kész Markdown szöveget.
    4. **Értesítés/Kimenet:** Elküldi a kész ajánlat-tervezetet Telegramra a Vezetőségnek jóváhagyásra, VAGY elmenti Google Drive-ra dokumentumként (ahogy a már meglévő `Kimenő ajánlatok_dokumentumok.json`-juk teszi).

## 3. Fejlesztési Lépések

### 3.1. Tudásbázis (Mock) Elkészítése
Létre kell hozni a fiktív árlistát és normákat (`iszapfalo_arlista_es_normak_mock.md`). *Ezt a fájlt a következő lépésben legenerálom neked.*

### 3.2. Langflow Flow Építése
*   Szükség lesz egy **Prompt Template**-re, ami nagyon pontos utasításokat ad arra, hogyan épüljön fel az ajánlat (Bevezetés, Tételes kalkuláció, Végösszeg, Zárás). *Ezt is legenerálom neked.*
*   Mivel ez a prompt matematikát igényel (szorzás, osztás a normák alapján), az LLM-nek ki kell adni az utasítást, hogy "Gondold végig lépésről lépésre a számolást, mielőtt leírod a végeredményt".

### 3.3. n8n Integráció
Egy egyszerű Webhook -> HTTP Request -> Telegram üzenet workflow elkészítése a teszteléshez.