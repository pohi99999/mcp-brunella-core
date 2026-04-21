# src/servers/workspace.py - Workspace MCP Module
from fastmcp import FastMCP

# Workspace modul inicializálása
mcp_workspace = FastMCP("Workspace Module")

@mcp_workspace.tool()
async def workspace_status() -> str:
    """Visszaadja a workspace modul állapotát."""
    return "Workspace Module is active and ready."

@mcp_workspace.tool()
async def list_vault_files() -> str:
    """Dummy eszköz a fájlok listázásához a tudásbázisban."""
    return "Feature coming soon: RAG search in 07_KNOWLEDGE_BASE"
