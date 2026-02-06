# 🤖 Robotkéz (Browser-Use) - Teljes Setup & Használati Útmutató

**Verzió:** 1.0
**Dátum:** 2026-02-06
**Cél:** Automatikus böngésző vezérlés beállításokhoz, monitoring-hoz, teszteléshez

---

## ⚡ Gyors Start (10 perc)

### 1. Függőségek Telepítése

A projekt gyökeréből:

```bash
# Függőségek telepítése a különálló requirements fájlból
uv pip install -r myai/requirements.txt
# Vagy manuálisan:
uv pip install browser-use playwright httpx asyncio langchain-google-genai python-dotenv

# Playwright böngésző telepítése
python -m playwright install chromium
```

### 2. Környezeti Változók

Győződj meg róla, hogy a `.env` fájl tartalmazza a következőket:
```
GEMINI_API_KEY=...
```

### 3. Szerver Indítása

```bash
cd myai
uvicorn server:app --reload --port 8000
```
Ellenőrzés: `curl http://localhost:8000/health`
Várható válasz: `{"status": "ok", "browser_use": "available"}`

---

## 🧪 Tesztelés (3 Szint)

### Level 1: Alapvető Navigáció
```bash
python scripts/robotkez_test_level1.py
```
*Mit tesz:* Google keresés, Screenshot, GitHub trending repos kinyerés.

### Level 2: n8n Workflow Management
```bash
python scripts/robotkez_test_level2_n8n.py
```
*Mit tesz:* n8n bejelentkezés, workflow létrehozás és listázás.

### Level 3: Website Monitoring
```bash
python scripts/robotkez_test_level3_monitoring.py
```
*Mit tesz:* Weboldalak elérhetőségének ellenőrzése.

---

## 💼 Használati Esetek (CLI)

Használd a `scripts/robotkez_cli.py` eszközt gyors feladatokhoz:

```bash
# Google keresés
python scripts/robotkez_cli.py search "Python async tutorial"

# Weboldal megnyitás + screenshot
python scripts/robotkez_cli.py go https://github.com

# n8n login
python scripts/robotkez_cli.py n8n login

# Teljes teszt futtatása
python scripts/robotkez_cli.py test
```

## 📋 További Szkriptek

- `scripts/monitor_loop.py`: Folyamatos monitoring (10 percenként).
- `scripts/cloudflare_check_workers.py`: Cloudflare Workers állapotának lekérdezése.

---
