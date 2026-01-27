# Specification: Vertex AI Integráció (LLM Provider)

## 1. Overview
Ez a track a Google Vertex AI szolgáltatás integrálását célozza, hogy a rendszer hozzáférhessen a legújabb Gemini modellekhez (pl. Gemini 1.5 Pro/Flash). A megoldás egy új Python alapú MCP szerver modult (`src/servers/vertex_ai.py`) hoz létre, amely `fastmcp`-t használ.

## 2. Goals
- Vertex AI Python SDK integrálása.
- Hitelesítés kezelése (a meglévő `google_auth` modul kiterjesztése vagy `ADC` - Application Default Credentials használata).
- MCP eszközök implementálása:
    - `vertex_generate_content`: Szöveggenerálás Gemini modellel.
    - `vertex_list_models`: Elérhető modellek listázása (opcionális).

## 3. Requirements
- **Dependencies:** `google-cloud-aiplatform`.
- **Configuration:**
    - `PROJECT_ID` és `LOCATION` (pl. `us-central1`) beállítása környezeti változókból vagy config fájlból.
- **MCP Server:**
    - A szervernek `stdio` módban kell futnia a Node.js integrációhoz.
- **Functionality:**
    - A `vertex_generate_content` eszköznek fogadnia kell a promptot és opcionálisan a modell nevét.

## 4. Out of Scope
- Multimodális bemenet (kép/videó küldése) az első fázisban (bár a Gemini képes rá).
- Fine-tuning vagy modell training.
