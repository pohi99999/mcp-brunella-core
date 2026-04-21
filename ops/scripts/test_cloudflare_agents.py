#!/usr/bin/env python3
"""
Cloudflare Worker Agents Teszt Script

Demonstrálja hogyan lehet a deployed Cloudflare Worker-t használni
fejlesztésre és tesztelésre.

Használat:
    python scripts/test_cloudflare_agents.py
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "bas-cloudflare-orchestrator" / "client"))

from bas_client import BASClient, TaskType

async def main():
    print("=" * 60)
    print("[*] Cloudflare Worker Agents Teszt")
    print("=" * 60)

    async with BASClient() as client:
        # 1. Health Check
        print("\n[1] Health Check - Osszes rendszer")
        print("-" * 60)
        health = await client.health_check()
        for component, status in health.items():
            emoji = "[OK]" if status else "[!!]"
            print(f"  {emoji} {component.upper():<15} {'ONLINE' if status else 'OFFLINE'}")

        # 2. Cloudflare Worker Teszt - Task Submit
        print("\n[2] Task Submit (Cloudflare Auto-routing)")
        print("-" * 60)

        result = await client.submit_task(
            instruction="Mi a legjobb Python async library 2026-ban?",
            wait_for_result=False
        )

        print(f"  [OK] Task elküldve")
        print(f"     Task ID: {result.task_id}")
        print(f"     Type: {result.task_type.value}")
        print(f"     Status: {result.status}")

        # 3. Kód Generálás (Ollama via client)
        if health.get("ollama"):
            print("\n💻 3. Kód Generálás (Ollama)")
            print("-" * 60)

            code = await client.generate_code(
                "Write a Python async function that retries HTTP requests with exponential backoff",
                language="python",
                style="documented"
            )

            print(f"  [OK] Kód generálva ({len(code)} karakter)")
            print(f"\n{code[:200]}...")
        else:
            print("\n[SKIP]  3. Kód Generálás (Ollama) - SKIP (offline)")

        # 4. Summary
        print("\n" + "=" * 60)
        print("📝 Összefoglaló")
        print("=" * 60)

        online_count = sum(1 for status in health.values() if status)
        total_count = len(health)

        print(f"\n[OK] {online_count}/{total_count} komponens online")
        print(f"🔗 Cloudflare Worker: https://bas-orchestrator.iam-dd1.workers.dev")
        print(f"📊 Max hívások: 100,000/nap")

        print("\n💡 Használat:")
        print("   - Task submit: client.submit_task('feladat')")
        print("   - Kód generálás: client.generate_code('prompt')")
        print("   - Research: client.research('topic')")
        print("   - Browser automation: client.browser_action('instruction')")

        print("\n🚀 Felpörgéshez:")
        print("   1. Integrálj a DeveloperAgent-be (generate_code hívás)")
        print("   2. Adj hozzá az AgentManager-hez (remote execution)")
        print("   3. CLI parancs: brunella edge <task>")

if __name__ == "__main__":
    asyncio.run(main())
