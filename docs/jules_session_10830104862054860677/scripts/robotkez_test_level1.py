#!/usr/bin/env python3
"""
Robotkéz Level 1 Test: Alapvető Navigáció
"""
import asyncio
import httpx
import sys

API_URL = "http://localhost:8000"

async def test_level1():
    print("Starting Level 1 Test...")
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{API_URL}/api/task",
                json={
                    "taskId": "level1-test",
                    "type": "browser",
                    "payload": {
                        "instruction": "Go to google.com, search for 'GitHub trending', click the first result (github.com/trending), and extract the names of the top 3 repositories.",
                        "context": {"headless": True}
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            print("Result:", data)
            print("Level 1 Test Completed: OK")
        except Exception as e:
            print(f"Level 1 Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_level1())
