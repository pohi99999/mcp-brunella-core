# Track Specifikáció: Funkcionális Helyreállítás (Functional Restoration)

## 1. Célkitűzés
A "System Recovery" során létrehozott stub-ok és mock-ok kiváltása valódi logikával. A cél az intelligens funkciók (LLM, Agents) és az MCP integrációk teljes körű reaktiválása.

## 2. Hatókör (Scope)

### A. LLM Infrastruktúra
- **Ollama Kliens:** Valódi kommunikáció megvalósítása a `src/core/llm_client.ts`-ben.
- **Streaming:** Chat kimenetek folyamatos továbbítása a Dashboard felé.

### B. Ügynök Logika (Agent Brains)
- **Orchestrator:** Tervalkotás (Planning) és delegálás reaktiválása.
- **Data Scientist:** A `refiner_logic.py` és a TypeScript wrapper összekötése.
- **Researcher:** RAG alapú keresés és összefoglalás validálása.

### C. MCP Integráció
- **Multi-Server Bridge:** A `web.ts`-ben kikommentált auto-connect és proxy logika helyreállítása.
- **Tool Mapping:** A belső toolok és a külső MCP toolok egységes kezelése.

## 3. Elvárt Kimenet
1.  **Működő Chat:** A Dashboardon keresztüli üzenetváltás valódi LLM válaszokat ad.
2.  **Valódi Delegálás:** Az Orchestrator képes szétbontani a feladatot és kiadni az ügynököknek.
3.  **Külső Toolok:** A CLI és a Dashboard látja és futtatja a külső MCP szerverek tooljait.

## 4. Sikerességi Kritériumok
- Egy komplex kérésre (pl. "Nézd meg a logokat és foglald össze") több ügynök együttműködésével érkezik válasz.
- Az Ollama ping sikeres.
