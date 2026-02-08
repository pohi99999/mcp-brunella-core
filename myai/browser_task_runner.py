# FILE: myai/browser_task_runner.py
# PURPOSE: CLI-alapú böngésző vezérlés (Browser-Use + Gemini 1.5 Flash).
# Node.js python-shell híd hívja --task argumentummal.

import os
import sys
import json
import asyncio
import argparse
from typing import Optional, Dict, Any
from pydantic import BaseModel
from dotenv import load_dotenv

# Browser-use importok (v0.11.9+)
from browser_use import Agent, ChatGoogle

# Környezeti változók betöltése
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# --- ADATSTRUKTÚRÁK ---

class BrowserTaskResult(BaseModel):
    success: bool
    final_answer: str
    extracted_data: Optional[Dict[str, Any]] = None
    screenshot_path: Optional[str] = None
    error: Optional[str] = None

# --- KONFIGURÁCIÓ ---

def get_llm(model: str = "gemini-1.5-flash"):
    """Gemini inicializálása browser-use ChatGoogle wrapper-rel."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY vagy GOOGLE_API_KEY nincs beállítva a .env fájlban!")
    
    # browser-use saját wrapper-e a GOOGLE_API_KEY-t használja
    if not os.getenv("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = api_key
    
    return ChatGoogle(model=model)

# --- FŐ LOGIKA ---

async def run_browser_task(task: str, headless: bool = True, use_vision: bool = True) -> BrowserTaskResult:
    """
    Végrehajt egy böngészős feladatot a browser-use könyvtár segítségével.
    """
    try:
        # LLM inicializálása
        llm = get_llm()
        
        # Agent létrehozása (browser-use 0.11.9+ egyszerűsített API)
        # A browser konfigurációt az Agent automatikusan kezeli
        agent = Agent(
            task=task,
            llm=llm,
            use_vision=use_vision,
        )

        # Futtatás
        history = await agent.run()
        result = history.final_result()
        
        # Eredmény feldolgozása
        return BrowserTaskResult(
            success=True,
            final_answer=str(result),
            extracted_data={"raw_history_length": len(history.history)} # Metadata
        )

    except Exception as e:
        return BrowserTaskResult(
            success=False,
            final_answer="Hiba történt a végrehajtás során.",
            error=str(e)
        )

# --- CLI INTERFÉSZ (Node.js híváshoz) ---

if __name__ == "__main__":
    # Argumentumok parsrolása
    parser = argparse.ArgumentParser(description="Brunella Robotkéz CLI Task Runner")
    parser.add_argument("--task", type=str, required=True, help="A végrehajtandó feladat leírása")
    parser.add_argument("--headless", type=str, default="True", help="Headless mód (True/False)")
    parser.add_argument("--vision", type=str, default="True", help="Vision használata (True/False)")
    
    args = parser.parse_args()
    
    # Boolean konverzió
    is_headless = args.headless.lower() == "true"
    use_vision = args.vision.lower() == "true"

    # Async futtatás
    result = asyncio.run(run_browser_task(args.task, is_headless, use_vision))
    
    # JSON kimenet stdout-ra (ezt olvassa a Node.js)
    print(result.model_dump_json())
