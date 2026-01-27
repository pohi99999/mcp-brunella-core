# Track: Fehér Könyv implementáció a Brunella Core MCP szerveren

## Állapot
- **Kész** (2026-01-27) – Dokumentáció és terminológia igazítás lezárva.

## Cél
- A Technikai Fehér Könyv rétegeinek és swarm szerepköreinek leképezése a Brunella komponensekre, egységes szókészlettel és hivatkozásokkal.

## Megvalósított elemek
- `docs/ARCHITECTURE.md`: réteg- és szerepkör-mátrix, komponens megfeleltetések, out-of-scope szakasz (LangSmith/BOV, Phoenix, nagy léptékű scaling).
- `docs/FEHER_KONYV_ALIGNMENT.md`: alap igazítás forrás.
- `README.md`: konfiguráció és tárolás (BRUNELLA_HOME, mcp_servers.json), architekturális hivatkozás.
- `testing/TEST_BOOK.md`: szcenáriók Fehér Könyv rétegekhez kötve.
- `AGENTS.md`: hivatkozás az architektúrára.

## Függőségek / Kapcsolódások
- Docs konzisztencia: ARCHITECTURE ↔ README ↔ TEST_BOOK.
- BRUNELLA_HOME konvenciók (CLI memória, extensions).

## Következő lépések (javaslat)
- Out-of-scope elemek (LangSmith/BOV, Phoenix, scaling) priorizálása külön trackben.
- Fehér Könyv rétegenkénti KPI-k és mérőszámok a dashboardra.
- Agypiac/Immunrendszer mélyebb automatizmusai (watchdog telemetria, tooling UX).

## Kockázatok
- Terminológiai drift: új funkcióknál frissíteni kell az ARCHITECTURE/README/TEST_BOOK hivatkozásait.
