# Iszapfaló Kft. - Intelligens Asszisztens Rendszer
## Fejlesztési vízió — Hogyan legyen Claude a rendszer agya?

**Dátum:** 2026. március 11.  
**Készítette:** Claude AI (Anthropic)  
**Cél:** Stratégiai architektúra-vízió  
**Alapelv:** Meglévőkre építeni — nem újraírni  

**Kapcsolódó megvalósítási terv:** `docs/ISZAPFALO_HETI_KONTEXTUS_AKCIOPLAN.md`  

---

## 1. A kérdés, amit feltettél — és a valódi válasz

Azt kérdezted: hogyan tudnád kihasználni azt a rengeteg adatot, amit a rendszer gyűjt? Hogyan kaphatnál tőlem pontos munkarend-javaslatokat, projekt-áttekintőt, prioritás-elemzést?

Az őszinte válasz: a rendszered adatai már most kiemelkedőek. Megvan az összes szükséges információ. Ami hiányzik, az egyetlen dolog:

**Én (Claude) nem látom az adataidat — csak te látod.**  
Ha az adatok eljutnak hozzám, azonnal képes vagyok velük dolgozni.

Ez a dokumentum azt mutatja meg, hogyan lehet ezt a hidat megépíteni — minimális fejlesztéssel, a meglévő rendszerre alapozva.

### 1.1. Mit láttam az Airtable-ben — élőben, most

Mielőtt ezt a dokumentumot elkészítettem, belenéztem az Airtable-be. Íme, mit találtam:

| Tábla | Rekordok száma | Kulcsmezők |
|---|---|---|
| **Folyamatok** | 36 projekt | Státusz, Késés napokban, Ár, Felelős, Feladatok száma |
| **Feladatok** | 367 feladat | Feladat neve, Prioritás, Státusz, Folyamat kapcsolat |
| **Munkatársak** | 7 fő | Beosztás, Kapcsolódó folyamatok, Feladat leterheltség % |
| **Munkaidő Nyilvántartás** | létezik | Munkaidő adatok (Pohi fejlesztéssel bővül) |
| **Szabadságok** | létezik | Szabadság nyilvántartás |
| **Kimenő Árajánlatok**| létezik | Ajánlat pipeline |
| **Telegram Napló** | létezik | Minden bot-üzenet naplózva |

⚠️ **Ami azonnal feltűnt az adatokban:**
*   **Balatonberény:** 11 nap késésben • **Bátor-Tábor Hatvan:** 58 nap késésben!
*   **Balatonszárszó:** 24 nap késés • **Nagytarcsa:** 40 nap késés
*   367 feladatból a legtöbb 'Új' státuszban — sok feldolgozatlan teendő
*   A Munkatársak táblában 'Feladat leterheltség (%)' mező már létezik — ezt használni kell!
*   Projekt összesen ~39,8 millió Ft ajánlati értékkel fut

---

## 2. A rendszer jelenlegi felépítése és a vízió

### 2.1. Jelenlegi állapot — három réteg, amelyek nem kommunikálnak

📊 **AIRTABLE — Adat réteg**  
`36 projekt • 367 feladat • 7 munkatárs • Munkaidő • Ajánlatok`

⬆ *adatok folynak felfelé* ⬆

⚙️ **N8N — Automatizálás réteg**  
`Gmail kategorizálás • Telegram bot • Drive szinkron • Error monitoring`

❌ *nincs kapcsolat* ❌

🧠 **CLAUDE — Elemzés réteg**  
`Jelen pillanatban: csak azt látja, amit te beírsz`

A három réteg egymástól függetlenül működik. Claude nem látja az Airtable adatait, az n8n nem küld összefoglalókat Claude-nak, és te manuálisan közvetítesz közöttük.

### 2.2. A vízió — az összekötő híd

📊 **AIRTABLE — Adat réteg**  
`36 projekt • 367 feladat • 7 munkatárs • Munkaidő • Ajánlatok`

⬆ *adatok + automatikus összefoglaló* ⬆

⚙️ **N8N — Automatizálás réteg + Heti Kontextus Csomag**  
`Gmail kategorizálás • Telegram bot • Drive szinkron • Error monitoring • ⭐ ÚJ: Heti Kontextus workflow`

⬇ *Kontextus Csomag → Google Drive → Claude látja* ⬇

🧠 **CLAUDE — Elemzés réteg**  
`Látja a projekt státuszokat • Látja a késéseket • Látja ki ér rá • Látja a feladat prioritásokat • → Képes pontos munkarend-javaslatot adni`

---

## 3. A híd: a Heti Kontextus Csomag

Ez a vízió kulcseleme. Egyetlen n8n workflow, ami minden hétfő reggel összegyűjti az Airtable adatokat és egy olvasható formátumban eljuttatja oda, ahol én is látom.

### 3.1. Hogyan működik?

🔄 **A folyamat lépései:**
1.  **MINDEN HÉTFŐ 07:00** — n8n automatikusan lefut
2.  Airtable lekérdezés: aktív folyamatok + státusz + késések + felelősök
3.  Airtable lekérdezés: nyitott Magas prioritású feladatok + kinek van rendelve
4.  Airtable lekérdezés: ki van szabadságon a jövő héten
5.  Airtable lekérdezés: munkaidő előző héten (mennyit dolgozott mindenki)
6.  n8n Code node: formázott Markdown összefoglaló készítése
7.  Google Drive: `Heti_Kontextus_[datum].md` fájl feltöltése
8.  Te megnyitod Claude-ot, én automatikusan látom a Drive fájlt, és kész

### 3.2. Mit tartalmaz a Heti Kontextus Csomag?

| Szekció | Tartalom |
|---|---|
| 📋 **Aktív projektek** | Minden folyamatban lévő projekt: státusz, késés napokban, fő felelős, nyitott feladatok száma |
| 🚨 **Sürgős / késésben lévők** | Az összes projekt ahol Késés > 0 nap, prioritás szerint rendezve |
| ✅ **Magas prioritású feladatok** | Csak a 'Magas' prioritású, 'Új' státuszú feladatok — ki van hozzárendelve |
| 👥 **Munkatárs elérhetőség** | Ki van szabadságon, ki ér rá, aktuális leterheltség % Airtable-ből |
| 📈 **Előző heti munkaidő** | Összesített munkaidő munkatársanként (ha Pohi modul él) |
| 💰 **Pipeline áttekintő** | Ajánlat státuszban lévő projektek összértéke |

### 3.3. Kell-e ehhez új fejlesztés?

| Komponens | Meglévő? | Teendő |
|---|---|---|
| Airtable adatok | ✅ Kész | Semmi |
| n8n Schedule Trigger | ✅ Kész | Semmi — megvan a tudás |
| n8n Airtable node — List Records | ✅ Kész | Semmi — már használjuk |
| n8n Code node — Markdown formázás | ✅ Kész | ~30 sor kód |
| Google Drive feltöltés n8n-ből | ✅ Kész | Credential megvan |
| Claude Google Drive kapcsolat | ✅ MÁR ÉL | MCP connector aktív Claude.ai-ban |
| Munkaidő adatok (Pohi modulja) | ⏳ Hamarosan | Pohi brief teljesítése után |

✅ **Összefoglalva:**
Ez az egyetlen workflow amit meg kell csinálni: 1 Schedule Trigger + 4 Airtable lekérdezés + 1 Code node + 1 Google Drive feltöltés.
**Becsült fejlesztési idő:** 2-3 óra (Pohi vagy én, böngészőn keresztül).
Után: minden hétfőn automatikus, emberi beavatkozás nélkül.

---

## 4. Mit tudok majd megválaszolni — élő példák

Ha a Heti Kontextus Csomag él, ilyen kérdéseket tudsz feltenni — és ilyen precíz válaszokat adhatok:

### 4.1. Munkarend tervezés
**❓ "Milyen legyen a jövő heti munkarend?"**
🤖 Bátor-Tábor Hatvan 58 napja késik — ez a legégetőbb. Javaslom Kollár Jánost és Baksa Istvánt oda irányítani hétfőtől szerdáig. Balatonszárszón (24 nap késés) csütörtök-pénteken Gergely és Bartos tudná folytatni. Vazul Zátrok szabad, őt érdemes a Nagytarcsa mérésekre küldeni. Figyelem: ha Pohi modul él, látom hogy ki dolgozott kevesebbet előző héten — ez alapján is tudok elosztást javasolni.

### 4.2. Projekt prioritizálás
**❓ "Melyik projektekre kell most fókuszálni?"**
🤖 Késés alapján prioritási sorrend: 1) Bátor-Tábor Hatvan (58 nap), 2) Nagytarcsa (40 nap), 3) Balatonszárszó (24 nap), 4) Balatonberény (11 nap). A Városligeti Vertikum és Városligeti feladatok 'Számlázásra vár' státuszban — ezek pénzügyileg égetők, mert a bevétel ott áll. A Keszthelyi és Vonyarcvashegyi ajánlatokat sürgősen ki kell küldeni — feladat szintjén 'Magas' prioritásként jelölve.

### 4.3. Munkatárs leterheltség
**❓ "Ki van túlterhelve, ki kaphat még feladatot?"**
🤖 Az Airtable Feladat leterheltség % mezőjéből látom: Gergely 8 aktív projekthez kapcsolódik, Bartos szintén. A terep munkások (Kollár, Baksa, Nádasi, Vazul) feladatszáma alacsonyabb — ők még kaphatnak feladatot. Konkrét számokat a Heti Kontextus Csomag munkaidő szekciójából tudom igazolni.

### 4.4. Pénzügyi áttekintő
**❓ "Hol állunk pénzügyileg? Milyen bevételek várhatók?"**
🤖 Aktív ajánlati pipeline: ~39,8 millió Ft. Számlázásra kész: Városligeti Vertikum + Városligeti (ezeket ki kell küldeni!). Folyamatban lévő projektek: Balatonberény, Balatonszárszó, Nagytarcsa, Vonyarcvashegy, Audi Győr, Gyenesdiás, Syssy lakópark. Pontosabb számokat a Kiajánlott Ár mező alapján tudok adni ha ez látható a csomagban.

### 4.5. Heti összefoglaló automatikusan
**❓ "Adj egy gyors heti összefoglalót."**
🤖 Pénteken 16:00-kor, a Heti Kontextus Csomag alapján, automatikusan generálok egy összefoglalót: mit zártunk le ezen a héten, mi van késésben, mi a jövő hét top 3 teendője, és kinek kell figyelmet kapni (túlterhelt / késő projekt).

---

## 5. Megvalósítási terv — fázisok

A teljes vízió 3 fázisban valósítható meg. Az első fázis az egyetlen, amelyik valódi fejlesztést igényel.

**1. FÁZIS — Heti Kontextus Workflow megépítése**
*   **Felelős:** Pohi | **Időigény:** 2-3 óra
*   Schedule Trigger: minden hétfő 07:00
*   Airtable — Folyamatok lekérdezés: Folyamatban + Számlázásra vár státuszok, Késés napokban szűrve
*   Airtable — Feladatok lekérdezés: Magas prioritás + Új státusz
*   Airtable — Munkatársak lekérdezés: Telegram Chat ID, leterheltség %
*   Airtable — Szabadságok lekérdezés: aktuális hét
*   Code node: Markdown formázás (projekt lista, késések, feladatok, munkatársak)
*   Google Drive: fájl feltöltés → 'Airtable Kontextus' mappába → `Heti_Kontextus_YYYYMMDD.md`
*   Opcionális: Telegram értesítés 'A heti kontextus elkészült'

**2. FÁZIS — Munkaidő integráció bekapcsolása**
*   **Felelős:** Pohi (brief alapján) | **Időigény:** 0 extra fejlesztés
*   Ez automatikusan megtörténik ha Pohi elvégzi a briefben kért feladatokat
*   Amikor az AI Agent v2 él, a munkaidő adatok bekerülnek az Airtable-be
*   A Heti Kontextus workflow-ba csak egy extra Airtable lekérdezés sor kell: Munkaidő Nyilvántartás
*   Ezután látom ki mennyit dolgozott előző héten → munkarend javaslat pontosabb lesz

**3. FÁZIS — Valós idejű lekérdezés (opcionális, hosszú táv)**
*   **Felelős:** Pohi + Anthropic MCP | **Időigény:** 4-6 óra
*   Airtable MCP szerver bekonfigurálása a Claude.ai-ban
*   Ezután nem kell várni hétfőig — bármikor kérdezhetsz, én azonnal lekérdezem az Airtable-t
*   Nem szükséges a Heti Kontextus Csomag — ez azt felváltja
*   Ez a Manus hibrid koncepció teljeskörű megvalósítása
*   *FIGYELEM: ez az egyetlen fázis ahol valódi technikai komplexitás van*

💡 **Javaslat:**
1.  Kezdjük a 2. fázissal (Pohi brief) — az ingyenes és már folyamatban van.
2.  Aztán építsük meg a Heti Kontextus workflow-t (1. fázis) — ez a legnagyobb értékteremtés, 2-3 óra munkával.
3.  A 3. fázist hagyjuk a jövőre — csak akkor kell, ha a heti snapshot kevés lesz.

---

## 6. Az adatminőség javítása — amit ti tehettek

A rendszer csak annyira okos, amennyire jók az adatok. Van néhány egyszerű dolog, amit ti tehetek, hogy én pontosabb válaszokat tudjak adni:

### 6.1. Amit most meg kell csinálni

| Teendő | Miért fontos |
|---|---|
| **Folyamatok: Felelős mező kitöltése** | Nélküle nem tudom ki melyik projekten dolgozik — munkarend lehetetlen |
| **Folyamatok: Határidő mező kitöltése** | Nélküle nem tudom mi sürgős valóban |
| **Feladatok: Felelős hozzárendelés** | Ki mit csinál — nélküle csak project szinten látok |
| **Munkatársak: Telegram Chat ID kitöltés** | Pohi Heti Emlékeztető moduljához kell |
| **Folyamatok: késés > 30 napnál ok megadása**| Megértem miért késik, nem csak azt hogy késik |

### 6.2. Amit az n8n rendszer fog automatikusan javítani
*   **Munkaidő adatok:** Pohi AI Agent v2 → Munkaidő Nyilvántartás tábla automatikusan töltődik
*   **Feladat státuszok:** a már működő Telegram bot automatikusan frissíti
*   **Telegram Napló:** minden bot-interakció naplózva → látom a kommunikáció mintázatait
*   **Gmail kategorizálás:** javítás után → levelek automatikusan projektekhez rendelve

---

## 7. Összefoglalás — a végcél

> A cél nem az, hogy több automatizáció legyen.
> **A cél az, hogy te minden hétfő reggel 5 percet tölts el velem, és pontosan tudod: mit kell csinálni ezen a héten, kinek, és miért.**
> A rendszer gyűjti az adatot. Az n8n automatizálja a rutint. Én elemzem és rangsorolom.

### Következő lépések — sorrendben

| # | Ki | Mit | Mikor |
|---|---|---|---|
| 1 | Pohi | Briefben kért 1-5. feladat elvégzése | Következő 1-2 hét |
| 2 | Te | Folyamatok tábla: Felelős + Határidő kitöltése | Párhuzamosan |
| 3 | Pohi | Heti Kontextus Workflow megépítése | Pohi brief után |
| 4 | Te + Én | Első Heti Kontextus teszt — kérdezz, én válaszolok| Első hétfő után |
| 5 | Döntés alapján | Airtable MCP valós idejű kapcsolat (opcionális)| Ha a heti snapshot kevés |

***
*Iszapfaló Kft. | Intelligens Asszisztens Rendszer — Vízió 2026 | Claude AI*