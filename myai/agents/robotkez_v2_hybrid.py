"""
RobotkezV2 Hybrid Browser Automation Engine

Kombinálja:
- Playwright (gyors, fix selector-os task-ok)
- Browser-Use (AI-powered, komplex task-ok)

Használat:
    from robotkez_v2_hybrid import RobotkezV2

    robot = RobotkezV2()
    result = await robot.execute("screenshot github.com", mode="auto")
"""

import os
import asyncio
import logging
from typing import Optional, Dict, Any, Literal
from dataclasses import dataclass
from dotenv import load_dotenv

# Opcionális importok (graceful fallback)
try:
    from browser_use import Agent as BrowserUseAgent
    from browser_use.browser.browser import Browser, BrowserConfig
    from langchain_google_genai import ChatGoogleGenerativeAI
    HAS_BROWSER_USE = True
except ImportError:
    HAS_BROWSER_USE = False

try:
    from playwright.async_api import async_playwright, Browser as PlaywrightBrowser, Page
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

load_dotenv()
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class RobotkezResult:
    """Unified result object"""
    success: bool
    mode: str  # "playwright", "browser-use", "auto"
    result: Any
    duration_ms: int
    error: Optional[str] = None
    screenshot_path: Optional[str] = None


class RobotkezV2:
    """
    Hybrid Browser Automation Engine

    Automatically chooses between Playwright (fast) and Browser-Use (AI) based on task complexity.
    """

    def __init__(
        self,
        default_mode: Literal["auto", "playwright", "browser-use"] = "auto",
        headless: bool = True,
        llm_model: str = "gemini-2.0-flash-exp"
    ):
        self.default_mode = default_mode
        self.headless = headless
        self.llm_model = llm_model

        # Validate dependencies
        if not HAS_PLAYWRIGHT and not HAS_BROWSER_USE:
            raise ImportError("Neither Playwright nor Browser-Use is installed! Install at least one.")

        logger.info(f"[RobotkezV2] Initialized (mode={default_mode}, headless={headless})")
        logger.info(f"[RobotkezV2] Playwright: {'[OK]' if HAS_PLAYWRIGHT else '[MISSING]'}")
        logger.info(f"[RobotkezV2] Browser-Use: {'[OK]' if HAS_BROWSER_USE else '[MISSING]'}")


    async def execute(
        self,
        instruction: str,
        mode: Optional[str] = None,
        **kwargs
    ) -> RobotkezResult:
        """
        Execute browser task with automatic or manual mode selection

        Args:
            instruction: Natural language instruction (e.g., "screenshot github.com")
            mode: "auto", "playwright", "browser-use", or None (uses default_mode)
            **kwargs: Additional parameters (url, screenshot_path, timeout, etc.)

        Returns:
            RobotkezResult with success status, result data, and metadata
        """
        import time
        start_time = time.time()

        # Determine execution mode
        execution_mode = mode or self.default_mode

        if execution_mode == "auto":
            execution_mode = self._analyze_complexity(instruction)
            logger.info(f"[AUTO] Complexity analysis: '{instruction}' -> {execution_mode.upper()}")

        # Route to appropriate executor
        try:
            if execution_mode == "playwright":
                if not HAS_PLAYWRIGHT:
                    raise ImportError("Playwright not installed! Use 'uv pip install playwright && playwright install chromium'")
                result = await self._playwright_execute(instruction, **kwargs)

            elif execution_mode == "browser-use":
                if not HAS_BROWSER_USE:
                    raise ImportError("Browser-Use not installed! Use 'uv pip install browser-use'")
                result = await self._browser_use_execute(instruction, **kwargs)

            else:
                raise ValueError(f"Unknown mode: {execution_mode}")

            duration_ms = int((time.time() - start_time) * 1000)

            return RobotkezResult(
                success=True,
                mode=execution_mode,
                result=result,
                duration_ms=duration_ms
            )

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[ERROR] {execution_mode.upper()} execution failed: {e}")

            return RobotkezResult(
                success=False,
                mode=execution_mode,
                result=None,
                duration_ms=duration_ms,
                error=str(e)
            )


    def _analyze_complexity(self, instruction: str) -> Literal["playwright", "browser-use"]:
        """
        Analyze task complexity and decide execution mode

        Simple tasks → Playwright (fast)
        Complex tasks → Browser-Use (AI)
        """
        instruction_lower = instruction.lower()

        # Simple task keywords (Playwright)
        simple_keywords = [
            "screenshot", "pdf", "navigate", "goto", "open",
            "get title", "get url", "get text",
            "wait", "sleep", "close"
        ]

        # Complex task keywords (Browser-Use AI)
        complex_keywords = [
            "click", "fill", "type", "submit", "login",
            "find", "search", "extract", "scrape",
            "create", "add", "delete", "update",
            "workflow", "form", "table", "list",
            "first", "last", "all", "every"
        ]

        # Check simple keywords
        if any(kw in instruction_lower for kw in simple_keywords):
            # But if also contains complex keywords → Browser-Use
            if any(kw in instruction_lower for kw in complex_keywords):
                return "browser-use"
            return "playwright"

        # Check complex keywords
        if any(kw in instruction_lower for kw in complex_keywords):
            return "browser-use"

        # Default: If instruction is very short (< 5 words) → Playwright
        if len(instruction.split()) < 5:
            return "playwright"

        # Otherwise → Browser-Use (AI can handle ambiguity)
        return "browser-use"


    async def _playwright_execute(self, instruction: str, **kwargs) -> Dict[str, Any]:
        """
        Execute task using Playwright (fast, fixed selectors)

        Supports:
        - screenshot <url>
        - pdf <url>
        - navigate <url>
        - get title <url>
        - get text <url> <selector>
        """
        logger.info(f"[PLAYWRIGHT] Executing: {instruction}")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=self.headless)
            page = await browser.new_page()

            try:
                # Parse instruction
                parts = instruction.lower().split()
                action = parts[0] if parts else ""

                # Extract URL (look for http:// or https://)
                url = kwargs.get('url')
                if not url:
                    for part in parts:
                        if part.startswith('http://') or part.startswith('https://'):
                            url = part
                            break
                        # Handle domain without protocol
                        if '.' in part and not part.startswith('-'):
                            url = f"https://{part}"
                            break

                if not url:
                    raise ValueError(f"No URL found in instruction: {instruction}")

                # Navigate to URL
                logger.info(f"[PLAYWRIGHT] Navigating to {url}")
                await page.goto(url, wait_until='networkidle', timeout=30000)

                # Execute action
                if action == "screenshot":
                    screenshot_path = kwargs.get('screenshot_path', 'screenshot.png')
                    await page.screenshot(path=screenshot_path, full_page=True)
                    logger.info(f"[PLAYWRIGHT] Screenshot saved: {screenshot_path}")
                    return {"action": "screenshot", "path": screenshot_path, "url": url}

                elif action == "pdf":
                    pdf_path = kwargs.get('pdf_path', 'page.pdf')
                    await page.pdf(path=pdf_path, format='A4')
                    logger.info(f"[PLAYWRIGHT] PDF saved: {pdf_path}")
                    return {"action": "pdf", "path": pdf_path, "url": url}

                elif action in ["navigate", "goto", "open"]:
                    title = await page.title()
                    logger.info(f"[PLAYWRIGHT] Navigated to: {title}")
                    return {"action": "navigate", "title": title, "url": url}

                elif action == "title" or "get title" in instruction.lower():
                    title = await page.title()
                    logger.info(f"[PLAYWRIGHT] Title: {title}")
                    return {"action": "get_title", "title": title, "url": url}

                elif action == "text" or "get text" in instruction.lower():
                    selector = kwargs.get('selector', 'body')
                    text = await page.text_content(selector)
                    logger.info(f"[PLAYWRIGHT] Text from {selector}: {text[:100]}...")
                    return {"action": "get_text", "text": text, "selector": selector, "url": url}

                else:
                    raise ValueError(f"Unknown Playwright action: {action}. Use screenshot, pdf, navigate, or title.")

            finally:
                await browser.close()


    async def _browser_use_execute(self, instruction: str, **kwargs) -> Dict[str, Any]:
        """
        Execute task using Browser-Use (AI-powered, complex tasks)

        Supports:
        - Natural language instructions (AI interprets)
        - Complex multi-step workflows
        - Dynamic UI interaction
        """
        logger.info(f"[BROWSER-USE] Executing: {instruction}")

        # Initialize LLM
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY not found in environment!")

        llm = ChatGoogleGenerativeAI(
            model=self.llm_model,
            google_api_key=api_key,
            temperature=0.1  # Low temperature for deterministic behavior
        )

        # Initialize Browser-Use agent
        browser_config = BrowserConfig(
            headless=self.headless,
            disable_security=False  # Keep security enabled
        )

        async with Browser(config=browser_config) as browser:
            agent = BrowserUseAgent(
                task=instruction,
                llm=llm,
                browser=browser,
                use_vision=True  # Enable vision-based interaction
            )

            # Execute task
            history = await agent.run()
            final_result = history.final_result()

            logger.info(f"[BROWSER-USE] Task completed. Steps: {len(history.history)}")

            return {
                "action": "browser_use",
                "instruction": instruction,
                "final_result": str(final_result),
                "steps": len(history.history),
                "history": [str(h) for h in history.history[:5]]  # First 5 steps only
            }


# ============================================================================
# CLI Helper Functions
# ============================================================================

async def cli_execute(instruction: str, mode: str = "auto", **kwargs):
    """CLI wrapper for RobotkezV2"""
    robot = RobotkezV2(default_mode=mode)
    result = await robot.execute(instruction, **kwargs)

    print(f"\n{'='*60}")
    print(f"[ROBOTKEZ V2] Result")
    print(f"{'='*60}")
    print(f"Success:    {result.success}")
    print(f"Mode:       {result.mode.upper()}")
    print(f"Duration:   {result.duration_ms}ms")

    if result.success:
        print(f"\nResult:")
        import json
        print(json.dumps(result.result, indent=2, ensure_ascii=False))
    else:
        print(f"\nError:      {result.error}")

    print(f"{'='*60}\n")

    return result


# ============================================================================
# Example Usage (for testing)
# ============================================================================

async def example_usage():
    """Example tasks demonstrating both modes"""
    robot = RobotkezV2(default_mode="auto")

    # Simple task → Playwright (fast)
    print("\n[EXAMPLE 1] Simple task (screenshot)")
    result1 = await robot.execute("screenshot github.com")
    print(f"[OK] Result: {result1.success}, Mode: {result1.mode}, Duration: {result1.duration_ms}ms\n")

    # Complex task → Browser-Use (AI)
    print("\n[EXAMPLE 2] Complex task (search + extract)")
    result2 = await robot.execute("Go to GitHub trending, find the top Python repository, and return its name and stars")
    print(f"[OK] Result: {result2.success}, Mode: {result2.mode}, Duration: {result2.duration_ms}ms\n")

    # Manual mode override
    print("\n[EXAMPLE 3] Manual mode (force Browser-Use)")
    result3 = await robot.execute("navigate to google.com", mode="browser-use")
    print(f"[OK] Result: {result3.success}, Mode: {result3.mode}, Duration: {result3.duration_ms}ms\n")


if __name__ == "__main__":
    import sys
    import argparse

    # Parse CLI arguments
    parser = argparse.ArgumentParser(description='RobotkezV2 Hybrid Browser Automation')
    parser.add_argument('instruction', help='Natural language instruction')
    parser.add_argument('--mode', choices=['auto', 'playwright', 'browser-use'], default='auto')
    parser.add_argument('--headless', type=str, default='true', choices=['true', 'false'])
    parser.add_argument('--url', help='Target URL')
    parser.add_argument('--screenshot', help='Screenshot output path')
    parser.add_argument('--pdf', help='PDF output path')
    parser.add_argument('--selector', help='CSS selector')
    parser.add_argument('--timeout', type=int, help='Timeout in ms')

    args = parser.parse_args()

    # Build kwargs
    kwargs = {}
    if args.url:
        kwargs['url'] = args.url
    if args.screenshot:
        kwargs['screenshot_path'] = args.screenshot
    if args.pdf:
        kwargs['pdf_path'] = args.pdf
    if args.selector:
        kwargs['selector'] = args.selector
    if args.timeout:
        kwargs['timeout'] = args.timeout

    # Execute
    robot = RobotkezV2(default_mode=args.mode, headless=(args.headless == 'true'))

    # Run async execution
    async def run():
        result = await robot.execute(args.instruction, mode=args.mode, **kwargs)

        # Print JSON result for TypeScript parsing
        import json
        print(json.dumps({
            "success": result.success,
            "mode": result.mode,
            "result": result.result,
            "duration_ms": result.duration_ms,
            "error": result.error,
            "screenshot_path": result.screenshot_path
        }))

    asyncio.run(run())
