# n8n Sandbox Telepítési Útmutató (Robotkéz Edzőterem)

## 1. Docker Setup
Futtasd az alábbi parancsot egy elkülönített könyvtárban vagy add a meglévő `docker-compose.yml`-hez:

```yaml
services:
  n8n-sandbox:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_TEST_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_TEST_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
```

## 2. Elérhetőség
- **Lokális Docker:** http://localhost:5678
- **Docker hálózaton belül:** ha a worker is konténerben fut, használd a szerviznevet: `http://n8n-sandbox:5678`

## 3. Működési Módok

### 3.1 API mód (ajánlott – gyors, megbízható)
- **Környezeti változók:** `N8N_API_KEY`, `N8N_TEST_URL`
- **n8n Cloud / self-hosted:** API kulcs szükséges (Settings → API)
- **Használat:** `python myai/browser_worker.py` – a scenario `create_workflow`, `rename_workflow` lépéseit REST API-n végzi

### 3.2 Browser-Use mód (opcionális – UI edzés)

**Ellenőrzés API kulcs nélkül:** `python myai/browser_worker.py myai/scenarios/n8n_training_ui.json --check`

---
- **Környezeti változók:** `N8N_TEST_USER`, `N8N_TEST_PASSWORD`, `GOOGLE_API_KEY` (Gemini)
- **Függőségek:** `pip install browser-use` (+ `uv run browser-use install` Chromium-hoz)
- **Scenario:** `myai/scenarios/n8n_training_ui.json` – login, onboarding popup kezelése (ha van), click, rename, save
- **Használat:**
  ```bash
  python myai/browser_worker.py myai/scenarios/n8n_training_ui.json
  # vagy kényszerített mód: python myai/browser_worker.py ... ui
  ```

### 3.3 Hibaelhárítás (Browser-Use)

- **Onboarding popup:** Az n8n első belépéskor megjelenhet egy „Milyen területen dolgozol?” felugró ablak. A scenario ezt kezeli – válassz egy opciót (pl. Other) vagy Skip, majd folytatja a Create Workflow lépést.
- **Böngésző bezáródik:** Ha a popup nem lett kezelve, az ügynök időtúllépés miatt bezárhatja a böngészőt. A frissített scenario és task leírás ezt most már kezeli.

---

## 4. Kapcsolódó dokumentáció

- **Strukturált JSON Harvester:** `docs/harvester-structured-json.md` – Pydantic séma vezérelt adatkinyerés weboldalakról (álláshirdetések, hírek, termékek).
