# IAM Bob's Brain - Beállítási Útmutató

## ⚠️ Fontos Információ

Az **IAM Bob's Brain** egy **production-grade multi-agent rendszer**, amely **Vertex AI Agent Engine**-t használ. Ez **nem** egy egyszerű lokális alkalmazás, hanem egy komplex, cloud-alapú rendszer.

## 🏗️ Architektúra

```
┌─────────────────────────────────────────────────────────┐
│  Bob (Global Orchestrator)                              │
│  • Slack interface                                      │
│  • Routes requests to specialist departments            │
└─────────────────────────┬───────────────────────────────┘
                          │
       ┌──────────────────┴────────────────────┐
       │                                       │
       ▼                                       ▼
┌──────────────────────┐            ┌──────────────────────┐
│ iam-* Department     │            │ Future Departments   │
│ (THIS REPO)          │            │ (Coming Soon)        │
│                      │            │                      │
│ Focus: ADK/Vertex    │            │ • Data pipeline team │
│ compliance audits    │            │ • Security team      │
│ and fixes            │            │ • Performance team   │
└──────────────────────┘            └──────────────────────┘
```

## 📋 Előfeltételek

### Kötelező
- **Python 3.12+**
- **Google Cloud Project** Vertex AI engedélyezve
- **Vertex AI Agent Engine** beállítva
- **Google Cloud Authentication** (gcloud auth application-default login)

### Opcionális (de ajánlott)
- **Slack workspace** bot integrációhoz
- **GitHub account** CI/CD-hez

## 🚀 Indítási Lehetőségek

### 1. A2A Gateway (Demo Mód)

Az A2A Gateway lokálisan is futtatható, de **Agent Engine URL** szükséges:

```powershell
$bobsPath = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\iam-bobs-brain").FullName
cd $bobsPath\service\a2a_gateway

# Környezeti változók beállítása
$env:PROJECT_ID="your-gcp-project-id"
$env:LOCATION="us-central1"
$env:AGENT_ENGINE_ID="your-agent-engine-id"
$env:PORT="8083"
$env:APP_NAME="bobs-brain"
$env:APP_VERSION="0.6.0"
$env:PUBLIC_URL="http://localhost:8083"
$env:AGENT_SPIFFE_ID="spiffe://intent.solutions/agent/bobs-brain/dev/us-central1/0.6.0"

# Függőségek telepítése
pip install fastapi uvicorn httpx pydantic

# Indítás
python main.py
```

**URL**: http://localhost:8083
- **AgentCard**: http://localhost:8083/.well-known/agent.json
- **Health**: http://localhost:8083/health
- **Query**: POST http://localhost:8083/query

**⚠️ Megjegyzés**: A port 8083-ra van beállítva, hogy elkerüljük az ütközést a Foundry Agent WebApp backend-jével (port 8080). Ha más portot szeretnél használni, módosítsd a `$env:PORT` értékét.

### 2. Slack Webhook (Demo Mód)

A Slack webhook is lokálisan futtatható, de **Slack konfiguráció** szükséges:

```powershell
$bobsPath = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\iam-bobs-brain").FullName
cd $bobsPath\service\slack_webhook

# Környezeti változók beállítása
$env:SLACK_BOB_ENABLED="false"  # Demo módban kikapcsolva
$env:PROJECT_ID="your-gcp-project-id"
$env:LOCATION="us-central1"
$env:AGENT_ENGINE_ID="your-agent-engine-id"
$env:PORT="8081"
$env:A2A_GATEWAY_URL="http://localhost:8083"  # Ha az A2A gateway fut

# Függőségek telepítése
pip install fastapi uvicorn httpx

# Indítás
python main.py
```

**URL**: http://localhost:8081
- **Health**: http://localhost:8081/health
- **Events**: POST http://localhost:8081/slack/events

**⚠️ Megjegyzés**: A Slack webhook port 8081-re van beállítva. Az A2A Gateway URL-je 8083-ra van beállítva, hogy konzisztens legyen a `STARTED_APPS.md` dokumentációval.

### 3. Portfolio Audit (CLI)

A portfolio audit script lokálisan futtatható:

```powershell
$bobsPath = (Get-Item -LiteralPath "G:\Brunella\[ACTIVE]_Agents\ready-agents\iam-bobs-brain").FullName
cd $bobsPath

# Python környezet beállítása
python -m venv .venv
.venv\Scripts\activate

# Függőségek telepítése
pip install -r requirements.txt

# Portfolio audit futtatása
python scripts/run_portfolio_swe.py

# Vagy specifikus repo-k auditálása
python scripts/run_portfolio_swe.py --repos bobs-brain
```

## 🔧 Hard Mode Szabályok (R1-R8)

Az IAM Bob's Brain 8 szigorú architektúrális szabályt követ:

1. **R1**: ADK-only (nincs LangChain, CrewAI keverés)
2. **R2**: Vertex AI Agent Engine (nincs self-hosted runner)
3. **R3**: Gateway separation (Cloud Run csak proxy)
4. **R4**: CI-only deployments (nincs manuális deploy)
5. **R5**: Dual Memory (Session + Memory Bank)
6. **R6**: Single docs folder (000-docs/)
7. **R7**: SPIFFE Identity (immutable identity)
8. **R8**: Drift Detection (CI blokkolja a rossz mintákat)

## 📊 Multi-Agent Struktúra

A rendszer 8 specialist ügynököt tartalmaz:

- **iam-senior-adk-devops-lead** (Foreman) - Koordinálja az auditokat
- **iam-adk** - ADK/Vertex pattern expert
- **iam-issue** - ADK violation detector
- **iam-fix-plan** - ADK fix strategy planner
- **iam-fix-impl** - ADK fix implementer
- **iam-qa** - ADK compliance QA
- **iam-docs** - ADK/Vertex dokumentáció
- **iam-cleanup** - ADK codebase cleanup
- **iam-index** - ADK knowledge curator

## 🎯 Használati Esetek

### 1. ADK/Vertex Compliance Audit
```bash
python scripts/run_portfolio_swe.py --repos my-repo
```

### 2. Slack Bot (Production)
- Slack workspace-ben @Bob mention
- Automatikus ADK compliance válaszok

### 3. A2A Protocol (Agent-to-Agent)
- Más ügynökök hívhatják Bob-ot A2A protokollon keresztül
- AgentCard discovery: `/.well-known/agent.json`

## ⚠️ Korlátok Lokális Futtatáshoz

1. **Agent Engine URL szükséges** - A gateway-ek nem működnek Agent Engine nélkül
2. **Slack konfiguráció** - Slack bot működéséhez Slack app szükséges
3. **GCP Authentication** - Google Cloud hitelesítés szükséges
4. **Production Deployment** - Teljes funkcionalitás csak production környezetben

## 💡 Alternatív: Portfolio Audit Demo

Ha nincs Agent Engine beállítva, a **portfolio audit script**-et lehet futtatni lokálisan:

```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\iam-bobs-brain"
python scripts/run_portfolio_swe.py --repos . --output audit-demo.json
```

Ez egy statikus auditot végez a kódbázison ADK compliance szempontjából.

## 📚 További Dokumentáció

- **README.md** - Fő dokumentáció
- **000-docs/** - Részletes technikai dokumentáció
- **NOX-QUICK-START.md** - Testing útmutató
- **Makefile** - Fejlesztési parancsok

---

*Ez egy production-grade rendszer. Teljes funkcionalitáshoz Vertex AI Agent Engine deployment szükséges.*

