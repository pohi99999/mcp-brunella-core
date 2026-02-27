# Design Document: Windows Automation Bridge (WAB)

**Dátum:** 2026-02-26
**Státusz:** Validált (Brainstorming Complete)
**Cél:** Teljes körű Windows-automatizáció biztosítása a BAS számára egy natív Python/PowerShell hídon keresztül.

## 1. Architektúra és Projektstruktúra

A WAB egy független, natív Python szolgáltatásként működik a gazdagépen, elkülönítve a meglévő `myai` alrendszertől.

**Mappa struktúra:**
```text
windows_bridge/
├── .venv/              # Izolált Python környezet
├── main.py             # FastAPI szerver és végpontok
├── requirements.txt    # Függőségek (fastapi, uvicorn, pydantic)
├── run_bridge.bat      # Gyorsindító script a Windows-hoz
└── tests/              # PowerShell hívásokat tesztelő scriptek
```

## 2. Adatfolyam és MCP Integráció

A Brunella központi egysége (Node.js) egy MCP HTTP bridge-en keresztül kommunikál a WAB szerverrel.

1. **Input:** Magyar nyelvű utasítás.
2. **Orkesztráció:** Az MCP kliens meghívja a `windows_automation_bridge` eszközt.
3. **Bridge:** HTTP POST kérés a `http://127.0.0.1:8765` címre.
4. **Végrehajtás:** Python -> PowerShell (pwsh) subprocess hívás.
5. **Visszacsatolás:** Strukturált JSON válasz az ügynöknek.

## 3. Fő Funkciók és Végpontok

### `/ps/execute` (POST)
Tetszőleges PowerShell parancsok futtatása. Ideális komplex szkriptekhez vagy speciális rendszerbeállításokhoz.

### `/fs` (POST)
Strukturált fájlműveletek:
- `list`: Könyvtár tartalmának listázása (JSON kimenettel).
- `move`: Fájl/mappa áthelyezése.
- `copy`: Másolás.
- `delete`: Rekurzív törlés.
- `mkdir`: Mappa létrehozása (idempotens módon).

### `/communication` (POST) - Későbbi bővítés
Email és naptár kezelés a `Microsoft.Graph` PowerShell modul segítségével.

## 4. Biztonság és Audit

- **Hálózati izoláció:** Csak a `127.0.0.1` (localhost) interfészen fogad kéréseket.
- **Audit Logging:** Minden végrehajtott parancs, annak időbélyege és eredménye naplózásra kerül a `logs/wab_audit.log` fájlba.
- **Timeout:** 300 másodperces hard limit minden hívásra.

## 5. BAS Integráció

Az ügynökök számára dedikált system prompt biztosítja a magyar nyelvű utasítások helyes leképezését a WAB eszközeire.

---
*Ez a dokumentum a brainstorming folyamat eredménye, az implementáció alapjául szolgál.*
