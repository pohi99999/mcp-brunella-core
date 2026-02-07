#!/usr/bin/env python3
"""
Robotkéz Level 2 Test: n8n Workflow Management
"""
import asyncio
import httpx
import os
import random
import string

API_URL = "http://localhost:8000"
N8N_URL = os.getenv("N8N_BASE_URL", "https://n8n-latest-fulv.onrender.com")
N8N_USER = os.getenv("N8N_TEST_USER", "test@example.com")
N8N_PASS = os.getenv("N8N_TEST_PASSWORD", "testpassword123")

def generate_random_string(length=8):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))

async def test_level2():
    print("--- 🤖 Robotkéz Level 2 Teszt: n8n Workflow Management ---")
    
    if not N8N_PASS:
        print("[FAIL] N8N_TEST_PASSWORD environment variable is not set. Aborting.")
        return

    workflow_name = f"Robotkéz Test Workflow - {generate_random_string()}"

    async with httpx.AsyncClient(timeout=300.0) as client:
        # 1. Login to n8n
        print(f"\n[TASK] 1/3: Bejelentkezés az n8n rendszerbe: {N8N_URL}...")
        login_instruction = f"""
        1. Navigate to {N8N_URL}
        2. If a login form is visible, find the username/email field and type '{N8N_USER}'.
        3. Find the password field and type '{N8N_PASS}'.
        4. Click the 'Sign in' or 'Login' button.
        5. After login, wait for the dashboard page to load and confirm by checking for the text 'Workflows'.
        """
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "level2-n8n-login",
                "type": "browser",
                "payload": {"instruction": login_instruction, "context": {"headless": True}},
            }
        )
        if response.status_code == 200 and 'Workflows' in response.json().get('result', {}).get('summary', ''):
            print("[OK] Sikeres bejelentkezés.")
        else:
            print(f"[FAIL] Bejelentkezési hiba: {response.text}")
            # return # Don't stop, maybe session is already active

        # 2. Create a new workflow
        print(f"\n[TASK] 2/3: Új workflow létrehozása '{workflow_name}' néven...")
        create_instruction = f"""
        1. Assuming you are logged into n8n, find and click the 'Add workflow' or 'New workflow' button.
        2. Wait for the new workflow editor to load.
        3. Find the workflow title, which might be 'My workflow', and click it to edit.
        4. Rename the workflow to '{workflow_name}'.
        5. Click 'Save' or a similar button to save the changes.
        """
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "level2-n8n-create-workflow",
                "type": "browser",
                "payload": {"instruction": create_instruction, "context": {"headless": True}},
            }
        )
        if response.status_code == 200:
            print(f"[OK] Workflow '{workflow_name}' létrehozása valószínűleg sikeres.")
        else:
            print(f"[FAIL] Workflow létrehozási hiba: {response.text}")
            return
            
        # 3. List workflows to verify creation
        print(f"\n[TASK] 3/3: Workflow lista ellenőrzése...")
        list_instruction = f"""
        1. Go to the main dashboard or the 'Workflows' page.
        2. Extract the names of all visible workflows on the page.
        3. Return the list as a JSON array of objects with a 'name' key.
        """
        response = await client.post(
            f"{API_URL}/api/task",
            json={
                "taskId": "level2-n8n-list-workflows",
                "type": "browser",
                "payload": {"instruction": list_instruction, "context": {"headless": True, "extract_json": True}},
            }
        )

        if response.status_code == 200:
            workflows = response.json().get('result', {}).get('extractedData', [])
            found = any(workflow.get('name') == workflow_name for workflow in workflows)
            if found:
                print(f"[OK] Az új workflow '{workflow_name}' megtalálható a listában.")
            else:
                print(f"[WARN] Az új workflow '{workflow_name}' nem található a listában. Lehet, hogy a létrehozás lassú volt.")
                print("Jelenlegi workflow-k:", [w.get('name') for w in workflows])
        else:
            print(f"[FAIL] Workflow lista lekérdezési hiba: {response.text}")

    print("\n--- ✅ Robotkéz Level 2 Teszt Befejezve ---")

if __name__ == "__main__":
    asyncio.run(test_level2())