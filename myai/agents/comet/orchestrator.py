import os
import asyncio
import logging
from urllib.parse import urlparse
from typing import List, Optional, Dict, Any
from playwright.async_api import async_playwright
from .planner import TaskPlanner
from .actor import BrowserActor
from .critic import CriticAgent
from .memory import ActionMemory
from .models import CometResult, ActorResult, CometTask, BrowserStep

logger = logging.getLogger(__name__)

class CometOrchestrator:
    """Fő koordinátor — Planner → Actor → Critic loop memóriával"""

    def __init__(self, headless: bool = True):
        self.planner = TaskPlanner()
        self.actor = BrowserActor(headless=headless)
        self.critic = CriticAgent()
        self.memory = ActionMemory()
        self.max_retries = int(os.getenv("COMET_MAX_RETRIES", "3"))

    async def execute(self, task: str, context: Optional[Dict[str, Any]] = None) -> CometResult:
        """Feladat végrehajtása fázisokra bontva, önjavító mechanizmussal és memóriával"""
        logger.info(f"[CometOrchestrator] Feladat indítása: {task}")
        
        session_path = "data/comet_session.json"
        memory_hints = []
        all_results = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.actor.headless)
            
            # Munkamenet betöltése ha létezik
            storage_state = session_path if os.path.exists(session_path) else None
            
            browser_context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                storage_state=storage_state
            )
            
            # Első oldal létrehozása
            page = await browser_context.new_page()
            pages = [page]
            
            for attempt in range(self.max_retries):
                logger.info(f"[CometOrchestrator] Próbálkozás {attempt + 1}/{self.max_retries}")
                
                try:
                    # 1. Domain kinyerés és memória tippek
                    current_url = page.url
                    domain = urlparse(current_url).netloc
                    hints = await self.memory.get_hints(domain, task) if domain else []
                    
                    # 2. Tervezés
                    steps = await self.planner.plan(task, current_url=current_url, memory_hints=memory_hints + hints)
                    
                    # 3. Végrehajtás és Ellenőrzés lépésenként
                    failed = False
                    current_attempt_results = []
                    
                    for step in steps:
                        result = await self.actor.execute_step(step, page)
                        
                        # 4. Ellenőrzés (Critic) ha hiba volt vagy kritikus a lépés
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
                        
                        # Sikeres akció mentése a memóriába (ha volt selector)
                        if result.success and step.selector and domain:
                            await self.memory.record_success(domain, step.description or step.action, step.selector)
                        
                        current_attempt_results.append(result)
                    
                    if not failed:
                        # Mentjük a munkamenetet sikeres végrehajtás után
                        await browser_context.storage_state(path=session_path)
                        await browser.close()
                        return CometResult(
                            success=True,
                            data=current_attempt_results,
                            attempts=attempt + 1
                        )

                except Exception as e:
                    logger.error(f"[CometOrchestrator] Váratlan hiba az {attempt + 1}. próbálkozásnál: {e}")
                    memory_hints.append(f"Rendszerhiba: {str(e)}")
            
            await browser.close()
        
        return CometResult(success=False, error="Max retries reached", attempts=self.max_retries)
