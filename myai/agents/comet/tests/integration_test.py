import asyncio
import os
import sys
import logging
from dotenv import load_dotenv

# Add project root to sys.path
# Current file is at myai/agents/comet/tests/integration_test.py
# We need myai to be importable
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
MYAI_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
if MYAI_DIR not in sys.path:
    sys.path.append(MYAI_DIR)

from agents.comet.orchestrator import CometOrchestrator

logging.basicConfig(level=logging.INFO)

async def test_comet_simple():
    print("🚀 RobotkezV2 Comet Integrációs Teszt Indítása...")
    
    orchestrator = CometOrchestrator(headless=True)
    
    # 1. Teszt: Egyszerű navigáció és cím kinyerés
    task = "Nyisd meg a google.com-ot és mondd meg mi a címe"
    print(f"\nTask: {task}")
    
    result = await orchestrator.execute(task)
    
    print(f"Success: {result.success}")
    print(f"Attempts: {result.attempts}")
    if result.error:
        print(f"Error: {result.error}")
    
    for i, res in enumerate(result.data):
        print(f"Step {i+1} result: success={res.success}, extracted={res.extracted}")

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(test_comet_simple())

