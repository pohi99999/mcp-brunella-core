# Használati és Beüzemelési Útmutató
**Modul:** "Okos" Ajánlatadó / Költségbecslő Asszisztens - *All-in-One n8n verzió*

Ez az útmutató lépésről lépésre bemutatja, hogyan tudod beüzemelni a tisztán n8n-alapú ajánlatadó modult.

---

## 1. Importálás és Beállítás az n8n-ben

Az egész folyamat (az AI logikával és az árlista dokumentummal együtt) egyetlen n8n JSON fájlban található.

1. Nyisd meg az **n8n** felületedet.
2. Kattints az **"Add Workflow"** gombra.
3. Jobb felül kattints a három pontra (`...`), és válaszd az **"Import from File"** menüpontot.
4. Töltsd be ezt a fájlt: `docs/Egyéb/Iszap2/iszapfalo_okos_ajanlatado_all_in_one_n8n.json`.

---

## 2. API Kulcsok megadása

Két hitelesítési pontot kell beállítanod a futtatás előtt:

1.  **AI Modell beállítása (OpenAI Chat Model node):**
    *   Kattints duplán az **"OpenAI Chat Model"** node-ra.
    *   Válaszd ki vagy hozd létre az **OpenAI API** kulcsodat (Credential).
    *   *(Itt érdemes meghagyni a gpt-4o modellt, mert a matematikai számításokhoz és a szép Markdown generáláshoz kell az erősebb intelligencia).*
2.  **Telegram Értesítő (Opcionális):**
    *   Kattints duplán a **"Telegram Értesítés"** node-ra.
    *   Add meg a Telegram Bot tokenedet és a Chat ID-dat. Ez a node úgy van beállítva, hogy egy gyönyörűen megformázott ajánlat-tervezetet küldjön át neked ellenőrzésre.

---

## 3. Tesztelés

Teszteljük a modult egy fiktív ügyfélkéréssel!

1.  Az n8n-ben kattints alul a **"Test Workflow"** gombra (a Webhook node "Listening" állapotba lép).
2.  Kattints duplán a **"Webhook"** node-ra, és másold ki a "Test URL" címet.
3.  Egy POST kéréssel (Postmanből vagy belső Inject node-ból) küldd be ezt az ügyfél e-mailt JSON-ben:
    ```json
    {
      "nev": "Kovács János",
      "email": "janos.kovacs@gmail.com",
      "uzenet": "Üdvözlöm! Van egy 800 m2-es nádas a nyaralóm előtt, amit le kellene vágni Truxorral és a nádat össze is kellene gyűjteni. A helyszín kb 100 km-re van Érdtől. Kérek egy becsült árajánlatot!"
    }
    ```
4.  Látni fogod, ahogy az **AI Agent** elkezdi a "gondolkodást" (Chain of Thought):
    *   Felolvassa az árlistát a rákötött szerszámból.
    *   Kiszámolja a napidíjat (800 m2 / 800 m2/nap norma = 1 nap -> 180.000 Ft).
    *   Kiszámolja a kiszállást (100 km-re -> Alapdíj + 50 * 400 Ft).
    *   Összegzi és ír egy udvarias válasz e-mailt.
5.  A végeredményt megkapod a Telegramodon.

---

## 4. Árlista Frissítése
Ha az Iszapfaló árat emel, vagy megváltoznak a normák:
*   Csak kattints duplán a **"Mock Árlista (Szerszám)"** node-ra.
*   A "Text" mezőben simán írd át az összegeket vagy a négyzetméter számokat. Az AI azonnal a frissített adatokkal fog számolni a következő futásnál, kódolás nélkül!

## 5. Integrálás az Iszapfaló Rendszerébe
Állítsd a Workflow-t "Active" módba, és add meg a Production Webhook URL-t az Iszapfaló csapatának. 
Amikor a `Gmail kategorizáló` workflow-juk egy "Ajánlatkérés" típusú e-mailt talál, egy HTTP Request node-dal át tudják küldeni erre az URL-re, az AI pedig megírja nekik a piszkozatot!