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
import sys
import asyncio
import httpx
import argparse
import subprocess

API_URL = "http://localhost:8000"

async def run_task(instruction, headless=True):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{API_URL}/api/task",
                json={
                    "taskId": "cli-task",
                    "type": "browser",
                    "payload": {
                        "instruction": instruction,
                        "context": {"headless": headless}
                    }
                }
            )
            response.raise_for_status()
            print(response.json())
        except Exception as e:
            print(f"Error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Robotkez CLI")
    subparsers = parser.add_subparsers(dest="command")
    
    # search
    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("term", type=str)
    
    # go
    go_parser = subparsers.add_parser("go")
    go_parser.add_argument("url", type=str)
    
    # test
    subparsers.add_parser("test")
    
    # n8n
    n8n_parser = subparsers.add_parser("n8n")
    n8n_parser.add_argument("action", choices=["login"])

    args = parser.parse_args()
    
    if args.command == "search":
        asyncio.run(run_task(f"Search Google for '{args.term}' and summarize results.", headless=False))
    elif args.command == "go":
        asyncio.run(run_task(f"Go to {args.url} and take a screenshot.", headless=False))
    elif args.command == "n8n":
        if args.action == "login":
             asyncio.run(run_task(f"Login to n8n at https://n8n-latest-fulv.onrender.com using credentials from env if available.", headless=False))
    elif args.command == "test":
        print("Running Level 1...")
        subprocess.run([sys.executable, "scripts/robotkez_test_level1.py"])
        print("Running Level 2...")
        subprocess.run([sys.executable, "scripts/robotkez_test_level2_n8n.py"])
        print("Running Level 3...")
        subprocess.run([sys.executable, "scripts/robotkez_test_level3_monitoring.py"])
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
