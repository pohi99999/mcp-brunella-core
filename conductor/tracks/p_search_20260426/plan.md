# P-SEARCH (Pályázat- és hitelkereső) Implementációs Terv

## 1. Fázis: Bootstrap és A2UI Alapok [checkpoint: e4cd4ad]
- [x] Task: Könyvtárszerkezet kialakítása a `Z:\001_Workspace\p-search\` mappában 653262c
- [x] Task: React + Vite + Tailwind frontend inicializálása A2UI rendererrel 4cdfe87
- [x] Task: FastAPI backend vázlat és session kezelő implementálása fcb7762
- [x] Task: P-Search A2UI katalógus definíció létrehozása 4461884
- [x] Task: Conductor - User Manual Verification '1. Fázis: Bootstrap' (Protocol in workflow.md) e4cd4ad

## 2. Fázis: P-Search Agent és Tool-ok (MVP) [checkpoint: 741f280]
- [x] Task: p_search_agent és alap manifest létrehozása 4461884
- [x] Task: search_grants és search_loans tool-ok implementálása mock adatokkal 34a4d18
- [x] Task: match_score és check_deadlines logika kidolgozása 8b1fe94
- [x] Task: Első keresési flow tesztelése (PSearchPage.tsx) 49bf6e2
- [x] Task: Conductor - User Manual Verification '2. Fázis: Agent és Tool-ok' (Protocol in workflow.md) 741f280

## 3. Fázis: Scraper Adapterek és Valós Adatok [checkpoint: db0cfeb]
- [x] Task: palyazat_gov_scraper.py implementálása (BeautifulSoup) 8b1fe94
- [x] Task: MFB és OTP adapterek kialakítása 63b1bdb
- [x] Task: AdapterRegistry és cache réteg (InMemory) bekötése 63b1bdb
- [x] Task: Conductor - User Manual Verification '3. Fázis: Scraperek' (Protocol in workflow.md) db0cfeb

## 4. Fázis: Dokumentumkezelés és Kanban [checkpoint: 230e74d]
- [x] Task: document_package_builder widget és logika implementálása b1dd9a2
- [x] Task: Kanban feladatkövető nézet kialakítása pályázatokhoz b006b07
- [x] Task: Cloudflare KV cache integráció (Production setup) d8e4c40
- [x] Task: Conductor - User Manual Verification '4. Fázis: Dokumentumkezelés' (Protocol in workflow.md) 230e74d
