# Langflow Setup Guide - BAS Multi-Agent System

## 🎯 Áttekintés

A Langflow a BAS rendszer vizuális multi-agent flow builder komponense. Három specializált agent-et tartalmaz:

| Agent | Endpoint | Feladat |
|-------|----------|---------|
| **Research Agent** | `/api/v1/run/research-agent` | Információgyűjtés, összefoglalás |
| **Code Agent** | `/api/v1/run/code-agent` | Kód generálás, review, debug |
| **Orchestrator Agent** | `/api/v1/run/orchestrator-agent` | Feladat koordináció, ReAct reasoning |

## 🚀 Telepítés

### Opció 1: Docker (Ajánlott)

```powershell
cd C:\Projects\bas-cloudflare-orchestrator
docker-compose up -d langflow
```

Elérhető: http://localhost:7860
- User: admin
- Password: bas2025

### Opció 2: Lokális telepítés

```powershell
# Python 3.10+ szükséges
pip install langflow

# Indítás
langflow run --host 0.0.0.0 --port 7860
```

### Opció 3: Pip + uv (gyorsabb)

```powershell
pip install uv
uv pip install langflow
langflow run
```

## 📥 Flow-k Importálása

### 1. lépés: Nyisd meg a Langflow UI-t
http://localhost:7860

### 2. lépés: Minden flow-hoz:

1. Kattints **"New Project"** → **"Blank Flow"**
2. Kattints a ⚙️ (Settings) ikonra → **"Import"**
3. Válaszd ki a JSON fájlt:
   - `langflow/research-agent.json`
   - `langflow/code-agent.json`
   - `langflow/orchestrator-agent.json`
4. **"Save"** és adj nevet

### 3. lépés: Ollama konfiguráció

Minden flow-ban az **OllamaModel** node-nál:

1. **base_url**: `http://localhost:11434` (vagy Docker esetén `http://host.docker.internal:11434`)
2. **model_name**: `llama3.1:8b` (vagy ami elérhető)
3. Teszteld: Kattints a ▶️ gombra

### 4. lépés: Endpoint beállítása

Minden flow-nál:
1. Kattints **"API"** fülre
2. Másold ki az endpoint URL-t
3. Ellenőrizd, hogy aktív-e

## 🔗 API Használat

### Research Agent hívása

```bash
curl -X POST http://localhost:7860/api/v1/run/research-agent \
  -H "Content-Type: application/json" \
  -d '{
    "input_value": "Keress modern Python async HTTP könyvtárakat",
    "output_type": "chat",
    "input_type": "chat"
  }'
```

### Code Agent hívása

```bash
curl -X POST http://localhost:7860/api/v1/run/code-agent \
  -H "Content-Type: application/json" \
  -d '{
    "input_value": "Írj egy FastAPI endpoint-ot ami JSON-t fogad",
    "output_type": "chat",
    "input_type": "chat",
    "tweaks": {
      "language": "python",
      "task_type": "generate"
    }
  }'
```

### Orchestrator Agent hívása

```bash
curl -X POST http://localhost:7860/api/v1/run/orchestrator-agent \
  -H "Content-Type: application/json" \
  -d '{
    "input_value": "Készíts egy heti email összefoglalót és küld el Slack-re",
    "output_type": "chat",
    "input_type": "chat",
    "tweaks": {
      "context": {"user": "Peter", "priority": "high"}
    }
  }'
```

## 🏗️ Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│                      LANGFLOW (7860)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐ │
│  │  Research   │ │    Code     │ │     Orchestrator      │ │
│  │   Agent     │ │   Agent     │ │        Agent          │ │
│  │             │ │             │ │   ┌───────────────┐   │ │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │   │ ReAct Engine  │   │ │
│  │ │ Ollama  │ │ │ │ Ollama  │ │ │   │ + Memory      │   │ │
│  │ │ LLM     │ │ │ │ LLM     │ │ │   └───────────────┘   │ │
│  │ └─────────┘ │ │ └─────────┘ │ │   │ Task Parser   │   │ │
│  │ │ Search  │ │ │ │Validator│ │ │   │ + Delegator   │   │ │
│  │ └─────────┘ │ │ └─────────┘ │ │   └───────────────┘   │ │
│  └─────────────┘ └─────────────┘ └───────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────┐
            │        n8n (5678)            │
            │   [BAS Task Handler]         │
            │         │                    │
            │    ┌────┴────┐               │
            │    ▼         ▼               │
            │ Research   Code    Orchestrate│
            │  Route     Route     Route   │
            └──────────────────────────────┘
```

## ⚙️ Testreszabás

### Új Agent hozzáadása

1. Másold le az egyik meglévő flow-t
2. Módosítsd a Prompt template-et
3. Add hozzá a szükséges tool-okat (pl. WebSearch, Database)
4. Állítsd be az endpoint nevet
5. Frissítsd az n8n workflow-t

### Ollama modell váltás

Ha más modellt szeretnél használni:

```bash
# Elérhető modellek listázása
ollama list

# Új modell letöltése
ollama pull mistral
ollama pull codellama

# Langflow-ban átállítás
# OllamaModel node → model_name mező
```

### Memory hozzáadása

Az Orchestrator Agent már tartalmaz ConversationBufferMemory-t. 
Más agent-eknél is hozzáadhatod:

1. Húzz be egy **ConversationBufferMemory** node-ot
2. Kösd össze a Prompt és az Output között
3. Állítsd be a `session_id`-t egyedi azonosítóra

## 🔧 Hibakeresés

### "Connection refused" hiba

```powershell
# Ellenőrizd, hogy fut-e az Ollama
ollama serve

# Vagy Docker-ben
docker ps | findstr ollama
```

### "Model not found" hiba

```powershell
# Töltsd le a modellt
ollama pull llama3.1:8b
```

### Langflow nem indul

```powershell
# Töröld a cache-t és indítsd újra
Remove-Item -Recurse -Force $env:USERPROFILE\.cache\langflow
langflow run
```

## 📊 Monitoring

### Langflow logok

```powershell
# Docker
docker logs -f bas-langflow

# Lokális
# A konzolban láthatók
```

### API metrikák

Langflow UI → Settings → Logs

---

## 🎯 Következő lépések

1. ✅ Langflow telepítése
2. ✅ Flow-k importálása
3. ✅ Ollama kapcsolat tesztelése
4. ⬜ n8n workflow aktiválása
5. ⬜ Cloudflare Worker deploy
6. ⬜ End-to-end teszt
