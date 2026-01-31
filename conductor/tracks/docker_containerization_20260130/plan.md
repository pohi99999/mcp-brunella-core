# Plan: Containerization & Docker Compose

**Track ID:** `docker_containerization_20260130`
**Cél:** A fejlesztői környezet ("Works on my machine") problémáinak megszüntetése és a rendszer hordozhatóvá tétele Docker konténerek segítségével.

## 1. Helyzetkép
- Jelenleg a rendszer a host gépen fut (`npm start`, `start.bat`).
- Függőségek: Node.js 20+, Python 3.14+, Ollama (helyi), AnythingLLM (helyi).
- Környezeti változók: `.env` fájlban.

## 2. Lépések

- [x] **1. Dockerfile.node elkészítése:**
    - Base image: `node:20-alpine`.
    - Build lépések: `npm ci`, `npm run build`.
    - Start command: `npm start`.
- [x] **2. Dockerfile.python elkészítése:**
    - Base image: `python:3.11-slim`.
    - Dependencies: `uv` telepítése, majd `pip install`.
    - Start command: `uvicorn myai.server:app --host 0.0.0.0 --port 8000`.
- [x] **3. docker-compose.yml összeállítása:**
    - Services: `backend`, `ai-worker`.
    - Networks: default bridge.
    - Volumes: `logs/`, `agents.db`.
    - Env vars: `BRUNELLA_PYTHON_API_URL`, `OLLAMA_BASE_URL`.
- [x] **4. Verifikáció:**
    - Fájlok létrehozva (`Dockerfile.node`, `Dockerfile.python`, `docker-compose.yml`).
    - *Megjegyzés: A futtatás validálása deployment környezetben történik.*

## 3. Kockázatok
- Ollama elérése konténerből (`host.docker.internal` Linuxon trükkös lehet).
- Windows fájlrendszer vs Linux konténer útvonalak (`config.workspaceRoot`).