# Tech Stack: BAS Ecosystem

## Core Infrastruktúra
- **Szerver:** MCP Brunella Core (Node.js 24+, TypeScript) - Moduláris, Dependency Injection alapú architektúra.
- **Globális Hálózat:** Planet Mesh absztrakció, Edge Colonies (Peremhálózat), Singularity Kernel integráció.
- **Automatizálási Platform:** n8n (API-val vezérelve), Langflow (Docker alapú vizuális ágens tervező).
- **Runtime:** Hibrid Node.js & Perzisztens Python Shell.
- **Szolgáltatáskezelés:** Központosított `ServiceRegistry` a modulok közötti tiszta csatolásért és életciklus-kezelésért.
- **Modellek:**
  - *Vezérlés (Local):* llama3.1:8b (Ollama)
  - *Kódgenerálás (Local):* deepseek-coder:6.7b (Ollama), qwen2.5-coder:7b (Ollama), codegemma:7b (Ollama)
  - *Beágyazás (Local):* embeddinggemma:300m (Ollama), nomic-embed-text:latest (Ollama)
  - *Kutatás (Local):* kimi-k2.5:cloud (Ollama), ministral-3:latest (Ollama), mistral:latest (Ollama)
  - *Konverzió (Local):* translategemma:4b (Ollama)
  - *Specifikus Ügynökök (Future):* Finomhangolt modellek (pl. Gemma 3, llama3.2, gemma2) a Vertex AI-ban, ha a keret engedi.

## Adat & Memória
- **Vektor Store:** LanceDB (hibrid, lokális/Python & Node.js írás) - Injektált `RagEngine`-en keresztül kezelve.
- **Adatbázis:** SQLite (better-sqlite3) a tranzakcióknak - Osztály-alapú `DatabaseManager` wrapperrel.
- **Ingestion:** Playwright (böngészés), Python Refiner (zajszűrés), Unstructured.io (PDF), Gemini Vision (OCR).
- **Strukturált Adatkimenet:** Pydantic (Python) a böngésző ügynök (Robotkéz) strukturált JSON kimenetéhez.

## Felhő Integráció (BAS-Bridge)
- **Peremhálózat (Edge):** Cloudflare Workers (Orchestration), R2 (Vektor DB Snapshotok), D1 (Metaadatok).
- **CI/CD & Automatizáció:** GitHub Actions (Self-hosted runner a lokális szkriptek futtatásához).
- **GCP (Jövőbeli):** Cloud Run (Backend), Firestore (NoSQL), BigQuery (Analitika).
- **Security:** Secret Manager, Cloudflare Access, GitHub Secrets.

## Monitoring & Healing
- **Logging:** Strukturált JSON logging minden szinten.
- **Audit & Telemetria:** LangSmith (telemetria, tracing, költségfigyelés) / Custom Ops Agent dashboard.