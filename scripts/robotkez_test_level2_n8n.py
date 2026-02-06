#!/usr/bin/env python3
"""
Robotkéz Level 2 Test: n8n Workflow Management
"""
import asyncio
import httpx
import os

API_URL = "http://localhost:8000"
N8N_URL = os.getenv("N8N_TEST_URL", "https://n8n-latest-fulv.onrender.com")
N8N_USER = os.getenv("N8N_TEST_USER", "peterpohankapesonal@gmail.com")
N8N_PASSWORD = os.getenv("N8N_TEST_PASSWORD", "Iszapfalo2026")

async def test_level2_n8n():
    print("=" * 60)
    print("[LEVEL 2] n8n Workflow Management Test")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=180.0) as client:
        # Test 1: n8n Login
        print("\n[TEST 1] n8n Login")
        print("-" * 60)

        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "n8n-login",
                "type": "browser",
                "payload": {
                    "instruction": f"""
                    Open {N8N_URL}/signin and login with:
                    Email: {N8N_USER}
                    Password: {N8N_PASSWORD}

                    Verify successful login by checking for dashboard or workflows page.
                    """,
                    "context": {
                        "headless": False,  # Show browser for debugging
                        "save_screenshot": True
                    }
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            print(f"[OK] Login task submitted: {result.get('taskId')}")
            summary = result.get('result', {}).get('summary', '')
            print(f"Summary: {summary[:100]}...")

            # Check for success indicators
            if "dashboard" in summary.lower() or "workflow" in summary.lower():
                print("[SUCCESS] Login verified!")
            else:
                print("[WARN] Login success unclear, check screenshot")
        else:
            print(f"[FAIL] HTTP {response.status_code}: {response.text}")
            return

        # Test 2: Create Basic Workflow
        print("\n[TEST 2] Create Basic HTTP Workflow")
        print("-" * 60)

        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "n8n-create-workflow",
                "type": "browser",
                "payload": {
                    "instruction": f"""
                    In n8n at {N8N_URL}:
                    1. Click 'New Workflow' or '+' button
                    2. Add 'Webhook' trigger node
                    3. Add 'HTTP Request' node
                    4. Connect them
                    5. Save workflow as 'Test Workflow - Robotkez'

                    Extract the workflow URL or ID if visible.
                    """,
                    "context": {
                        "headless": False,
                        "extract_json": True,
                        "save_screenshot": True
                    }
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            print(f"[OK] Workflow creation task submitted")
            extracted = result.get('result', {}).get('extractedData')
            if extracted:
                print(f"Extracted data: {extracted}")
            else:
                print("[INFO] No structured data extracted, check screenshot")

            summary = result.get('result', {}).get('summary', '')
            if "saved" in summary.lower() or "workflow" in summary.lower():
                print("[SUCCESS] Workflow created!")
            else:
                print("[WARN] Workflow creation unclear")
        else:
            print(f"[FAIL] HTTP {response.status_code}")

        # Test 3: List Workflows
        print("\n[TEST 3] List Existing Workflows")
        print("-" * 60)

        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "n8n-list-workflows",
                "type": "browser",
                "payload": {
                    "instruction": f"""
                    In n8n at {N8N_URL}:
                    Go to workflows page and extract all workflow names and IDs.
                    Return as JSON list: [{{"name": "...", "id": "..."}}, ...]
                    """,
                    "context": {
                        "headless": False,
                        "extract_json": True
                    }
                },
                "callbackUrl": ""
            }
        )

        if response.status_code == 200:
            result = response.json()
            extracted = result.get('result', {}).get('extractedData')
            if extracted and isinstance(extracted, list):
                print(f"[OK] Found {len(extracted)} workflows:")
                for wf in extracted[:3]:  # Show first 3
                    print(f"  - {wf.get('name', 'N/A')} (ID: {wf.get('id', 'N/A')})")
            else:
                print("[INFO] Workflows list extraction unclear")
        else:
            print(f"[FAIL] HTTP {response.status_code}")

    print("\n" + "=" * 60)
    print("[LEVEL 2] Test Complete")
    print("=" * 60)
    print("\nNext: Check screenshots in myai/ folder")
    print("If tests passed, proceed to Level 3 (Monitoring)")

if __name__ == "__main__":
    asyncio.run(test_level2_n8n())
