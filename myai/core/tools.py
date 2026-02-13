import os
import json
import subprocess
from typing import Dict, Any, List, Optional
from myai.config import PROJECT_IGNORE, WORKSPACE_ROOT
from .llm import simple_completion


def list_files(root: str = "") -> List[str]:
    """List project files. Uses WORKSPACE_ROOT as base to avoid cwd dependency."""
    if root and os.path.isabs(root):
        effective_root = root
    elif root:
        effective_root = str(WORKSPACE_ROOT / root)
    else:
        effective_root = str(WORKSPACE_ROOT)
    result = []
    for base, dirs, files in os.walk(effective_root):
        dirs[:] = [d for d in dirs if d not in PROJECT_IGNORE]
        for f in files:
            path = os.path.join(base, f)
            result.append(path)
    return result


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def write_file(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def summarize_project(root: str = ".", model: str = None) -> str:
    files = list_files(root)
    sample_files = [f for f in files if f.endswith((".py", ".js", ".ts", ".json", ".md"))]
    sample_files = sample_files[:20]

    summary_input = []
    for path in sample_files:
        try:
            content = read_file(path)
        except Exception:
            continue
        summary_input.append(f"### FILE: {path}\n{content[:2000]}")

    prompt = (
        "You are a project analysis agent.\n"
        "You get a partial view of a codebase.\n"
        "Summarize the project purpose, tech stack, and structure.\n\n"
        + "\n\n".join(summary_input)
    )

    return simple_completion(prompt, model=model) if model else simple_completion(prompt)


def generate_code(
    instruction: str,
    context_files: Optional[List[str]] = None,
    model: str = None,
) -> str:
    context = ""
    if context_files:
        for path in context_files:
            try:
                content = read_file(path)
            except Exception:
                continue
            context += f"\n\n### FILE: {path}\n{content[:3000]}"

    prompt = (
        "You are a senior software engineer.\n"
        "Follow the user's instruction and generate high-quality code.\n"
        "If context is provided, respect existing patterns.\n\n"
        f"Instruction:\n{instruction}\n\n"
        f"Context:\n{context}"
    )

    return simple_completion(prompt, model=model) if model else simple_completion(prompt)


def refactor_project(
    instruction: str,
    root: str = ".",
    model: str = None,
) -> str:
    files = list_files(root)
    code_files = [f for f in files if f.endswith((".py", ".js", ".ts", ".tsx", ".jsx"))]
    code_files = code_files[:30]

    context = ""
    for path in code_files:
        try:
            content = read_file(path)
        except Exception:
            continue
        context += f"\n\n### FILE: {path}\n{content[:2000]}"

    prompt = (
        "You are a refactoring agent.\n"
        "User wants a refactor or structural change across the project.\n"
        "Return a high-level plan and concrete file-level changes.\n\n"
        f"User instruction:\n{instruction}\n\n"
        f"Project snapshot:\n{context}"
    )

    return simple_completion(prompt, model=model) if model else simple_completion(prompt)
