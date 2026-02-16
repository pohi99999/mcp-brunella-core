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
from typing import Optional

# Ensure project root is on sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastmcp import FastMCP

# Lazy-load heavy modules to keep startup fast
_refiner = None
_rag_service = None


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


# --- MCP Server Setup ---

mcp = FastMCP("brunella-python")


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

    local_scope = {"context": ctx, "json": json, "os": os, "sys": sys}
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
async def harvest_scenario(scenario_path: str, force_mode: Optional[str] = None) -> str:
    """Run a browser automation scenario using Playwright.
    
    Executes a JSON scenario file for web scraping, form filling, or data extraction.
    
    Args:
        scenario_path: Path to the scenario JSON file (relative to project root).
        force_mode: Force execution mode — 'api' or 'ui'. None for auto-detect.
    """
    try:
        from myai.browser_worker import run_scenario
        full_path = os.path.join(PROJECT_ROOT, scenario_path) if not os.path.isabs(scenario_path) else scenario_path
        if not os.path.exists(full_path):
            return json.dumps({"status": "error", "error": f"Scenario not found: {full_path}"})
        result = await run_scenario(full_path, force_mode=force_mode)
        return json.dumps({"status": "success", "result": result}, ensure_ascii=False, default=str)
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
        from myai.browser_worker import run_structured_extraction
        config = {
            "target_url": target_url,
            "extraction_prompt": extraction_prompt,
            "model": model,
        }
        result = await run_structured_extraction(config, schema_source)
        if "error" in result:
            return json.dumps({"status": "error", "error": result["error"]}, default=str)
        return json.dumps({"status": "success", "data": result.get("data")}, ensure_ascii=False, default=str)
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
    ]:
        try:
            __import__(module_name)
            checks[label] = "available"
        except ImportError:
            checks[label] = "not_installed"

    return json.dumps({"status": "ok", "capabilities": checks})


# --- Entry Point ---

def main():
    transport = "sse" if "--sse" in sys.argv else "stdio"
    mcp.run(transport=transport)


if __name__ == "__main__":
    main()
