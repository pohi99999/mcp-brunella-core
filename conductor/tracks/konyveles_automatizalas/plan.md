# Track: Könyvelés automatizálása

Rövid leírás
---------------
Ez a track célja a számlák és bankmozgások automatizált feldolgozásának megvalósítása agent-alapú pipeline-on keresztül. Források: email PDF-ek, NAV Online Számla XML-ek, banki kivonatok. A `.worktrees/konyveles_automatizalas.md` fájlban vázolt folyamat alapján modulárisan építjük fel az adatgyűjtést, validálást, kategorizálást, párosítást és riportolást.

Fő célok
--------
- Automatikus számla-feldolgozás (PDF/XML) és mezők kinyerése (nettó, ÁFA, bruttó, teljesítés dátuma).
- Banki egyeztetés automatizálása (matching engine) napi bankkivonatokkal.
- Kivételes tételek jelentése és napi összefoglaló email generálása.

Mérföldkövek és feladatok (kezdeti bontás)
------------------------------------------
1) Discovery & Data mapping — 2 nap
   - Feladat: Mezőtérképek készítése (NAV XML, PDF mezők, bank CSV/JSON) — "done when": `mappings/*.csv` és minta adathalmaz.
   - Felelős: ProjectConductor / Finance domain

2) Email-Agent prototípus — 3 nap
   - Feladat: IMAP/Drive watcher, PDF letöltés és egyedi azonosító hozzárendelés (`Partner_Dátum_Összeg.pdf`).
   - Kimenet: `data/invoices/` mappa, sample PDF-ek és log entry.

3) NAV API integráció — 3 nap
   - Feladat: NAV Online Számla XML lekérése és normalizálása.
   - Kimenet: `data/nav/` normalizált JSON.

4) OCR / Adatkinyerés (LLM/OCR) — 4 nap
   - Feladat: OCR pipeline (Gemini Vision / tesseract) + LLM szabályok a mezők kinyeréséhez, hibakezelés.
   - Kimenet: `data/extracted/` (JSON rekordok: partner, nettó, áfa, bruttó, teljesítés)

5) Matching Engine (PDF/XML/Bank) — 4 nap
   - Feladat: Párosítási logika implementálása (egyetlen utalás több számla, részösszeges kifizetés, tolerancia értékek).
   - Kimenet: `data/matches/` és `exceptions/` lista.

6) Bank Reconciliation — 3 nap
   - Feladat: Bank API / CSV parser integráció, automatikus egyeztetés, kiegyenlítés címkézése.
   - Kimenet: `data/reconciled/` és riportok.

7) Riportálás és értesítések — 1 nap
   - Feladat: Napi összefoglaló email sablon és exception dashboard (Sheets vagy Dashboard panel).

8) Tesztelés, QA, deploy — 2 nap
   - Feladat: Integrációs tesztek, end-to-end folyamatellenőrzés, dokumentáció.

Összes becslés: ~22 munkanap (csapat és párhuzamosan futó munkák mellett rövidebb lehet).

Első lépések (ma)
------------------
- A track fájlok létrehozása (`plan.md`, `spec.md`, `meta.json`) — kész.
- Elindítjuk a Discovery feladatot: mező-térképek és minta adathalmaz előállítása.

Kockázatok & feltételezések
---------------------------
- NAV API és banki hozzáférések megléte szükséges (credentials). Ha nincs, fallback: manual CSV import.
- OCR pontosság és LLM kimeneti megbízhatóság függvényében szükséges lesz manuális verifikációs lépés.

Kommunikáció
-------------
- Rendszeres napi standup (egynapos sprint-ciklus első napján) és heti demo.
