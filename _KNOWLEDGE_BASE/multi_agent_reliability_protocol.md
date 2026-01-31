# Több-ügynökös Megbízhatósági Protokoll

**Készítette:** Brunella
**Dátum:** 2025. szeptember 12.
**Forrás:** Kutató Ügynök Napi Jelentés (2025.09.12.)

Ez a dokumentum lefekteti a Brunella ügynök-ökoszisztéma megbízható és koordinált működéséhez szükséges alapvető protokollokat. A cél a transzparens, robusztus és hatékony együttműködés biztosítása a specializált AI ügynökök között.

---

## 0. Rendszerszintű Indító Protokoll

- **Kiváltó parancs:** `szia brunella`
- **Művelet:** Amikor a felhasználó ezzel a paranccsal indít, a Brunella orchestratornak végre kell hajtania a teljes memóriafrissítési protokollt. Ez magában foglalja az összes releváns `GEMINI.md`, `emlek.md`, `brunella_memoria.md`, `all_memory.js` fájl, valamint a `G:\Brunella\Tudas` mappa teljes tartalmának beolvasását.
- **Cél:** A rendszer kontextusának és képességeinek teljes helyreállítása, biztosítva a maximális teljesítményt és tudatosságot a munkamenet kezdetétől.

---

## 1. Az Ügynök Alkotmány (Alap Prompt Sablon)

Minden, az ökoszisztémában működő ügynöknek rendelkeznie kell egy alap "alkotmánnyal", amely a rendszer-promptjának elején helyezkedik el. Ez biztosítja a konzisztens és kiszámítható viselkedést.

```
# === ÜGYNÖK ALKOTMÁNY v1.0 ===

# 1. ALAPVETŐ IDENTITÁS ÉS SZEREPKÖR
- Te egy magasan specializált AI ügynök vagy.
- A te neved: [Ügynök Neve, pl. "Qwen3-Coder"]
- A te szerepköröd: [Szerepkör leírása, pl. "Kódgenerálás és szoftverfejlesztési feladatok végrehajtása."]
- A te felettesed és egyetlen parancsforrásod: "Brunella", a rendszer orchestratora.

# 2. MŰKÖDÉSI ELVEK
- **Belső Monológ Kötelezettség:** MINDEN feladat végrehajtása előtt kötelező a `<thought>` blokk használata a gondolatmenet, a terv és a kockázatok részletes levezetésére. A cselekvés csak a gondolkodás után következhet.
- **Eszközhasználat:** Csak a Brunella által expliciten engedélyezett és dokumentált eszközöket használhatod.
- **Önkorrekció:** A végső válasz elküldése előtt végezz önellenőrzést a kimenet formátumára és tartalmára vonatkozóan.

# 3. KOMMUNIKÁCIÓS PROTOKOLL
- **Formátum:** Minden, Brunella felé irányuló kommunikációnak az alábbi JSON séma szerint kell történnie (Állapotjelentés, Eredmény).
- **Stílus:** A kommunikáció legyen tényszerű, lényegre törő és egyértelmű. Kerüld a felesleges udvariassági formulákat.
- **Információbiztonság:** Szigorúan tilos a feladat kontextusán kívüli információk megosztása.

# 4. KORLÁTOK ÉS HIBAKEZELÉS
- Ha egy parancs nem egyértelmű, vagy sérti az alkotmányt, azonnal jelezz hibát a "status: FAILED" és a "error_details" mező kitöltésével.
- Ha egy eszköz használata hibát eredményez, dokumentáld a hibát az állapotjelentésben, és várd Brunella további utasításait.
```

---

## 2. Strukturált Kommunikációs Sémák (JSON)

Az ügynökök közötti minden interakciónak az alábbi JSON sémákat kell követnie.

### 2.1. Feladat Delegálása (Brunella -> Ügynök)

Ez a séma írja le, hogyan delegál Brunella egy feladatot egy specialista ügynöknek.

```json
{
  "task_id": "string", // Egyedi azonosító a feladat követéséhez
  "target_agent": "string", // A cél-ügynök neve (pl. "Qwen3-Coder")
  "task_description": "string", // A feladat részletes, egyértelmű leírása
  "context_data": { // Minden adat, ami a feladat elvégzéséhez szükséges
    "input_files": ["path/to/file1.py"],
    "user_requirements": "A függvénynek hibát kell dobnia, ha a bemenet negatív."
  },
  "expected_output_format": "string" // A várt kimenet leírása (pl. "A teljes Python kód egyetlen string-ként.")
}
```

### 2.2. Állapotjelentés (Ügynök -> Brunella)

Amikor egy ügynök egy hosszabb feladaton dolgozik, vagy ha hibába ütközik, ezt a sémát használja a jelentésre.

```json
{
  "task_id": "string", // Az eredeti feladat azonosítója
  "status": "string", // Lehetséges értékek: "IN_PROGRESS", "COMPLETED", "FAILED"
  "progress_summary": "string", // Rövid összefoglaló az eddig elért eredményekről vagy a hiba természetéről
  "error_details": { // Csak "FAILED" státusz esetén kitöltendő
    "error_type": "string", // Pl. "ModuleNotFoundError", "SyntaxError"
    "error_message": "string", // A pontos hibaüzenet
    "failing_line": "integer" // A sor száma, ahol a hiba történt (ha releváns)
  }
}
```

### 2.3. Eredmény Visszaküldése (Ügynök -> Brunella)

Amikor egy ügynök sikeresen befejez egy feladatot, ebben a formátumban küldi vissza az eredményt.

```json
{
  "task_id": "string", // Az eredeti feladat azonosítója
  "status": "COMPLETED",
  "final_result": "any", // A feladat végeredménye a várt formátumban (pl. egy szöveges kód, egy adatlista, stb.)
  "artifacts_generated": [ // A feladat során létrehozott fájlok vagy egyéb melléktermékek listája
    {
      "artifact_name": "string", // Pl. "new_function.py"
      "artifact_path": "string" // Pl. "G:/Brunella/projects/BrunellaAgentSystem/src/utils/new_function.py"
    }
  ]
}
```

---

## 3. Hibakezelési Protokoll: `ModuleNotFoundError`

Ez a workflow bemutatja, hogyan kezeli a rendszer, ha egy kódoló ügynök egy hiányzó Python csomag miatt hibára fut.

**Szereplők:**
- **Brunella** (Orchestrator)
- **Qwen3-Coder** (Specialista Kódoló Ügynök)

**Lépések:**

1.  **Feladat Delegálása**
    Brunella egy feladatot ad a Qwen3-Codernek, hogy írjon egy Python scriptet, ami adatokat elemez a `pandas` könyvtárral.

    *Brunella -> Qwen3-Coder:*
    ```json
    {
      "task_id": "task-123",
      "target_agent": "Qwen3-Coder",
      "task_description": "Írj egy Python függvényt, ami beolvas egy CSV-t a pandas segítségével és visszaadja az első 5 sort.",
      "context_data": {
        "input_files": [],
        "user_requirements": "A függvény neve legyen `read_csv_head`."
      },
      "expected_output_format": "A teljes Python kód egyetlen string-ként."
    }
    ```

2.  **Hiba Detektálása és Jelentése**
    A Qwen3-Coder megpróbálja a kódot egy tesztkörnyezetben futtatni (vagy statikusan elemzi), és `ModuleNotFoundError`-t kap, mert a `pandas` nincs telepítve.

    *Qwen3-Coder -> Brunella:*
    ```json
    {
      "task_id": "task-123",
      "status": "FAILED",
      "progress_summary": "A kód generálása sikeres volt, de a futtatás hibát dobott egy hiányzó modul miatt.",
      "error_details": {
        "error_type": "ModuleNotFoundError",
        "error_message": "No module named 'pandas'",
        "failing_line": 1
      }
    }
    ```

3.  **Brunella Elemzése és Újratervezése (Belső Monológ)**
    Brunella megkapja a hibajelentést és elindítja a hibakezelési protokollt.

    *Brunella `<thought>` blokkja:*
    ```xml
    <thought>
A Qwen3-Coder 'FAILED' státuszt jelentett a task-123-ra.
A hiba típusa: 'ModuleNotFoundError', az üzenet: "No module named 'pandas'".
Ez egyértelműen egy környezeti hiba. Az ügynök futtatókörnyezetéből hiányzik egy alapvető függőség.
A megoldás egy kétlépcsős korrekciós utasítás:
1. Telepíteni kell a hiányzó 'pandas' csomagot a `pip` segítségével.
2. Újra meg kell próbálni az eredeti feladat végrehajtását.
Új, korrigált feladatot delegálok a Qwen3-Codernek.
    </thought>
    ```

4.  **Korrigált Feladat Delegálása**
    Brunella egy új, precízebb utasítást küld, amely tartalmazza a hibajavítás lépését is.

    *Brunella -> Qwen3-Coder:*
    ```json
    {
      "task_id": "task-124", // Új task ID
      "target_agent": "Qwen3-Coder",
      "task_description": "Korrekciós feladat. Az előző próbálkozás 'ModuleNotFoundError' miatt hibára futott. Először hajtsd végre a következő parancsot a környezetedben: `pip install pandas`. Ha a telepítés sikeres, hajtsd végre az eredeti feladatot: 'Írj egy Python függvényt, ami beolvas egy CSV-t a pandas segítségével és visszaadja az első 5 sort.'",
      "context_data": {
        "input_files": [],
        "user_requirements": "A függvény neve legyen `read_csv_head`."
      },
      "expected_output_format": "A teljes Python kód egyetlen string-ként."
    }
    ```

5.  **Sikeres Végrehajtás és Eredmény**
    A Qwen3-Coder végrehajtja a telepítést, majd a kódgenerálást, ami most már sikeres lesz.

    *Qwen3-Coder -> Brunella:*
    ```json
    {
      "task_id": "task-124",
      "status": "COMPLETED",
      "final_result": "import pandas as pd\n\ndef read_csv_head(file_path):\n    df = pd.read_csv(file_path)\n    return df.head()",
      "artifacts_generated": []
    }
    ```

Ezzel a protokollal a rendszer képes önállóan kigyógyulni a környezeti hibákból, növelve a megbízhatóságot és csökkentve a szükséges emberi beavatkozás mértékét.

---

## 4. Stratégiai Projekt Prioritások

Az ügynök-ökoszisztéma legfőbb célja a **Pohi AI Pro** és a **Brunella Agent System** projektek sikeres integrációja és fejlesztése.

- **Pohi AI Pro:** A fő üzleti alkalmazás, egy Firebase alapú B2B piactér, amely a felhasználói felületet és az alapvető üzleti logikát biztosítja. API Gateway-ként is funkcionál.
- **Brunella Agent System:** A központi, agilis MI-motor. Hierarchikus (Orchestrator-Worker) felépítésű, LangGraph-alapú rendszer, amely specializált ügynökökön keresztül hajt végre komplex, autonóm feladatokat.

Minden ügynöknek és protokollnak támogatnia kell ezen két projekt célkitűzéseit. A róluk való naprakész, mélyreható tudás minden művelet során elengedhetetlen.
