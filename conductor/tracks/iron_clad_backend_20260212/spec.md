\# Track: Iron Clad Python AI Backend



\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* MEDIUM (Architectural Shift)

\*\*Status:\*\* PROPOSED



\## 🎯 Célkitűzés

Egy egységes, skálázható Python alapú AI backend létrehozása FastAPI, LiteLLM és vLLM alapokon. Ez szolgál majd a rendszer "agyaként", leváltva az ad-hoc megoldásokat, és integrálva a LangGraph orchestrációt és az OpenInterpreter végrehajtást.



\## 🛠️ Stack

\- \*\*Framework:\*\* FastAPI

\- \*\*Gateway:\*\* LiteLLM (Unified API)

\- \*\*Inference:\*\* vLLM (Local GPU accel)

\- \*\*Orchestration:\*\* LangGraph

\- \*\*Execution:\*\* OpenInterpreter / OpenDevin



\## 📅 Megvalósítási Terv (Phases)



\### Phase 1: FastAPI + LiteLLM Gateway (Az Alap)

Minden modell (lokális és cloud) egyetlen API mögé terelése.



1\.  \*\*Service Setup:\*\*

&nbsp;   - Új Python service létrehozása: `myai/backend/`

&nbsp;   - FastAPI app inicializálása.

&nbsp;   - Docker container előkészítése (ha szükséges).

2\.  \*\*LiteLLM Integráció:\*\*

&nbsp;   - Endpointok: `/chat/completions`, `/models`.

&nbsp;   - Konfiguráció: Ollama modellek, OpenAI/DeepSeek kulcsok bekötése.

&nbsp;   - Cél: Minden kliens (CLI, Dashboard) ezt hívja majd.



\### Phase 2: vLLM High-Performance Inference (A Motor)

A lokális modellek sebességének maximalizálása (RTX 3060 specifikus).



1\.  \*\*vLLM Service:\*\*

&nbsp;   - Külön GPU-accelerated service setup.

&nbsp;   - Paged Attention konfiguráció a nagyobb kontextushoz.

2\.  \*\*LiteLLM Provider bekötés:\*\*

&nbsp;   - A LiteLLM-ben a vLLM-et mint `openai\_compatible` providert felvenni.

&nbsp;   - Stratégia: Kicsi modellek -> Ollama, Nagy modellek/Agentek -> vLLM.



\### Phase 3: LangGraph Orchestration (Az Agy)

Állapotgépes multi-agent logika implementálása.



1\.  \*\*Adapter Réteg:\*\*

&nbsp;   - LangGraph LLM client → FastAPI Gateway hívás.

2\.  \*\*Alap Agentek:\*\*

&nbsp;   - \*\*Supervisor Agent:\*\* Döntéshozó.

&nbsp;   - \*\*Diagnosztika Agent:\*\* Log elemző.

&nbsp;   - \*\*Javító Agent:\*\* Javaslattevő.

3\.  \*\*Állapotgép:\*\*

&nbsp;   - Gráf definíciója (Nodes \& Edges).

&nbsp;   - Perzisztencia (Checkpointing).



\### Phase 4: OpenInterpreter 2.0 (A Kezek)

A tényleges végrehajtó réteg integrálása (Shell, Python).



1\.  \*\*Service Integráció:\*\*

&nbsp;   - OpenInterpreter futtatása lokális service-ként vagy könyvtárként.

&nbsp;   - Sandbox / Biztonsági határok beállítása.

2\.  \*\*LangGraph Tool Node:\*\*

&nbsp;   - Az OpenInterpreter bekötése mint "Tool" a LangGraph-ba.

&nbsp;   - PowerShell script futtatási képesség biztosítása.



\### Phase 5: OpenDevin (A Fejlesztő)

A "Meta-fejlesztő" réteg.



1\.  \*\*Setup:\*\*

&nbsp;   - OpenDevin konfigurálása, hogy a saját FastAPI gateway-ünket használja.

2\.  \*\*Tooling:\*\*

&nbsp;   - Git, CLI, Fájlrendszer hozzáférés megadása.

&nbsp;   - Feladat: A rendszer saját kódjának refaktorálása ezen keresztül.



\## ✅ Definition of Done

\- \[ ] FastAPI szerver fut és válaszol OpenAI kompatibilis formátumban.

\- \[ ] vLLM sikeresen fut GPU-n és gyorsabb, mint a sima Ollama.

\- \[ ] LangGraph képes egy több lépéses folyamatot (Diagnosztika -> Terv -> Végrehajtás) levezényelni.

\- \[ ] OpenInterpreter képes biztonságosan parancsokat futtatni a host gépen.

