# FEJLESZTÉSI BRIEF
## Iszapfaló Kft.
### Munkaidő Nyilvántartó és Telegram Bot Rendszer
#### n8n + Airtable Fejlesztési Terv

---

**Címzett:** Pohánka Úr (Pohi)  
**Cég:** Pohánka és Társa Kft.  
**Dátum:** 2026. január 5.

---

## Executive Summary

Az Iszapfaló Kft. meglévő munkaidő nyilvántartó rendszerének fejlesztése és a Telegram bot funkcióinak bővítése áll fókuszban. A rendszer jelenleg Telegram + n8n + Airtable architektúrára épül, és sikeresen működik a csapat körében.

### Fő célok:

- ✅ Telegram bot bővítése: feladat létrehozás természetes nyelvű parancsokkal
- ✅ Szabadság kezelés fejlesztése: támogatás Telegram ÉS Google Naptár bejegyzésekhez
- ✅ Munkaidő nyilvántartás finomítása: mobilbarát adatbevitel és automatizációk
- ✅ Meglévő Airtable + n8n infrastruktúra optimalizálása (NEM platform váltás AppSheet-re)

---

## Javasolt Platform: Airtable + n8n

### Döntés Indoklása

A részletes elemzés után egyértelmű, hogy a meglévő Airtable + n8n kombináció megtartása a leghatékonyabb megoldás. Ez a döntés három fő pillérre épül: meglévő infrastruktúra kihasználása, csapat ismerete és a Telegram integráció központi szerepe.

### Előnyök (Airtable + n8n)

✓ **Működő infrastruktúra:** A Telegram → n8n → Airtable pipeline már éles üzemben van  
✓ **Csapat elfogadás:** A munkások már most is használják a Telegram botot, nem kell újratanulás  
✓ **AI integráció:** OpenAI API természetes nyelvű feldolgozás könnyedén bővíthető  
✓ **Rugalmasság:** n8n-ben gyorsan implementálhatók új funkciók és automatizációk  
✓ **Költséghatékonyság:** Nincs platform váltási költség, a meglévő rendszer már kifizetett  
✓ **Skálázhatóság:** Google Calendar, Drive, Gmail integrációk már működnek és bővíthetők

### Miért NEM AppSheet?

Bár az AppSheet erős eszköz mobilalkalmazások gyors fejlesztésére, a konkrét esetünkben több hátránnyal járna:

- ❌ **Telegram integráció nehézkes:** Az AppSheet nem támogatja natívan a Telegram API-t, pedig ez a fő beviteli csatorna
- ❌ **Új rendszer tanulása:** A csapat újra kellene tanuljon egy új felületet, ami időigényes
- ❌ **AI feldolgozás korlátozottabb:** OpenAI API bekötése nehezebb, kevésbé rugalmas workflow automatizáció
- ❌ **Költség:** Enterprise funkciók (Automation, AI features) drágák
- ❌ **Platform lock-in:** Későbbi migráció nehezebb lenne

---

## Fejlesztési Prioritások

## FÁZIS 1: Telegram Funkciók Bővítése (MAGAS PRIORITÁS)

### Jelenlegi Helyzet

A Telegram bot jelenleg csak folyamat (munkaidő) létrehozását támogatja. A munkások nem tudnak feladatokat rögzíteni természetes nyelven.

### Célállapot

**A Telegram bot felismerje és feldolgozza az alábbi parancsokat:**

- _"új feladat: elromlott a szivattyú, javítani kell"_
- _"feladat: beszerzés - új alkatrészek szükségesek"_
- _"todo: találkozó az ügyféllel holnap 14:00"_

### Technikai Megvalósítás:

1. **n8n Workflow módosítása/létrehozása:** Meglévő Telegram webhook bővítése
2. **AI feldolgozás finomítása:** OpenAI API prompt frissítése a feladat típusok felismerésére
3. **Switch Node hozzáadása:** Branch 1: Munkaidő | Branch 2: Feladat | Branch 3: Szabadság
4. **Airtable integráció:** Új kapcsolódási pont a Feladatok táblához megfelelő mezőkkel
5. **Tesztelés:** Különböző feladat típusok próba üzenetekkel

---

## FÁZIS 2: Szabadság Kezelés Fejlesztése (MAGAS PRIORITÁS)

### Cél

**🔴 A rendszer támogassa a szabadság rögzítését AKÁR Telegramban, AKÁR közvetlenül a Google Naptárba történő beírással.**

### Két beviteli csatorna:

1. **Telegram bot:** "szabadság július 1-7-ig" → Airtable + Google Naptár szinkronizáció
2. **Google Naptár direkt bejegyzés:** Munkatárs közvetlenül a naptárba írja → n8n webhook detektálja → Airtable frissítés

### Technikai Megvalósítás:

- **Google Calendar API Webhook:** n8n-ben webhook beállítása Google Naptár eseményekre (push notifications)
- **Esemény Felismerés:** Ha az esemény címe/leírása tartalmazza a "szabadság" vagy "szabadnap" kulcsszót
- **Airtable Szinkronizáció:** Új rekord létrehozása a Szabadságok táblában
- **Munkaóra Nyilvántartás:** Automatikus "Szabadnap" bejegyzés létrehozása a megfelelő dátumokra
- **Értesítés:** Telegram visszajelzés a munkatársnak és a vezetőségnek

---

## FÁZIS 3: Munkaidő Nyilvántartás Finomítása (KÖZEPES PRIORITÁS)

### A) Mobil Élmény Javítása

**Airtable Interfaces létrehozása:**
- **Munkatársi nézet:** Egyszerű, mobilbarát adatbeviteli felület (csak saját adatok)
- **Vezetői dashboard:** Heti összesítők, grafikonok, munkatársakra lebontva

**Telegram bot továbbfejlesztése:**
- Inline billentyűzetek (gyors gombok)
- Munkaidő státusz lekérdezés: _"/statusz"_
- Heti összesítő lekérdezés: _"/het"_

### B) Automatizációk Bővítése

**Új n8n Workflow-k:**

1. **Heti emlékeztető (csütörtök délután):** "Kérlek ellenőrizd a munkaidődet a héten!"
2. **Hiányzó adatok figyelmeztetés:** Ha valaki nem töltött ki munkaidőt 2 napig
3. **Vezetőségi dashboard:** Napi összesítők Telegramra, Google Sheets export hetente

---

## FÁZIS 4: Monitoring és Értesítések (ALACSONY PRIORITÁS)

- **Error Workflow készítése:** Ha az AI nem tudja feldolgozni az üzenetet
- **Success Metrics:** Hány üzenet érkezett, hány feldolgozás sikeres, hány hiba történt

---

## Részletes Feladatlista és Ütemterv

| Fázis | Feladat | Becsült Idő | Prioritás |
|-------|---------|--------------|-----------|
| **FÁZIS 1** | n8n Workflow módosítása/létrehozása | 2-3 óra | **🔴 MAGAS** |
| | AI feldolgozás finomítása (OpenAI prompt) | 2-3 óra | **🔴 MAGAS** |
| | Switch Node és Airtable integráció | 2-3 óra | **🔴 MAGAS** |
| | Tesztelés és debuggolás | 2-3 óra | **🔴 MAGAS** |
| **FÁZIS 2** | Google Calendar API Webhook beállítása | 3-4 óra | **🔴 MAGAS** |
| | Esemény felismerés és feldolgozás logika | 2-3 óra | **🔴 MAGAS** |
| | Airtable szinkronizáció és értesítések | 2-3 óra | **🔴 MAGAS** |
| **FÁZIS 3** | Airtable Interfaces létrehozása | 3-4 óra | **🟠 KÖZEPES** |
| | Telegram bot továbbfejlesztése (inline gombok, lekérdezések) | 2-3 óra | **🟠 KÖZEPES** |
| | Automatizációk bővítése (emlékeztetők, értesítések) | 2-3 óra | **🟠 KÖZEPES** |
| **FÁZIS 4** | Error Workflow és Monitoring | 2-3 óra | ⚪ ALACSONY |
| **ÖSSZESEN** | **TELJES BECSÜLT IDŐIGÉNY** | **~24-32 óra** | **3-4 munkanap** |

---

## Következő Lépések

A projekt sikeres elindításához az alábbi lépéseket javasoljuk:

1. **Jelenlegi rendszer áttekintése:** Pohi nézze át a meglévő n8n workflow-kat, Airtable struktúrát és OpenAI API integrációkat
2. **Technikai terv készítése:** Részletes terv a Telegram funkció bővítésére és a Google Calendar webhook beállítására
3. **Proof-of-Concept demó:** Mutasson egy működő példát screenshot vagy rövid videó formájában
4. **Fejlesztési prioritások egyeztetése:** Beszéljük meg a pontos sorrendet és az esetleges módosításokat
5. **Kickoff meeting:** Közös megbeszélés a részletes ütemtervről és a kommunikációs csatornákról

---

## Elérhetőségek és Kommunikáció

### Ügyfél:
**Iszapfaló Kft.**  
Kovásznai-Szász Gergely (Ügyvezető igazgató)  
Email: gergely@iszapfalo.hu

### Fejlesztő Partner:
**Pohánka és Társa Kft.**  
Pohánka Úr (Rendszergazda)  
Email: pohi@pohanka.hu

---

## Mellékletek

A projekt során az alábbi dokumentumok kerültek megosztásra:

- **Airtable Adatbázis Struktúra:** Részletes táblák, oszlopok és kapcsolatok leírása
- **Munkaidő és Költség Nyilvántartó Rendszer Működési Összefoglaló:** Jelenlegi funkciók és használati forgatókönyvek
- **n8n Workflow Dokumentáció:** Meglévő workflow-k és integrációk
- **Rendszerértékelés és Javaslat:** Platform összehasonlítás és döntési kritériumok

---

Köszönjük az együttműködést és várjuk a projekttel kapcsolatos visszajelzéseket!

_Üdvözlettel,_  
**Iszapfaló Kft. Vezetősége**
