import asyncio
import logging
import base64
import os
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright, Page, BrowserContext
from openai import AsyncOpenAI
from .models import BrowserStep, ActorResult

logger = logging.getLogger(__name__)

try:
    import pyautogui
    _HAS_PYAUTOGUI = True
except ImportError:
    _HAS_PYAUTOGUI = False

class BrowserActor:
    """Playwright async - lepesek vegrehajtoja"""

    def __init__(self, headless: bool = True):
        self.headless = headless
        self.timeout = 30000  # 30s alapertelmezett timeout
        github_pat = os.getenv("GITHUB_PAT")
        if github_pat:
            self.vision_client = AsyncOpenAI(
                base_url="https://models.inference.ai.azure.com",
                api_key=github_pat
            )
        else:
            self.vision_client = None

    async def _vision_selector(self, page: Page, description: str) -> Optional[str]:
        """Screenshot -> GPT-4o vision -> CSS selector"""
        if not self.vision_client:
            logger.warning("[BrowserActor] Nincs GITHUB_PAT, Vision Selector nem erheto el.")
            return None

        try:
            logger.info(f"[BrowserActor] Vision Selector keresese: {description}")
            screenshot_bytes = await page.screenshot()
            base64_image = base64.b64encode(screenshot_bytes).decode('utf-8')

            prompt = f"A csatolt kepernyokepen keresd meg a kovetkezot: '{description}'. Adj vissza egy pontos CSS selectort, amivel kattintani lehet ra vagy ki lehet tolteni. Csak a selectort add vissza, semmi mast."

            response = await self.vision_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/png;base64,{base64_image}"}
                            }
                        ]
                    }
                ],
                max_tokens=50
            )

            selector = response.choices[0].message.content.strip().replace('`', '')
            logger.info(f"[BrowserActor] Vision altal talalt selector: {selector}")
            return selector
        except Exception as e:
            logger.error(f"[BrowserActor] Vision Selector hiba: {e}")
            return None

    async def execute_steps(self, steps: List[BrowserStep], pages: List[Page], context: BrowserContext) -> List[ActorResult]:
        """Lepeslista vegrehajtasa az adott kontextusban"""
        results = []

        for step in steps:
            logger.info(f"[BrowserActor] Vegrehajtas: {step.action} (Tab: {step.tab_index})")
            
            # Megfelelo ful (page) kivalasztasa vagy letrehozasa
            if step.tab_index == -1:
                # Kifejezetten uj ful kerese
                page = await context.new_page()
                pages.append(page)
            else:
                # Meglevo ful valasztasa vagy automatikus bovites
                while step.tab_index >= len(pages):
                    new_page = await context.new_page()
                    pages.append(new_page)
                page = pages[step.tab_index]
            
            # Ful eloterbe hozasa
            try:
                await page.bring_to_front()
            except:
                pass
            
            try:
                result = await self.execute_step(step, page)
                results.append(result)
                
                if not result.success and step.critical:
                    logger.error(f"[BrowserActor] Kritikus hiba a(z) {step.action} lepesnel: {result.error}")
                    break
                    
            except Exception as e:
                logger.error(f"[BrowserActor] Varatlan hiba: {e}")
                results.append(ActorResult(success=False, error=str(e)))
                if step.critical:
                    break

        return results

    async def execute_step(self, step: BrowserStep, page: Page) -> ActorResult:
        """Egyetlen lepes vegrehajtasa"""
        action = step.action.lower()
        
        try:
            if action == "navigate":
                if not step.url:
                    return ActorResult(success=False, error="Nincs megadva URL a navigaciohoz")
                await page.goto(step.url, wait_until="networkidle", timeout=self.timeout)
                return ActorResult(success=True)

            elif action == "search":
                if not step.selector and step.description:
                    step.selector = await self._vision_selector(page, step.description)
                
                if not step.selector or not step.text:
                    return ActorResult(success=False, error="Hianyzo selector vagy szoveg a kereseshez")
                
                await page.fill(step.selector, step.text)
                await page.press(step.selector, "Enter")
                await page.wait_for_load_state("networkidle")
                return ActorResult(success=True)

            elif action == "click":
                if not step.selector and step.description:
                    step.selector = await self._vision_selector(page, step.description)
                
                if not step.selector:
                    return ActorResult(success=False, error="Nem sikerult selectort talalni a kattintashoz.")
                
                await page.click(step.selector, timeout=10000)
                return ActorResult(success=True)

            elif action == "fill":
                if not step.selector and step.description:
                    step.selector = await self._vision_selector(page, step.description)
                
                if not step.selector or not step.text:
                    return ActorResult(success=False, error="Hianyzo selector vagy szoveg a kitolteshez")
                
                await page.fill(step.selector, step.text)
                return ActorResult(success=True)

            elif action == "extract":
                if not step.selector or not step.key:
                    return ActorResult(success=False, error="Hianyzo selector vagy kulcs az adatkinyeresez")
                text = await page.inner_text(step.selector)
                return ActorResult(success=True, extracted={step.key: text})

            elif action == "screenshot":
                screenshot_bytes = await page.screenshot(full_page=True)
                return ActorResult(success=True, screenshot=screenshot_bytes)

            elif action == "wait":
                seconds = step.description or "2" # Hack: ha a description-be kerult a szam
                try:
                    sec = float(str(seconds).split()[0])
                except:
                    sec = 2.0
                await asyncio.sleep(sec)
                return ActorResult(success=True)

            elif action == "click_os":
                # OS-szintu kattintas pyautogui-val (pixel koordinatak)
                if not _HAS_PYAUTOGUI:
                    return ActorResult(success=False, error="pyautogui nem elerheto")
                x = step.x or 0
                y = step.y or 0
                if x == 0 and y == 0:
                    return ActorResult(success=False, error="click_os: x es y koordinata szukseges")
                pyautogui.click(x=x, y=y)
                await asyncio.sleep(0.3)
                return ActorResult(success=True)

            elif action == "type_os":
                # OS-szintu gepeles pyautogui-val
                if not _HAS_PYAUTOGUI:
                    return ActorResult(success=False, error="pyautogui nem elerheto")
                text = step.text or ""
                if not text:
                    return ActorResult(success=False, error="type_os: szoveg szukseges")
                pyautogui.typewrite(text, interval=0.05)
                return ActorResult(success=True)

            elif action == "press_key":
                key = step.key or step.text or "Enter"
                await page.keyboard.press(key)
                return ActorResult(success=True)

            else:
                return ActorResult(success=False, error=f"Ismeretlen muvelet: {action}")

        except Exception as e:
            return ActorResult(success=False, error=str(e))
