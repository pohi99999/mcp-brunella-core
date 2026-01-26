# Implementation Plan - Vertex AI Integráció (LLM Provider)

## Phase 1: Setup
- [x] Task: Dependency Installation
    - [x] Telepítsd a szükséges csomagokat: `pip install google-cloud-aiplatform`.
    - [x] Frissítsd a `requirements.txt`-t.
- [x] Task: Configuration
    - [x] Ellenőrizd a `credentials.json` meglétét (ADC-hez).
    - [x] Hozz létre egy `.env` példát vagy dokumentációt a `PROJECT_ID` beállításához.

## Phase 2: Implementation
- [ ] Task: Create Server File
    - [ ] Hozz létre egy `src/servers/vertex_ai.py` fájlt.
    - [ ] Inicializáld a FastMCP szervert és a Vertex AI SDK-t (`aiplatform.init`).
- [ ] Task: Implement Tools
    - [ ] Implementáld a `vertex_generate_content` eszközt.
    - [ ] Implementáld a `vertex_list_models` eszközt.

## Phase 3: Integration & Testing
- [ ] Task: Manual Testing
    - [ ] Hozz létre egy teszt scriptet (`test_vertex_ai.py`) a generálás ellenőrzésére.
- [ ] Task: E2E Integration
    - [ ] Add hozzá a Vertex AI szervert az `e2e_runner.ts` tesztjeihez.
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md`-t és az `INTEGRATION_PLAN.md`-t.
