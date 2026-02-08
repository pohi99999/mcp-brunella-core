import httpx
import asyncio
import json

async def debug_task():
    url = "http://localhost:8000/api/task"
    payload = {
        "taskId": "debug-task-1",
        "type": "browser",
        "payload": {
            "instruction": "Go to google.com and take a screenshot.",
            "context": {"headless": True}
        }
    }
    
    print(f"Sending request to {url}...")
    try:
        async with httpx.AsyncClient(timeout=100.0) as client:
            response = await client.post(url, json=payload)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(debug_task())
