# Elindított Ügynök Alkalmazások

Ez a dokumentum tartalmazza az elindított ügynök alkalmazások listáját és azok elérési útjait.

## 🎯 Gemini Enterprise Alternatíva

### ⭐ ADK Web (Ajánlott - Chat Asszisztens Feeling)
- **Státusz**: Fut
- **Backend Port**: 8000
- **Frontend Port**: 4200
- **URL**: http://localhost:4200
- **Típus**: Built-in Developer UI (Gemini Enterprise alternatíva)
- **Funkciók**:
  - ✅ Chat Interface - Interaktív chat az ügynökkel
  - ✅ Agent Builder & Assistant - Vizuális ügynök építés
  - ✅ Tracing - Részletes debugging és nyomkövetés
  - ✅ Events - Események valós idejű megjelenítése
  - ✅ Artifacts - Generált fájlok megtekintése
  - ✅ Evaluations - Ügynök teljesítmény értékelés
  - ✅ Code Editor - Beépített kódszerkesztő
  - ✅ Session Management - Többszörös beszélgetések
- **Előnyök**:
  - **Minimális kód** - Beépített UI, nincs extra frontend fejlesztés
  - **Chat aszisztens feeling** - Pontosan mint a Gemini Enterprise
  - **Interaktív építés** - Drag-and-drop ügynök építés
  - **Visual debugging** - Látod, hogy az ügynök mit csinál
  - **Gemini Native** - Közvetlenül Google ADK-val működik
- **Indítás**:
  ```powershell
  # Backend (egy terminálban)
  $agentsPath = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat").FullName
  cd $agentsPath
  $env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
  uv run adk api_server app --allow_origins="http://localhost:4200" --host=0.0.0.0 --port=8000
  
  # Frontend (másik terminálban)
  $adkWebPath = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\adk-a2a\adk-web").FullName
  cd $adkWebPath
  npm run serve -- --backend=http://localhost:8000
  ```
- **Részletes útmutató**: Lásd `GEMINI_ENTERPRISE_ALTERNATIVES.md`

## 📋 Elindított Alkalmazások

### 1. ✅ Deep Search Agent (agents-chat)
- **Státusz**: Fut
- **Port**: 8501
- **URL**: http://localhost:8501
- **Típus**: Multi-Agent Research System
- **Ügynökök**: 
  - Planner Agent
  - Researcher Agent  
  - Critic Agent
  - Composer Agent
- **Funkciók**: 
  - Human-in-the-Loop (HITL) terv jóváhagyás
  - Automatikus webes kutatás
  - Iteratív finomítás
  - Összefoglaló jelentések generálása
- **Indítás**: 
  ```powershell
  cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
  $env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
  uv run adk web --port 8501
  ```

### 2. ✅ Production Monitoring Assistant
- **Státusz**: Fut
- **Backend Port**: 8002
- **Frontend Port**: 8502
- **Frontend URL**: http://localhost:8502
- **Backend API**: http://localhost:8002
- **Típus**: Production Monitoring Agent (LangGraph)
- **Funkciók**:
  - Production logok elemzése
  - Problémák automatikus észlelése
  - Slack bot integráció (production-ben)
  - FastAPI backend + Streamlit frontend
- **Indítás** (ha újra kell indítani):
  ```powershell
  $path = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\prod-monitoring-assistant").FullName
  cd $path
  $env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
  
  # Backend (egy terminálban)
  uv run uvicorn app.server:app --host 0.0.0.0 --port 8002 --reload
  
  # Frontend (másik terminálban)
  uv run streamlit run frontend/streamlit_app.py --server.port 8502 --server.enableCORS=false --browser.serverAddress=localhost
  ```

### 3. ⏳ Foundry Agent WebApp
- **Státusz**: Telepítés szükséges
- **Backend Port**: 8080 (.NET)
- **Frontend Port**: 5173 (React)
- **URL**: http://localhost:5173
- **Típus**: Azure AI Foundry integráció
- **Funkciók**:
  - Entra ID autentikáció
  - Azure AI Foundry Agent Service
  - React frontend + ASP.NET Core backend
- **Előfeltételek**:
  - .NET 9 SDK
  - Node.js 18+
  - Azure AI Foundry Resource
- **Indítás**:
  ```powershell
  cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\foundry-agent-webapp"
  .\deployment\scripts\start-local-dev.ps1
  ```

### 4. ✅ IAM Bob's Brain (A2A Gateway - Demo Mód)
- **Státusz**: A2A Gateway fut (demo mód)
- **Port**: 8083
- **URL**: http://localhost:8083
- **Típus**: Multi-Department Specialist Team
- **Funkciók**:
  - ADK/Vertex compliance audit
  - Slack bot integráció (production-ben)
  - A2A protocol
  - Agent Engine deployment (production-ben)
- **⚠️ Demo Mód Korlátok**:
  - Agent Engine URL nélkül csak metadata endpoint-ok működnek
  - Teljes funkcionalitáshoz Vertex AI Agent Engine szükséges
- **Elérhető Endpoint-ok**:
  - Health: http://localhost:8083/health
  - AgentCard: http://localhost:8083/.well-known/agent.json
  - Root: http://localhost:8083/
- **Indítás**: 
  ```powershell
  $bobsPath = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\iam-bobs-brain").FullName
  cd "$bobsPath\service\a2a_gateway"
  $env:PROJECT_ID='demo-project'
  $env:LOCATION='us-central1'
  $env:AGENT_ENGINE_ID='demo-engine'
  $env:PORT='8083'
  python main.py
  ```
- **Részletes útmutató**: Lásd `BOBS_BRAIN_SETUP.md`

## 🚀 Gyors Indítási Útmutató

### PowerShell-ben (szögletes zárójelek kezelése)

```powershell
# 1. Deep Search Agent
$path = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat").FullName
cd $path
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
uv run adk web --port 8501

# 2. Production Monitoring Assistant
$path = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\prod-monitoring-assistant").FullName
cd $path
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
# Backend
uv run uvicorn app.server:app --host 0.0.0.0 --port 8002 --reload
# Frontend (másik terminálban)
uv run streamlit run frontend/streamlit_app.py --server.port 8502
```

## 📊 Portok Összefoglaló

| Alkalmazás | Backend Port | Frontend Port | URL | Státusz |
|------------|-------------|---------------|-----|---------|
| **ADK Web** (Gemini Enterprise alternatíva) | 8000 | 4200 | http://localhost:4200 | ✅ Fut |
| Deep Search Agent | - | 8501 | http://localhost:8501 | ✅ Fut |
| Production Monitoring | 8002 | 8502 | http://localhost:8502 | ✅ Fut |
| IAM Bob's Brain (A2A Gateway) | 8083 | - | http://localhost:8083 | ✅ Fut (Demo) |
| Foundry WebApp | 8080 | 5173 | http://localhost:5173 | ⏳ Telepítés szükséges |

## 🔑 API Kulcs Beállítása

**⚠️ FONTOS: Soha ne commitolj valódi API kulcsokat a repository-ba!**

Minden alkalmazás a `GOOGLE_API_KEY` környezeti változót használja. A kulcsot az alábbi módon állíthatod be:

### 1. Környezeti változóként (PowerShell)
```powershell
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
```

### 2. .env fájl használata (Ajánlott)
Hozz létre egy `.env` fájlt az alkalmazás könyvtárában:
```bash
# app/.env vagy projekt gyökér/.env
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE
```

### 3. API kulcs beszerzése
1. Látogasd meg: https://aistudio.google.com/app/apikey
2. Hozz létre egy új API kulcsot
3. Mentsd el biztonságos helyen (pl. password manager)
4. **Soha ne oszd meg publikus helyeken!**

### 4. Biztonsági Best Practices
- ✅ Használj `.env` fájlt és add hozzá a `.gitignore`-hoz
- ✅ Ne commitolj `.env` fájlokat
- ✅ Ne oszd meg az API kulcsot publikus dokumentációban
- ✅ Használj környezeti változókat production-ben
- ✅ Rotáld az API kulcsokat rendszeresen

## 📝 Megjegyzések

- A szögletes zárójelek miatt a PowerShell-ben használd a `-LiteralPath` paramétert vagy a `Get-Item` parancsot
- Minden alkalmazás külön terminálban fut
- A portok ütközése elkerülése érdekében különböző portokat használunk

---

*Utolsó frissítés: 2026-01-05*

