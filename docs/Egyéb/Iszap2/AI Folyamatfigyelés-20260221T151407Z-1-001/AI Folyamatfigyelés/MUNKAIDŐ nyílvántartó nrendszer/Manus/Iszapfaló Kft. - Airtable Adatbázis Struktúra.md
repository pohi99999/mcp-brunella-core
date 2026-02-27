# Iszapfaló Kft. - Airtable Adatbázis Struktúra

## Áttekintés

Az Airtable adatbázis az Iszapfaló munkaidő és költség nyilvántartó rendszer központi adattára. Négy fő táblából áll, amelyek szorosan integrálódnak az n8n munkafolyamatokkal.

---

## 1. TÁBLA: Munkaidő Nyilvántartás

**Célja:** A munkatársak napi munkaidejének, költségeinek és kiemelt tevékenységeinek rögzítése.

| Oszlopnév | Típus | Kötelező | Leírás | Megjegyzés |
| :--- | :--- | :--- | :--- | :--- |
| **ID** | Autonumber | Igen | Egyedi, automatikus azonosító | Rendszer által generált |
| **Munkatárs Neve** | Single line text | Igen | A munkavállaló neve | pl. "Kollár János" |
| **Telegram Felhasználónév** | Single line text | Igen | A munkavállaló Telegram azonosítója | pl. "@kollarjanos" |
| **Telegram Chat ID** | Single line text | Igen | A munkavállaló egyedi Telegram chat ID-ja | pl. "8468817202" |
| **Dátum** | Date | Igen | Az esemény dátuma | pl. "2025-01-15" |
| **Nap Típusa** | Single select | Igen | Munkanap / Szabadnap / Adott szabadság / Speciális munkarend | Előre definiált lehetőségek |
| **Munkaidő Kezdete** | Time | Nem | A munka kezdete | pl. "08:00" |
| **Munkaidő Vége** | Time | Nem | A munka vége | pl. "17:00" |
| **Ledolgozott Órák** | Number | Nem | Automatikusan számított óraszám | Formula: (Munkaidő Vége - Munkaidő Kezdete) |
| **Túlóra Órák** | Number | Nem | Az 8 órát meghaladó órák | Formula: MAX(0, Ledolgozott Órák - 8) |
| **Projekt** | Single line text | Nem | A munka helyszíne/projektje | pl. "Velencei-tó", "Balaton kotrás" |
| **Munkahelyszín** | Single line text | Nem | A munka fizikai helyszíne | pl. "Velencei-tó", "Ügyfél helyszíne", "Iroda" |
| **Kiemelt Tevékenység** | Single select | Nem | Gépkezelés / Munkavezetés / Veszélyes munka / Truxor / Traktor / Egyéb | Előre definiált, de bővíthető |
| **Költségek** | Currency | Nem | Az adott napra felmerült költségek | pl. "5000" (Ft) |
| **Költség Típusa** | Single line text | Nem | A költség fajtája | pl. "Üzemanyag", "Szerszám", "Alkatrész" |
| **Megjegyzés** | Long text | Nem | Szabad szöveges megjegyzés | pl. "Elromlott a szivattyú, javítani kell" |
| **Feladat Generálva** | Checkbox | Nem | Jelzi, hogy a megjegyzésből feladat lett-e generálva | Automatikus |
| **Hét Száma** | Formula | Nem | Az ISO heti szám | Formula: `WEEKNUM(Dátum)` |
| **Év** | Formula | Nem | Az év | Formula: `YEAR(Dátum)` |
| **Lezárva** | Checkbox | Nem | Jelzi, hogy a heti adatbevitel lezárult-e | Péntek éjfélkor automatikus |
| **Rögzítés Dátuma** | Created time | Igen | Az adat rögzítésének pontos időpontja | Rendszer által generált |
| **Módosítás Dátuma** | Last modified time | Nem | Az utolsó módosítás időpontja | Rendszer által generált |

---

## 2. TÁBLA: Szabadságok

**Célja:** A munkatársak szabadság-igénylésének és az adott szabadnapoknak a rögzítése.

| Oszlopnév | Típus | Kötelező | Leírás | Megjegyzés |
| :--- | :--- | :--- | :--- | :--- |
| **ID** | Autonumber | Igen | Egyedi azonosító | Rendszer által generált |
| **Munkatárs Neve** | Single line text | Igen | A munkavállaló neve | pl. "Kollár János" |
| **Telegram Chat ID** | Single line text | Nem | Telegram azonosító (ha munkavállaló igénylése) | Csak igénylés esetén |
| **Szabadság Típusa** | Single select | Igen | "Kivett" / "Adott" | Munkavállaló igénylése vagy vezetőség döntése |
| **Kezdő Dátum** | Date | Igen | Az első szabadnap | pl. "2025-10-12" |
| **Befejezés Dátuma** | Date | Igen | Az utolsó szabadnap | pl. "2025-10-18" |
| **Napok Száma** | Formula | Nem | Az automatikusan számított napok száma | Formula: `Befejezés Dátuma - Kezdő Dátum + 1` |
| **Megjegyzés** | Long text | Nem | Szabad szöveges megjegyzés | pl. "Nyaralás", "Betegség", "Céges döntés" |
| **Naptár Esemény Létrehozva** | Checkbox | Nem | Jelzi, hogy a Google Naptárban létrejött-e az esemény | Automatikus |
| **Naptár Esemény ID** | Single line text | Nem | A Google Naptár esemény egyedi azonosítója | Szinkronizációhoz szükséges |
| **Rögzítés Dátuma** | Created time | Igen | Az igénylés/rögzítés időpontja | Rendszer által generált |

---

## 3. TÁBLA: Feladatok

**Célja:** A munkatársak megjegyzéseiből automatikusan generált feladatok rögzítése.

| Oszlopnév | Típus | Kötelező | Leírás | Megjegyzés |
| :--- | :--- | :--- | :--- | :--- |
| **ID** | Autonumber | Igen | Egyedi azonosító | Rendszer által generált |
| **Munkatárs Neve** | Single line text | Igen | Ki írta be a megjegyzést | pl. "Kollár János" |
| **Feladat Leírása** | Long text | Igen | A feladat szövege | pl. "Elromlott a szivattyú, javítani kell" |
| **Eredeti Megjegyzés** | Long text | Nem | Az eredeti megjegyzés szövege | Referencia |
| **Feladat Típusa** | Single select | Nem | "Karbantartás" / "Javítás" / "Beszerzés" / "Egyéb" | AI által javasolt kategória |
| **Prioritás** | Single select | Nem | "Normál" | Alapértelmezett, később bővíthető |
| **Hozzárendelve** | Single line text | Nem | Akihez a feladat hozzárendelve van | Alapértelmezés: vezetőség |
| **Státusz** | Single select | Nem | "Nyitott" / "Folyamatban" / "Lezárva" | Alapértelmezés: "Nyitott" |
| **Munkaidő Nyilvántartás Link** | Link to another record | Nem | A feladatot generáló munkaidő-bejegyzésre mutató link | Referencia az 1. táblához |
| **Dátum** | Date | Igen | A feladat rögzítésének dátuma | pl. "2025-01-15" |
| **Rögzítés Dátuma** | Created time | Igen | Az adat rögzítésének pontos időpontja | Rendszer által generált |

---

## 4. TÁBLA: Munkarendbeli Speciális Napok

**Célja:** A négy napos munkarend és egyéb speciális munkarendbeli napok rögzítése.

| Oszlopnév | Típus | Kötelező | Leírás | Megjegyzés |
| :--- | :--- | :--- | :--- | :--- |
| **ID** | Autonumber | Igen | Egyedi azonosító | Rendszer által generált |
| **Munkatárs Neve** | Single line text | Igen | A munkavállaló neve | pl. "Kollár János" |
| **Speciális Munkarend Típusa** | Single select | Igen | "4 napos munkarend" / "Rövidített munkanap" / "Egyéb" | Előre definiált |
| **Kezdő Dátum** | Date | Igen | Az első nap, amikor a speciális munkarend érvényes | pl. "2025-07-01" |
| **Befejezés Dátuma** | Date | Igen | Az utolsó nap | pl. "2025-08-31" |
| **Szabadnap Napja** | Single select | Nem | "Hétfő" / "Kedd" / "Szerda" / "Csütörtök" / "Péntek" / "Változó" | Melyik nap a szabadnap |
| **Megjegyzés** | Long text | Nem | Szabad szöveges megjegyzés | pl. "Nyári 4 napos munkarend" |
| **Rögzítés Dátuma** | Created time | Igen | Az adat rögzítésének időpontja | Rendszer által generált |

---

## 5. TÁBLA: Munkatársak (Referencia)

**Célja:** A munkatársak alapadatainak és Telegram azonosítóinak központi tárolása.

| Oszlopnév | Típus | Kötelező | Leírás | Megjegyzés |
| :--- | :--- | :--- | :--- | :--- |
| **ID** | Autonumber | Igen | Egyedi azonosító | Rendszer által generált |
| **Munkatárs Neve** | Single line text | Igen | A munkavállaló teljes neve | pl. "Kollár János" |
| **Telegram Felhasználónév** | Single line text | Igen | A Telegram felhasználónév | pl. "@kollarjanos" |
| **Telegram Chat ID** | Single line text | Igen | A munkavállaló egyedi Telegram chat ID-ja | pl. "8468817202" |
| **Email** | Email | Nem | A munkavállaló email címe | pl. "janos@iszapfalo.hu" |
| **Telefon** | Phone number | Nem | A munkavállaló telefonszáma | pl. "+36701234567" |
| **Beosztás** | Single line text | Nem | A munkavállaló beosztása | pl. "Operátor", "Vezető" |
| **Aktív** | Checkbox | Nem | Jelzi, hogy a munkavállaló aktív-e | Alapértelmezés: bejelölt |
| **Rögzítés Dátuma** | Created time | Igen | Az adat rögzítésének időpontja | Rendszer által generált |

---

## Relációk és Nézetek

### Relációk
- **Munkaidő Nyilvántartás** ↔ **Munkatársak**: A munkatárs neve alapján kapcsolódnak.
- **Szabadságok** ↔ **Munkatársak**: A munkatárs neve alapján kapcsolódnak.
- **Feladatok** ↔ **Munkaidő Nyilvántartás**: Link to another record.
- **Munkarendbeli Speciális Napok** ↔ **Munkatársak**: A munkatárs neve alapján kapcsolódnak.

### Ajánlott Nézetek
1. **Munkaidő Nyilvántartás - Heti Összesítő**: Szűrve az aktuális hétre, munkatársakra lebontva.
2. **Feladatok - Nyitott**: Szűrve a "Nyitott" státuszra.
3. **Szabadságok - Aktív**: Szűrve az aktuális és jövőbeli dátumokra.
4. **Munkatársak - Aktív**: Szűrve az aktív munkatársakra.

---

## Biztonsági Másolat (Google Drive)

Az Airtable adatokból hetente egyszer (péntek éjfélkor) egy Google Sheets fájl készül, amely az alábbi adatokat tartalmazza:
- **Munkaidő Nyilvántartás** (szűrt az aktuális hétre)
- **Szabadságok** (szűrt az aktuális és jövőbeli dátumokra)
- **Feladatok** (szűrt az "Nyitott" és "Folyamatban" státuszra)

Ez a fájl a Google Drive-on egy dedikált mappában (`/Iszapfaló/Biztonsági Másolatok`) kerül mentésre.

---

## Integráció az n8n-nel

Az n8n munkafolyamatok az alábbi módokon kommunikálnak az Airtable-lel:

1. **Adatok Beírása**: A Telegram botról érkező adatok közvetlenül az Airtable táblákba kerülnek.
2. **Adatok Lekérdezése**: Az n8n munkafolyamatok lekérdezik az adatokat (pl. heti összesítéshez).
3. **Adatok Módosítása**: Az n8n automatikusan frissíti az adatokat (pl. "Lezárva" checkbox bejelölése).
4. **Webhook Triggerek**: Az Airtable webhook-okat küldhet az n8n-nek, ha bizonyos feltételek teljesülnek.

---

## Integráció a Google Naptárral

A **Szabadságok** tábla minden új bejegyzésénél az n8n automatikusan létrehoz egy eseményt a Google Naptárban:
- **Esemény Címe**: `[Munkatárs Neve] szabadságon`
- **Esemény Leírása**: A szabadság típusa és megjegyzése
- **Dátumok**: A kezdő és befejezés dátuma között minden nap
- **Naptár**: "Iszapfaló" Google Naptár

---

## Integráció a Google Drive-vel

A biztonsági másolat Google Sheets fájlok az alábbi helyen kerülnek mentésre:
- **Mappa**: `/Iszapfaló/Biztonsági Másolatok/`
- **Fájl Elnevezése**: `Munkaidő_Nyilvántartás_[Év]_[Hét száma].xlsx`
- **Frissítés Gyakorisága**: Hetente egyszer (péntek éjfélkor)

