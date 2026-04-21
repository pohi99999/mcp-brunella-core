import asyncio
import httpx

async def check_cloudflare_workers():
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "http://localhost:8000/api/task",
            json={
                "taskId": "cf-workers-check",
                "type": "browser",
                "payload": {
                    "instruction": """
                    1. Login to dash.cloudflare.com
                    2. Go to Workers & Pages
                    3. Extract all workers: name, URL, status
                    4. Return JSON: [{"name": "...", "url": "...", "status": "..."}]
                    """,
                    "context": {
                        "headless": False,
                        "extract_json": True
                    }
                },
                "callbackUrl": ""
            }
        )

        result = response.json()
        if 'result' in result and 'extractedData' in result['result']:
             workers = result['result']['extractedData']
             print(f"Found workers: {workers}")
        else:
             print("No workers found or error:", result)

if __name__ == "__main__":
    asyncio.run(check_cloudflare_workers())
