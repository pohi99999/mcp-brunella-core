# 🐍 Python Subsystem (myai) - SUMMARY

Ez a mappa tartalmazza a Brunella MI-specifikus Python alrendszerét, amely a nehéz elemzésekért, az ágensek kiegészítő logikájáért és a sandboxingért felel.

## 🗂️ Struktúra
- **`core/`**: Az alrendszer magja (agent, llm, project, sandbox, tools alaposztályok).
- **`agents/`**: TOML alapú dinamikus ügynökök és specializált promptok helye.
- **`tests/`**: Pytest alapú egységtesztek a Python modulokhoz.
- **`sandbox_env/`**: Izolált környezet a kódvégrehajtáshoz.

## 🛠️ Kulcsfájlok
- `server.py`: FastAPI alapú MCP szerver a Python funkciók kiszolgálásához.
- `cli.py`: A Python ügynökök közvetlen elérésére szolgáló CLI.
- `refiner_logic.py`: Az adatfeldolgozó (Refiner) ügynök fő logikája.
- `requirements.txt`: Python függőségek listája.

---
*Készítette: Project Organizer ügynök*
