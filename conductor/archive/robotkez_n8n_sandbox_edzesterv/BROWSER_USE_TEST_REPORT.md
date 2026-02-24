# Robotkéz n8n – Teszt Riport (2026-02-02)

## API mód ✅ SIKERES

```
Creating new workflow: Robotkez_Teszt_1
Workflow created: Robotkez_Teszt_1 (ID: r6G6gvMRLxOJbr3Z)
Renaming workflow r6G6gvMRLxOJbr3Z to Robotkez_Teszt_1_API
Workflow renamed to: Robotkez_Teszt_1_API
Scenario execution complete via API.
```

- **Feltételek:** N8N_API_KEY, N8N_TEST_URL a .env-ben, n8n fut (docker-compose)
- **Parancs:** `python myai/browser_worker.py myai/scenarios/n8n_training.json`

## Browser-Use UI mód ✅ FRISSÍTVE (2026-02-02)

- **Modell:** gemini-1.5-flash (kvóta/költség optimalizálás)
- **Onboarding kezelés:** Ha az n8n első belépéskor „Milyen területen dolgozol?” felugró ablakot mutat, a scenario `dismiss_onboarding` lépése kezeli (opció választás vagy Skip).
- **Ellenőrzés:** `python myai/browser_worker.py myai/scenarios/n8n_training_ui.json --check`
- **Futtatás:** `python myai/browser_worker.py myai/scenarios/n8n_training_ui.json`

### Ismert problémák
- **Gemini 429:** Free tier limit (5 RPM gemini-2.5-flash) – 1.5-flash-re váltva (magasabb limit).
- **Unicode log:** Windows cp1250 emoji hibák a konzolon – nem befolyásolja a futást.

## --check mód

A `--check` kapcsoló ellenőrzi a beállításokat API kulcs nélkül:
- Scenario fájl létezik és valid
- browser-use importálható
- Szükséges környezeti változók (figyelmeztetés ha hiányzik)
