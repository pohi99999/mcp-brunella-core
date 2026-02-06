#!/usr/bin/env python3
"""
Robotkéz Level 1 Test: Alapvető Navigáció
"""
import asyncio
import httpx

API_URL = "http://localhost:8000"

async def test_level1():
    print("=" * 60)
    print("[LEVEL 1] Alapveto Navigacio Teszt")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Test 1: Google Search
        print("\n[TEST 1] Google Search")
        print("-" * 60)

        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "test-google-search",
                "type": "browser",
                "payload": {
                    "instruction": "Open google.com and search for 'Playwright Python tutorial'",
                    "context": {}
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            print(f"[OK] Task submitted: {result.get('taskId')}")
            print(f"Result: {result.get('result', {}).get('summary', 'N/A')}")
        else:
            print(f"[FAIL] HTTP {response.status_code}: {response.text}")

        # Test 2: Screenshot
        print("\n[TEST 2] Screenshot")
        print("-" * 60)

        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "test-screenshot",
                "type": "browser",
                "payload": {
                    "instruction": "Open example.com and take a screenshot",
                    "context": {"save_screenshot": True}
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            print(f"[OK] Screenshot saved")
        else:
            print(f"[FAIL] HTTP {response.status_code}")

        # Test 3: Data Extraction
        print("\n[TEST 3] Data Extraction")
        print("-" * 60)

        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "test-extraction",
                "type": "browser",
                "payload": {
                    "instruction": "Open github.com/trending and extract the top 3 repositories",
                    "context": {"extract_json": True}
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            extracted = result.get('result', {}).get('extractedData')
            if extracted:
                print(f"[OK] Extracted {len(extracted)} items")
                print(f"Sample: {extracted[0] if extracted else 'N/A'}")
            else:
                print("[WARN] No data extracted")
        else:
            print(f"[FAIL] HTTP {response.status_code}")

    print("\n" + "=" * 60)
    print("[LEVEL 1] Test Complete")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_level1())
