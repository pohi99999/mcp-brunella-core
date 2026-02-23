# Master Track: Law Detective (Pillar 9) - Specifikáció

**Verzió:** 1.0.0
**Státusz:** PROPOSED
**Üzleti Cél:** Automata jogszabály-figyelés és elemzés kkv-k számára. A rendszer figyeli a Magyar Közlönyt, és értesítést küld, ha releváns változás történik.

## 🎯 Célkitűzések
1.  **Forrás Figyelése:** A `magyarkozlony.hu` rendszeres ellenőrzése.
2.  **Adatkinyerés:** PDF letöltés és OCR alapú szövegelemzés.
3.  **Intelligens Szűrés:** TEÁOR kódok vagy egyedi kulcsszavak (pl. "minimálbér", "kata", "szocho") alapján.
4.  **Elemzés:** Az MI foglalja össze a változás lényegét és üzleti hatását.
5.  **Értesítés:** n8n-en keresztül Email vagy Slack értesítés küldése.

## 🛠️ Technikai Architektúra
- **Agent:** `LawDetectiveAgent` (Új ágens a `src/agents/` mappában).
- **Worker:** Python alapú PDF parser (`myai/workers/law_parser.py`).
- **Memory:** LanceDB `laws` tábla a már feldolgozott közlönyök tárolására.
- **UI:** Dashboard widget a figyelt kulcsszavak beállításához.

## ✅ Elfogadási Kritériumok
- [ ] Képes letölteni a legfrissebb Magyar Közlönyt.
- [ ] Sikeresen kinyeri a szöveget a PDF-ből.
- [ ] Csak a releváns részeket (matching keywords) menti és jelzi.
- [ ] Magyar nyelvű összefoglalót készít az üzleti hatásokról.
- [ ] Dashboard-on konfigurálhatóak a figyelt témakörök.

## 📅 Ütemterv (Phases)
1. **Phase 1:** Core Agent & PDF Scraper (Python).
2. **Phase 2:** LanceDB integráció (duplikáció szűrés).
3. **Phase 3:** Dashboard UI & n8n integráció.
4. **Phase 4:** Live Pilot (éles tesztelés).
