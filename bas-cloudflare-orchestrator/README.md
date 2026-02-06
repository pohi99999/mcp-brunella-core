# BAS Cloudflare Orchestrator - Hybrid Architecture

## 🏗️ Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           BAS Orchestrator Worker                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │ Task     │  │ Workers  │  │ KV Storage       │  │   │
│  │  │ Router   │  │ AI       │  │ (Task State)     │  │   │
│  │  └────┬─────┘  └──────────┘  └──────────────────┘  │   │
│  └───────┼─────────────────────────────────────────────┘   │
│          │                                                  │
└──────────┼──────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                    LOCAL SYSTEM (PETER-PC)                   │
│  ┌─────────────────┐     ┌──────────────────────────────┐   │
│  │  n8n Workflows  │     │  Browser-Use API (robotkéz)  │   │
│  │  - Research     │     │  - Ollama (Llama 3.1)        │   │
│  │  - Code tasks   │     │  - Chrome automation         │   │
│  │  - Orchestrate  │     │  - Full browser control      │   │
│  └─────────────────┘     └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Telepítés

### 1. Cloudflare Worker

```powershell
# Navigálj a projekt mappába
cd C:\Projects\bas-cloudflare-orchestrator

# Telepítsd a függőségeket
npm install

# Hozd létre a KV namespace-t
npm run kv:create
# A kapott ID-t írd be a wrangler.jsonc-be!

# Lokális fejlesztés
npm run dev

# Deploy
npm run deploy
```

### 2. Lokális Browser-Use API

```powershell
# Navigálj a local mappába
cd C:\Projects\bas-cloudflare-orchestrator\local

# Virtuális környezet létrehozása
python -m venv venv
.\venv\Scripts\Activate.ps1

# Függőségek telepítése
pip install -r requirements.txt

# API indítása
python browser_use_api.py
```

## 📡 API Használat

### Task beküldése

```bash
curl -X POST https://bas-orchestrator.workers.dev/task \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Nyisd meg a google.com-ot és keresd meg: Cloudflare Workers",
    "context": {"priority": "high"}
  }'
```

Válasz:
```json
{
  "success": true,
  "taskId": "bas-1738466789012-abc123",
  "type": "browser",
  "message": "Task dispatched to Browser-Use (robotkéz)"
}
```

### Task státusz ellenőrzése

```bash
curl https://bas-orchestrator.workers.dev/status/bas-1738466789012-abc123
```

## 🔧 Konfiguráció

### wrangler.jsonc

Állítsd be a webhook URL-eket:

- `N8N_WEBHOOK_URL`: Az n8n webhook URL-je (lokális: `http://localhost:5678/webhook/bas-task`)
- `BROWSER_USE_ENDPOINT`: A Browser-Use API URL-je (lokális: `http://localhost:8000/api/task`)

### Tunneling (opcionális)

Lokális fejlesztéshez használj cloudflared tunnel-t:

```powershell
# Browser-Use API elérhetővé tétele
cloudflared tunnel --url http://localhost:8000

# n8n elérhetővé tétele
cloudflared tunnel --url http://localhost:5678
```

## 📋 Task típusok

| Típus | Kezelő | Példa |
|-------|--------|-------|
| `browser` | Browser-Use API | "Kattints a bejelentkezés gombra" |
| `research` | n8n workflow | "Keress információt a Python async könyvtárakról" |
| `code` | n8n workflow | "Generálj egy FastAPI endpointot" |
| `orchestrate` | n8n workflow | "Készíts egy heti riportot az emailekből" |

## 🔗 Gemini CLI Integráció

A projekt mappában lévő `GEMINI.md` fájlba add hozzá:

```markdown
## BAS Cloudflare Orchestrator

Task beküldése a hibrid rendszerbe:
- Endpoint: https://bas-orchestrator.workers.dev/task
- Lokális Browser-Use: http://localhost:8000
- Lokális n8n: http://localhost:5678
```

## 📊 Monitoring

```powershell
# Cloudflare Worker logok
npm run tail

# Lokális API logok
# A konzolban láthatók a FastAPI logok
```
