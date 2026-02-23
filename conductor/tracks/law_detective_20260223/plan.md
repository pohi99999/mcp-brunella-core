# Law Detective - Implementációs Terv

## 📋 Feladatok

### Fázis 1: Alapok (Agent & Scraper)
- [ ] `src/agents/LawDetectiveAgent.ts` létrehozása (BaseAgent alapokon).
- [ ] `myai/workers/law_parser.py` megírása (Playwright + PDF parsing).
- [ ] Regisztráció a `registry.json` fájlban.

### Fázis 2: Adatkezelés
- [ ] LanceDB `laws` séma definiálása.
- [ ] IsDuplicate ellenőrzés implementálása (közlöny száma alapján).

### Fázis 3: Integráció
- [ ] `LawDetectiveWidget.tsx` Dashboard komponens.
- [ ] Kulcsszó kezelő felület.
- [ ] n8n webhook hívás bekötése.

## 🚀 Végrehajtási Sorrend
1. Python scraper tesztelése manuálisan.
2. Ágens bekötése az Orchestratorba.
3. UI megjelenítése a Dashboardon.
