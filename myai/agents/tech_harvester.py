"""
Tech-Harvester Agent - Autonomous Web Scraping for AI Tech Trends

This agent uses Browser-Use (LangChain) + Playwright to harvest technical
content from configured sources (GitHub, DevTools, AI News).

Author: Claude Code (Anthropic)
Created: 2026-02-13
Track: TR-20260212-TECH-HAR
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from playwright.async_api import async_playwright, Browser, Page
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    print("[!] WARNING: playwright not installed. Run: pip install playwright")

try:
    from browser_use import Agent as BrowserUseAgent
    try:
        from langchain_ollama import ChatOllama
    except ImportError:
        # Fallback to langchain_community if langchain_ollama not available
        from langchain_community.chat_models import ChatOllama
    HAS_BROWSER_USE = True
except ImportError:
    HAS_BROWSER_USE = False
    ChatOllama = None
    print("[!] WARNING: browser-use not installed. Run: pip install browser-use langchain-ollama")


# ════════════════════════════════════════════════════════════════════════════
# LOGGING SETUP
# ════════════════════════════════════════════════════════════════════════════

def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Configure logging for Tech-Harvester."""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)

    log_file = log_dir / "harvester.log"

    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler()
        ]
    )

    return logging.getLogger("TechHarvester")


# ════════════════════════════════════════════════════════════════════════════
# CONFIGURATION LOADER
# ════════════════════════════════════════════════════════════════════════════

def load_config(config_path: str = "myai/config/sources.json") -> Dict[str, Any]:
    """Load harvester configuration from JSON file."""
    config_file = Path(config_path)

    if not config_file.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)

    return config


# ════════════════════════════════════════════════════════════════════════════
# TECH HARVESTER AGENT CLASS
# ════════════════════════════════════════════════════════════════════════════

class TechHarvester:
    """
    Autonomous agent for harvesting AI/Tech trends from configured sources.

    Workflow:
    1. Load sources.json configuration
    2. Initialize Browser-Use agent (LangChain + Playwright)
    3. Iterate through enabled sources
    4. Extract relevant content (keywords filtering)
    5. Save results to JSON (temp/harvest_results_{date}.json)
    """

    def __init__(self, config: Dict[str, Any], logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.browser: Optional[Browser] = None
        self.results: List[Dict[str, Any]] = []

        # Extract settings
        self.targets = [t for t in config["targets"] if t.get("enabled", True)]
        self.global_keywords = config.get("globalKeywords", [])
        self.settings = config.get("harvesterSettings", {})

        self.max_items = self.settings.get("maxItemsPerSource", 5)
        self.timeout = self.settings.get("timeoutSeconds", 60)
        self.headless = self.settings.get("headless", True)
        self.output_dir = Path(self.settings.get("output_dir", "temp/harvest_results"))

        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.logger.info(f"TechHarvester initialized with {len(self.targets)} enabled sources")

    async def initialize_browser(self):
        """Initialize Playwright browser instance."""
        if not HAS_PLAYWRIGHT:
            raise ImportError("Playwright not installed. Run: pip install playwright && playwright install")

        self.logger.info("Starting Playwright browser (headless=%s)", self.headless)

        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=self.headless)

        return self.browser

    async def close_browser(self):
        """Close Playwright browser."""
        if self.browser:
            await self.browser.close()
            self.logger.info("Browser closed")

    async def harvest_source_with_browser_use(self, target: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Harvest a single source using Browser-Use agent.

        This uses LangChain + Browser-Use to intelligently navigate and extract data.
        """
        if not HAS_BROWSER_USE:
            self.logger.warning("Browser-Use not available, skipping %s", target["name"])
            return []

        self.logger.info("[AI] Harvesting with Browser-Use: %s", target["name"])

        try:
            # Initialize LangChain LLM
            llm = ChatOllama(
                model="qwen2.5-coder:latest",
                temperature=0.1,
            )

            # Create Browser-Use agent
            agent = BrowserUseAgent(
                task=self._build_browser_use_task(target),
                llm=llm,
            )

            # Run agent (async)
            result = await agent.run()

            self.logger.info("[OK] Browser-Use completed for %s", target["name"])

            # Parse agent result
            items = self._parse_browser_use_result(result, target)

            return items[:self.max_items]

        except Exception as e:
            self.logger.error("[ERROR] Browser-Use failed for %s: %s", target["name"], str(e))
            return []

    async def harvest_source_with_playwright(self, target: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Harvest a single source using direct Playwright automation.

        Fallback method if Browser-Use is not available.
        """
        self.logger.info("[PLAYWRIGHT] Harvesting: %s", target["name"])

        try:
            page = await self.browser.new_page()

            # Navigate to URL
            await page.goto(target["url"], timeout=self.timeout * 1000)
            await page.wait_for_load_state("networkidle")

            self.logger.info("Page loaded: %s", target["url"])

            # Extract content based on selector
            selector = target.get("selector", "article")
            elements = await page.query_selector_all(selector)

            items = []
            for element in elements[:self.max_items]:
                try:
                    # Extract text content
                    text_content = await element.text_content()

                    # Check keyword relevance
                    if self._is_relevant(text_content, target):
                        item = {
                            "source": target["name"],
                            "url": target["url"],
                            "content": text_content.strip(),
                            "timestamp": datetime.utcnow().isoformat(),
                            "type": target.get("type", "article"),
                        }
                        items.append(item)

                except Exception as e:
                    self.logger.warning("Failed to extract element: %s", str(e))
                    continue

            await page.close()

            self.logger.info("[OK] Playwright extracted %d items from %s", len(items), target["name"])

            return items

        except Exception as e:
            self.logger.error("[ERROR] Playwright failed for %s: %s", target["name"], str(e))

            # Screenshot on error
            if self.settings.get("screenshotOnError", True):
                try:
                    screenshot_path = self.output_dir / f"error_{target['name']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png"
                    await page.screenshot(path=str(screenshot_path))
                    self.logger.info("Screenshot saved: %s", screenshot_path)
                except:
                    pass

            return []

    def _build_browser_use_task(self, target: Dict[str, Any]) -> str:
        """Build natural language task for Browser-Use agent."""
        keywords_str = ", ".join(target.get("keywords", self.global_keywords[:5]))

        task = f"""
Visit the website: {target['url']}

Find the latest {self.max_items} items (articles, projects, or resources) that are relevant to these topics:
{keywords_str}

For each item, extract:
- Title
- Description or summary
- URL (if available)
- Any metadata (stars, date, author)

Return the results as a structured JSON array.
""".strip()

        return task

    def _parse_browser_use_result(self, result: Any, target: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse Browser-Use agent result into structured items."""
        # Browser-Use returns various formats, try to extract JSON
        try:
            if isinstance(result, str):
                # Try to find JSON in the string
                import re
                json_match = re.search(r'\[.*\]', result, re.DOTALL)
                if json_match:
                    items = json.loads(json_match.group(0))
                else:
                    items = [{"content": result}]
            elif isinstance(result, list):
                items = result
            elif isinstance(result, dict):
                items = [result]
            else:
                items = [{"content": str(result)}]

            # Add metadata
            for item in items:
                item["source"] = target["name"]
                item["source_url"] = target["url"]
                item["timestamp"] = datetime.utcnow().isoformat()
                item["type"] = target.get("type", "article")

            return items

        except Exception as e:
            self.logger.error("Failed to parse Browser-Use result: %s", str(e))
            return []

    def _is_relevant(self, text: str, target: Dict[str, Any]) -> bool:
        """Check if text content is relevant based on keywords."""
        if not text:
            return False

        text_lower = text.lower()

        # Check target-specific keywords
        target_keywords = target.get("keywords", [])
        for keyword in target_keywords:
            if keyword.lower() in text_lower:
                return True

        # Check global keywords
        for keyword in self.global_keywords:
            if keyword.lower() in text_lower:
                return True

        return False

    async def run_harvest(self, mode: str = "browser-use") -> Dict[str, Any]:
        """
        Run the harvesting process for all enabled sources.

        Args:
            mode: "browser-use" (intelligent agent) or "playwright" (direct scraping)

        Returns:
            Summary dict with results and statistics
        """
        self.logger.info("=" * 80)
        self.logger.info("TECH-HARVESTER STARTING")
        self.logger.info("Mode: %s", mode)
        self.logger.info("Sources: %d enabled", len(self.targets))
        self.logger.info("=" * 80)

        start_time = datetime.utcnow()

        # Initialize browser
        await self.initialize_browser()

        # Harvest each source
        for target in self.targets:
            self.logger.info("")
            self.logger.info("-" * 80)
            self.logger.info("Processing source: %s", target["name"])
            self.logger.info("URL: %s", target["url"])
            self.logger.info("-" * 80)

            try:
                if mode == "browser-use" and HAS_BROWSER_USE:
                    items = await self.harvest_source_with_browser_use(target)
                else:
                    items = await self.harvest_source_with_playwright(target)

                self.results.extend(items)

                self.logger.info("Collected %d items from %s", len(items), target["name"])

            except Exception as e:
                self.logger.error("Failed to harvest %s: %s", target["name"], str(e))
                continue

        # Close browser
        await self.close_browser()

        # Save results
        output_file = self._save_results()

        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()

        summary = {
            "status": "completed",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "sources_processed": len(self.targets),
            "total_items_collected": len(self.results),
            "output_file": str(output_file),
        }

        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("TECH-HARVESTER COMPLETED")
        self.logger.info("Total items: %d", len(self.results))
        self.logger.info("Duration: %.2f seconds", duration)
        self.logger.info("Output: %s", output_file)
        self.logger.info("=" * 80)

        return summary

    def _save_results(self) -> Path:
        """Save harvested results to JSON file."""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        output_file = self.output_dir / f"harvest_results_{timestamp}.json"

        output_data = {
            "harvested_at": datetime.utcnow().isoformat(),
            "config_version": self.config.get("version", "1.0.0"),
            "total_items": len(self.results),
            "sources": [t["name"] for t in self.targets],
            "items": self.results,
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        self.logger.info("Results saved to: %s", output_file)

        return output_file


# ════════════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════

async def main():
    """Main entry point for CLI usage."""
    import argparse

    parser = argparse.ArgumentParser(description="Tech-Harvester - Autonomous Web Scraping Agent")
    parser.add_argument("--mode", choices=["browser-use", "playwright"], default="playwright",
                        help="Harvesting mode (default: playwright)")
    parser.add_argument("--config", default="myai/config/sources.json",
                        help="Path to sources.json config file")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"],
                        help="Logging level")

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.log_level)

    # Load config
    try:
        config = load_config(args.config)
    except FileNotFoundError as e:
        logger.error(str(e))
        return 1

    # Check dependencies
    if args.mode == "browser-use" and not HAS_BROWSER_USE:
        logger.error("Browser-Use mode requires: pip install browser-use langchain-ollama")
        return 1

    if not HAS_PLAYWRIGHT:
        logger.error("Playwright required: pip install playwright && playwright install")
        return 1

    # Create harvester
    harvester = TechHarvester(config, logger)

    # Run harvest
    try:
        summary = await harvester.run_harvest(mode=args.mode)

        # Print summary
        print("\n" + "=" * 80)
        print("HARVEST SUMMARY")
        print("=" * 80)
        print(f"Status: {summary['status']}")
        print(f"Duration: {summary['duration_seconds']:.2f} seconds")
        print(f"Sources: {summary['sources_processed']}")
        print(f"Items: {summary['total_items_collected']}")
        print(f"Output: {summary['output_file']}")
        print("=" * 80)

        return 0

    except Exception as e:
        logger.exception("Fatal error during harvest: %s", str(e))
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
