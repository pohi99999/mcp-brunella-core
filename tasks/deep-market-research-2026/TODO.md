# Feladatlista (TODO): Országos AI Bevétel-gyorsítási Kampány (2026)

Ez a dokumentum a `PLAN.md` alapján lebontott, végrehajtható feladatokat tartalmazza.

---

## 🟦 1. Fázis: Szektorspecifikus Demo Arzenál [COMPLETED]

- [x] **1.1 Gyártási Demo (Vision-alapú minőségellenőrzés)** `[python]` `[backend]`
  - [x] `myai/demo_factory/manufacturing.py` létrehozása
  - [x] OpenCV integráció a hiba-detektáláshoz (mock/placeholder logika a gyors demóhoz)
  - [x] Robotkéz Pro Vision API végpont összekötése a képfeldolgozással
- [x] **1.2 Pénzügyi Demo (Smart Invoice Processing)** `[backend]` `[database]`
  - [x] `myai/demo_factory/finance.py` létrehozása
  - [x] Számlaadattár (OCR eredmények) automatikus összefésülése több fájlból
  - [x] Anomália detektálás (pl. dupla számla, eltérő összegek) implementálása
- [x] **1.3 Logisztikai Widget (Route Optimizer)** `[frontend]`
  - [x] React-alapú térkép komponens létrehozása (`src/dashboard/components/widgets/LogisticsDemo.tsx`)
  - [x] Valós idejű útvonal-megtakarítás kalkulátor (üzemanyag vs. idő)

---

## 🟩 2. Fázis: Pályázati Érvrendszer Integrálása [COMPLETED]

- [x] **2.1 Pályázati Adatbázis Létrehozása** `[database]`
  - [x] `config/grants_2026.json` létrehozása (Demján Sándor Program, DIMOP Plusz adatokkal)
  - [x] Jogosultsági feltételek és határidők rögzítése
- [x] **2.2 Outreach Sablonok Frissítése** `[backend]`
  - [x] `src/services/outreachService.ts` sablonkezelőjének bővítése pályázati változókkal
  - [x] Meggyőző copywriting a "90%-os támogatás" üzenet köré

---

## 🟧 3. Fázis: Weboldal Transzformáció [COMPLETED]

- [x] **3.1 "Pályázati Tanácsadó" Chatbot** `[frontend]` `[backend]`
  - [x] Backend végpont a pályázati kérdések megválaszolásához (`src/server/routes/grants.ts`)
  - [x] Frontend widget injektálása a Netlify oldalra (vagy React komponens frissítés)
  - [x] Konverziós pont: Demo felajánlása a chatbot beszélgetés végén
- [x] **3.2 Showcase Aloldal** `[frontend]`
  - [x] `src/dashboard/pages/ShowcasePage.tsx` megvalósítva
  - [x] Videók és interaktív példák elhelyezése a gyártási, pénzügyi és logisztikai modulokról

---

## 🟨 4. Fázis: Országos Outreach és Monitorozás [COMPLETED]

- [x] **4.1 Regionalizált Lead Bányászat** `[backend]`
  - [x] `LeadMiningAgent` futtatása Budapest, Debrecen, Győr és Kecskemét lokációkra
  - [x] Iparági szűrés (Gyártó cégek, Logisztikai parkok, Könyvelő irodák)
- [x] **4.2 Automata Demo Pipeline indítása** `[backend]` `[python]`
  - [x] A bányászott leadekhez a `demo_factory` meghívása és egyedi URL-ek generálása
  - [x] Emailek automatizált sorrendezése (ütemezett kiküldés)
- [x] **4.3 Értékesítési Dashboard frissítése** `[frontend]`
  - [x] Megnyitási arányok (Open rate) követése
  - [x] Pályázati érdeklődők számának kijelzése

---

## ✅ 5. Fázis: Tesztelés és Átadás [COMPLETED]

- [x] **5.1 Kampány Teszt**
  - [x] Teszt kiküldés 10 belső címre, a teljes folyamat (Bot -> Grant info -> Demo link) ellenőrzése
- [x] **5.2 Biztonsági audit**
  - [x] Pályázati adatok integritásának ellenőrzése

---
*A feladatok sikeresen végrehajtva.*
