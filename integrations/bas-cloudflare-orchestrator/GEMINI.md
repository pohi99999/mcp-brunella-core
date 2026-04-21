# BAS Cloudflare Orchestrator - GEMINI.md

## 📋 Projekt Áttekintés

**Projekt neve:** BAS (Brunella Agent System) Cloudflare Orchestrator
**Verzió:** 1.0.0
**Architektúra:** Hibrid (Cloudflare Edge + Lokális)

## 🎯 Mi ez a projekt?

Ez a Brunella Agent System hibrid orchestrátor komponense. A rendszer kombinálja:
- **Cloudflare Workers** - Edge orchestráció, task routing, AI osztályozás
- **Langflow** - Multi-agent flow builder (Research, Code, Orchestrator agents)
- **n8n** - Workflow automatizálás
- **Browser-Use API** - Lokális böngésző automatizálás (robotkéz)
- **Ollama** - Lokális LLM (llama3.1:8b)

## 📁 Projekt Struktúra

```
C:\Projects\bas-cloudflare-orchestrator\
├── src/
│   └── index.ts              # Cloudflare Worker fő kód
├── langflow/
│   ├── research-agent.json   # Kutató agent flow
│   ├── code-agent.json       # Kódoló agent flow
│   ├── orchestrator-agent.json # Fő orchestrátor flow
│   └── SETUP.md              # Langflow beállítási útmutató
├── n8n/
│   └── bas-task-handler-workflow.json  # n8n workflow
├── local/
│   ├── browser_use_api.py    # Browser-Use FastAPI wrapper
│   ├── requirements.txt      # Python függőségek
│   └── Dockerfile.browseruse # Docker konfig
├── wrangler.jsonc            # Cloudflare konfiguráció
├── docker-compose.yml        # Full stack Docker
├── GEMINI_CLI_INSTRUCTIONS.md # Telepítési útmutató
└── TEST_RESULTS.md           # Teszt eredmények (generált)
```

## 🔗 Szolgáltatások és Portok

| Szolgáltatás | URL | Port | Leírás |
|--------------|-----|------|--------|
| Cloudflare Worker | https://bas-orchestrator.workers.dev | - | Edge orchestrátor |
| Langflow | http://localhost:7860 | 7860 | Multi-agent UI |
| n8n | http://localhost:5678 | 5678 | Workflow engine |
| Browser-Use API | http://localhost:8000 | 8000 | robotkéz |
| Ollama | http://localhost:11434 | 11434 | Lokális LLM |

## 🚀 Gyors Parancsok

### Cloudflare Worker
```powershell
cd C:\Projects\bas-cloudflare-orchestrator
npm run dev      # Lokális fejlesztés
npm run deploy   # Deploy Cloudflare-re
npm run tail     # Logok figyelése
```

### Langflow
```powershell
langflow run --host 0.0.0.0 --port 7860
```

### n8n
```powershell
npx n8n
```

### Browser-Use API
```powershell
cd C:\Projects\bas-cloudflare-orchestrator\local
.\venv\Scripts\Activate.ps1
python browser_use_api.py
```

### Ollama
```powershell
ollama serve
ollama list
ollama run llama3.1:8b
```

## 📡 API Használat

### Task beküldése
```powershell
$body = @{
    instruction = "Feladat leírása"
    context = @{ priority = "high" }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://bas-orchestrator.workers.dev/task" -Method Post -ContentType "application/json" -Body $body
```

### Státusz lekérdezés
```powershell
Invoke-RestMethod -Uri "https://bas-orchestrator.workers.dev/status/TASK_ID" -Method Get
```

## 🔧 Konfiguráció

### wrangler.jsonc fontos mezők
- `kv_namespaces[0].id` - KV namespace ID (telepítéskor generálódik)
- `vars.N8N_WEBHOOK_URL` - n8n webhook endpoint
- `vars.BROWSER_USE_ENDPOINT` - Browser-Use API endpoint

### Langflow Ollama beállítások
- `base_url`: http://localhost:11434
- `model_name`: llama3.1:8b
- `temperature`: 0.7 (research/orchestrate), 0.3 (code)

## ⚠️ Fontos Tudnivalók

1. **KV Namespace** - Telepítés után be kell írni az ID-t a wrangler.jsonc-be
2. **Langflow flow-k** - Manuálisan kell importálni a UI-n
3. **Ollama** - Mindig futnia kell a lokális LLM-hez
4. **Portok** - Ellenőrizd, hogy nincs ütközés más szolgáltatásokkal

## 🐛 Gyakori Hibák

| Hiba | Megoldás |
|------|----------|
| "Model not found" | `ollama pull llama3.1:8b` |
| "Connection refused" | Ellenőrizd, hogy fut-e a szolgáltatás |
| "KV namespace not found" | Futtasd: `npm run kv:create` |
| "Unauthorized" | `npx wrangler login` |

## 📊 Task Típusok és Routing

| Instruction tartalmazza | Típus | Handler |
|-------------------------|-------|---------|
| weboldal, kattint, böngésző | browser | Browser-Use API |
| keres, gyűjt, összefoglal | research | Langflow Research |
| kód, script, függvény | code | Langflow Code |
| minden más | orchestrate | Langflow Orchestrator |

## 🔗 Kapcsolódó Projektek

- **mcp-brunella-core** - MCP szerver (GitHub)
- **Browser-Use** - Böngésző automatizálás
- **Langflow** - https://langflow.org
- **n8n** - https://n8n.io

---

*Utoljára frissítve: 2025-02-02*
