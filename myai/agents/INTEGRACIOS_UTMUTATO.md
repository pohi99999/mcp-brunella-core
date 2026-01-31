# Proaktív Kódíró Ügynök - Integrációs Útmutató

## 🎯 Cél

Egy proaktív helyi kódíró és rendszerező aszisztens ügynök létrehozása, aki:
- ✅ Chat felületen kommunikál (ADK Web UI)
- ✅ Projektjeid kezelésében részt vesz
- ✅ Proaktív (nem csak reagál, hanem aktívan segít)
- ✅ Fájlkezelés, kódírás, projekt rendszerezés

## 🚀 Gyors Integráció - agents-chat Módosítása

A legegyszerűbb módja, hogy a meglévő `agents-chat`-et módosítod és hozzáadod a fájlkezelési eszközöket.

### 1. Fájlok Hozzáadása

A következő fájlok már létre lettek hozva:
- ✅ `app/file_tools.py` - Fájlkezelési eszközök
- ✅ `app/coding_assistant_agent.py` - Egyszerű kódíró ügynök

### 2. Opció A: Új Ügynök Hozzáadása (Ajánlott)

Módosítsd az `app/agent.py` fájlt, hogy tartalmazza a kódíró ügynököt is:

```python
# app/agent.py végére add hozzá:

from .coding_assistant_agent import get_coding_assistant_agent

# Választható: Hozzáadhatod a root_agent-hez mint sub-agent
# Vagy használhatod önállóan

coding_assistant = get_coding_assistant_agent(workspace_root="G:\\Brunella")
```

### 3. Opció B: Önálló Ügynök Indítása

Indítsd el a kódíró ügynököt önállóan:

```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
$env:WORKSPACE_ROOT="G:\Brunella"
uv run python -m app.coding_assistant_agent
# Vagy: uv run adk web app.coding_assistant_agent --port=8504
```

### 4. Opció C: Integráció a Meglévő Ügynökhöz

Ha a meglévő research ügynökhöz is hozzá szeretnéd adni a fájlkezelést:

```python
# app/agent.py - interactive_planner_agent módosítása

from .file_tools import get_file_management_tools

# Add file tools to the interactive planner
file_tools = get_file_management_tools(workspace_root="G:\\Brunella")
interactive_planner_agent.tools.extend(file_tools)
```

## 🛠️ Elérhető Eszközök

### Fájlkezelés
- `read_file` - Fájlok olvasása
- `write_file` - Fájlok írása (append vagy overwrite)
- `list_directory` - Könyvtárak listázása (rekurzív, szűrés típus szerint)
- `create_directory` - Könyvtárak létrehozása
- `search_files` - Fájlok keresése név vagy tartalom alapján

### Git Műveletek
- `git_status` - Git státusz ellenőrzése
- `git_commit` - Git commit létrehozása

## 💡 Proaktív Funkciók Implementálása

### 1. Projekt Monitoring

Az ügynök rendszeresen ellenőrizheti a projektet:

```python
from google.adk.events import Event, EventActions
import asyncio

async def monitor_project(agent: LlmAgent):
    """Proactively monitor project and suggest improvements."""
    while True:
        # Check for uncommitted changes
        status_result = await git_status_tool().func(GitStatusInput())
        
        if "Changes not staged" in status_result:
            # Proactively suggest committing
            await agent.send_event(Event(
                action=EventActions.SUGGEST,
                content="I noticed uncommitted changes. Would you like me to help organize and commit them?",
            ))
        
        await asyncio.sleep(300)  # Check every 5 minutes
```

### 2. Chat Interface

Az ADK Web UI automatikusan elérhető:

```powershell
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agents-chat"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
$env:WORKSPACE_ROOT="G:\Brunella"
uv run adk web app.coding_assistant_agent --port=8504
```

**URL**: http://localhost:8504

## 📋 Használati Példák

### Chat felületen keresztül:

1. **"Olvasd be a README.md fájlt"**
   - Az ügynök használja a `read_file` eszközt

2. **"Hozz létre egy új fájlt: test.py"**
   - Az ügynök használja a `write_file` eszközt

3. **"Listázd ki a projekt fájljait"**
   - Az ügynök használja a `list_directory` eszközt

4. **"Keresd meg az összes Python fájlt"**
   - Az ügynök használja a `search_files` eszközt

5. **"Milyen változások vannak a git-ben?"**
   - Az ügynök használja a `git_status` eszközt

## 🔧 Testreszabás

### Workspace Root Módosítása

```python
# Módosítsd a workspace_root-ot
agent = get_coding_assistant_agent(workspace_root="G:\\Brunella\\MyProject")
```

### További Eszközök Hozzáadása

Hozzáadhatsz további eszközöket a `file_tools.py` fájlhoz, például:
- Kód formázás (black, ruff)
- Teszt futtatás
- Dokumentáció generálás
- Stb.

## 📚 További Források

- **Agent Starter Pack**: Új projekt létrehozásához
- **ADK Dokumentáció**: https://google.github.io/adk-docs/
- **Példa eszközök**: `coding-assistant-tools-example.py`

---

*Ez az útmutató segít integrálni a fájlkezelési eszközöket a meglévő agents-chat rendszerbe.*


