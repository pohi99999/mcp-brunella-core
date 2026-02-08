#!/usr/bin/env python3
"""
Robotkéz Level 1 Test: Alapvető Navigáció
"""
import asyncio
import httpx

API_URL = "http://localhost:3000"  # Corrected port for the main server

async def run_robotkez_task(client, instruction, context):
    """Helper to execute a task via the Robotkez agent."""
    response = await client.post(
        f"{API_URL}/api/agents/Robotkez/execute",
        json={
            "task": instruction,
            "context": context
        },
        timeout=180.0
    )
    response.raise_for_status()
    return response.json()

async def test_level1():
    print("--- Robotkez Level 1 Teszt: Alapveto Navigacio ---")
    async with httpx.AsyncClient() as client:
        try:
            # 1. Google Keresés
            print("\n[TASK] 1/3: Google keresés 'github playwright'...")
            instruction1 = "Go to google.com and search for 'github playwright', then take a screenshot."
            context1 = {"headless": True, "save_screenshot": True}
            result1 = await run_robotkez_task(client, instruction1, context1)
            print("[OK] Google keresés sikeres.")

            # 2. GitHub Trending
            print("\n[TASK] 2/3: GitHub Trending repók kinyerése...")
            instruction2 = "Go to github.com/trending and extract the names and URLs of the top 3 repositories. Return as JSON."
            context2 = {"headless": True, "extract_json": True}
            result2 = await run_robotkez_task(client, instruction2, context2)
            
            # The actual data is nested in the agent's response
            data = result2.get("result", {}).get("data", {}).get("extractedData", [])
            print(f"[OK] GitHub Trending sikeresen kinyerve. {len(data)} repó található.")
            if data:
                for repo in data[:3]:
                    # Ensure repo is a dict before accessing keys
                    if isinstance(repo, dict):
                        print(f"  - {repo.get('name', 'N/A')}: {repo.get('url', 'N/A')}")

            # 3. Weboldal tartalmának ellenőrzése
            print("\n[TASK] 3/3: n8n.io weboldal tartalmának ellenőrzése...")
            instruction3 = "Go to n8n.io and check if the text 'workflow automation' is present on the page."
            context3 = {"headless": True}
            result3 = await run_robotkez_task(client, instruction3, context3)
            
            summary = result3.get("result", {}).get("data", {}).get("summary", "")
            if 'is present' in summary:
                 print("[OK] 'workflow automation' szöveg megtalálható az n8n.io oldalon.")
            else:
                 print(f"[WARN] n8n.io tartalomellenőrzés: a várt szöveg nem egyértelműen található. Válasz: {summary}")

        except httpx.HTTPStatusError as e:
            print(f"[FAIL] HTTP hiba: {e.response.status_code} - {e.response.text}")
            return
        except httpx.RequestError as e:
            print(f"[FAIL] Kapcsolati hiba: {e}")
            return
        except Exception as e:
            print(f"[FAIL] Váratlan hiba: {e}")
            return

    print("\n--- Robotkez Level 1 Teszt Befejezve ---")

if __name__ == "__main__":
    asyncio.run(test_level1())