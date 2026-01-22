# Technológiai Stack: Cogella Core (BAS)

## 1. Core Backend
- **Nyelv:** TypeScript (Node.js runtime)
- **Framework:** Express 5.x
- **Protokoll:** Model Context Protocol (MCP SDK v1.0.0)
- **Kommunikáció:** Socket.io (Real-time)

## 2. Frontend (Dashboard)
- **Framework:** React 19 + Vite
- **UI/UX:** Tailwind CSS + Radix UI (Shadcn/UI design system)
- **State Management:** Zustand (Global), React Context (Local)
- **API Híd:** Socket.io-client + Native Fetch

## 3. Adattárolás & Tudásbázis
- **Vektoradatbázis:** LanceDB (RAG engine)
- **Relációs Adatbázis:** SQLite (`better-sqlite3`)

## 4. AI & Kódgenerálás
- **Helyi Modellek (On-Premise):**
    - `ollama` (Gemma 3.4b, Qwen 2.5 Coder)
- **Felhő Modellek:**
    - Gemini API v1.5 Pro
- **Kiegészítők:** Jules, Agent Coder

## 5. Automatizáció & Környezet
- **Sandbox:** Egyedi megoldás / VM2 (Node.js & Python isolation)
- **Browser Automation:** Playwright (Headless/Headed)
- **Integrációk:** Google Workspace API
- **Scripting:** Python (Elsődleges) + Node.js

## 6. Fejlesztési Eszközök
- **CLI:** Gemini CLI / Brunella CLI
- **OS:** Windows + WSL 2 (Ubuntu)
- **Container:** Docker (opcionális)
