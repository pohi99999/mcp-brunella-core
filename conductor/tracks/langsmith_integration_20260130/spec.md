# Specifikáció: LangSmith Tracing & Observability

## 1. Áttekintés
A BAS (Brunella Agent System) átláthatóságának növelése érdekében integráljuk a LangSmith platformot. Ez lehetővé teszi a teljes ügynök-láncolat (Node.js orchestrator -> Python worker) monitorozását, a hibák gyorsabb feltárását és a promptok optimalizálását.

## 2. Technikai Követelmények

### 2.1 Környezeti változók (.env)
A rendszernek támogatnia kell a következő kulcsokat:
- `LANGCHAIN_TRACING_V2=true`
- `LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"`
- `LANGCHAIN_API_KEY="<user_api_key>"`
- `LANGCHAIN_PROJECT="brunella-core"`

### 2.2 Node.js Integráció (src/)
- A `LangChain` alapú hívásoknál (ha van ilyen) automatikus tracing.
- Egyedi `run` és `agent_delegate` műveletek manuális trace-elése a `langsmith` SDK-val.

### 2.3 Python Integráció (myai/)
- A `langsmith` Python csomag telepítése.
- A `myai/core/agent.py` osztály dekorálása a `@traceable` dekorátorral.
- Minden `execute` hívás naplózása a LangSmith-be a bemeneti paraméterekkel és a model válaszával.

## 3. Elfogadási Kritériumok
- [ ] A `.env` fájl kiegészítve a LangSmith kulcsokkal (LANGCHAIN_API_KEY, LANGCHAIN_TRACING_V2=true).
- [x] Python traceable dekorátor a `myai/core/agent.py`-ban (2026-02-02).
- [x] Node.js LangSmith traceable wrapper a `src/core/llm_client.ts`-ben.
- [ ] Egy ügynök hívás (pl. `project_organizer`) után megjelenik a trace a LangSmith Dashboardon (LANGCHAIN_API_KEY beállítva esetén).
