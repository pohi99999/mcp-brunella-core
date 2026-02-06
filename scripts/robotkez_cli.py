#!/usr/bin/env python3
"""
Robotkéz CLI - Egyszerű parancsok böngésző automatizáláshoz

Használat:
    python scripts/robotkez_cli.py test          # Run all tests
    python scripts/robotkez_cli.py go <url>      # Navigate to URL
    python scripts/robotkez_cli.py search <term> # Google search
    python scripts/robotkez_cli.py monitor       # Start monitoring
    python scripts/robotkez_cli.py n8n login     # n8n login
"""
import asyncio
import httpx
import sys
import os

API_URL = "http://localhost:8000"

async def check_server():
    """Check if browser-use server is running"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_URL}/health")
            if response.status_code == 200:
                print("✅ Browser-Use server: ONLINE")
                return True
            else:
                print(f"❌ Server responded with {response.status_code}")
                return False
    except Exception as e:
        print(f"❌ Cannot connect to {API_URL}")
        print(f"   Error: {e}")
        print("\nStart server with:")
        print("  cd myai && uvicorn server:app --reload --port 8000")
        return False


async def run_task(instruction, context=None):
    """Submit a task to browser-use"""
    if context is None:
        context = {"headless": False, "save_screenshot": True}

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": f"cli-{hash(instruction)}",
                "type": "browser",
                "payload": {
                    "instruction": instruction,
                    "context": context
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ Task completed")
            summary = result.get('result', {}).get('summary', 'N/A')
            print(f"Summary: {summary[:200]}...")

            extracted = result.get('result', {}).get('extractedData')
            if extracted:
                print(f"\nExtracted data:")
                print(f"{extracted}")

            return result
        else:
            print(f"❌ Task failed: HTTP {response.status_code}")
            print(response.text)
            return None


async def cmd_test():
    """Run all test levels"""
    print("=" * 60)
    print("Robotkéz Full Test Suite")
    print("=" * 60)

    tests = [
        ("Level 1", "scripts/robotkez_test_level1.py"),
        ("Level 2", "scripts/robotkez_test_level2_n8n.py"),
        ("Level 3", "scripts/robotkez_test_level3_monitoring.py")
    ]

    for level, script_path in tests:
        print(f"\n🧪 Running {level}...")
        os.system(f"python {script_path}")
        await asyncio.sleep(2)

    print("\n✅ All tests complete")


async def cmd_go(url):
    """Navigate to URL and take screenshot"""
    print(f"🌐 Navigating to: {url}")
    await run_task(f"Open {url} and take a screenshot")


async def cmd_search(term):
    """Google search"""
    print(f"🔍 Searching Google for: {term}")
    await run_task(f"Open google.com and search for '{term}'. Extract top 5 results.")


async def cmd_monitor():
    """Start monitoring loop"""
    print("📊 Starting monitoring...")
    os.system("python scripts/robotkez_test_level3_monitoring.py")


async def cmd_n8n_login():
    """n8n login"""
    print("🔐 Logging into n8n...")
    n8n_url = os.getenv("N8N_TEST_URL", "https://n8n-latest-fulv.onrender.com")
    n8n_user = os.getenv("N8N_TEST_USER", "peterpohankapesonal@gmail.com")
    n8n_password = os.getenv("N8N_TEST_PASSWORD", "Iszapfalo2026")

    await run_task(f"""
        Login to {n8n_url}/signin with:
        Email: {n8n_user}
        Password: {n8n_password}

        Verify login success.
    """, context={"headless": False, "save_screenshot": True})


def print_help():
    """Print usage instructions"""
    print("""
🤖 Robotkéz CLI - Browser Automation

Commands:
  test                 Run all test levels
  go <url>            Navigate to URL
  search <term>       Google search
  monitor             Start monitoring loop
  n8n login           Login to n8n
  help                Show this help

Examples:
  python scripts/robotkez_cli.py test
  python scripts/robotkez_cli.py go https://github.com
  python scripts/robotkez_cli.py search "Python async tutorial"
  python scripts/robotkez_cli.py n8n login

Setup:
  1. Start server: cd myai && uvicorn server:app --reload --port 8000
  2. Run commands: python scripts/robotkez_cli.py <command>
    """)


async def main():
    if len(sys.argv) < 2:
        print_help()
        return

    # Check server first
    if not await check_server():
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "test":
        await cmd_test()
    elif command == "go" and len(sys.argv) >= 3:
        await cmd_go(sys.argv[2])
    elif command == "search" and len(sys.argv) >= 3:
        term = " ".join(sys.argv[2:])
        await cmd_search(term)
    elif command == "monitor":
        await cmd_monitor()
    elif command == "n8n" and len(sys.argv) >= 3 and sys.argv[2] == "login":
        await cmd_n8n_login()
    elif command == "help":
        print_help()
    else:
        print(f"❌ Unknown command: {command}")
        print_help()


if __name__ == "__main__":
    asyncio.run(main())
