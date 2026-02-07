#!/usr/bin/env python3
"""
Robotkéz Level 3 Test: Website Monitoring & Alerting
"""
import asyncio
import httpx
import os
from datetime import datetime

API_URL = "http://localhost:8000"

SITES_TO_MONITOR = {
    "Cloudflare Worker": "https://bas-orchestrator.iam-dd1.workers.dev/health",
    "n8n Server": "https://n8n-latest-fulv.onrender.com/healthz",
    "Local Backend": "http://localhost:3000/api/health"
}

async def check_site(client: httpx.AsyncClient, site_name: str, url: str) -> bool:
    print(f"\n[TASK] '{site_name}' ellenőrzése: {url}...")
    try:
        # Use a simple GET request for health checks
        response = await client.get(url, timeout=60.0)
        
        # Check for successful status code
        if 200 <= response.status_code < 300:
            print(f"[OK] '{site_name}' elérhető (Status: {response.status_code}).")
            return True
        else:
            print(f"[FAIL] '{site_name}' nem elérhető (Status: {response.status_code}).")
            return False
    except httpx.RequestError as e:
        print(f"[FAIL] '{site_name}' kapcsolódási hiba: {e}")
        return False

async def test_level3():
    print("--- 🤖 Robotkéz Level 3 Teszt: Website Monitoring & Alerting ---")
    
    all_ok = True
    async with httpx.AsyncClient() as client:
        tasks = [check_site(client, name, url) for name, url in SITES_TO_MONITOR.items()]
        results = await asyncio.gather(*tasks)
        
        if not all(results):
            all_ok = False

    if all_ok:
        print("\n--- ✅ Minden monitorozott oldal sikeresen elérhető! ---")
    else:
        print("\n--- 🚨 Hiba! Egy vagy több oldal nem elérhető! ---")
        # In a real scenario, you would trigger an alert here (e.g., via n8n webhook)
        print("Riasztás küldése szimulálva...")

if __name__ == "__main__":
    asyncio.run(test_level3())