"""
BAS Browser-Use API Wrapper (robotkéz)
Receives tasks from Cloudflare Orchestrator and executes browser automation

Endpoint: POST /api/task
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Any
import httpx
import asyncio
import uvicorn
from datetime import datetime

# Browser-Use imports (adjust based on your setup)
try:
    from browser_use import Agent
    from langchain_ollama import ChatOllama
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("⚠️ Browser-Use not installed. Running in mock mode.")

app = FastAPI(
    title="BAS Browser-Use API",
    description="Robotkéz - Browser automation endpoint for BAS hybrid architecture",
    version="1.0.0"
)

# Models
class TaskRequest(BaseModel):
    taskId: str
    type: str
    payload: dict
    callbackUrl: str

class TaskResponse(BaseModel):
    taskId: str
    status: str
    message: str

# Task execution
async def execute_browser_task(task: TaskRequest):
    """Execute browser automation task and send callback"""
    result = None
    status = "success"
    
    try:
        instruction = task.payload.get("instruction", "")
        context = task.payload.get("context", {})
        
        if BROWSER_USE_AVAILABLE:
            # Real Browser-Use execution
            llm = ChatOllama(
                model="llama3.1:8b",
                base_url="http://localhost:11434"
            )
            
            agent = Agent(
                task=instruction,
                llm=llm,
                # Add any additional config from context
            )
            
            result = await agent.run()
        else:
            # Mock execution for testing
            await asyncio.sleep(2)  # Simulate work
            result = {
                "mock": True,
                "instruction": instruction,
                "executed_at": datetime.now().isoformat(),
                "message": "Mock execution completed (Browser-Use not available)"
            }
            
    except Exception as e:
        status = "failed"
        result = {"error": str(e)}
    
    # Send callback to Cloudflare
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                task.callbackUrl,
                json={
                    "taskId": task.taskId,
                    "status": status,
                    "result": result
                },
                timeout=30.0
            )
    except Exception as e:
        print(f"Callback failed for {task.taskId}: {e}")

# Routes
@app.get("/")
async def root():
    return {
        "service": "BAS Browser-Use API (robotkéz)",
        "version": "1.0.0",
        "browser_use_available": BROWSER_USE_AVAILABLE,
        "status": "operational",
        "endpoints": {
            "submit_task": "POST /api/task",
            "health": "GET /health"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "browser_use": BROWSER_USE_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/task", response_model=TaskResponse)
async def submit_task(task: TaskRequest, background_tasks: BackgroundTasks):
    """Receive task from Cloudflare and execute in background"""
    
    if task.type != "browser":
        raise HTTPException(
            status_code=400, 
            detail=f"This endpoint only handles 'browser' tasks, got '{task.type}'"
        )
    
    # Execute in background
    background_tasks.add_task(execute_browser_task, task)
    
    return TaskResponse(
        taskId=task.taskId,
        status="accepted",
        message="Task queued for browser automation"
    )

if __name__ == "__main__":
    uvicorn.run(
        "browser_use_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
