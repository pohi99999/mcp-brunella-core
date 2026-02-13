import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# Workspace root: always resolves to the project root regardless of cwd
WORKSPACE_ROOT = Path(os.getenv("BRUNELLA_WORKSPACE_ROOT", str(Path(__file__).resolve().parent.parent)))

PROJECT_IGNORE = [
    ".git",
    ".idea",
    ".vscode",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "venv",
]
