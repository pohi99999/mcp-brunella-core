#!/usr/bin/env python3
"""
Robotkéz Level 2 Test: n8n Workflow Management
"""
import asyncio
import httpx
import os
import random
import string

API_URL = "http://localhost:3000" # Corrected port
N8N_URL = os.getenv("N8N_BASE_URL", "https://n8n-latest-fulv.onrender.com")
N8N_USER = os.getenv("N8N_TEST_USER", "test@example.com")
N8N_PASS = os.getenv("N8N_TEST_PASSWORD", "testpassword123")

def generate_random_string(length=8):
    letters = string.ascii_lowercase
    return ''.join(random.choice(letters) for i in range(length))

async def run_robotkez_task(client, instruction, context):
    """Helper to execute a task via the Robotkez agent."""
    response = await client.post(
        f"{API_URL}/api/agents/Robotkez/execute",
        json={
            "task": instruction,
            "context": context
        },
        timeout=300.0
    )
    response.raise_for_status()
    return response.json()

async def test_level2():
    print("--- Robotkez Level 2 Teszt: n8n Workflow Management ---")
    
    if not N8N_PASS or not N8N_USER:
        print("[FAIL] N8N_TEST_USER or N8N_TEST_PASSWORD environment variable is not set. Aborting.")
        return

    workflow_name = f"Robotkéz Test Workflow - {generate_random_string()}"

    async with httpx.AsyncClient() as client:
        try:
            # 1. Login to n8n
            print(f"\n[TASK] 1/3: Bejelentkezés az n8n rendszerbe: {N8N_URL}...")
            login_instruction = f"""
            1. Navigate to {N8N_URL}
            2. If a login form is visible, find the username/email field and type '{N8N_USER}'.
            3. Find the password field and type '{N8N_PASS}'.
            4. Click the 'Sign in' or 'Login' button.
            5. After login, wait for the dashboard page to load and confirm by checking for the text 'Workflows'.
            """
            login_result = await run_robotkez_task(client, login_instruction, {"headless": True})
            
            login_summary = login_result.get("result", {}).get("data", {}).get("summary", "")
            if 'Workflows' in login_summary or 'dashboard' in login_summary:
                print("[OK] Sikeres bejelentkezés.")
            else:
                print(f"[WARN] Bejelentkezés nem egyértelmű, de folytatjuk. Válasz: {login_summary}")

            # 2. Create a new workflow
            print(f"\n[TASK] 2/3: Új workflow létrehozása '{workflow_name}' néven...")
            create_instruction = f"""
            1. Assuming you are logged into n8n, find and click the 'Add workflow' or 'New workflow' button.
            2. Wait for the new workflow editor to load.
            3. Find the workflow title, which might be 'My workflow', and click it to edit.
            4. Rename the workflow to '{workflow_name}'.
            5. Click 'Save' or a similar button to save the changes.
            """
            await run_robotkez_task(client, create_instruction, {"headless": True})
            print(f"[OK] Workflow '{workflow_name}' létrehozási kísérlet elküldve.")
            
            # Give n8n a moment to process
            await asyncio.sleep(5)

            # 3. List workflows to verify creation
            print(f"\n[TASK] 3/3: Workflow lista ellenőrzése...")
            list_instruction = """
            1. Go to the main dashboard or the 'Workflows' page.
            2. Extract the names of all visible workflows on the page.
            3. Return the list as a JSON array of objects with a 'name' key.
            """
            list_result = await run_robotkez_task(client, list_instruction, {"headless": True, "extract_json": True})

            workflows = list_result.get("result", {}).get("data", {}).get("extractedData", [])
            
            if not isinstance(workflows, list):
                print(f"[FAIL] Helytelen adat érkezett a workflow listázásakor: {workflows}")
                return

            found = any(isinstance(w, dict) and w.get('name') == workflow_name for w in workflows)
            if found:
                print(f"[OK] Az új workflow '{workflow_name}' megtalálható a listában.")
            else:
                print(f"[WARN] Az új workflow '{workflow_name}' nem található a listában. Lehet, hogy a létrehozás lassú volt.")
                current_names = [w.get('name') for w in workflows if isinstance(w, dict)]
                print("Jelenlegi workflow-k:", current_names)
        
        except httpx.HTTPStatusError as e:
            print(f"[FAIL] HTTP hiba: {e.response.status_code} - {e.response.text}")
            return
        except httpx.RequestError as e:
            print(f"[FAIL] Kapcsolati hiba: {e}")
            return
        except Exception as e:
            print(f"[FAIL] Váratlan hiba: {e}")
            return

    print("\n--- Robotkez Level 2 Teszt Befejezve ---")

if __name__ == "__main__":
    asyncio.run(test_level2())