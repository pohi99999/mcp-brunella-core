\# Track: Micro-Local CSR Automator (Neighborhood Watchman)



\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* LOW (High Impact)

\*\*Status:\*\* PROPOSED



\## 🎯 Célkitűzés

Egy hibrid (n8n + Python) rendszer létrehozása, amely geo-fenced (helyhez kötött) módon figyeli a helyi híreket és közösségi csoportokat segítségkérésekért, majd összeveti azokat a cég belső "felesleg" leltárával.



\## 🛠️ Érintett Fájlok

\- `data/grant\_blueprints/csr\_neighbor\_watch.json` (Architectural Blueprint)

\- `myai/browser\_task\_runner.py` (Local news scraping)

\- `n8n/workflows/csr\_automator.json` (Implementáció)



\## 📅 Megvalósítási Terv (Phases)



\### Phase 1: Geo-Fenced Harvesting (A Figyelő)

Helyi igények detektálása.



1\.  \*\*Python Task:\*\*

&nbsp;   - `browser\_task\_runner.py` bővítése: Facebook csoportok és helyi hírek szkennelése.

&nbsp;   - Kulcsszavak: "adomány", "segítség", "hiány", "önkéntes".

&nbsp;   - Radius: 5km (szimulálva keresési kifejezésekkel).



\### Phase 2: Inventory Matchmaking (Az Összekötő)

A kereslet és kínálat párosítása.



1\.  \*\*Inventory Mock:\*\*

&nbsp;   - Google Sheet vagy egyszerű JSON adatbázis a "Céges Felesleg"-ről (pl. lejárat közeli élelmiszer, régi laptop).

2\.  \*\*Matchmaker AI:\*\*

&nbsp;   - Modell: Gemini 1.5 Flash.

&nbsp;   - Logika: Szemantikus párosítás + Biztonsági szűrő (pl. ne küldjünk nyers húst iskolába).



\### Phase 3: Logistics \& PR (A Végrehajtó)

A szállítás és kommunikáció szervezése.



1\.  \*\*Logistics Planner:\*\*

&nbsp;   - Szállítási megbízás generálása (Pickup -> Dropoff).

2\.  \*\*Communication:\*\*

&nbsp;   - Automatikus email generálás a kedvezményezettnek.

&nbsp;   - LinkedIn poszt piszkozat írása a közösségi támogatásról.



\## ✅ Definition of Done

\- \[ ] A rendszer képes releváns "igényeket" találni egy szimulált hírfolyamból.

\- \[ ] A Matchmaker AI helyesen párosít (és helyesen utasít el).

\- \[ ] A folyamat végén létrejön egy email piszkozat és egy szállítási terv.

