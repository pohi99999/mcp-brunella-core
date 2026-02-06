#!/usr/bin/env python3
"""
Robotkéz Level 3 Test: Website Monitoring & Alerting
"""
import asyncio
import httpx
import os
from datetime import datetime

API_URL = "http://localhost:8000"

# Monitored URLs
MONITORED_SITES = [
    {
        "name": "Cloudflare Worker",
        "url": "https://bas-orchestrator.iam-dd1.workers.dev",
        "check": "Verify status=operational"
    },
    {
        "name": "n8n (Render)",
        "url": "https://n8n-latest-fulv.onrender.com/healthz",
        "check": "Verify 200 OK"
    },
    {
        "name": "Local Backend",
        "url": "http://localhost:3000/api/health",
        "check": "Verify JSON response"
    }
]

async def test_level3_monitoring():
    print("=" * 60)
    print("[LEVEL 3] Website Monitoring Test")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=120.0) as client:
        results = []

        for site in MONITORED_SITES:
            print(f"\n[CHECK] {site['name']}")
            print("-" * 60)

            response = await client.post(
                f"{API_URL}/api/task",
                json={
                    "taskId": f"monitor-{hash(site['url'])}",
                    "type": "browser",
                    "payload": {
                        "instruction": f"""
                        Check {site['url']}:
                        1. Navigate to URL
                        2. {site['check']}
                        3. Measure response time
                        4. Check for error messages or status codes

                        Return JSON:
                        {{
                            "url": "{site['url']}",
                            "status": "ok" or "error",
                            "response_time_ms": 123,
                            "status_code": 200,
                            "errors": []
                        }}
                        """,
                        "context": {
                            "headless": True,
                            "extract_json": True,
                            "timeout": 30000
                        }
                    },
                    "callbackUrl": ""
                }
            )

            if response.status_code == 200:
                result = response.json()
                status_data = result.get('result', {}).get('extractedData', {})

                if status_data:
                    if status_data.get('status') == 'ok':
                        print(f"[OK] {site['name']}: ONLINE")
                        print(f"     Response time: {status_data.get('response_time_ms', 'N/A')}ms")
                        print(f"     Status code: {status_data.get('status_code', 'N/A')}")
                    else:
                        print(f"[WARN] {site['name']}: ISSUES DETECTED")
                        print(f"     Errors: {status_data.get('errors', [])}")

                    results.append({
                        "site": site['name'],
                        "status": status_data.get('status', 'unknown'),
                        "response_time": status_data.get('response_time_ms')
                    })
                else:
                    print(f"[WARN] {site['name']}: No structured data extracted")
                    results.append({
                        "site": site['name'],
                        "status": "extraction_failed"
                    })
            else:
                print(f"[FAIL] {site['name']}: HTTP {response.status_code}")
                results.append({
                    "site": site['name'],
                    "status": "api_error"
                })

        # Summary
        print("\n" + "=" * 60)
        print("[SUMMARY] Monitoring Results")
        print("=" * 60)

        online_count = sum(1 for r in results if r.get('status') == 'ok')
        total_count = len(results)

        print(f"\n{online_count}/{total_count} sites ONLINE")

        for r in results:
            status_emoji = "✅" if r.get('status') == 'ok' else "❌"
            print(f"  {status_emoji} {r['site']}: {r.get('status', 'N/A')}")

        # Test alerting (Discord webhook - optional)
        if online_count < total_count:
            print("\n[ALERT] Some sites are down!")
            print("In production: Send to Discord/Slack webhook")

            # Example Discord webhook (uncomment to use)
            # discord_webhook = os.getenv("DISCORD_WEBHOOK_URL")
            # if discord_webhook:
            #     await send_discord_alert(client, discord_webhook, results)

    print("\n" + "=" * 60)
    print("[LEVEL 3] Test Complete")
    print("=" * 60)
    print("\nNext Steps:")
    print("1. Set up Windows Task Scheduler for periodic checks")
    print("2. Configure Discord/Slack webhook for alerts")
    print("3. Create monitoring dashboard (optional)")


async def send_discord_alert(client, webhook_url, results):
    """Send alert to Discord webhook"""
    down_sites = [r for r in results if r.get('status') != 'ok']

    message = {
        "content": f"🚨 **Monitoring Alert**\n\n{len(down_sites)} site(s) down:",
        "embeds": [
            {
                "title": r['site'],
                "description": f"Status: {r.get('status', 'unknown')}",
                "color": 15158332  # Red
            }
            for r in down_sites
        ]
    }

    await client.post(webhook_url, json=message)
    print("[OK] Alert sent to Discord")


if __name__ == "__main__":
    asyncio.run(test_level3_monitoring())
