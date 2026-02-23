import os
import asyncio
import logging
from typing import List, Optional, Dict, Any
from playwright.async_api import async_playwright
from .planner import TaskPlanner
from .actor import BrowserActor
from .models import CometResult, ActorResult, CometTask

logger = logging.getLogger(__name__)

class CometOrchestrator:
    """Fő koordinátor — Planner → Actor loop"""

    def __init__(self, headless: bool = True):
        self.planner = TaskPlanner()
        self.actor = BrowserActor(headless=headless)
        self.max_retries = int(os.getenv("COMET_MAX_RETRIES", "3"))

    async def execute(self, task: str, context: Optional[Dict[str, Any]] = None) -> CometResult:
        """Feladat végrehajtása fázisokra bontva"""
        logger.info(f"[CometOrchestrator] Feladat indítása: {task}")
        
        attempts = 0
        all_results = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.actor.headless)
            browser_context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            
            # Első oldal létrehozása
            page = await browser_context.new_page()
            pages = [page]
            
            try:
                # 1. Tervezés
                current_url = page.url
                steps = await self.planner.plan(task, current_url=current_url)
                
                # 2. Végrehajtás
                results = await self.actor.execute_steps(steps, pages, browser_context)
                all_results.extend(results)
                
                success = all(r.success for r in results)
                
                # TODO: Phase 2-ben itt jönne a CriticAgent és a Retry loop
                
                return CometResult(
                    success=success,
                    data=all_results,
                    attempts=1,
                    error=None if success else "Egy vagy több lépés sikertelen volt"
                )

            except Exception as e:
                logger.error(f"[CometOrchestrator] Végrehajtási hiba: {e}")
                return CometResult(success=False, error=str(e), attempts=1)
            finally:
                await browser.close()
