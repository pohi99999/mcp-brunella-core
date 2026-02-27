# Megvalósítási Terv: Gyors Bevétel Generálás és Trójai Faló Stratégia
**Verzió:** 1.0
**Cél:** A Brunella Agent System (BAS) képességeinek közvetlen monetizálása a "Trójai faló" értékesítési stratégia és a Dashboard V3 finomítása révén.

---

## 1. Fázis: Dashboard V3 "Bevétel" Fókusz és Navigáció (UI/UX)
**Cél:** A Dashboard átszervezése, hogy a felhasználó azonnal a pénztermelő folyamatokra lásson rá.

- **1.1 Navigáció Refaktor:**
  - Módosítandó: `src/dashboard/lib/navigation.tsx`
  - Feladat: A "Bevétel" csoport átnevezése "Értékesítési Központ"-ra (Sales Hub). Új elemek hozzáadása: "Trójai Faló Kampányok", "Lead Monitor", "Demo Gyár".
- **1.2 Új Komponens: `TrojanHorseCommandCenter.tsx`:**
  - Hely: `src/dashboard/components/dashboard/TrojanHorseCommandCenter.tsx`
  - Funkció: Egy egyesített felület, ahol kiválasztható a céliparág, elindítható a lead-bányászat, generálható az egyedi demo és nyomon követhető a kiküldés.

## 2. Fázis: Lead Pipeline Tökéletesítés (Backend & Agent)
**Cél:** Minőségi, validált lead-ek gyűjtése és a visszapattanó emailek minimalizálása.

- **2.1 Lead Validációs Modul:**
  - Módosítandó: `src/agents/LeadMiningAgent.ts`
  - Feladat: Beépíteni egy e-mail validációs lépést (pl. ZeroBounce vagy Hunter.io API integráció előkészítése).
- **2.2 SQLite Séma Bővítés:**
  - Módosítandó: `src/utils/db.ts` (vagy megfelelő séma fájl)
  - Feladat: `leads` tábla kiegészítése `email_status` (valid/invalid/catch-all), `demo_url` és `outreach_count` mezőkkel.
- **2.3 Inbox Rotációs Logika:**
  - Feladat: Egy konfigurációs fájl létrehozása (`config/outreach_accounts.json`), ahol több küldő fiók adható meg, és az orkesztrátor ezek között rotálja a küldést.

## 3. Fázis: "Trójai Faló" Demo Gyár Automatizálása (Python & Integration)
**Cél:** Gyorsan, automatizáltan létrehozni egyedi, a célcégre szabott demókat.

- **3.1 Demo Sablonok Standardizálása:**
  - Módosítandó: `myai/demo_factory/main.py`
  - Feladat: Olyan API végpontok létrehozása, amelyek paraméterként fogadják a cég nevét/domainjét, és ez alapján generálnak egy mini-weboldalt vagy API választ.
- **3.2 "One-Click Demo" Végpont:**
  - Módosítandó: `src/server/web.ts`
  - Feladat: Egy POST végpont, ami meghívja a Python demo factory-t és visszaadja a publikus (Cloudflare Tunnel-en keresztüli) URL-t.

## 4. Fázis: Outreach és Weboldal Optimalizálás
**Cél:** A piaci ismeretség növelése és a konverzió javítása.

- **4.1 AI Icebreaker Generátor:**
  - Feladat: Egy új ügynök-képesség vagy külön script, ami a célcég weboldalának (RobotkezV2 általi) elemzése után egyedi nyitómondatot generál az emailhez.
- **4.2 Weboldal (pohankaestarsa.netlify.app) Tartalmi Frissítés:**
  - Feladat: Elkészíteni egy "Demo Kipróbálása" szekciót a weboldalra, ami a Brunella API-ján keresztül élőben mutatja be a képességeket.

---

## Ellenőrzési Pontok (Definition of Done)
- [ ] A Dashboard "Értékesítési Központ" menüje él és funkcionális.
- [ ] A lead-gyűjtés végén lefut az e-mail validáció.
- [ ] Egy kattintással generálható egyedi demo URL a Dashboardról.
- [ ] A küldött emailek státusza (Sent/Opened/Bounced) látható az admin felületen.
- [ ] A weboldal új fókuszpontjai dokumentálva és implementálva vannak.

---
**Következő lépés:** `/blueprint:define` a feladatok granuláris lebontásához.