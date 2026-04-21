import asyncio
import httpx
from datetime import datetime

SITES = [
    "https://bas-orchestrator.iam-dd1.workers.dev",
    "https://n8n-latest-fulv.onrender.com/healthz"
]

async def monitor():
    while True:
        print(f"\n[{datetime.now()}] Checking...")

        async with httpx.AsyncClient(timeout=60.0) as client:
            for url in SITES:
                try:
                    # Note: This calls the browser agent to check.
                    # Alternatively, we could check directly with httpx if it's just a status check.
                    # But per guide we use the agent.
                    response = await client.post(
                        "http://localhost:8000/api/task",
                        json={
                            "taskId": f"monitor-{hash(url)}",
                            "type": "browser",
                            "payload": {
                                "instruction": f"Check {url}, return status OK/ERROR",
                                "context": {"headless": True}
                            },
                            "callbackUrl": ""
                        }
                    )

                    if response.status_code == 200:
                        print(f"  ✅ {url}: OK")
                    else:
                        print(f"  ❌ {url}: DOWN (API Error)")
                except Exception as e:
                    print(f"  ❌ {url}: DOWN ({e})")

        await asyncio.sleep(600)  # 10 min

if __name__ == "__main__":
    asyncio.run(monitor())
