# Megvalósítási Terv: Országos AI Bevétel-gyorsítási Kampány (2026)
**Verzió:** 1.0
**Cél:** A 2026-os piackutatás eredményeinek konvertálása konkrét üzleti szerződésekké a "Trójai Faló" stratégia és állami támogatási érvek kombinálásával.

---

## 1. Fázis: Szektorspecifikus Demo Arzenál Kiépítése (Technikai)
**Cél:** Olyan demók létrehozása, amelyek vizuálisan és funkcionálisan azonnal meggyőzik a célcsoportot.

- **1.1 Gyártási Demo (Robotkéz Pro + Vision):**
  - Feladat: Egy olyan demo script készítése, amely egy feltöltött képen (pl. alkatrész) vizuálisan bekeretezi a hibákat és javaslatot tesz a selejt-mentésre.
  - Technológia: Robotkéz Pro Vision API + OpenCV.
- **1.2 Pénzügyi/Könyvelői Demo (Data Flywheel):**
  - Feladat: Egy "Smart Inbox" demo, amely automatikusan kinyeri az adatokat 3 különböző formátumú számláról és egy közös Excel/Sheets táblázatba rendezi őket.
  - Technológia: `FinanceGuardianAgent` + Document Intelligence.
- **1.3 Logisztikai Widget:**
  - Feladat: Interaktív útvonal-optimalizáló térkép, amely valós idejű forgalmi adatok alapján mutatja meg a várható üzemanyag-megtakarítást.

## 2. Fázis: "Pályázati Érvrendszer" Integrálása (Sales & Copywriting)
**Cél:** Az árérzékenység leküzdése a 90%-os állami támogatási lehetőségek bemutatásával.

- **2.1 Outreach Sablonok Frissítése:**
  - Feladat: Az `outreachService` sablonjaiba beépíteni a **Demján Sándor Program** és **DIMOP Plusz** hivatkozásokat.
  - Üzenet: "A Brunella BAS bevezetése most 90%-os vissza nem térítendő támogatással valósítható meg."
- **2.2 Pályázati Adatbázis:**
  - Feladat: Egy egyszerű JSON adatbázis létrehozása a legfrissebb pályázati határidőkről és feltételekről, amit az ügynökök fel tudnak használni a levelezésben.

## 3. Fázis: Weboldal Transzformáció (pohankaestarsa.netlify.app)
**Cél:** A látogatókból azonnal leadeket képezni.

- **3.1 "Pályázati Tanácsadó" Chatbot:**
  - Feladat: Egy új ágens alapú chatbot fejlesztése a főoldalra, amely 3 kérdés alapján megmondja a látogatónak, melyik állami támogatásra jogosult, és közben felajánlja a neki megfelelő "Trójai Faló" demót.
- **3.2 Esettanulmányok (Showcase):**
  - Feladat: Dedikált aloldal a gyártás, pénzügy és logisztika szektorok számára, ahol a fenti demók videói láthatóak.

## 4. Fázis: Országos Outreach Hullám Indítása
**Cél:** Napi 100+ minőségi megkeresés.

- **4.1 Lead Bányászat Szektoronként:**
  - Feladat: A `LeadMiningAgent` futtatása a megyeszékhelyekre (Budapest, Debrecen, Győr, Kecskemét) szűkítve, a három kiemelt szektorban.
- **4.2 Automata Demo Generálás:**
  - Feladat: A `demo_factory` segítségével minden validált lead-hez legyártani az egyedi linket.
- **4.3 Monitorozás:**
  - Feladat: A Dashboardon követni a megnyitásokat és a visszapattanókat, szükség esetén domain-váltás.

---

## Ellenőrzési Pontok (Definition of Done)
- [ ] Mindhárom szektorhoz (Gyártás, Pénzügy, Logisztika) van működő demo sablon.
- [ ] A weboldalon él a Pályázati Tanácsadó chatbot.
- [ ] Az outreach emailek tartalmazzák a pályázati finanszírozási lehetőséget.
- [ ] Elindult az első 500 fős országos kampány.

---
**Következő lépés:** `/blueprint:define` a konkrét taskok listájához.