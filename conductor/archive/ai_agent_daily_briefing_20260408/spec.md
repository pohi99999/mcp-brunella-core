# Spec: Napi AI Agent Összefoglaló

## Cél

Minden nap 11:00-kor automatikusan összegyűjti az AI agent ökoszisztéma legfontosabb híreit és fejleményeit, majd strukturált magyar nyelvű összefoglalót generál, amely leképezi az eredményeket a Brunella architektúra rétegeire (cortex, memoria, corpus, nexus, fabrica, interface, conductor).

## Funkcionális követelmények

1. **Adatgyűjtés (GitHub Search API)** — 5 AI-agent-fókuszú lekérdezés naponta
2. **Web crawl (crawl4ai)** — 5 forrásoldal tartalmának kinyerése
3. **LLM elemzés** — Minden eredmény mappelése Brunella architektúra rétegekre
4. **Markdown riport** — Strukturált, magyar nyelvű kimenet `docs/001_Jelentés/briefing/` mappába
5. **Asztali másolat** — Opcionálisan `BRUNELLA_BRIEFING_DESKTOP_PATH` env var által meghatározott helyre
6. **SQLite perzisztencia** — `ai_agent_briefing_reports` tábla
7. **REST API** — `/api/v1/briefing/reports`, `/api/v1/briefing/reports/latest`, `/api/v1/briefing/run`
8. **Dashboard panel** — `AIAgentBriefingPanel` React komponens
9. **CLI parancsok** — `brunella briefing riport`, `brunella briefing futtat`
10. **Scheduler** — `0 11 * * *` cron, `daily-ai-agent-briefing` task ID

## Nem funkcionális követelmények

- Minden felhasználói szöveg magyarül
- Moduláris, egységtesztelhető kód (SOLID elvek)
- Hibatűrő: az LLM összefoglaló fallback-re esik ha nem érhető el
- A desktop másolás nem kritikus hiba

## Elfogadási kritériumok

- [ ] `npm run build` hibátlanul lefut
- [ ] A scheduler beiratja a `daily-ai-agent-briefing` taskot az adatbázisba
- [ ] `GET /api/v1/briefing/reports/latest` 200 vagy 404 válaszol
- [ ] `POST /api/v1/briefing/run` meghívja a `DailyAgentBriefingAgent.executeTask`-ot
- [ ] A dashboard panelen megjelenik a legutóbbi riport
- [ ] `brunella briefing riport` kiírja az összefoglalót
