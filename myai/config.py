import os
from dotenv import load_dotenv

load_dotenv()

DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

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
