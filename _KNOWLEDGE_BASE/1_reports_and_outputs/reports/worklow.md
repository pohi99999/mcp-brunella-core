# Kódoló Ügynöki Workflow – Gemini + Qwen3-coder CLI + Langlow + Brunella

## 1. Rendszer Áttekintés

**Cél:**  
Egy szakértői, több ügynökből álló, CLI-t, Gemini appot, Qwen3-coder-t, Langlow-t, és speciális "vizuális megértés" modult integráló rendszer, amelyben a felhasználó (Te) minden műveletet a Gemini appon keresztül indít, a végrehajtást és a stratégiát Brunella, a dedikált asszisztens koordinálja, miközben a kódolási, elemzési és prompt-generáló műveletekhez a Qwen3-coder CLI és Langlow AI is aktívan hozzájárulnak.

## 2. Főszereplők és Feladatkörök

| Ügynök/Modul         | Fő képesség                   | Interfész             | Fő feladatok                                                  |
|----------------------|-------------------------------|-----------------------|---------------------------------------------------------------|
| **Brunella**         | Stratégia, összefogás, QA     | Gemini app (prompt)   | Feladat-felbontás, workflow-menedzsment, döntés-előkészítés   |
| **Gemini app**       | Prompt-alapú MI               | App/CLI/API           | Felhasználói promptok, workflow vezérlés, szöveg-alapú output |
| **Qwen3-coder**      | Kódgenerálás, CLI automata    | CLI                   | Kódolás, scriptelés, parancsok végrehajtása                   |
| **Langlow**          | LLM, prompt-kiegészítő        | API/CLI               | Prompt optimalizálás, kreatív szöveg, kód review              |
| **Vizuális megértés**| Képalapú elemzés, profilírozás| Gemini gem            | Vizuális input feldolgozás, leírás, kontextus bővítés         |

---

## 3. Általános Workflow

### 3.1. Feladatindítás (felhasználó → Gemini app)

1. **Felhasználó promptja**:  
   - Cél, elvárás, kontextus rövid leírása.
   - Példa: „Hozz létre egy REST API backendet FastAPI-vel, tesztesetekkel és CI/CD workflow-val.”

2. **Brunella átveszi a promptot**  
   - Felbontja cselekvési lépésekre/fázisokra.
   - Tisztázó kérdéseket tesz fel, ha kell.
   - Meghatározza, melyik ügynök/modul végzi a feladatot vagy annak részét.

### 3.2. Cselekvési lépések – felosztás és végrehajtás

| Lépés | Példa (REST API)                | Felelős ügynök      | Eszköz/parancs           |
|-------|---------------------------------|---------------------|--------------------------|
| 1     | Projekt sablon létrehozása      | Qwen3-coder         | `qwen3 new fastapi ...`  |
| 2     | Endpointok megtervezése         | Brunella + Langlow  | Gemini prompt            |
| 3     | Kód generálása, tesztek         | Qwen3-coder         | CLI parancsok            |
| 4     | CI/CD workflow                  | Qwen3-coder         | YAML generálás           |
| 5     | Kód review, optimalizálás       | Langlow             | `langlow review ...`     |
| 6     | Dokumentáció generálás          | Gemini app          | Prompt vagy CLI          |
| 7     | Vizuális UI review              | Vizuális megértés   | Kép/videó input analízis |

### 3.3. Minden lépésnél:
- A parancsokat, kimeneteket, fájlokat Brunella egységesen dokumentálja és verziózza.
- Tételes naplózás: ki, mikor, mit módosított.
- Folyamatos visszacsatolás: a felhasználó minden fázisnál megerősíthet vagy módosíthat.

---

## 4. Modul-specifikus workflow-k és parancs minták

### 4.1. Qwen3-coder CLI – Kódolás, projektgenerálás

**Indítás (projekt létrehozás):**
```bash
qwen3-coder create fastapi --name=myproject --with-tests --with-ci
```
**Fájl generálás:**
```bash
qwen3-coder generate model --name=User --fields=name:str,email:str
qwen3-coder generate endpoint --model=User --crud
```
**Teszt futtatás:**
```bash
qwen3-coder test
```

### 4.2. Gemini app – Prompt-alapú irányítás

- **Általános prompt minta:**
  ```
  Készítsd el a projekt backendjét FastAPI-vel, generálj minden endpointhoz tesztet, hozz létre CI/CD pipeline-t, és készíts hozzá magyar nyelvű dokumentációt.
  ```
- **Visszacsatolás kérés:**  
  „Állj meg minden fő lépésnél, kérj jóváhagyást a továbblépéshez!”

### 4.3. Langlow – Kódminőség, kreatív promptok

- **Kód review:**
  ```bash
  langlow review src/
  ```
- **Prompt optimalizálás:**  
  „Írd át a promptot kreatívabb, strukturáltabb formában, magyar nyelven!”

### 4.4. Vizuális megértés gem – Profilírozás, UI review

- **Kép/videó elemzés workflow:**
  1. Kép/videó feltöltése Gemini-n keresztül.
  2. Brunella automatikusan futtatja a vizuális megértés gém promptját.
  3. Kimenet: struktúrált, részletes profil + összefoglaló, prompt-ready leírás.

---

## 5. Brunella – Integrátor, minőségbiztosító és stratégiai asszisztens

### 5.1. Munkamenet-sablon

1. **Feladat értelmezése, célok tisztázása**  
   *„Mi a végső cél? Mik a fő követelmények?”*

2. **Feladat lebontása**  
   *Fázisokra, lépésekre, felelős ügynökök hozzárendelése.*

3. **Végrehajtási terv készítése**  
   *Csekklista, workflow, szükséges CLI parancsok.*

4. **Folyamatos státuszfrissítés és visszacsatolás**  
   *„Most a 2. fázisban vagyunk, a következő lépés: …”*

5. **Minőségellenőrzés**  
   *Kód review (Langlow), tesztek futtatása, dokumentáció generálás.*

6. **Kimenet prezentálása, döntés-előkészítés**  
   *Összefoglaló, alternatívák, következő lépések listája.*

---

## 6. Fájlstruktúra és megosztás

- **Projekt log:**  
  `/logs/` – minden ügynök lépése, outputja, döntési pontok, verziók.
- **Dokumentáció:**  
  `/docs/` – generált útmutatók, promptok, workflow leírások.
- **Kód:**  
  `/src/` – Qwen3-coder és Langlow által generált vagy javított forráskód.
- **Vizuális anyagok:**  
  `/visuals/` – UI review, vizuális megértés outputok.
- **Prompt könyvtár:**  
  `/prompts/` – Brunella, Gemini, Langlow stb. prompt minták, sablonok.

---

## 7. Példa: Teljes workflow egy új funkció fejlesztésénél

1. **Felhasználói prompt a Gemini appban:**  
   „Szükségem van egy új PDF-jelentés generáló modulra, amely adatbázisból tölt adatot, és emailben is elküldi az eredményt.”

2. **Brunella workflow-bontása:**  
   - (a) Adatmodell bővítése
   - (b) PDF generáló logika fejlesztése
   - (c) Email küldés integráció
   - (d) Tesztek és dokumentáció

3. **Qwen3-coder CLI parancsok:**  
   ```bash
   qwen3-coder generate model --name=Report --fields=...
   qwen3-coder generate pdf-module --input=Report
   qwen3-coder generate email-module --to-field=...
   ```

4. **Langlow review:**  
   ```bash
   langlow review src/
   ```

5. **Gemini app prompt a dokumentációhoz:**  
   „Írj részletes magyar nyelvű útmutatót a PDF-jelentés modul használatához!”

6. **Vizuális UI review (ha releváns):**  
   - Képernyő feltöltése → vizuális megértés gem futtatása → output elemzése

7. **Brunella összefoglalója:**  
   - Mit végzett el, milyen minőséggel, mi a következő lépés.

---

## 8. Stratégiai előnyök és best practice-ek

- **Automatizált, de kontrollált:** minden lépés auditálható, visszacsatolható, dokumentált.
- **Ügynökök specializációja:** mindenki a saját erősségére fókuszál.
- **Prompt alapú vezérlés:** minden workflow, kódgenerálás és review promptból indítható, egyszerűen bővíthető.
- **Kódminőség és dokumentáció beépítve:** tesztek, review, magyar nyelvű doc minden lépésnél.
- **Vizuális input feldolgozás:** nem csak kód, hanem design, UI és vizuális profil is workflow része lehet.

---

## 9. Továbbfejlesztési irányok

- **Automatikus workflow ajánló:** Gemini/Langlow javaslatokat tesz a következő lépésekre.
- **Template könyvtár:** új feladatokra sablon workflow, prompt, kódrészlet.
- **Minden output magyarul is generálható.**
- **Folyamatos tanulás:** minden ügynök naplózza és visszacsatolja a tapasztalatokat a workflow-ba.

---

## 10. Mintafájl sablonok (kezdeti verziók)

### /logs/2025-08-09_workflow_log.md
```
- [10:00] Funkcióigény beérkezett: PDF-jelentés generálás + email
- [10:05] Brunella: workflow lépések felosztva
- [10:10] Qwen3-coder: adatmodell generálva
- [10:12] Qwen3-coder: PDF modul kész
- [10:15] Qwen3-coder: email modul kész
- [10:17] Langlow: code review, javaslatok integrálva
- [10:20] Gemini: dokumentáció generálva
- [10:21] Brunella: státusz update, következő lépés egyeztetése
```

### /docs/pdf_modul_hasznalati_utmutato.md
```
# PDF Modul Használati Útmutató

## 1. Cél
...

## 2. Használat
...

## 3. Példa parancs
qwen3-coder generate pdf-module --input=...
...

## 4. Hibakezelés
...
```

---

**Ha bármelyik workflow-lépést, parancsot, sablont vagy kódrészletet magyarul, konkrét példával szeretnéd látni, csak szólj, és készítem!**