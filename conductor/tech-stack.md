# Technológiai Stack: Cogella Core (BAS)

## Core Backend
- **Nyelv:** TypeScript (Node.js runtime)
- **Szerver keretrendszer:** Express
- **Protokoll:** Model Context Protocol (MCP SDK v1.0.0)
- **Real-time kommunikáció:** Socket.io

## Adattárolás és Tudásbázis
- **Vektoros Adatbázis:** LanceDB (RAG implementációhoz)
- **Strukturált Adatbázis:** SQLite (better-sqlite3)

## AI és Kódgenerálás
- **Elsődleges Modellek:**
    - Helyi: Ollama (Gemma 3.4b, Qwen 2.5 Coder - kódolásra optimalizálva)
    - Felhő: Gemini API (kiegészítő hívásokhoz, tervezett Gemini 1.5 Pro integráció)
- **Ügynök Kiegészítők:** Jules, Brunella CLI (Python Typer), Agent Coder, Open Interpreter (OS-level tasks)
- **RAG:** Saját implementáció LanceDB alapon

## Automatizáció és Végrehajtás
- **Kód Interpreter:** Python és Node.js kódvégrehajtás (VM2 / saját sandbox megoldás)
- **Böngésző:** Playwright (Headless navigáció)
- **Integráció:** Google Workspace API-k (GoogleAuth)
- **Logika:** Kód alapú automatizáció (Python scriptek prioritással az n8n helyett/mellett)

## Frontend (Dashboard)
- **Keretrendszer:** React 19 (Vite)
- **Stílus:** Tailwind CSS v4
- **UI komponensek:** Shadcn/UI, Radix UI
- **Kommunikáció:** MCP Client (SSE)

## Fejlesztői Környezet
- **CLI:** Gemini CLI
- **Környezet:** Windows + WSL 2 + Docker
