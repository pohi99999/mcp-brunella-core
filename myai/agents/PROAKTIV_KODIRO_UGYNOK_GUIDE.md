# Proaktív Helyi Kódíró és Rendszerező Aszisztens Ügynök

## 🎯 Cél

Egy proaktív helyi kódíró és rendszerező aszisztens ügynök létrehozása, aki:
- ✅ Chat felületen kommunikál (ADK Web UI)
- ✅ Projektjeid kezelésében részt vesz
- ✅ Proaktív (nem csak reagál, hanem aktívan segít)
- ✅ Fájlkezelés, kódírás, projekt rendszerezés

## 🚀 Gyors Indítás - Agent Starter Pack

Az **Agent Starter Pack** segítségével percek alatt létrehozhatsz egy saját ügynököt:

### 1. Új Ügynök Projekt Létrehozása

```powershell
# Agent Starter Pack telepítése
uvx agent-starter-pack create my-coding-assistant

# Vagy ha már van uv környezet
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agent-starter-pack"
uv run agent-starter-pack create my-coding-assistant -p -s -y -d agent_engine --output-dir target
```

**Parancs opciók:**
- `-p` / `--prototype`: Minimális projekt (gyors prototípus)
- `-s` / `--skip-checks`: GCP ellenőrzések kihagyása
- `-y` / `--auto-approve`: Automatikus jóváhagyás
- `-d agent_engine`: Deployment target (vagy `cloud_run` lokális futtatáshoz)

### 2. Ügynök Típus Választása

Az Agent Starter Pack több sablont kínál:
- **`adk_base`** - Alap ReAct ügynök (ajánlott kezdéshez)
- **`adk_a2a_base`** - A2A protokoll támogatással
- **`agentic_rag`** - RAG ügynök dokumentumokhoz
- **`adk_live`** - Valós idejű multimodális ügynök

**Ajánlott:** `adk_base` - ez a legegyszerűbb és legjobb kiindulási pont.

## 🛠️ Egyedi Eszközök (Tools) Hozzáadása

A proaktív kódíró ügynökhöz hozzá kell adni fájlkezelési és projektkezelési eszközöket.

### Példa: Fájlkezelési Eszközök

Hozz létre egy `tools.py` fájlt az ügynök projektben:

```python
from pathlib import Path
from typing import Optional
from google.adk.tools import Tool
from pydantic import BaseModel, Field

class ReadFileInput(BaseModel):
    """Input for reading a file."""
    file_path: str = Field(description="Path to the file to read")

class WriteFileInput(BaseModel):
    """Input for writing to a file."""
    file_path: str = Field(description="Path to the file to write")
    content: str = Field(description="Content to write to the file")
    append: bool = Field(default=False, description="Append to file if True, overwrite if False")

class ListDirectoryInput(BaseModel):
    """Input for listing directory contents."""
    directory_path: str = Field(description="Path to the directory to list")
    recursive: bool = Field(default=False, description="List recursively if True")

def read_file_tool(workspace_root: str = ".") -> Tool:
    """Tool for reading files from the workspace."""
    async def read_file(input: ReadFileInput) -> str:
        file_path = Path(workspace_root) / input.file_path
        if not file_path.exists():
            return f"Error: File {input.file_path} does not exist"
        if not file_path.is_file():
            return f"Error: {input.file_path} is not a file"
        try:
            return file_path.read_text(encoding="utf-8")
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    return Tool(
        name="read_file",
        description="Read the contents of a file from the workspace",
        input_type=ReadFileInput,
        func=read_file,
    )

def write_file_tool(workspace_root: str = ".") -> Tool:
    """Tool for writing files to the workspace."""
    async def write_file(input: WriteFileInput) -> str:
        file_path = Path(workspace_root) / input.file_path
        try:
            # Create parent directories if they don't exist
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            if input.append:
                with file_path.open("a", encoding="utf-8") as f:
                    f.write(input.content)
                return f"Appended content to {input.file_path}"
            else:
                file_path.write_text(input.content, encoding="utf-8")
                return f"Written content to {input.file_path}"
        except Exception as e:
            return f"Error writing file: {str(e)}"
    
    return Tool(
        name="write_file",
        description="Write content to a file in the workspace. Can append or overwrite.",
        input_type=WriteFileInput,
        func=write_file,
    )

def list_directory_tool(workspace_root: str = ".") -> Tool:
    """Tool for listing directory contents."""
    async def list_directory(input: ListDirectoryInput) -> str:
        dir_path = Path(workspace_root) / input.directory_path
        if not dir_path.exists():
            return f"Error: Directory {input.directory_path} does not exist"
        if not dir_path.is_dir():
            return f"Error: {input.directory_path} is not a directory"
        
        try:
            if input.recursive:
                files = []
                for item in dir_path.rglob("*"):
                    files.append(str(item.relative_to(workspace_root)))
                return "\n".join(sorted(files))
            else:
                items = [item.name for item in dir_path.iterdir()]
                return "\n".join(sorted(items))
        except Exception as e:
            return f"Error listing directory: {str(e)}"
    
    return Tool(
        name="list_directory",
        description="List contents of a directory. Can list recursively.",
        input_type=ListDirectoryInput,
        func=list_directory,
    )
```

### Példa: Git Eszközök (Proaktív Projektkezelés)

```python
import subprocess
from pathlib import Path
from google.adk.tools import Tool
from pydantic import BaseModel, Field

class GitStatusInput(BaseModel):
    """Input for checking git status."""
    repo_path: str = Field(default=".", description="Path to the git repository")

class GitCommitInput(BaseModel):
    """Input for creating a git commit."""
    repo_path: str = Field(default=".", description="Path to the git repository")
    message: str = Field(description="Commit message")
    files: Optional[list[str]] = Field(default=None, description="Specific files to commit (None = all)")

def git_status_tool() -> Tool:
    """Tool for checking git status."""
    async def git_status(input: GitStatusInput) -> str:
        repo_path = Path(input.repo_path)
        try:
            result = subprocess.run(
                ["git", "status", "--short"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return result.stdout if result.stdout else "No changes"
            return f"Error: {result.stderr}"
        except Exception as e:
            return f"Error checking git status: {str(e)}"
    
    return Tool(
        name="git_status",
        description="Check git status of the repository",
        input_type=GitStatusInput,
        func=git_status,
    )
```

## 📝 Ügynök Konfiguráció

Az ügynök fő fájlja (`agent.py` vagy `app.py`):

```python
from google.adk.agents import LlmAgent
from google.adk.apps.app import App
from google.genai import types as genai_types

# Import your custom tools
from .tools import read_file_tool, write_file_tool, list_directory_tool, git_status_tool

def get_agent(workspace_root: str = ".") -> LlmAgent:
    """Create the coding assistant agent with file management tools."""
    
    # Create tools
    tools = [
        read_file_tool(workspace_root),
        write_file_tool(workspace_root),
        list_directory_tool(workspace_root),
        git_status_tool(),
    ]
    
    # Create agent with tools
    agent = LlmAgent(
        model="gemini-2.0-flash-exp",
        tools=tools,
        system_instruction="""You are a proactive coding assistant that helps manage and organize projects.

Your capabilities:
- Read and write files
- Organize project structure
- Suggest improvements
- Help with code organization
- Proactively identify issues and suggest fixes

Be helpful, proactive, and always ask before making significant changes.""",
    )
    
    return agent

def create_app() -> App:
    """Create the ADK app."""
    app = App()
    app.agent = get_agent(workspace_root=".")
    return app
```

## 🎨 Proaktív Funkciók Implementálása

### 1. Projekt Monitoring (Proaktív Észlelés)

Az ügynök rendszeresen ellenőrizheti a projektet és proaktívan jelezhet problémákat:

```python
from google.adk.events import Event, EventActions
import asyncio

async def monitor_project(agent: LlmAgent, workspace_root: str = "."):
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
        
        # Check for TODO comments
        # Check for code quality issues
        # Check for missing documentation
        
        await asyncio.sleep(300)  # Check every 5 minutes
```

### 2. Chat Interface Integráció

Az ADK Web UI automatikusan elérhető:

```powershell
# Ügynök indítása ADK Web UI-val
cd "my-coding-assistant"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
uv run adk web --port=8504
```

**URL**: http://localhost:8504

## 🔧 Integráció a Meglévő Projektekkel

### Opció 1: Új Ügynök Projekt (Ajánlott)

1. Hozz létre egy új ügynök projektet az Agent Starter Pack-kel
2. Add hozzá a fájlkezelési eszközöket
3. Konfiguráld a workspace root-ot a projektjeid könyvtárára

### Opció 2: Meglévő Ügynök Módosítása

Ha már van egy ügynök (pl. `agents-chat`), hozzáadhatsz fájlkezelési eszközöket:

```python
# agents-chat/app/agent.py módosítása
from .tools import read_file_tool, write_file_tool

# Add tools to existing agent
agent.tools.extend([
    read_file_tool(workspace_root="G:\\Brunella"),
    write_file_tool(workspace_root="G:\\Brunella"),
])
```

## 📋 Teljes Példa Projekt Struktúra

```
my-coding-assistant/
├── app/
│   ├── agent.py          # Fő ügynök logika
│   ├── tools.py          # Egyedi eszközök (fájlkezelés, git, stb.)
│   └── config.py         # Konfiguráció
├── pyproject.toml        # Projekt függőségek
├── .env                  # API kulcs (NEM commitolni!)
└── README.md
```

## 🚀 Indítási Útmutató

### 1. Projekt Létrehozása

```powershell
# Agent Starter Pack használata
uvx agent-starter-pack create my-coding-assistant -p -s -y -d cloud_run

# Vagy manuálisan
cd "G:\Brunella\[ACTIVE]_Agents\ready-agents\agent-starter-pack"
uv run agent-starter-pack create my-coding-assistant -p -s -y -d cloud_run --output-dir target
```

### 2. Eszközök Hozzáadása

Másold a fájlkezelési eszközöket az `app/tools.py` fájlba.

### 3. Ügynök Konfigurálása

Módosítsd az `app/agent.py` fájlt, hogy használja az új eszközöket.

### 4. Indítás

```powershell
cd "target/my-coding-assistant"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
uv run adk web --port=8504
```

## 💡 Proaktív Funkciók Ötletek

1. **Automatikus Projekt Rendszerezés**
   - Fájlok kategorizálása
   - Hiányzó fájlok észlelése
   - Dokumentáció generálása

2. **Kód Minőség Ellenőrzés**
   - TODO kommentek keresése
   - Duplikált kód észlelése
   - Best practices ellenőrzés

3. **Projekt Struktúra Javaslatok**
   - Mappa struktúra optimalizálás
   - Fájl elnevezési konvenciók
   - Projekt dokumentáció

4. **Git Workflow Segítség**
   - Commit üzenetek generálása
   - Branch stratégia javaslatok
   - Merge conflict kezelés

## 📚 További Források

- **Agent Starter Pack**: https://github.com/GoogleCloudPlatform/agent-starter-pack
- **ADK Dokumentáció**: https://google.github.io/adk-docs/
- **ADK Samples**: `G:\Brunella\[ACTIVE]_Agents\adk-a2a\adk-samples\python\agents\`

## 🎯 Következő Lépések

1. ✅ Hozz létre egy új ügynök projektet az Agent Starter Pack-kel
2. ✅ Add hozzá a fájlkezelési eszközöket
3. ✅ Konfiguráld a workspace root-ot
4. ✅ Teszteld az ADK Web UI-ban
5. ✅ Bővítsd proaktív funkciókkal

---

*Ez az útmutató segít létrehozni egy proaktív helyi kódíró és rendszerező aszisztens ügynököt az ADK-val.*


