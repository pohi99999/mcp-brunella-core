#!/usr/bin/env python3
"""
Robotkéz CLI - Egyszerű parancsok böngésző automatizáláshoz

Használat:
  python scripts/robotkez_cli.py test            # Run all tests
  python scripts/robotkez_cli.py go <url>        # Navigate to URL
  python scripts/robotkez_cli.py search <term>   # Google search
  python scripts/robotkez_cli.py monitor         # Start monitoring
  python scripts/robotkez_cli.py n8n-login       # n8n login
"""
import sys
import asyncio
import httpx

# Import test scripts
from robotkez_test_level1 import test_level1
from robotkez_test_level2_n8n import test_level2
from robotkez_test_level3_monitoring import test_level3

API_URL = "http://localhost:8000"

async def run_browser_task(instruction: str, task_id: str, context: dict = None):
    """Helper to run a generic browser task."""
    if context is None:
        context = {"headless": True}
    
    print(f"Executing task '{task_id}': {instruction[:70]}...")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            response = await client.post(
                f"{API_URL}/api/task",
                json={
                    "taskId": task_id,
                    "type": "browser",
                    "payload": {"instruction": instruction, "context": context},
                }
            )
            response.raise_for_status()
            result = response.json()
            print("Task Result:", result.get("result", {}).get("summary", "No summary"))
            return result
        except httpx.RequestError as e:
            print(f"Error: Cannot connect to Robotkéz API at {API_URL}. Is it running?")
            print("  -> cd myai && uvicorn server:app --reload --port 8000")
        except httpx.HTTPStatusError as e:
            print(f"Error: Task failed with status {e.response.status_code}")
            print(e.response.text)
        return None

async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]

    if command == "test":
        await test_level1()
        await test_level2()
        await test_level3()
    elif command == "go":
        if len(sys.argv) > 2:
            url = sys.argv[2]
            await run_browser_task(f"Navigate to {url} and take a screenshot.", "cli-go", {"save_screenshot": True})
        else:
            print("Usage: python scripts/robotkez_cli.py go <url>")
    elif command == "search":
        if len(sys.argv) > 2:
            term = " ".join(sys.argv[2:])
            await run_browser_task(f"Go to google.com and search for '{term}'.", "cli-search")
        else:
            print("Usage: python scripts/robotkez_cli.py search <term>")
    elif command == "monitor":
        await test_level3()
    elif command == "n8n-login":
        await test_level2()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)

if __name__ == "__main__":
    asyncio.run(main())