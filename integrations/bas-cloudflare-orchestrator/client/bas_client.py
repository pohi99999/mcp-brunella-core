"""
BAS Python Client
Unified interface to interact with the entire BAS Hybrid System

Usage:
    from bas_client import BASClient
    
    client = BASClient()
    
    # Submit a task (auto-routed)
    result = await client.submit_task("Keress Python async könyvtárakat")
    
    # Direct agent calls
    research = await client.research("AI trends 2025")
    code = await client.generate_code("FastAPI endpoint for user auth")
    browser = await client.browser_action("Log into gmail.com")
"""

import httpx
import asyncio
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass
from enum import Enum
import json

class TaskType(Enum):
    BROWSER = "browser"
    RESEARCH = "research"
    CODE = "code"
    ORCHESTRATE = "orchestrate"

@dataclass
class BASConfig:
    """Configuration for BAS endpoints"""
    cloudflare_url: str = "https://bas-orchestrator.iam-dd1.workers.dev"
    langflow_url: str = "http://localhost:7860"
    browser_use_url: str = "http://localhost:8000"
    n8n_url: str = "http://localhost:5678"
    ollama_url: str = "http://localhost:11434"
    timeout: float = 120.0

@dataclass
class TaskResult:
    """Result from a BAS task"""
    task_id: str
    status: str
    task_type: TaskType
    result: Any
    error: Optional[str] = None

class BASClient:
    """
    Unified client for the BAS Hybrid System
    
    Supports:
    - Cloudflare orchestrated tasks (auto-routing)
    - Direct Langflow agent calls
    - Direct Browser-Use calls
    - Direct Ollama calls
    """
    
    def __init__(self, config: Optional[BASConfig] = None):
        self.config = config or BASConfig()
        self._client: Optional[httpx.AsyncClient] = None
    
    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=self.config.timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self.config.timeout)
        return self._client
    
    # ==================== Main Task Submission ====================
    
    async def submit_task(
        self,
        instruction: str,
        context: Optional[Dict[str, Any]] = None,
        wait_for_result: bool = True
    ) -> TaskResult:
        """
        Submit a task to Cloudflare orchestrator (auto-routed)
        
        Args:
            instruction: Natural language task description
            context: Optional context data
            wait_for_result: If True, poll until completion
        """
        response = await self.client.post(
            f"{self.config.cloudflare_url}/task",
            json={
                "instruction": instruction,
                "context": context or {}
            }
        )
        response.raise_for_status()
        data = response.json()
        
        task_id = data["taskId"]
        task_type = TaskType(data["type"])
        
        if not wait_for_result:
            return TaskResult(
                task_id=task_id,
                status="dispatched",
                task_type=task_type,
                result=None
            )
        
        # Poll for result
        return await self._poll_task(task_id, task_type)
    
    async def _poll_task(
        self,
        task_id: str,
        task_type: TaskType,
        max_attempts: int = 60,
        interval: float = 2.0
    ) -> TaskResult:
        """Poll Cloudflare for task completion"""
        for _ in range(max_attempts):
            response = await self.client.get(
                f"{self.config.cloudflare_url}/status/{task_id}"
            )
            
            if response.status_code == 200:
                data = response.json()
                if data["status"] in ("completed", "failed"):
                    return TaskResult(
                        task_id=task_id,
                        status=data["status"],
                        task_type=task_type,
                        result=data.get("result"),
                        error=data.get("result", {}).get("error") if data["status"] == "failed" else None
                    )
            
            await asyncio.sleep(interval)
        
        return TaskResult(
            task_id=task_id,
            status="timeout",
            task_type=task_type,
            result=None,
            error="Task polling timed out"
        )
    
    # ==================== Direct Agent Calls ====================
    
    async def research(
        self,
        query: str,
        depth: Literal["quick", "standard", "deep"] = "standard"
    ) -> Dict[str, Any]:
        """
        Direct call to Langflow Research Agent
        
        Args:
            query: Research question or topic
            depth: How deep to search
        """
        response = await self.client.post(
            f"{self.config.langflow_url}/api/v1/run/bas-research",
            json={
                "input_value": query,
                "output_type": "chat",
                "input_type": "chat",
                "tweaks": {
                    "depth": depth
                }
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def orchestrate(
        self,
        complex_task: str,
        auto_execute: bool = False
    ) -> Dict[str, Any]:
        """
        Direct call to Langflow Multi-Agent Orchestrator
        
        Args:
            complex_task: Complex task to decompose and execute
            auto_execute: If True, execute subtasks automatically
        """
        response = await self.client.post(
            f"{self.config.langflow_url}/api/v1/run/bas-orchestrator",
            json={
                "input_value": complex_task,
                "output_type": "chat",
                "input_type": "chat",
                "tweaks": {
                    "auto_execute": auto_execute
                }
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def generate_code(
        self,
        prompt: str,
        language: str = "python",
        style: Literal["minimal", "documented", "production"] = "documented"
    ) -> str:
        """
        Direct call to Ollama for code generation
        
        Args:
            prompt: Code generation request
            language: Target programming language
            style: Code style preference
        """
        system_prompt = f"""Te egy szakértő {language} fejlesztő vagy.
Generálj tiszta, {style} stílusú kódot.
{"Minimális kommentekkel." if style == "minimal" else ""}
{"Részletes dokumentációval és docstringekkel." if style == "documented" else ""}
{"Production-ready kódot error handling-gel és loggolással." if style == "production" else ""}
"""
        
        response = await self.client.post(
            f"{self.config.ollama_url}/api/generate",
            json={
                "model": "llama3.1:8b",
                "prompt": prompt,
                "system": system_prompt,
                "stream": False
            }
        )
        response.raise_for_status()
        return response.json()["response"]
    
    async def browser_action(
        self,
        instruction: str,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Direct call to Browser-Use API (robotkéz)
        
        Args:
            instruction: Browser automation instruction
            url: Optional starting URL
        """
        response = await self.client.post(
            f"{self.config.browser_use_url}/api/task",
            json={
                "taskId": f"direct-{int(asyncio.get_event_loop().time() * 1000)}",
                "type": "browser",
                "payload": {
                    "instruction": instruction,
                    "context": {"start_url": url} if url else {}
                },
                "callbackUrl": ""  # No callback for direct calls
            }
        )
        response.raise_for_status()
        return response.json()
    
    # ==================== Utility Methods ====================
    
    async def health_check(self) -> Dict[str, bool]:
        """Check health of all BAS components"""
        results = {}
        
        # Cloudflare
        try:
            r = await self.client.get(self.config.cloudflare_url, timeout=5.0)
            results["cloudflare"] = r.status_code == 200
        except:
            results["cloudflare"] = False
        
        # Langflow
        try:
            r = await self.client.get(f"{self.config.langflow_url}/health", timeout=5.0)
            results["langflow"] = r.status_code == 200
        except:
            results["langflow"] = False
        
        # Browser-Use
        try:
            r = await self.client.get(f"{self.config.browser_use_url}/health", timeout=5.0)
            results["browser_use"] = r.status_code == 200
        except:
            results["browser_use"] = False
        
        # Ollama
        try:
            r = await self.client.get(f"{self.config.ollama_url}/api/tags", timeout=5.0)
            results["ollama"] = r.status_code == 200
        except:
            results["ollama"] = False
        
        # n8n
        try:
            r = await self.client.get(f"{self.config.n8n_url}/healthz", timeout=5.0)
            results["n8n"] = r.status_code == 200
        except:
            results["n8n"] = False
        
        return results


# ==================== CLI Interface ====================

async def main():
    """Example usage"""
    async with BASClient() as client:
        # Health check
        print("🔍 Checking BAS components...")
        health = await client.health_check()
        for component, status in health.items():
            emoji = "✅" if status else "❌"
            print(f"  {emoji} {component}")
        
        # Example task
        print("\n📋 Submitting test task...")
        result = await client.submit_task(
            "Mi a legjobb Python web framework 2025-ben?",
            wait_for_result=False
        )
        print(f"  Task ID: {result.task_id}")
        print(f"  Type: {result.task_type.value}")
        print(f"  Status: {result.status}")


if __name__ == "__main__":
    asyncio.run(main())
