#!/usr/bin/env python3
"""
Robotkéz Level 3 Test: Website Monitoring & Alerting
"""
import asyncio
import httpx
import os
from datetime import datetime

API_URL = "http://localhost:8000"

SITES = [
    "https://bas-orchestrator.iam-dd1.workers.dev",
    "https://n8n-latest-fulv.onrender.com/healthz",
    "http://localhost:8000/health"
]

async def test_level3():
    print("Starting Level 3 Test...")
    instruction = f"Check the following websites and determine if they are online (status 200) or down: {', '.join(SITES)}. Return a JSON with status for each."
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{API_URL}/api/task",
                json={
                    "taskId": "level3-test",
                    "type": "browser",
                    "payload": {
                        "instruction": instruction,
                        "context": {"headless": True}
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            print("Result:", data)
            print("Level 3 Test Completed: OK")
        except Exception as e:
            print(f"Level 3 Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_level3())
