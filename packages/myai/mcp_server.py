"""
Brunella Python MCP Server
==========================
Exposes the Python subsystem capabilities as MCP tools via stdio transport.
Uses FastMCP (already in project dependencies).

Usage:
    python -m myai.mcp_server          # stdio transport (for VS Code / Node.js)
    python -m myai.mcp_server --sse    # SSE transport (for HTTP clients)
"""

import os
import sys
import json
import traceback
import io
from contextlib import redirect_stdout
import logging
from typing import Literal, Optional

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastmcp import FastMCP
from myai.runtime_security import (
    is_python_execute_enabled,
    MAX_DYNAMIC_CODE_SIZE,
    resolve_harvest_scenario_path,
    resolve_json_schema_source,
)

logger = logging.getLogger(__name__)

# Lazy-load heavy modules to keep startup fast
_refiner = None
_rag_service = None
_autogen_adapter = None


def _get_refiner():
    global _refiner
    if _refiner is None:
        from myai.refiner_logic import refiner
        _refiner = refiner
    return _refiner


def _get_rag():
    global _rag_service
    if _rag_service is None:
        from myai.rag import rag_service
        _rag_service = rag_service
    return _rag_service


def _get_autogen_adapter():
    global _autogen_adapter
    if _autogen_adapter is None:
        from myai.backend.autogen_adapter import build_autogen_adapter
        from myai.backend.config import get_backend_config

        _autogen_adapter = build_autogen_adapter(get_backend_config())
    return _autogen_adapter


# --- MCP Server Setup ---

mcp = FastMCP("brunella-python")
PROJECT_ROOT_REALPATH = os.path.realpath(PROJECT_ROOT)


# --- Tool Definitions ---

@mcp.tool()
def python_execute(code: str, context: Optional[str] = None) -> str:
    """Execute Python code and return stdout output.
    
    Args:
        code: Python source code to execute.
        context: Optional JSON string of context variables available as 'context' dict.
    """
    try:
        ctx = json.loads(context) if context else {}
    except json.JSONDecodeError:
        ctx = {}

    if not is_python_execute_enabled():
        return json.dumps(
            {
                "status": "error",
                "error": "Python execute is disabled. Set BRUNELLA_ENABLE_PYTHON_EXECUTE=1 to enable.",
            }
        )

    if len(code) > MAX_DYNAMIC_CODE_SIZE:
        return json.dumps(
            {
                "status": "error",
                "error": f"Code too large (max {MAX_DYNAMIC_CODE_SIZE} chars)",
            }
        )

    local_scope = {"context": ctx, "json": json}
    f = io.StringIO()
    try:
        with redirect_stdout(f):
            exec(code, {}, local_scope)  # noqa: S102
        output = f.getvalue().strip()
        return json.dumps({"status": "success", "stdout": output})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e), "stdout": f.getvalue().strip()})


@mcp.tool()
def data_refine(content: str, source: str = "unknown") -> str:
    """Refine/clean raw text data using the Brunella DataRefiner pipeline.
    
    Applies noise removal, semantic checking, and entity extraction.
    Priority topics: fuvarszervezés, mcp, logisztika, ai-agent, adatbázis.
    
    Args:
        content: Raw text to refine.
        source: Data source identifier.
    """
    try:
        refiner = _get_refiner()
        result = refiner.process_data({"content": content, "source": source})
        if result is None:
            return json.dumps({"status": "REJECTED", "reason": "Content did not pass semantic check"})
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


@mcp.tool()
async def rag_search(query: str, limit: int = 5) -> str:
    """Search the Brunella Knowledge Base (LanceDB) for relevant context.
    
    Uses vector similarity search to find related documents, PDFs, and ingested content.
    
    Args:
        query: Natural language search query.
        limit: Maximum number of results (default 5).
    """
    try:
        rag = _get_rag()
        results = await rag.search(query, limit=min(limit, 20))
        return json.dumps({"status": "success", "results": results, "count": len(results)}, ensure_ascii=False, default=str)
    except ImportError:
        return json.dumps({"status": "error", "error": "lancedb not installed — RAG unavailable"})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


@mcp.tool()
async def autogen_run_task(
    task: str,
    system_message: Optional[str] = None,
    prefer_provider: Literal["auto", "github", "ollama"] = "auto",
    model: Optional[str] = None,
) -> str:
    """Run a single AutoGen AssistantAgent task with GitHub Models first.

    Falls back to Ollama when prefer_provider='auto' and GitHub Models is unavailable
    or runtime execution fails.

    Args:
        task: Natural language instruction or prompt for the AutoGen assistant.
        system_message: Optional system instruction to override the default Brunella prompt.
        prefer_provider: Provider selection strategy: 'auto', 'github', or 'ollama'.
        model: Optional explicit model override for the selected provider.
    """
    try:
        adapter = _get_autogen_adapter()
        result = await adapter.run(
            task,
            system_message=system_message,
            prefer_provider=prefer_provider,
            model=model,
        )
        return json.dumps(
            {
                "status": "success",
                "provider": result.provider,
                "model": result.model,
                "output": result.output,
                "stop_reason": result.stop_reason,
                "message_count": result.message_count,
            },
            ensure_ascii=False,
        )
    except Exception as e:
        logger.exception(
            "autogen_run_task failed",
            extra={
                "prefer_provider": prefer_provider,
                "model": model,
                "task_length": len(task.strip()),
            },
        )
        return json.dumps({"status": "error", "error": str(e)})


@mcp.tool()
async def harvest_scenario(scenario_path: str, force_mode: Optional[str] = None) -> str:
    """Run a browser automation scenario using Playwright.
    
    Executes a JSON scenario file for web scraping, form filling, or data extraction.
    
    Args:
        scenario_path: Path to the scenario JSON file (relative to project root).
        force_mode: Force execution mode — 'api' or 'ui'. None for auto-detect.
    """
    try:
        full_path = resolve_harvest_scenario_path(scenario_path)
        from myai.browser_worker import run_scenario
        if not os.path.exists(full_path):
            return json.dumps({"status": "error", "error": f"Scenario not found: {full_path}"})
        result = await run_scenario(full_path, force_mode=force_mode)
        return json.dumps({"status": "success", "result": result}, ensure_ascii=False, default=str)
    except ValueError as e:
        return json.dumps({"status": "error", "error": str(e)})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


@mcp.tool()
async def harvest_extract(target_url: str, schema_source: str, extraction_prompt: str = "Extract the required data according to the JSON schema.", model: str = "gemini-2.0-flash") -> str:
    """Extract structured data from a URL using a JSON schema and LLM.
    
    Navigates to the URL, applies the schema, and returns structured JSON data.
    
    Args:
        target_url: URL to extract data from.
        schema_source: JSON schema file path or raw JSON schema string.
        extraction_prompt: Instruction for the LLM extractor.
        model: LLM model to use for extraction.
    """
    try:
        safe_schema_source = resolve_json_schema_source(schema_source)
        from myai.browser_worker import run_structured_extraction
        config = {
            "target_url": target_url,
            "extraction_prompt": extraction_prompt,
            "model": model,
        }
        result = await run_structured_extraction(config, safe_schema_source)
        if "error" in result:
            return json.dumps({"status": "error", "error": result["error"]}, default=str)
        return json.dumps({"status": "success", "data": result.get("data")}, ensure_ascii=False, default=str)
    except ValueError as e:
        return json.dumps({"status": "error", "error": str(e)})
    except Exception as e:
        return json.dumps({"status": "error", "error": str(e)})


@mcp.tool()
def system_health() -> str:
    """Check the health and available capabilities of the Python subsystem.
    
    Returns availability of: browser-use, playwright, whisper, lancedb.
    """
    checks = {
        "python_version": sys.version,
        "project_root": PROJECT_ROOT,
    }

    for module_name, label in [
        ("browser_use", "browser_use"),
        ("playwright", "playwright"),
        ("faster_whisper", "whisper"),
        ("lancedb", "lancedb"),
        ("chromadb", "chromadb"),
        ("langchain", "langchain"),
        ("autogen_agentchat", "autogen_agentchat"),
        ("autogen_ext", "autogen_ext"),
    ]:
        try:
            __import__(module_name)
            checks[label] = "available"
        except Exception:
            # Catch all exceptions, not just ImportError
            # Some modules (e.g., chromadb) may raise pydantic.v1.ConfigError on Python 3.14+
            checks[label] = "not_installed"

    github_token = os.getenv("GITHUB_PAT") or os.getenv("GITHUB_TOKEN")
    checks["github_models_token"] = "configured" if github_token else "missing"

    try:
        from azure.core.credentials import AzureKeyCredential  # noqa: F401

        checks["azure_core"] = "available"
    except ImportError:
        checks["azure_core"] = "not_installed"

    try:
        adapter = _get_autogen_adapter()
        checks["autogen_pilot"] = "available" if adapter.enabled else "not_installed"
        checks["autogen_ollama_ready"] = "ready" if adapter.enabled else "not_ready"
        checks["autogen_github_ready"] = (
            "ready"
            if adapter.enabled and bool(github_token) and checks["azure_core"] == "available"
            else "not_ready"
        )
    except Exception:
        logger.exception("system_health failed to initialize AutoGen pilot adapter")
        checks["autogen_pilot"] = "error"
        checks["autogen_ollama_ready"] = "error"
        checks["autogen_github_ready"] = "error"

    return json.dumps({"status": "ok", "capabilities": checks})


# --- Entry Point ---

def main():
    transport = "sse" if "--sse" in sys.argv else "stdio"
    mcp.run(transport=transport)


if __name__ == "__main__":
    main()
