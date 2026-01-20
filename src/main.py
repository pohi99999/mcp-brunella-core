# src/main.py - Cogella Core MCP Gateway
from fastapi import FastAPI
from fastmcp import FastMCP
import asyncio
from contextlib import asynccontextmanager
import uvicorn

# 1. Al-szerverek helyőrzőinek előkészítése (Phase 3-ban töltjük meg)
# mcp_workspace = FastMCP("Workspace Module")
# mcp_automation = FastMCP("Automation Module")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializációs logika (pl. adatbázis kapcsolatok)
    print("Cogella Core Gateway starting up...")
    yield
    # Leállítási logika
    print("Cogella Core Gateway shutting down...")

# 2. Fő FastAPI alkalmazás létrehozása
app = FastAPI(
    title="Cogella Core MCP Gateway",
    description="Central gateway for Brunella Agent System MCP modules",
    version="1.0.0",
    lifespan=lifespan
)

# 3. Alapvető REST végpontok
@app.get("/health")
async def health_check():
    """Health check végpont a rendszer állapotának ellenőrzéséhez."""
    return {
        "status": "operational",
        "mode": "async-gateway",
        "system": "Cogella Core"
    }

@app.get("/")
async def root():
    return {"message": "Welcome to Cogella Core MCP Gateway. Access /health for status."}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
