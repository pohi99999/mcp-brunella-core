#!/usr/bin/env python3
"""
Robotkéz Level 2 Test: n8n Workflow Management
"""
import asyncio
import httpx
import os
import sys

API_URL = "http://localhost:8000"
N8N_URL = os.getenv("N8N_TEST_URL", "https://n8n-latest-fulv.onrender.com")

async def test_level2():
    print("Starting Level 2 Test...")
    instruction = f"""
    1. Go to {N8N_URL}.
    2. Check if login is required. If so, look for username/password fields.
    3. If logged in (or after login), look for 'Workflows' menu.
    4. Create a new workflow named "Test Workflow - Robotkez".
    5. Return the list of visible workflows.
    """

    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            response = await client.post(
                f"{API_URL}/api/task",
                json={
                    "taskId": "level2-test",
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
            print("Level 2 Test Completed: OK")
        except Exception as e:
            print(f"Level 2 Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_level2())
