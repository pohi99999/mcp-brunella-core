#!/usr/bin/env python3
"""
Robotkéz Level 1 Test: Alapvető Navigáció
"""
import asyncio
import httpx

API_URL = "http://localhost:8000"

async def test_level1():
    print("--- 🤖 Robotkéz Level 1 Teszt: Alapvető Navigáció ---")
    async with httpx.AsyncClient(timeout=180.0) as client:
        # 1. Google Keresés
        print("\n[TASK] 1/3: Google keresés 'github playwright'...")
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "level1-google-search",
                "type": "browser",
                "payload": {
                    "instruction": "Go to google.com and search for 'github playwright', then take a screenshot.",
                    "context": {"headless": True, "save_screenshot": True}
                },
            }
        )
        if response.status_code == 200:
            print("[OK] Google keresés sikeres.")
        else:
            print(f"[FAIL] Google keresés hiba: {response.text}")
            return

        # 2. GitHub Trending
        print("\n[TASK] 2/3: GitHub Trending repók kinyerése...")
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "level1-github-trending",
                "type": "browser",
                "payload": {
                    "instruction": "Go to github.com/trending and extract the names and URLs of the top 3 repositories. Return as JSON.",
                    "context": {"headless": True, "extract_json": True}
                },
            }
        )
        if response.status_code == 200:
            data = response.json().get("result", {}).get("extractedData", [])
            print(f"[OK] GitHub Trending sikeresen kinyerve. {len(data)} repó található.")
            if data:
                for repo in data[:3]:
                    print(f"  - {repo.get('name')}: {repo.get('url')}")
        else:
            print(f"[FAIL] GitHub Trending hiba: {response.text}")
            return

        # 3. Weboldal tartalmának ellenőrzése
        print("\n[TASK] 3/3: n8n.io weboldal tartalmának ellenőrzése...")
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "level1-content-check",
                "type": "browser",
                "payload": {
                    "instruction": "Go to n8n.io and check if the text 'workflow automation' is present on the page.",
                    "context": {"headless": True}
                },
            }
        )
        if response.status_code == 200 and 'is present' in response.json().get('result', {}).get('summary', ''):
             print("[OK] 'workflow automation' szöveg megtalálható az n8n.io oldalon.")
        else:
            print(f"[FAIL] n8n.io tartalomellenőrzés hiba: {response.text}")
            return

    print("\n--- ✅ Robotkéz Level 1 Teszt Befejezve ---")

if __name__ == "__main__":
    asyncio.run(test_level1())