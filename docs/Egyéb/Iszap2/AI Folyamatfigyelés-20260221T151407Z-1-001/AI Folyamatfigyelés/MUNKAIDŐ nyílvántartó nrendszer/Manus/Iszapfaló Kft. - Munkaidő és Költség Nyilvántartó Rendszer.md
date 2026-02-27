# Iszapfaló Kft. - Munkaidő és Költség Nyilvántartó Rendszer
## Rendszer Működési Összefoglaló

---

## Mit Tud a Rendszer?

Az Iszapfaló AI-alapú munkaidő és költség nyilvántartó rendszere egy **komplett, automatizált megoldás**, amely a munkatársak számára egyszerű, a vezetőség számára pedig részletes és elemzésre alkalmas adatokat biztosít.

### Munkatársak Számára

#### 1. **Munkaidő Rögzítése** ✅
- **Munka kezdete és vége**: Egyszerű parancsokkal (`/start`, `/stop`) vagy természetes nyelven ("Elindítom a munkát", "Befejeztem")
- **Teljes munka intervallum**: Egy üzenetben az egész napot rögzítheti (pl. "9-17 Velencei-tó")
- **Rugalmas módosítás**: Az aktuális héten bármikor módosíthatja az adatokat, de múlt hétre nem
- **Automatikus számítás**: Az órákat és túlórákat a rendszer automatikusan kiszámolja
- **Projekt és helyszín rögzítése**: Minden munkaidőhöz hozzáadható a projekt neve és a munka helyszíne

#### 2. **Költségek Nyilvántartása** ✅
- **Rugalmas bevitel**: Természetes nyelven ("5000 Ft üzemanyag", "költség 3000 szerszám")
- **Költség típusa**: Üzemanyag, szerszám, alkatrész, vagy egyéb kategóriák
- **Megjegyzés hozzáadása**: A költséghez megjegyzés fűzhető (pl. "MOL kút")
- **Napi szintű rögzítés**: Minden költség az adott naphoz köthető

#### 3. **Kiemelt Tevékenységek Nyilvántartása** ✅
- **Gépkezelések**: Truxor, traktor, beton keverő, stb.
- **Munkavezetés**: Csapatvezető feladatok
- **Veszélyes munka**: Speciális munkahelyzetek
- **Egyéb kiemelt tevékenységek**: Vezetőség által később értékelendő
- **Automatikus rögzítés**: A vezetőség figyelmébe kerülnek az értékeléshez

#### 4. **Szabadság Igénylése** ✅
- **Egyszerű igénylés**: "Szabadság október 12-18-ig" vagy "/szabadsag 2025-10-12 2025-10-18"
- **Automatikus jóváhagyás**: Az igénylés azonnal rögzítésre kerül
- **Naptár szinkronizáció**: A Google Naptárban automatikusan megjelenik az esemény
- **Munkaóra-nyilvántartásban**: "Szabadnap" bejegyzés jön létre
- **Napok száma**: A rendszer automatikusan kiszámolja a szabadnapok számát

#### 5. **Megjegyzések és Feladatok Rögzítése** ✅
- **Szabad szöveges megjegyzés**: Bármilyen probléma vagy megjegyzés rögzítése ("Elromlott a szivattyú, javítani kell")
- **Automatikus feladat generálás**: A megjegyzés feladatként megjelenik az Airtable-ben
- **Vezetőség értesítése**: A vezetőség automatikusan értesítést kap
- **Személyes egyeztetés lehetősége**: Ha a rendszer nem érti a megjegyzést, feladatot hoz létre az egyeztetéshez

#### 6. **Munkarendbeli Speciális Napok** ✅
- **4 napos munkarend**: Nyári vagy egyéb időszakra beállítható
- **Rövidített munkanapok**: Ha szükséges
- **Szabadnap kijelölése**: Mely nap a szabad (pl. hétfő)
- **Automatikus figyelembe vétele**: Az óraszámítások módosulnak ennek megfelelően

#### 7. **Automatikus Értesítések** ✅
- **Napi túlóra értesítő** (18:00): Tájékoztatás a napi munkaidőről és túlóráról
- **Heti összesítő** (Péntek 14:00): Teljes heti munkaórák és kiemelt tevékenységek
- **Korrekciós lehetőség**: Pénteken éjfélig lehet módosítani az adatokat
- **Heti zárás** (Péntek 23:59): Értesítés, hogy az adatbevitel lezárult

#### 8. **Barátságos Kommunikáció** ✅
- **Közvetlen, személyes stílus**: A bot barátságosan kommunikál
- **Mindig visszajelzés**: Minden rögzítésről azonnali megerősítés
- **Érthető üzenetek**: Világos, magyar nyelvű kommunikáció
- **Emojik használata**: Vizuális segítség az üzenetek megértéséhez

---

### Vezetőség Számára

#### 1. **Valós Idejű Adatbázis** ✅
- **Airtable központi tár**: Összes adat egy helyen, szűrhető és kereshető
- **Munkatársakra lebontva**: Minden munkatárs adatai külön követhető
- **Automatikus szinkronizáció**: Az adatok azonnal frissülnek
- **Biztonsági másolat**: Hetente egyszer Google Drive-ra mentésre kerül

#### 2. **Heti Összesítések** ✅
- **Munkaórák összesítése**: Munkatársakra lebontva
- **Túlóra nyomon követése**: Ki, mikor, mennyit túlórázott
- **Kiemelt tevékenységek**: Gépkezelések, munkavezetés, stb. rögzítése
- **Költségek nyilvántartása**: Projekt és típus szerint
- **Szabadságok kezelése**: Ki, mikor, meddig szabadságon

#### 3. **Feladat Kezelés** ✅
- **Automatikus feladat generálás**: Munkatársak megjegyzéseiből
- **Nyitott feladatok listája**: Airtable-ben nyomon követhető
- **Prioritás és hozzárendelés**: Vezetőség által kezelhető
- **Státusz követése**: Nyitott → Folyamatban → Lezárva

#### 4. **Broadcast Üzenetek** ✅
- **Vezetőségi közlemények**: Az n8n Webhook-on keresztül
- **Mindenkihez egyszerre**: Az összes munkatárs értesítést kap
- **Például**: "Holnap senkinek nem kell bejönnie", "Nyári 4 napos munkarend kezdődik"
- **Könnyen integrálható**: Az n8n felületről küldés

#### 5. **Google Naptár Integráció** ✅
- **Szabadságok automatikus beírása**: A Google Naptárban megjelenik
- **Csapatnaptár megosztása**: Mindenki látja a szabadságokat
- **Munkarendbeli speciális napok**: Szintén megjeleníthetők
- **Valós idejű szinkronizáció**: Az adatok azonnal frissülnek

#### 6. **Biztonsági Másolat** ✅
- **Hetente egyszer**: Szombat 00:00-kor
- **Google Drive-ra mentés**: `/Iszapfaló/Biztonsági Másolatok/` mappába
- **Excel formátum**: Könnyen kezelhető és archivizálható
- **Teljes adatok**: Munkaidő, szabadságok, feladatok, összesítések

#### 7. **Jövőbeli Vertex AI Elemzések** ✅ (Előkészítve)
- **Munkaidő-mintázatok**: Kik a legproduktívabbak, mikor
- **Túlterheltség előrejelzése**: Mely munkatársak veszélyeztetett
- **Projekt költség-becslés**: Historikus adatok alapján
- **Anomáliák detektálása**: Szokatlan munkaórák vagy költségek

---

## Technikai Jellemzők

### Adatbázis Struktúra

| Tábla | Célja | Rekordok |
| :--- | :--- | :--- |
| **Munkaidő Nyilvántartás** | Napi munkaórák, költségek, kiemelt tevékenységek | Napi szintű |
| **Szabadságok** | Szabadság-igénylések és adott szabadnapok | Havi szintű |
| **Feladatok** | Munkatársak megjegyzéseiből generált feladatok | Szükség szerinti |
| **Munkarendbeli Speciális Napok** | 4 napos munkarend, rövidített napok | Szezonális |
| **Munkatársak** | Referencia tábla, alapadatok | Statikus |

### Automatizációs Munkafolyamatok

| Munkafolyamat | Trigger | Gyakoriság | Funkció |
| :--- | :--- | :--- | :--- |
| **Telegram Bejövő Üzenetek** | Üzenet érkezik | Valós idő | Adatok feldolgozása és rögzítése |
| **Napi Túlóra Értesítő** | Cron | Napi 18:00 | Túlóra értesítés |
| **Heti Összesítő** | Cron | Péntek 14:00 | Heti összesítés és korrekció |
| **Heti Zárás** | Cron | Péntek 23:59 | Adatbevitel lezárása |
| **Broadcast Üzenetek** | Webhook | Vezetőség által | Közlemények küldése |
| **Google Naptár Szinkronizáció** | Airtable webhook | Valós idő | Szabadságok beírása |
| **Google Drive Biztonsági Másolat** | Cron | Szombat 00:00 | Hetente egyszer mentés |

### Integrációk

- **Telegram Bot**: Felhasználói felület
- **n8n**: Munkafolyamatok automatizálása
- **Airtable**: Központi adatbázis
- **OpenAI API**: Természetes nyelvű feldolgozás
- **Google Calendar**: Naptár szinkronizáció
- **Google Drive**: Biztonsági másolat

---

## Felhasználási Forgatókönyvek

### Forgatókönyv 1: Napi Munka Rögzítése

**Munkatárs**: Jani

1. **Reggel 8:00**: Jani a Telegramra írja: "Elindítom a munkát a Velencei-tó projekten"
2. **Rendszer**: Rögzíti az adatot, visszajelzést küld
3. **Délután 17:00**: Jani: "Befejeztem"
4. **Rendszer**: Rögzíti a végidőt, kiszámolja az órakat
5. **Este 18:00**: A rendszer értesítést küld: "9 óra ledolgozva, 1 óra túlóra"
6. **Péntek 14:00**: Heti összesítő: "38 óra ledolgozva"
7. **Péntek 23:59**: Adatbevitel lezárult

---

### Forgatókönyv 2: Költség Rögzítése

**Munkatárs**: Péter

1. **Munka közben**: Péter tankoltat az autót, 5000 Ft-ot költ
2. **Telegram**: "5000 Ft üzemanyag, MOL kút"
3. **Rendszer**: Rögzíti a költséget, visszajelzést küld
4. **Airtable**: Az adat megjelenik a munkaidő-nyilvántartásban
5. **Vezetőség**: Látja a költséget a heti összesítőben

---

### Forgatókönyv 3: Kiemelt Tevékenység

**Munkatárs**: Jani

1. **Munka közben**: Jani Truxor kezelést végez
2. **Telegram**: "Truxor kezelés"
3. **Rendszer**: Rögzíti a kiemelt tevékenységet
4. **Airtable**: A munkaóra-bejegyzéshez hozzáadódik
5. **Heti összesítő**: "Truxor kezelés: 2 nap"
6. **Vezetőség**: Értékeli a díjazást

---

### Forgatókönyv 4: Szabadság Igénylése

**Munkatárs**: Péter

1. **Telegram**: "Szabadság július 1-7-ig"
2. **Rendszer**: 
   - Rögzíti az Airtable-ben
   - Létrehoz eseményt a Google Naptárban
   - Munkaóra-nyilvántartásban "Szabadnap" bejegyzést hoz létre
3. **Vezetőség**: Látja a naptárban és az Airtable-ben
4. **Csapat**: A megosztott naptárban mindenki látja

---

### Forgatókönyv 5: Probléma Rögzítése

**Munkatárs**: Jani

1. **Telegram**: "Elromlott a szivattyú, javítani kell"
2. **Rendszer**:
   - Rögzíti a megjegyzést
   - Feladatot hoz létre az Airtable-ben
   - Értesítést küld a vezetőségnek
3. **Vezetőség**: 
   - Látja a feladatot az Airtable-ben
   - Hozzárendelheti magának vagy másnak
   - Státusza: "Nyitott"
4. **Javítás után**: Státusz → "Lezárva"

---

### Forgatókönyv 6: Vezetőségi Broadcast

**Vezetőség**: Közlemény küldése

1. **n8n Webhook**: POST kérés az `iszapfalo-broadcast` útvonalra
2. **Payload**: `{"uzenet": "Holnap senkinek nem kell bejönnie. Céges kirándulás!"}`
3. **Rendszer**: Az üzenet mindenkihez eljut a Telegramra
4. **Munkatársak**: Értesítést kapnak

---

## Adatbeviteli Parancsok Gyors Referencia

| Parancs / Üzenet | Leírás | Példa |
| :--- | :--- | :--- |
| `/start` | Munka kezdete | `/start Velencei-tó` |
| `/stop` | Munka vége | `/stop` |
| Intervallum | Teljes munka intervallum | `9-17 Velencei-tó` vagy `8:00-16:00` |
| `/szunet` | Szünet | `/szunet` |
| Költség | Költség rögzítése | `5000 Ft üzemanyag` vagy `költség 3000 szerszám` |
| Kiemelt | Kiemelt tevékenység | `Truxor kezelés` vagy `Munkavezetés` |
| Szabadság | Szabadság igénylése | `Szabadság július 1-7` vagy `/szabadsag 2025-07-01 2025-07-07` |
| Megjegyzés | Megjegyzés/Feladat | `Elromlott a szivattyú, javítani kell` |
| Munkarend | Speciális munkarend | `4 napos munkarend július-augusztus, hétfő szabad` |

---

## Biztonsági Jellemzők

- **Adattitkosítás**: Telegram üzenetek titkosítottak
- **API Biztonság**: Az API kulcsok biztonságosan tárolódnak az n8n-ben
- **Hozzáférés Kontroll**: Airtable-ben beállítható, hogy ki milyen adatokat láthat
- **Auditálás**: Minden módosítás rögzítésre kerül az Airtable-ben
- **GDPR Kompatibilitás**: Az Airtable GDPR-kompatibilis

---

## Rendszer Előnyei

✅ **Egyszerűség**: Munkatársak számára barátságos, intuitív felület

✅ **Automatizáció**: Minimális kézi munka a vezetőség számára

✅ **Valós Idejű Adatok**: Azonnal frissülő adatbázis

✅ **Rugalmasság**: Könnyedén módosítható és bővíthető

✅ **Integráció**: Meglévő eszközökhöz (Google, Airtable) csatlakozik

✅ **AI Feldolgozás**: Természetes nyelvű parancsok feldolgozása

✅ **Biztonsági Másolat**: Hetente egyszer mentés

✅ **Jövőbiztos**: Vertex AI elemzésekhez előkészítve

---

## Következő Lépések

### Rövid Távon (1-2 hét)
1. Airtable adatbázis létrehozása
2. n8n munkafolyamatok importálása és konfigurálása
3. Telegram bot beállítása
4. Tesztelés 1-2 munkatárssal

### Közép Távon (2-4 hét)
1. Teljes csapatra kiterjesztés
2. Felhasználói visszajelzések gyűjtése
3. Finomítások és javítások

### Hosszú Távon (1-3 hónap)
1. Mobilalkalmazás fejlesztése
2. Vertex AI elemzések integrálása
3. Vezetőségi dashboard létrehozása

---

**Verzió:** 1.0  
**Utolsó frissítés:** 2025. január 15.  
**Szerző:** Manus AI

