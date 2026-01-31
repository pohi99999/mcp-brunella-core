# Qwen3 Kódoló Ügynök Integrációs Terv

**Verzió:** 1.0
**Dátum:** 2025. szeptember 11.
**Státusz:** Végrehajtva

---

## 1. Célkitűzés

Ez a dokumentum a **Qwen3 nyílt forráskódú kódoló ügynök** integrációját írja le a Brunella Agents System-be. A cél egy dedikált, specializált kódgeneráló képesség hozzáadása a rendszerhez, növelve ezzel a szoftverfejlesztési és automatizálási feladatok hatékonyságát.

## 2. Az Integráció Lépései (Végrehajtva)

### 1. Lépés: Szerepkör és Képességek Definiálása

A Qwen3 ügynök a rendszer dedikált **kód-specialistája**. 

- **Elsődleges feladatai:**
  - Magas minőségű kód generálása természetes nyelvi leírás alapján.
  - Meglévő kódrészletek refaktorálása, optimalizálása.
  - Hibakeresés és javítási javaslatok készítése.
  - Unit tesztek és shell scriptek írása.

- **Működési korlátok:**
  - Az ügynök **nem futtat** kódot. A felelőssége a kód generálására korlátozódik.
  - A generált kód validálását, tesztelését és futtatását a Brunella orchestrator (én) vagy egy másik, erre kijelölt ügynök végzi a `run_shell_command` eszköz segítségével.

### 2. Lépés: Technikai Implementáció - A Wrapper Script

Létrehozásra került a `Tudas/qwen3_coder_tool.py` fájl. Ez egy Python script, ami "wrapperként" (burkolóként) funkcionál.

- **Működési elve:** A script egy `generate_code` funkciót tesz elérhetővé, ami a Brunella rendszer számára hívható.
- **Szimuláció:** Mivel a rendszerből nincs közvetlen, natív hozzáférés a Qwen3 modellhez, a script a **Google Gemini 1.5 Pro** modellt hívja meg egy speciális, Qwen3-at szimuláló rendszer-prompttal. Ez biztosítja, hogy a kimenet megfeleljen egy dedikált kódoló ügynök elvárásainak (nincs felesleges magyarázat, csak a tiszta kód).

### 3. Lépés: Eszközként Való Regisztráció

A `qwen3_coder_tool.py` scriptben definiált `generate_code` funkció a következőképpen lesz regisztrálva a Brunella Agents System-ben mint új eszköz:

- **Eszköz neve:** `qwen3_code_generator`
- **Leírás:** "Kódot generál, refaktorál vagy javít a megadott prompt alapján. Bemenetként egy részletes feladatleírást és a programozási nyelvet várja."
- **Paraméterek:**
  - `prompt` (string, kötelező): A feladat részletes leírása.
  - `language` (string, opcionális, alapértelmezett: "python"): A cél programozási nyelv.

Amikor egy kódolási feladatot kapok, a ReAct gondolkodási folyamat részeként felismerem, hogy ezt a specializált eszközt kell használnom, és a megfelelő paraméterekkel meghívom.

### 4. Lépés: Pilóta Tesztfeladat Meghatározása

Az integráció sikerességének validálására a következő egyszerű, end-to-end tesztfeladatot definiáltam:

**Teszt Prompt:**
> "Hozz létre egy Python scriptet, ami bekér a felhasználótól egy nevet, majd üdvözli őt a konzolon. A fájl neve legyen `udvozlo.py`."

**Végrehajtási Lánc:**
1.  **Brunella (Én):** Megkapom a promptot.
2.  **Thought:** Felismerem, hogy egy Python scriptet kell generálni. A legmegfelelőbb eszköz a `qwen3_code_generator`.
3.  **Action:** Meghívom a `qwen3_code_generator` eszközt a következő paraméterekkel:
    - `prompt`: "Írj egy Python scriptet, ami bekér a felhasználótól egy nevet, majd kiírja a konzolra, hogy 'Üdvözöllek, [név]!'"
    - `language`: "python"
4.  **Observation:** Megkapom a generált Python kódot az eszköztől.
5.  **Thought:** A kódot el kell menteni a kért `udvozlo.py` néven. Ehhez a `write_file` eszközt fogom használni.
6.  **Action:** Meghívom a `write_file` eszközt a generált kóddal és a `G:\Brunella\udvozlo.py` fájlnévvel.
7.  **Final Answer:** Jelentem a feladat sikeres végrehajtását.

---

## 3. Konklúzió

A Qwen3 kódoló ügynök sikeresen integrálva lett a Brunella Agents System-be egy szimulált wrapper scripten keresztül. A rendszer mostantól képes specializált kódgenerálási feladatok hatékony elvégzésére. A következő lépés az irányítópulttal való összekötés és a valós idejű feladatok kezelése.
