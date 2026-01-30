# [ACTIVE]_Agents - Ügynök Megoldások Rendszerezése

Ez a könyvtár tartalmazza az összes aktív ügynök megoldást, keretrendszert, eszközt és kész ügynököt.

## Könyvtárstruktúra

### 📚 `frameworks/` - Ügynök Keretrendszerek
Ügynökök fejlesztéséhez használható keretrendszerek és könyvtárak.

- **CopilotKit** - React/Next.js ügynök keretrendszer, production-ready UI komponensekkel
- **LangGraph** - Ügynök munkafolyamatok építésére szolgáló keretrendszer
- **computer-use-preview** - Google Computer Use Preview modell, böngésző automatizációhoz

### 🛠️ `tools/` - Ügynök Készítő Eszközök
Ügynökök fejlesztéséhez és kezeléséhez használható eszközök.

- **agentics** - Ügynök munkafolyamatok és best practices
- **conductor** - Gemini CLI kiterjesztés, Context-Driven Development-hez
- **gemini-cli** - Gemini CLI - terminálból használható AI ügynök
- **GeminiCLI_ComputerUse_Extension** - Gemini CLI Computer Use kiterjesztés
- **python-api-core** - Google API Core könyvtár (támogató eszköz)

### 🤖 `ready-agents/` - Kész Ügynökök
Már kész, használható ügynök implementációk.

- **agent-starter-pack** - Ügynök fejlesztési starter pack sablonokkal
- **agents-chat** - Chat alapú ügynök alkalmazás
- **foundry-agent-webapp** - Azure AI Foundry integrációval rendelkező webalkalmazás
- **iam-bobs-brain** - IAM (Identity and Access Management) ügynök
- **prod-monitoring-assistant** - Production monitoring ügynök
- **pohi-ai-agents** - További AI ügynök implementációk

### 🔧 `adk-a2a/` - ADK A2A (Agent-to-Agent) Projektek
Google Agent Development Kit (ADK) és Agent-to-Agent kommunikációval kapcsolatos projektek.

- **a2a-go** - Go nyelven írt A2A implementáció
- **a2a-inspector** - A2A kommunikáció vizualizálása és ellenőrzése
- **adk-samples** - ADK mintapéldák (Python, Go, Java)
- **adk-web** - ADK webes felület

### 📖 `examples/` - Példa Implementációk
Ügynök fejlesztéshez használható példa kódok és implementációk.

- **crewai/** - CrewAI példa implementáció (crewai_tool_example.py)

## További projektek a főkönyvtárban

A következő projektek még a főkönyvtárban találhatók, és szükség esetén ide is áthelyezhetők:

- **crewai_tool_example.py** - CrewAI példa (már másolva: `examples/crewai/`)
- További CrewAI projektek esetén: `frameworks/crewai/` könyvtárba

## Használat

### Új keretrendszer hozzáadása
1. Helyezd a projektet a megfelelő könyvtárba (`frameworks/`, `tools/`, stb.)
2. Frissítsd ezt a README-t a leírással

### Új kész ügynök hozzáadása
1. Helyezd a projektet a `ready-agents/` könyvtárba
2. Adj hozzá README-t a projekthez
3. Frissítsd ezt a README-t

## Kategóriák

- **Frameworks**: Általános keretrendszerek ügynökök fejlesztéséhez
- **Tools**: Konkrét eszközök ügynök fejlesztéshez és kezeléshez
- **Ready Agents**: Kész, használható ügynök implementációk
- **ADK A2A**: Google ADK és Agent-to-Agent specifikus projektek
- **Examples**: Példa kódok és implementációk tanuláshoz

---

*Utolsó frissítés: 2026-01-05*

