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

API_URL = "http://localhost:3000" # Corrected port

async def run_robotkez_task(instruction: str, context: dict = None):
    """Helper to execute a task via the Robotkez agent."""
    if context is None:
        context = {"headless": True}
    
    print(f"Executing instruction: {instruction[:70]}...")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            response = await client.post(
                f"{API_URL}/api/agents/Robotkez/execute",
                json={
                    "task": instruction,
                    "context": context
                }
            )
            response.raise_for_status()
            result = response.json()
            # Assuming the result structure is { "result": { "data": ... } }
            final_data = result.get("result", {}).get("data", "No data returned.")
            print("Agent Result:", final_data)
            return final_data
        except httpx.RequestError as e:
            print(f"Error: Cannot connect to Agent API at {API_URL}. Is the main server running?")
            print("  -> npm run dev")
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
        print("Running all Robotkéz tests...")
        await test_level1()
        await test_level2()
        await test_level3()
        print("All tests finished.")
    elif command == "go":
        if len(sys.argv) > 2:
            url = sys.argv[2]
            await run_robotkez_task(f"Navigate to {url} and take a screenshot.", {"save_screenshot": True})
        else:
            print("Usage: python scripts/robotkez_cli.py go <url>")
    elif command == "search":
        if len(sys.argv) > 2:
            term = " ".join(sys.argv[2:])
            await run_robotkez_task(f"Go to google.com and search for '{term}'.")
        else:
            print("Usage: python scripts/robotkez_cli.py search <term>")
    elif command == "monitor":
        await test_level3()
    elif command == "n8n-login":
        # Level 2 test is effectively the login process
        await test_level2()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)

if __name__ == "__main__":
    asyncio.run(main())