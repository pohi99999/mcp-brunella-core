# BAS Langflow Integration Guide

## 🎯 Architektúra

```
┌─────────────────────────────────────────────────────────────────────┐
│                         LANGFLOW (7860)                              │
│  ┌─────────────────────┐     ┌──────────────────────────────────┐  │
│  │  Research Agent     │     │  Multi-Agent Orchestrator        │  │
│  │  /api/v1/run/       │     │  /api/v1/run/bas-orchestrator    │  │
│  │  bas-research       │     │                                   │  │
│  │                     │     │  ┌─────┐ ┌─────┐ ┌─────┐        │  │
│  │  • Query Analyzer   │     │  │Rsch │ │Code │ │Brws │        │  │
│  │  • Web Search       │     │  └──┬──┘ └──┬──┘ └──┬──┘        │  │
│  │  • Content Scraper  │     │     └───────┼───────┘            │  │
│  │  • Synthesizer      │     │         Aggregator                │  │
│  └─────────────────────┘     └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          ↑                              ↑
          │                              │
┌─────────┴──────────────────────────────┴────────────────────────────┐
│                      n8n Workflows (5678)                            │
│                                                                      │
│  POST /webhook/bas-task → Router → Langflow/Ollama → Callback       │
└─────────────────────────────────────────────────────────────────────┘
          ↑
          │
┌─────────┴────────────────────────────────────────────────────────────┐
│                 Cloudflare Workers (Edge)                            │
│                                                                      │
│  POST /task → AI Classifier → Dispatch to n8n or Browser-Use        │
└──────────────────────────────────────────────────────────────────────┘
```

## 🚀 Telepítés

### 1. Langflow telepítése

```powershell
# Virtuális környezet (ajánlott)
python -m venv langflow-env
.\langflow-env\Scripts\Activate.ps1

# Telepítés
pip install langflow

# Indítás
langflow run --host 0.0.0.0 --port 7860
```

### 2. Flow-k importálása

1. Nyisd meg a Langflow UI-t: http://localhost:7860
2. Kattints "Import" gombra
3. Töltsd fel a JSON fájlokat:
   - `bas-research-agent.json`
   - `bas-orchestrator-agent.json`
4. Minden flow-nál ellenőrizd az Ollama kapcsolatot (localhost:11434)

### 3. API Endpoint aktiválása

Minden importált flow-nál:
1. Kattints a "API" gombra (jobb felső sarok)
2. Engedélyezd az API hozzáférést
3. Jegyezd fel az endpoint URL-t

## 📡 API Használat

### Research Agent hívása

```bash
curl -X POST http://localhost:7860/api/v1/run/bas-research \
  -H "Content-Type: application/json" \
  -d '{
    "input_value": "Keress modern Python async HTTP könyvtárakat összehasonlítással",
    "output_type": "chat",
    "input_type": "chat"
  }'
```

### Orchestrator hívása

```bash
curl -X POST http://localhost:7860/api/v1/run/bas-orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "input_value": "Készíts egy heti riportot az utolsó 7 nap emailjeiből, mentsd Google Docs-ba",
    "output_type": "chat",
    "input_type": "chat"
  }'
```

## 🔧 Testreszabás

### Ollama modell váltása

A flow-kban az `OllamaModel` node-oknál állítsd át:
- `model_name`: pl. `mistral:7b`, `codellama:13b`
- `temperature`: 0.1-1.0 (alacsonyabb = determinisztikusabb)
- `num_ctx`: context window méret

### Új ügynök hozzáadása

1. Hozz létre új flow-t Langflow-ban
2. Add hozzá a `ConditionalRouter-1`-hez az új ügynök route-ot
3. Konfiguráld az API végpontot

## 🐛 Hibaelhárítás

### Ollama kapcsolat hiba
```powershell
# Ellenőrizd, hogy fut-e
ollama list

# Ha nem fut
ollama serve
```

### Langflow nem indul
```powershell
# Port foglalt?
netstat -ano | findstr :7860

# Újraindítás
langflow run --port 7861
```

### Flow nem működik
1. Ellenőrizd a node kapcsolatokat (minden él megvan?)
2. Nézd meg a Langflow konzol logokat
3. Teszteld az egyes node-okat külön-külön
