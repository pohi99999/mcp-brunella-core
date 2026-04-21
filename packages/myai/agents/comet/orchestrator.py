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
    """Fo koordinator - Planner -> Actor -> Critic loop memoriaval"""

    def __init__(self, headless: bool = True):
        self.planner = TaskPlanner()
        self.actor = BrowserActor(headless=headless)
        self.critic = CriticAgent()
        self.memory = ActionMemory()
        self.max_retries = int(os.getenv("COMET_MAX_RETRIES", "3"))
        self._step_callback = None  # opcionalis callback lepesenkent

    def on_step(self, callback):
        """Regisztral egy callback-et, ami minden lepesnel meghivodik.
        callback(step_info: dict) - {"attempt", "step_index", "action", "success", "error"}
        """
        self._step_callback = callback

    async def _notify_step(self, info: dict):
        if self._step_callback:
            try:
                result = self._step_callback(info)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.warning(f"[CometOrchestrator] Step callback hiba: {e}")

    async def execute_with_page(self, task: str, page, context=None,
                                 extra_hints: Optional[List[str]] = None) -> CometResult:
        """Feladat vegrehajtasa KULSO Playwright page-en (nem indit sajat bongeszot).

        Args:
            task: Szoveges feladat
            page: Meglevo Playwright Page objektum
            context: Opcionalis BrowserContext (session menteshez)
            extra_hints: Plusz memoria tippek (pl. n8n anchors, general_knowledge)
        """
        logger.info(f"[CometOrchestrator] execute_with_page: {task}")
        memory_hints = list(extra_hints or [])
        all_results: List[ActorResult] = []

        for attempt in range(self.max_retries):
            logger.info(f"[CometOrchestrator] Probaltozas {attempt + 1}/{self.max_retries}")
            await self._notify_step({
                "type": "attempt_start", "attempt": attempt + 1,
                "max_retries": self.max_retries, "task": task
            })

            try:
                current_url = page.url
                domain = urlparse(current_url).netloc
                hints = await self.memory.get_hints(domain, task) if domain else []

                steps = await self.planner.plan(
                    task, current_url=current_url,
                    memory_hints=memory_hints + hints
                )

                failed = False
                current_attempt_results: List[ActorResult] = []

                for step_idx, step in enumerate(steps):
                    await self._notify_step({
                        "type": "step_start", "attempt": attempt + 1,
                        "step_index": step_idx, "total_steps": len(steps),
                        "action": step.action,
                        "description": step.description or step.action
                    })

                    result = await self.actor.execute_step(step, page)

                    await self._notify_step({
                        "type": "step_done", "attempt": attempt + 1,
                        "step_index": step_idx, "action": step.action,
                        "success": result.success,
                        "error": result.error
                    })

                    if not result.success or step.critical:
                        screenshot_bytes = await page.screenshot()
                        critic_result = await self.critic.evaluate(
                            screenshot_bytes, task, step.model_dump()
                        )
                        if not critic_result.success:
                            logger.warning(f"[CometOrchestrator] Critic hiba: {critic_result.error}")
                            memory_hints.append(
                                f"Hiba a(z) {step.action} lepesnel: {critic_result.error}. "
                                f"Javaslat: {critic_result.suggestion}"
                            )
                            failed = True
                            break

                    if result.success and step.selector and domain:
                        await self.memory.record_success(
                            domain, step.description or step.action, step.selector
                        )

                    current_attempt_results.append(result)

                if not failed:
                    if context:
                        try:
                            await context.storage_state(path="data/comet_session.json")
                        except Exception:
                            pass
                    return CometResult(
                        success=True, data=current_attempt_results,
                        attempts=attempt + 1
                    )

            except Exception as e:
                logger.error(f"[CometOrchestrator] Hiba #{attempt + 1}: {e}")
                memory_hints.append(f"Rendszerhiba: {str(e)}")

        return CometResult(
            success=False, error="Max retries reached",
            attempts=self.max_retries
        )

    async def execute(self, task: str, context: Optional[Dict[str, Any]] = None) -> CometResult:
        """Feladat vegrehajtasa fazisokra bontva, onjavito mechanizmussal es memoriaval"""
        logger.info(f"[CometOrchestrator] Feladat inditasa: {task}")
        
        session_path = "data/comet_session.json"
        memory_hints = []
        all_results = []
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.actor.headless)
            
            # Munkamenet betoltese ha letezik
            storage_state = session_path if os.path.exists(session_path) else None
            
            browser_context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                storage_state=storage_state
            )
            
            # Elso oldal letrehozasa
            page = await browser_context.new_page()
            pages = [page]
            
            for attempt in range(self.max_retries):
                logger.info(f"[CometOrchestrator] Probaltozas {attempt + 1}/{self.max_retries}")
                
                try:
                    # 1. Domain kinyeres es memoria tippek
                    current_url = page.url
                    domain = urlparse(current_url).netloc
                    hints = await self.memory.get_hints(domain, task) if domain else []
                    
                    # 2. Tervezes
                    steps = await self.planner.plan(task, current_url=current_url, memory_hints=memory_hints + hints)
                    
                    # 3. Vegrehajtas es Ellenorzes lepesenkent
                    failed = False
                    current_attempt_results = []
                    
                    for step in steps:
                        result = await self.actor.execute_step(step, page)
                        
                        # 4. Ellenorzes (Critic) ha hiba volt vagy kritikus a lepes
                        if not result.success or step.critical:
                            screenshot_bytes = await page.screenshot()
                            critic_result = await self.critic.evaluate(
                                screenshot_bytes, task, step.model_dump()
                            )
                            
                            if not critic_result.success:
                                logger.warning(f"[CometOrchestrator] Critic hiba detektalt: {critic_result.error}")
                                memory_hints.append(f"Hiba a(z) {step.action} lepesnel: {critic_result.error}. Javaslat: {critic_result.suggestion}")
                                failed = True
                                break # Megallitjuk a jelenlegi probaltozast
                        
                        # Sikeres akcio mentese a memoriaba (ha volt selector)
                        if result.success and step.selector and domain:
                            await self.memory.record_success(domain, step.description or step.action, step.selector)
                        
                        current_attempt_results.append(result)
                    
                    if not failed:
                        # Mentjuk a munkamenetet sikeres vegrehajtas utan
                        await browser_context.storage_state(path=session_path)
                        await browser.close()
                        return CometResult(
                            success=True,
                            data=current_attempt_results,
                            attempts=attempt + 1
                        )

                except Exception as e:
                    logger.error(f"[CometOrchestrator] Varatlan hiba az {attempt + 1}. probaltozasnal: {e}")
                    memory_hints.append(f"Rendszerhiba: {str(e)}")
            
            await browser.close()
        
        return CometResult(success=False, error="Max retries reached", attempts=self.max_retries)
