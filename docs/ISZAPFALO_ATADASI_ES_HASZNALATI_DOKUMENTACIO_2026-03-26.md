# Iszapfaló Rendszer – Átadási és Használati Dokumentáció

**Címzett:** Kovásznai Gergely (Iszapfaló Kft.)  
**Dátum:** 2026. március 26.  
**Tárgy:** A rendszer működése, tesztelése és a még hiányzó elemek

---

## Bevezetés

Az alábbi dokumentum összefoglalja az Iszapfaló rendszer jelenlegi működését, a fő funkciókat, a tesztelés menetét, valamint azokat a pontokat, amelyek még további beállítást vagy felhasználói közreműködést igényelnek.

A dokumentáció célja, hogy átláthatóan megmutassa:

- melyik Telegram-botot kell használni,
- hova kerülnek az adatok,
- hogyan lehet a rendszert tesztelni,
- mi működik jelenleg stabilan,
- és melyek a fennmaradó nyitott pontok.

---

## 1. Telegram csatornák – Melyik botot kell használni?

### Fontos pontosítás

A reggeli teszt azért nem működött, mert nem a rendszerhez kapcsolt bot lett használva. Az `@andi_iszapfalo_bot` **nem** az Iszapfaló rendszer része, ezért az oda küldött üzenetek nem kerülnek feldolgozásra.

### A helyesen használandó bot

| Bot neve | Telegram link | Funkció |
|---|---|---|
| `@Iszapfalo_Agent_Bot` | `t.me/Iszapfalo_Agent_Bot` | Munkaidő, feladat, költség és szabadság rögzítése |

**Használati mód:** nincs szükség külön csoportra. Minden munkatárs privát üzenetben ír a botnak, amely természetes magyar nyelvű üzeneteket fogad.

### Példák elfogadott üzenetekre

- **Munkaidő:** „Ma 8 órát dolgoztam a Gödöllő-tó projekten.”, „8-tól 16-ig terepen voltam.”, „Ma 10 órát dolgoztam.”
- **Feladat:** „Feladat: árajánlat írása a Balaton projekthez holnapra.”, „Kellene venni 50 zsák cementet.”
- **Költség:** „Tankoltam 8000 Ft-ért.”, „Vettem csavarokat 3500 Ft-ért.”
- **Szabadság / távollét:** „Holnap nem jövök, beteg vagyok.”, „Pénteken szabadságon leszek.”

**Visszajelzés:** a bot minden esetben magyar nyelven válaszol: siker esetén megerősíti a rögzítést, bizonytalan adat esetén visszakérdez.

---

## 2. Munkaidő naplózás – Hova menti az adatokat?

A Telegramon beküldött információk az Airtable adatbázisba kerülnek. A `02 - ISZ AI Agent Munkaidő` workflow E2E tesztelve, működik.

**Airtable elérés (szerkesztési hozzáféréssel):**  
`https://airtable.com/appU3xQMuAmpmmCEy`

### Adatkapcsolat

| Üzenet típusa | Airtable tábla | Rögzített adatok |
|---|---|---|
| Munkaidő | Munkaidő Nyilvántartás | dátum, ledolgozott idő, projekt, küldő azonosítása |
| Feladat | MUNKAK | leírás, határidő, prioritás, státusz = „Várakozás” |
| Költség | KOLTSEGEK | összeg, dátum, megjegyzés, pénznem = „HUF” |
| Szabadság | Szabadságok | kezdő dátum, záró dátum, típus, ok |

### Hogyan lehet tesztelni?

1. Nyisd meg Telegramon: `@Iszapfalo_Agent_Bot`.
2. Küldd el például ezt az üzenetet: **„Ma 3 órát dolgoztam irodai munkán.”**
3. A bot néhány másodpercen belül visszajelez.
4. Nyisd meg az Airtable-t, és ellenőrizd a **Munkaidő Nyilvántartás** táblát. Az új bejegyzésnek meg kell jelennie.

---

## 3. Munkatársak Telegram-azonosítása – Hogyan kell bekötni őket?

A rendszer a Telegram-felhasználókat a Chat ID alapján azonosítja, ami lehetővé teszi, hogy a beküldött üzenetek a megfelelő munkatárshoz kapcsolódjanak.

### Miért fontos ez?

Amíg egy munkatárshoz nincs Telegram Chat ID rendelve:

- a rendszer az üzenetet még rögzítheti,
- de a munkatárs neve nem minden esetben jelenik meg megfelelően,
- helyette csak az azonosító vagy hiányos kapcsolat látszik.

### Lépések

#### 1. Chat ID begyűjtése

Két egyszerű módszer van:

**A) Egyszerű módszer:**  
A munkatárs ír a `@userinfobot` Telegram-botnak, és elküldi a visszakapott azonosítót.

**B) Iszapfaló boton keresztül:**  
A munkatárs ír az `@Iszapfalo_Agent_Bot` botnak. Az ismeretlen felhasználó így azonosítható, és később rögzíthető a rendszerben.

#### 2. Chat ID rögzítése Airtable-ben

1. Nyisd meg az Airtable-t: `https://airtable.com/appU3xQMuAmpmmCEy`
2. Nyisd meg a **Munkatársak** táblát.
3. Keresd meg az adott munkatárs sorát (vagy hozd létre).
4. A **Telegram Chat ID** mezőbe írd be a kapott számot.

### Jelenleg még rögzítendő munkatársak (5 fő)

- Kollár János
- Zátrok Vazul
- Baksa István
- Nádasdi János
- Bartos István

---

## 4. Gmail kategorizálás – Mi működik jelenleg?

A `06 - ISZ Gmail Categorizel` workflow jelenleg működik, és a beérkező levelekre automatikusan címkéket alkalmaz.

### Mit csinál a rendszer?

A rendszer figyeli és elemzi a beérkező emaileket, majd a szabályok / AI-logika alapján címkézi őket a Gmailen belül.

### Miért nem mindig egyértelmű a címkézés?

A Gmail egyes esetekben belső azonosítókkal (pl. `Label_9112759978974962082`) vagy rendszer-kategóriákkal (`CATEGORY_PERSONAL`, `IMPORTANT` stb.) dolgozik, ezért a címke nem mindig jelenik meg olyan látványosan, mint egy kézzel létrehozott egyedi címke, de a keresőben szűrhető.

### Hogyan lehet ellenőrizni?

1. Küldj egy teszt emailt az `iszapfalo@gmail.com` címre.
2. Lépj be az n8n felületre: `https://iszapfalo.app.n8n.cloud`
3. Nyisd meg a workflow-t: **06 - ISZ Gmail Categorizel → Executions**
4. Nézd meg az utolsó futás állapotát (`Success` / `Error`).
5. Ezután ellenőrizd a Gmail fiókban (`iszapfalo@gmail.com`), hogy a levél megkapta-e a megfelelő címkét vagy kategóriát.

**Fontos megjegyzés:** a jelenlegi verzió nem ír külön Airtable-be a Gmail-feldolgozásról, hanem közvetlenül a Gmailben alkalmaz címkéket. Ha ez szükséges, a funkció bővíthető Airtable naplózással is.

---

## 5. Error Monitoring – Hogyan látszanak a hibák?

Az `01 - Error Monitoring` workflow célja, hogy a rendszerhibák ne maradjanak észrevétlenek.

### Mit csinál?

- hibákat fogad webhookon keresztül,
- a hibaadatokat eltárolja Airtable-ben egy hibalog táblába,
- kritikus hiba esetén Telegram értesítést küld az adminnak,
- heti összesítőt készít az észlelt hibákról.

### Mit jelent ez a gyakorlatban?

Ha egy fontos automatizmus hibával fut le, azt nem csak az n8n execution listában lehet észrevenni, hanem külön logolható és riasztható eseményként is kezelhető.

### Mire jó üzleti oldalról?

- gyorsabban észlelhető, ha egy automatizmus megáll,
- utólag visszanézhető, melyik workflow-ban történt hiba,
- elkülöníthető a kritikus és a nem kritikus probléma.

**Jelenlegi állapot:** a workflow dokumentált/exportált állapota alapján aktív, Telegram riasztási mintával rendelkezik.

---

## 6. Telegram parancsok – Mire való a 03-as workflow?

A `03 - Telegram Commands` workflow a Telegramon beküldött lekérdezési parancsokat kezeli.

### Jelenlegi funkciók

A dokumentált/exportált állapot alapján a workflow a következő parancsokat kezeli:

- `/statusz` → napi állapot / mai munkaidő összesítés
- `/het` → heti munkaidő összesítés

### Mit ad vissza?

A rendszer az Airtable-ből lekéri a megfelelő adatokat, majd Telegramon visszaküldi az összesítést a kérdező munkatársnak.

### Mikor hasznos?

- ha egy munkatárs gyorsan meg akarja nézni, mi lett rögzítve aznap,
- ha heti összesítést szeretne külön Airtable megnyitása nélkül,
- ha a vezetőség később további lekérdezési parancsokat akar bevezetni.

**Megjegyzés:** ez nem azonos a fő rögzítő bottal, hanem annak kiegészítő lekérdezési modulja.

---

## 7. Rendszerstátusz – Mi működik most, és mi hiányzik még?

### Jelenlegi állapot

| Workflow | Funkció | Állapot |
|---|---|---|
| 01 — Error Monitoring | Hibalogolás, kritikus Telegram riasztás, heti hibaösszesítő | ✅ Dokumentáltan aktív |
| 02 — AI Agent Munkaidő | Telegram → munkaidő / feladat / költség / szabadság rögzítés | ✅ Működik (E2E tesztelve) |
| 03 — Telegram Commands | `/statusz` és `/het` lekérdezések | ✅ Dokumentáltan aktív / opcionális modul |
| 04 — Weekly Reminder | Heti emlékeztető logika | ✅ Aktív |
| 05 — Geppark | Géppark-nyilvántartás | ✅ Aktív |
| 06 — Gmail Categorizel | Beérkező levelek automatikus kategorizálása | ✅ Működik (aktív, tesztelve) |
| 07 — ISZ Heti Kontextus Csomag | Heti vezetői markdown riport generálása és Telegram kézbesítése | ✅ Aktív |

### Mi hiányzik még a teljes üzemhez?

- **Munkatársak Telegram Chat ID-jének rögzítése:** a 3. pontban leírt folyamat elvégzése az 5 hiányzó főnél.
- **Gmail címkézés felhasználói oldali ellenőrzése:** javasolt gyakorlati teszttel megnézni, hogy a címkék a Gmail felületén is megfelelően követhetők-e.
- **Első éles heti riport felhasználói oldali ellenőrzése:** javasolt megnézni az első beérkező Telegram dokumentumot, hogy a vezetői oldalon is megfelelő formában érkezik-e.
- **Google Drive feltöltés (opcionális):** jelenleg a heti riport Telegramon érkezik meg; külön Drive-feltöltéshez még hiányzik egy, a workflow számára is elérhető Google Drive credential.

---

## 8. Heti Kontextus riport – Mire szolgál?

**Workflow neve:** `07 - ISZ Heti Kontextus Csomag`

### Célja

Ez a workflow heti rendszerességgel összegyűjti az Iszapfaló működéséhez kapcsolódó legfontosabb Airtable adatokat, és egy vezetői áttekintésre alkalmas, AI-kompatibilis markdown riportot készít.

A riportból gyorsan látszik például:

- hány aktív projekt fut,
- mely projektek késnek,
- mely feladatok sürgősek,
- kik túlterheltek vagy szabadságon vannak,
- mennyi munkaidő ment el az előző időszakban,
- mekkora a pénzügyi / ajánlati pipeline.

### Működése

| Lépés | Leírás |
|---|---|
| Cron Trigger | Hetente egyszer, hétfő reggel indul. |
| Airtable lekérdezések | Adatgyűjtés az alábbi táblákból: Folyamatok, Feladatok, Munkatársak, Szabadságok, Munkaidő Nyilvántartás. |
| Heti Kontextus Generátor | A Code node összesíti az adatokat, elkészíti a heti riportot markdown formában, létrehozza a fájlnevet (pl. `Heti_Kontextus_20260326.md`), és előállítja a bináris fájlverziót (`binary.report`). |
| Telegram kézbesítés | A generált riport dokumentumként kerül kiküldésre Telegramon a vezetői admin chatre. |

### Jelenlegi állapot

- ✅ Airtable adatlekérés működik
- ✅ riportgenerálás működik
- ✅ markdown és bináris output létrejön
- ✅ Telegram dokumentumküldés be van kötve (`Telegram account 4` → admin chat: `7544590867`)
- ✅ a workflow **aktív** állapotban van, heti cron futásra kész
- ✅ a Telegramos kézbesítési ág az n8n-ben publikálva van

### Jelenlegi kézbesítés és opcionális bővítés

A jelenlegi éles verzióban a heti riport Telegram dokumentumként kerül kiküldésre. Ez a leggyorsabb és legkisebb kockázatú első kézbesítési mód, mert a meglévő Telegram credentialdel és admin chat-címmel már össze van kötve.

Ha később szükség van archiválásra vagy megosztott mappás tárolásra, akkor második ágon külön hozzáadható:

1. **Google Drive feltöltés** – ehhez még hiányzik egy, a workflow számára is elérhető Drive credential.

**Gyakorlati javaslat:** az első beérkező Telegram riportot érdemes vezetői oldalon ellenőrizni, és ha megfelelő, akkor a jelenlegi megoldás használható éles működésben külön további fejlesztés nélkül.

---

## 9. Gyors tesztelési ellenőrzőlista

Javasolt a következő teszteket sorban végigjárni:

### 1. Bot teszt
Írj a botnak: **„Ma 3 órát dolgoztam irodai munkán.”**  
**Elvárt eredmény:** a bot visszajelez, és az Airtable **Munkaidő Nyilvántartás** táblában új sor jelenik meg.

### 2. Feladat teszt
Írd ezt: **„Feladat: Balaton árajánlat elkészítése holnapra.”**  
**Elvárt eredmény:** a **MUNKAK** táblában új feladat jelenik meg.

### 3. Gmail teszt
Küldj teszt emailt az `iszapfalo@gmail.com` címre.  
**Elvárt eredmény:** az n8n-ben sikeres futás látható, és a Gmailben megjelenik a címkézés vagy kategorizálás.

### 4. Telegram command teszt
Telegramon küldd el a `/statusz` vagy `/het` parancsot.  
**Elvárt eredmény:** a bot visszaadja a napi vagy heti összesített információt.

### 5. Munkatársak azonosítása
A hiányzó 5 munkatárshoz kérj be Chat ID-t, és rögzítsd a **Munkatársak** táblában.

### 6. Heti Kontextus riport teszt
A `07 - ISZ Heti Kontextus Csomag` workflow kézi futtatásával ellenőrizhető, hogy a markdown riport előáll-e és Telegramon megérkezik-e.  
**Elvárt eredmény:** az n8n futás sikeres, létrejön a heti riport fájlneve és a bináris report output, majd a riport `.md` dokumentumként megérkezik a Telegram admin chatre.

---

## 10. Összefoglaló

| Mi működik jelenleg? | Mi szükséges még? |
|---|---|
| A munkatársak tudnak Telegramon adatot küldeni, a rendszer rögzíti a munkaidőt, feladatot, költséget és szabadságot. | A hiányzó munkatársi Chat ID-k rögzítése. |
| Az adatok Airtable-ben megjelennek. | Gmail címkézés felhasználói oldali ellenőrzése. |
| A Gmail kategorizálás működik. | Az első éles Telegram riport felhasználói oldali ellenőrzése javasolt. |
| Az Error Monitoring külön hibalogolási és Telegram riasztási logikát ad. | Google Drive credential biztosítása, ha Drive-feltöltés is szükséges. |
| A Telegram Commands modul gyors lekérdezéseket biztosít. | Opcionális további Telegram parancsok csak külön igény esetén szükségesek. |
| A heti vezetői kontextus riport generálása és Telegram kézbesítése működik, a workflow aktív. | A jelenlegi megoldás használható éles működésben; Drive-feltöltés csak opcionális bővítés. |

---

**Pohánka Péter**  
2026. március 26.
