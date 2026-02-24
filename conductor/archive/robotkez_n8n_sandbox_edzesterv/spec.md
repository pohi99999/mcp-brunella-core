# Specifikáció: Robotkéz n8n Sandbox és Edzésterv

## 1. Áttekintés

A Robotkéz számára izolált n8n sandbox és automatizált edzésterv. **Két mód:** API (REST, gyors) és Browser-Use (UI, opcionális).

---

## 2. Technikai Követelmények

### 2.1 n8n Sandbox
- **Docker:** n8nio/n8n:latest, port 5678 (docker-compose.yml)
- **Auth:** N8N_BASIC_AUTH_ACTIVE, N8N_TEST_USER, N8N_TEST_PASSWORD
- **Volumes:** n8n_data perzisztens adat

### 2.2 API mód (primary)
- **Környezet:** N8N_API_KEY, N8N_TEST_URL
- **Scenario lépések:** create_workflow, rename_workflow
- **browser_worker.py:** `run_n8n_api_scenario()` – REST API hívások

### 2.3 Browser-Use mód (opcionális) ✅ implementálva
- **Környezet:** N8N_TEST_USER, N8N_TEST_PASSWORD, GOOGLE_API_KEY (Gemini)
- **Modell:** gemini-1.5-flash (magasabb free tier kvóta, olcsóbb fizetős)
- **Scenario:** n8n_training_ui.json – login, **dismiss_onboarding** (ha felugrik „Milyen területen dolgozol?”), click, rename_workflow, save
- **Task utasítás:** Felugró ablakok kezelése (Skip/Close/opció választás) mielőtt továbblép
- **Függőségek:** browser-use
- **Futtatás:** `python myai/browser_worker.py myai/scenarios/n8n_training_ui.json`

### 2.4 Integráció
- **.env:** N8N_TEST_USER, N8N_TEST_PASSWORD, N8N_TEST_URL, N8N_API_KEY (API módhoz)
- **validateSecrets.ts:** n8n változók (opcionális ellenőrzés)
- **docs/n8n-setup.md:** mindkét mód dokumentálva

---

## 3. Kapcsolódó Tracks

- **browser_use_harvester_20260131** – Strukturált JSON kimenet
- **bas_scale_up_stabilization_20260131** – Zone III (Robotkéz Pydantic)

---

## 4. Elfogadási Kritériumok

- [x] docs/n8n-setup.md létrehozva, API + Browser-Use módok dokumentálva
- [x] myai/scenarios/n8n_training.json létrehozva (API lépések)
- [x] browser_worker.py API scenario mód implementálva
- [x] docker-compose n8n-sandbox szerviz
- [x] test/n8n_automation.test.ts
- [x] Browser-Use UI mód: run_n8n_scenario_ui, n8n_training_ui.json
- [x] Onboarding popup kezelés: dismiss_onboarding lépés, task utasítás
- [x] Gemini 1.5 Flash modell (kvóta/költség optimalizálás)
