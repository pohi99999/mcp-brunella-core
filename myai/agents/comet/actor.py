import asyncio
import logging
import base64
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, Page, BrowserContext
from .models import BrowserStep, ActorResult

logger = logging.getLogger(__name__)

class BrowserActor:
    """Playwright async — lépések végrehajtója"""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.timeout = 30000  # 30s alapértelmezett timeout

    async def execute_steps(self, steps: List[BrowserStep], pages: List[Page], context: BrowserContext) -> List[ActorResult]:
        """Lépéslista végrehajtása az adott kontextusban"""
        results = []

        for step in steps:
            logger.info(f"[BrowserActor] Végrehajtás: {step.action} (Tab: {step.tab_index})")
            
            # Megfelelő fül (page) kiválasztása vagy létrehozása
            while step.tab_index >= len(pages):
                new_page = await context.new_page()
                pages.append(new_page)
            
            page = pages[step.tab_index]
            
            try:
                result = await self.execute_step(step, page)
                results.append(result)
                
                if not result.success and step.critical:
                    logger.error(f"[BrowserActor] Kritikus hiba a(z) {step.action} lépésnél: {result.error}")
                    break
                    
            except Exception as e:
                logger.error(f"[BrowserActor] Váratlan hiba: {e}")
                results.append(ActorResult(success=False, error=str(e)))
                if step.critical:
                    break

        return results

    async def execute_step(self, step: BrowserStep, page: Page) -> ActorResult:
        """Egyetlen lépés végrehajtása"""
        action = step.action.lower()
        
        try:
            if action == "navigate":
                if not step.url:
                    return ActorResult(success=False, error="Nincs megadva URL a navigációhoz")
                await page.goto(step.url, wait_until="networkidle", timeout=self.timeout)
                return ActorResult(success=True)

            elif action == "search":
                if not step.selector or not step.text:
                    return ActorResult(success=False, error="Hiányzó selector vagy szöveg a kereséshez")
                await page.fill(step.selector, step.text)
                await page.press(step.selector, "Enter")
                await page.wait_for_load_state("networkidle")
                return ActorResult(success=True)

            elif action == "click":
                if not step.selector:
                    # Itt majd a Vision Selector jönne
                    return ActorResult(success=False, error="Nincs selector a kattintáshoz (Vision Selector még nincs kész)")
                await page.click(step.selector, timeout=10000)
                return ActorResult(success=True)

            elif action == "fill":
                if not step.selector or not step.text:
                    return ActorResult(success=False, error="Hiányzó selector vagy szöveg a kitöltéshez")
                await page.fill(step.selector, step.text)
                return ActorResult(success=True)

            elif action == "extract":
                if not step.selector or not step.key:
                    return ActorResult(success=False, error="Hiányzó selector vagy kulcs az adatkinyeréshez")
                text = await page.inner_text(step.selector)
                return ActorResult(success=True, extracted={step.key: text})

            elif action == "screenshot":
                screenshot_bytes = await page.screenshot(full_page=True)
                return ActorResult(success=True, screenshot=screenshot_bytes)

            elif action == "wait":
                seconds = step.description or "2" # Hack: ha a description-be került a szám
                try:
                    sec = float(str(seconds).split()[0])
                except:
                    sec = 2.0
                await asyncio.sleep(sec)
                return ActorResult(success=True)

            else:
                return ActorResult(success=False, error=f"Ismeretlen művelet: {action}")

        except Exception as e:
            return ActorResult(success=False, error=str(e))
