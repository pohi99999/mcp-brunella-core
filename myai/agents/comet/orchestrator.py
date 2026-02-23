import os
import asyncio
import logging
from typing import List, Optional, Dict, Any
from playwright.async_api import async_playwright
from .planner import TaskPlanner
from .actor import BrowserActor
from .critic import CriticAgent
from .models import CometResult, ActorResult, CometTask, BrowserStep

logger = logging.getLogger(__name__)

class CometOrchestrator:
    """Fő koordinátor — Planner → Actor → Critic loop"""

    def __init__(self, headless: bool = True):
        self.planner = TaskPlanner()
        self.actor = BrowserActor(headless=headless)
        self.critic = CriticAgent()
        self.max_retries = int(os.getenv("COMET_MAX_RETRIES", "3"))

    async def execute(self, task: str, context: Optional[Dict[str, Any]] = None) -> CometResult:
        """Feladat végrehajtása fázisokra bontva, önjavító mechanizmussal"""
        logger.info(f"[CometOrchestrator] Feladat indítása: {task}")
        
        memory_hints = []
        all_attempts_data = []
        
        for attempt in range(self.max_retries):
            logger.info(f"[CometOrchestrator] Próbálkozás {attempt + 1}/{self.max_retries}")
            
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
                    steps = await self.planner.plan(task, current_url=page.url, memory_hints=memory_hints)
                    
                    # 2. Végrehajtás és Ellenőrzés lépésenként
                    current_attempt_results = []
                    failed = False
                    
                    for step in steps:
                        result = await self.actor.execute_step(step, page)
                        
                        # 3. Ellenőrzés (Critic) ha hiba volt vagy kritikus a lépés
                        if not result.success or step.critical:
                            screenshot_bytes = await page.screenshot()
                            critic_result = await self.critic.evaluate(
                                screenshot_bytes, task, step.model_dump()
                            )
                            
                            if not critic_result.success:
                                logger.warning(f"[CometOrchestrator] Critic hiba detektált: {critic_result.error}")
                                memory_hints.append(f"Hiba a(z) {step.action} lépésnél: {critic_result.error}. Javaslat: {critic_result.suggestion}")
                                failed = True
                                break # Megállítjuk a jelenlegi próbálkozást
                        
                        current_attempt_results.append(result)
                    
                    if not failed:
                        # Ha végigértünk hiba nélkül
                        return CometResult(
                            success=True,
                            data=current_attempt_results,
                            attempts=attempt + 1
                        )

                except Exception as e:
                    logger.error(f"[CometOrchestrator] Váratlan hiba az {attempt + 1}. próbálkozásnál: {e}")
                    memory_hints.append(f"Rendszerhiba: {str(e)}")
                finally:
                    await browser.close()
        
        return CometResult(success=False, error="Max retries reached", attempts=self.max_retries)
