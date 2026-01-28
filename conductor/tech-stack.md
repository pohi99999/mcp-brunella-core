# Tech Stack: BAS Ecosystem

## Core Infrastruktúra
- **Szerver:** MCP Brunella Core (Node.js 24+, TypeScript).
- **Runtime:** Hibrid Node.js & Perzisztens Python Shell.
- **Modellek:**
  - *Vezérlés:* GPT-4o / Claude 3.5 / Gemini 1.5 Pro.
  - *Helyi Munka:* Ollama (Llama 3.1, Gemma 3:1b).
  - *Specifikus Ügynökök:* LoRA finomhangolt modellek a Vertex AI-ban.

## Adat & Memória
- **Vektor Store:** LanceDB (helyi) / Qdrant vagy Milvus (skálázott).
- **Adatbázis:** SQLite (better-sqlite3) a tranzakcióknak.
- **Ingestion:** Playwright (böngészés), Python Refiner (zajszűrés), Unstructured.io (PDF).

## Felhő Integráció (BAS-Bridge)
- **GCP:** Cloud Run (Backend), Firestore (NoSQL), BigQuery (Analitika).
- **Security:** Secret Manager, OAuth 2.1, JWT.

## Monitoring & Healing
- **Logging:** Strukturált JSON logging minden szinten.
- **Audit:** LangSmith / Custom Ops Agent dashboard.