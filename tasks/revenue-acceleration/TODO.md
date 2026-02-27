# Részletes Feladatlista (TODO): Bevétel Gyorsítás és Trójai Faló Stratégia

Ez a dokumentum a `PLAN.md` alapján lebontott, mérnöki pontosságú feladatokat tartalmazza.

---

## 🟦 1. Fázis: Dashboard V3 "Értékesítési Központ" (UI/UX) [COMPLETED]

- [x] **1.1 Navigáció Átszervezése** `[frontend]`
  - [x] `src/dashboard/lib/navigation.tsx` módosítása: "Bevétel" -> "Értékesítési Központ"
  - [x] Új almenüpontok regisztrálása: `trojan-horse`, `lead-monitor`, `demo-factory`
- [x] **1.2 `TrojanHorseCommandCenter.tsx` megvalósítása** `[frontend]`
  - [x] Alap layout kialakítása Radix UI és Tailwind használatával
  - [x] Iparág választó dropdown (Klinika, Ingatlan, Könyvelő, Egyéb)
  - [x] Célcég URL/Domain beviteli mező és "Kampány Indítása" gomb
- [x] **1.3 Kampány Státusz Widget** `[frontend]` `[parallel]`
  - [x] Real-time folyamatjelző (Scraping -> Validating -> Demo Generating -> Ready)
- [x] **1.4 Bevétel Statisztikai Panelek** `[frontend]`
  - [x] Aktív kampányok száma
  - [x] Sikerességi arány (Konverzió)

---

## 🟩 2. Fázis: Lead Pipeline és Adatmodell (Backend & DB) [COMPLETED]

- [x] **2.1 Adatbázis Séma Bővítése** `[database]`
  - [x] `src/utils/db.ts` frissítése: `leads` tábla kiegészítése (`email_status`, `demo_url`, `outreach_status`, `icebreaker_text`)
  - [x] Migrációs script vagy automatikus asztaltömbösítés implementálása
- [x] **2.2 Lead Validációs Bridge** `[backend]`
  - [x] `src/services/emailValidator.ts` létrehozása
  - [x] Hunter.io vagy ZeroBounce API integráció (fallback: DNS/Regex alapú ellenőrző)
- [x] **2.3 `LeadMiningAgent` Logika Frissítése** `[backend]`
  - [x] A bányászati folyamat végére a validációs lépés beiktatása
  - [x] Eredmények perzisztens mentése az új táblamezőkbe
- [x] **2.4 Inbox Rotációs Rendszer** `[backend]`
  - [x] `config/outreach_accounts.json` struktúra kialakítása
  - [x] Logika az aktív küldő fiókok kiválasztására (napi limit figyelésével)

---

## 🟧 3. Fázis: Automatizált Demo Gyár (Python & Integration) [COMPLETED]

- [x] **3.1 Python FastAPI Végpontok** `[backend]` `[python]`
  - [x] `myai/demo_factory/main.py`: `/generate-demo` végpont implementálása
  - [x] Dinamikus sablonkezelő (Jinja2 vagy egyszerű f-string alapú HTML/JSON generálás)
- [x] **3.2 Node.js - Python Híd** `[backend]`
  - [x] `src/server/routes/sales.ts` létrehozása
  - [x] Proxy végpont a Dashboard és a Python szerver között
- [x] **3.3 Cloudflare Tunnel Integráció** `[backend]`
  - [x] Dinamikus publikus URL generálás a lementett demókhoz

---

## 🟨 4. Fázis: Outreach és Marketing Optimalizálás [COMPLETED]

- [x] **4.1 AI Icebreaker Generátor** `[backend]` `[parallel]`
  - [x] Új ügynök funkció: `generateIcebreaker(domain: string)`
  - [x] RobotkezV2 meghívása a cég "Rólunk" oldalának gyors elemzésére
- [x] **4.2 Portfólió Oldal Frissítése** `[frontend]` (Recommendation: Update CTA on Netlify)
- [x] **4.3 Intelligens E-mail Küldő (Nodemailer)** `[backend]`
  - [x] `src/services/outreachService.ts` megírása
  - [x] Sablon alapú email generálás az Icebreaker beillesztésével

---

## ✅ 5. Fázis: Tesztelés és Átadás [COMPLETED]

- [x] **5.1 E2E Integrációs Teszt** `[test]`
  - [x] Teljes folyamat: UI indítás -> Lead gen -> Validáció -> Demo -> Email draft
- [x] **5.2 Biztonsági Felülvizsgálat** `[test]`
  - [x] API kulcsok védelme és backend sebességkorlátozás (Rate limiting)
  - [x] `.gitignore` frissítve a titkok védelmében.

---
*A feladatok jóváhagyás után azonnal megkezdhetők.*