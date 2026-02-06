# 🤖 Robotkéz (Browser-Use) - Teljes Setup & Használati Útmutató

**Verzió:** 1.0
**Dátum:** 2026-02-06
**Cél:** Automatikus böngésző vezérlés beállításokhoz, monitoring-hoz, teszteléshez

---

## 📋 Tartalomjegyzék

1. [Gyors Start](#gyors-start)
2. [Telepítés](#telepítés)
3. [Tesztelési Szintek](#tesztelési-szintek)
4. [Használati Esetek](#használati-esetek)
5. [Hibaelhárítás](#hibaelhárítás)

---

## ⚡ Gyors Start (10 perc)

### Lépés 1: Függőségek

```powershell
cd F:\mcp-brunella-core\myai

# Python packages (uv használatával)
uv pip install browser-use playwright httpx asyncio

# Playwright browser install
python -m playwright install chromium
```

### Lépés 2: FastAPI Szerver Indítás

```powershell
# Terminál 1
cd F:\mcp-brunella-core\myai
uvicorn server:app --reload --port 8000
```

**Ellenőrzés:**
```powershell
# Terminál 2
curl http://localhost:8000/health
# Válasz: {"status": "ok", "browser_use": "available"}
```

### Lépés 3: Alapvető Teszt

```powershell
cd F:\mcp-brunella-core
python scripts/robotkez_test_level1.py
```

**Várható eredmény:**
```
[OK] Task submitted: test-google-search
[OK] Screenshot saved
[OK] Extracted 3 items
[LEVEL 1] Test Complete
```

---

## 🔧 Telepítés (Részletes)

### Környezeti Változók Ellenőrzés

Nyisd meg: `F:\mcp-brunella-core\.env`

Szükséges változók:
```env
# Gemini API (AI agent steering)
GEMINI_API_KEY=AIzaSyCohm3LnbT2T_Yf1AA6J83KpcFv0zt92Ts

# Browser-Use API
BROWSER_USE_API_KEY=bu_g4faSN9Pz1lqAnA1vJabh0orDcN0tmhgpSt3g4610ts

# n8n credentials (teszteléshez)
N8N_TEST_URL=https://n8n-latest-fulv.onrender.com
N8N_TEST_USER=peterpohankapesonal@gmail.com
N8N_TEST_PASSWORD=Iszapfalo2026
```

### Python Modul Ellenőrzés

```python
# Test: python -c "..."
import browser_use
import playwright
print("✅ Browser-Use ready")
```

---

## 🎯 Tesztelési Szintek

### Level 1: Alapvető Navigáció

**Fájl:** `scripts/robotkez_test_level1.py`

**Mit tesz:**
- Google keresés
- Screenshot készítés
- Adatkinyerés (GitHub trending repos)

**Futtatás:**
```powershell
python scripts/robotkez_test_level1.py
```

**Sikerkritérium:**
- ✅ Minden teszt `[OK]` státusz
- ✅ Screenshot-ok a `myai/screenshots/` mappában
- ✅ Extracted JSON válasz

---

### Level 2: n8n Workflow Management

**Fájl:** `scripts/robotkez_test_level2_n8n.py`

**Mit teszt:**
1. n8n bejelentkezés
2. Új workflow létrehozás (Webhook + HTTP Request)
3. Workflow lista kinyerés

**Futtatás:**
```powershell
python scripts/robotkez_test_level2_n8n.py
```

**Sikerkritérium:**
- ✅ Login sikeres (dashboard látható)
- ✅ Workflow létrejött: "Test Workflow - Robotkez"
- ✅ Workflow lista kinyerve JSON-ként

**Debugging:**
- Ha login fail: ellenőrizd `N8N_TEST_PASSWORD` az `.env`-ben
- Ha headless problémás: `"headless": False` a context-ben (látható böngésző)

---

### Level 3: Weboldal Monitoring

**Fájl:** `scripts/robotkez_test_level3_monitoring.py` (most készítjük)

**Használat:**
```python
# Monitor website changes
monitor_task = {
    "instruction": "Check https://example.com every 10 minutes, alert if text 'Maintenance' appears",
    "context": {
        "monitoring": True,
        "interval": 600,  # seconds
        "alert_webhook": "https://discord.com/webhooks/..."
    }
}
```

---

## 💼 Használati Esetek

### 1. **Beállítások Kezelése (Cloudflare Dashboard)**

```python
import asyncio
import httpx

async def manage_cloudflare_settings():
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "http://localhost:8000/api/task",
            json={
                "taskId": "cf-check-workers",
                "type": "browser",
                "payload": {
                    "instruction": """
                    1. Login to Cloudflare dashboard (dash.cloudflare.com)
                    2. Go to Workers & Pages
                    3. Extract all deployed workers (name, URL, status)
                    4. Return as JSON: [{"name": "...", "url": "...", "status": "..."}]
                    """,
                    "context": {
                        "extract_json": True,
                        "credentials": {
                            "email": "your-cf-email@example.com",
                            "password": "your-password"
                        }
                    }
                },
                "callbackUrl": ""
            }
        )

        result = response.json()
        workers = result.get('result', {}).get('extractedData', [])

        print(f"Found {len(workers)} Cloudflare Workers:")
        for worker in workers:
            print(f"  - {worker['name']}: {worker['status']}")

asyncio.run(manage_cloudflare_settings())
```

---

### 2. **Weboldal Figyelés (Monitoring)**

**Automatikus ellenőrzés 10 percenként:**

```python
# scripts/monitor_website.py
import asyncio
import httpx
from datetime import datetime

MONITORED_URLS = [
    "https://bas-orchestrator.iam-dd1.workers.dev",
    "https://n8n-latest-fulv.onrender.com/healthz",
    "http://localhost:3000/api/health"
]

async def monitor_loop():
    while True:
        print(f"\n[{datetime.now()}] Monitoring check...")

        async with httpx.AsyncClient(timeout=60.0) as client:
            for url in MONITORED_URLS:
                response = await client.post(
                    "http://localhost:8000/api/task",
                    json={
                        "taskId": f"monitor-{hash(url)}",
                        "type": "browser",
                        "payload": {
                            "instruction": f"""
                            Check {url}:
                            1. Verify page loads (status 200)
                            2. Check for error messages
                            3. Extract response time

                            Return JSON: {{"status": "ok/error", "response_time_ms": 123, "errors": []}}
                            """,
                            "context": {
                                "headless": True,
                                "extract_json": True,
                                "timeout": 30000
                            }
                        },
                        "callbackUrl": ""
                    }
                )

                result = response.json()
                status_data = result.get('result', {}).get('extractedData', {})

                if status_data.get('status') == 'ok':
                    print(f"  ✅ {url}: OK ({status_data.get('response_time_ms')}ms)")
                else:
                    print(f"  ❌ {url}: ERROR - {status_data.get('errors')}")
                    # Alert: send to Discord/Slack webhook

        # Wait 10 minutes
        await asyncio.sleep(600)

asyncio.run(monitor_loop())
```

**Futtatás háttérben (PowerShell):**
```powershell
Start-Process python -ArgumentList "scripts/monitor_website.py" -WindowStyle Hidden
```

---

### 3. **Önálló Task Scheduler**

**Windows Task Scheduler integráció:**

1. **Task létrehozás:**
   - Nyisd meg: Task Scheduler (`taskschd.msc`)
   - Create Basic Task → "Robotkez Daily Check"
   - Trigger: Daily, 9:00 AM
   - Action: Start program
     - Program: `python`
     - Arguments: `F:\mcp-brunella-core\scripts\robotkez_daily_check.py`
     - Start in: `F:\mcp-brunella-core`

2. **Daily check script:**

```python
# scripts/robotkez_daily_check.py
import asyncio
import httpx
import json
from datetime import datetime

CHECKS = [
    {
        "name": "n8n Workflows Status",
        "instruction": "Login to n8n, check all workflows are active, return count",
        "extract_json": True
    },
    {
        "name": "Cloudflare Workers Health",
        "instruction": "Check Cloudflare dashboard, verify all workers are deployed",
        "extract_json": True
    },
    {
        "name": "GitHub Actions Status",
        "instruction": "Check github.com/yourrepo/actions, verify latest run passed",
        "extract_json": True
    }
]

async def daily_check():
    report = {
        "date": datetime.now().isoformat(),
        "checks": []
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        for check in CHECKS:
            print(f"Running: {check['name']}...")

            response = await client.post(
                "http://localhost:8000/api/task",
                json={
                    "taskId": f"daily-{hash(check['name'])}",
                    "type": "browser",
                    "payload": {
                        "instruction": check["instruction"],
                        "context": {"headless": True, "extract_json": check["extract_json"]}
                    },
                    "callbackUrl": ""
                }
            )

            result = response.json()
            report["checks"].append({
                "name": check["name"],
                "status": "success" if response.status_code == 200 else "failed",
                "data": result.get('result', {}).get('extractedData')
            })

    # Save report
    with open(f"logs/daily_report_{datetime.now().strftime('%Y%m%d')}.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n✅ Daily check complete. Report saved.")

asyncio.run(daily_check())
```

---

## 🚨 Hibaelhárítás

### Probléma 1: "Browser-Use not found"

```powershell
cd F:\mcp-brunella-core\myai
uv pip install browser-use --force-reinstall
```

### Probléma 2: "Playwright browser not installed"

```powershell
python -m playwright install chromium
```

### Probléma 3: FastAPI nem indul

```powershell
# Check port 8000
netstat -ano | findstr :8000

# Kill process if occupied
taskkill /PID <PID> /F

# Restart
cd myai
uvicorn server:app --reload --port 8000
```

### Probléma 4: Task timeout

Context-ben növeld a timeout-ot:
```python
"context": {
    "timeout": 120000  # 2 minutes (default: 60s)
}
```

### Probléma 5: Headless mode debugging

Kapcsold ki a headless módot hogy lásd mit csinál:
```python
"context": {
    "headless": False,  # Browser ablak látható
    "save_screenshot": True
}
```

Screenshot helye: `myai/screenshots/task-<taskId>.png`

---

## 📊 API Referencia

### POST /api/task

**Request:**
```json
{
  "taskId": "unique-id",
  "type": "browser",
  "payload": {
    "instruction": "What to do in natural language",
    "context": {
      "headless": true,
      "save_screenshot": false,
      "extract_json": false,
      "timeout": 60000,
      "start_url": "https://example.com"
    }
  },
  "callbackUrl": "https://your-webhook.com/callback"
}
```

**Response:**
```json
{
  "taskId": "unique-id",
  "status": "completed",
  "result": {
    "summary": "Task completed successfully",
    "extractedData": {...},
    "screenshot": "path/to/screenshot.png"
  }
}
```

---

## 🎯 Következő Lépések

1. ✅ **Level 1 Test** - Alapvető navigáció
2. ✅ **Level 2 Test** - n8n management
3. ⏳ **Level 3** - Monitoring setup (cron/Task Scheduler)
4. ⏳ **Level 4** - Cloudflare dashboard automation
5. ⏳ **Level 5** - Multi-site monitoring dashboard

---

## 📚 További Források

- **Browser-Use Docs:** https://github.com/browser-use/browser-use
- **Playwright Docs:** https://playwright.dev/python/
- **myai/browser_worker.py** - Robotkéz implementáció
- **myai/scenarios/*.json** - Példa scenario-k

---

*Verzió: 1.0*
*Utolsó frissítés: 2026-02-06*
*Készítette: Claude + Brunella Agent System*
