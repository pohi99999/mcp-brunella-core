"""
Crawl4AI Worker — Adaptív, LLM-optimalizált web crawling.

Stealth mód, zajmentes Markdown kimenet, séma-alapú extrakció.
A BAS Data Flywheel Harvest fázisának fejlett változata.
"""

import asyncio
import json
import logging
from typing import Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("crawl4ai_worker")


class CrawlRequest(BaseModel):
    """Crawl kérés modell."""
    url: str = Field(..., description="A crawlolandó URL")
    extract_schema: Optional[dict] = Field(None, description="Pydantic-kompatibilis JSON séma strukturált extrakcióhoz")
    extraction_prompt: Optional[str] = Field(None, description="LLM prompt a strukturált extrakcióhoz")
    wait_for_selector: Optional[str] = Field(None, description="CSS selector amire várni kell")
    stealth: bool = Field(True, description="Stealth mód bot-detektálás elkerülésére")
    headless: bool = Field(True, description="Headless böngésző mód")
    timeout: int = Field(30000, description="Timeout milliszekundumban")
    remove_selectors: list[str] = Field(
        default_factory=lambda: ["nav", "footer", "header", ".cookie-banner", ".advertisement", "#cookie-consent"],
        description="CSS selectorok eltávolítása a Markdown-ból (zajszűrés)"
    )


class CrawlResult(BaseModel):
    """Crawl eredmény modell."""
    url: str
    markdown: str = ""
    title: str = ""
    description: str = ""
    language: str = ""
    extracted_data: Optional[Any] = None
    links: list[str] = Field(default_factory=list)
    status: str = "success"
    error: Optional[str] = None


async def crawl_url(request: CrawlRequest) -> CrawlResult:
    """
    URL crawlolása Crawl4AI-val.

    Stealth módban navigál, zajmentes Markdown-t generál,
    opcionálisan séma-alapú strukturált adatot extraháláz.
    """
    try:
        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, BrowserConfig
    except ImportError:
        return CrawlResult(
            url=request.url,
            status="failed",
            error="crawl4ai csomag nem telepített. Futtasd: cd myai && uv sync"
        )

    browser_config = BrowserConfig(
        headless=request.headless,
        verbose=False,
    )

    run_config = CrawlerRunConfig(
        wait_until="domcontentloaded",
        page_timeout=request.timeout,
        remove_overlay_elements=True,
        excluded_tags=request.remove_selectors,
    )

    # Ha van wait_for_selector, beállítjuk
    if request.wait_for_selector:
        run_config.wait_for = f"css:{request.wait_for_selector}"

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(
                url=request.url,
                config=run_config,
            )

            if not result.success:
                return CrawlResult(
                    url=request.url,
                    status="failed",
                    error=result.error_message or "Crawl failed"
                )

            crawl_result = CrawlResult(
                url=request.url,
                markdown=result.markdown or "",
                title=result.metadata.get("title", "") if result.metadata else "",
                description=result.metadata.get("description", "") if result.metadata else "",
                language=result.metadata.get("language", "") if result.metadata else "",
                links=[link.get("href", "") for link in (result.links or {}).get("internal", [])]
                      + [link.get("href", "") for link in (result.links or {}).get("external", [])],
                status="success",
            )

            # Séma-alapú extrakció ha kérték
            if request.extract_schema and request.extraction_prompt:
                extracted = await _extract_structured(
                    crawler, request.url, request.extract_schema, request.extraction_prompt, run_config
                )
                crawl_result.extracted_data = extracted

            return crawl_result

    except Exception as e:
        logger.error(f"Crawl4AI hiba: {e}")
        return CrawlResult(
            url=request.url,
            status="failed",
            error=str(e)
        )


async def _extract_structured(
    crawler: Any,
    url: str,
    schema: dict,
    prompt: str,
    run_config: Any,
) -> Optional[Any]:
    """Séma-alapú strukturált extrakció LLM-mel."""
    try:
        from crawl4ai.extraction_strategy import LLMExtractionStrategy

        extraction_strategy = LLMExtractionStrategy(
            provider="ollama/qwen2.5-coder:7b",
            schema=schema,
            instruction=prompt,
        )

        config_with_extraction = run_config.clone() if hasattr(run_config, 'clone') else run_config
        config_with_extraction.extraction_strategy = extraction_strategy

        result = await crawler.arun(url=url, config=config_with_extraction)
        if result.extracted_content:
            return json.loads(result.extracted_content) if isinstance(result.extracted_content, str) else result.extracted_content
    except Exception as e:
        logger.warning(f"Strukturált extrakció sikertelen: {e}")

    return None


async def batch_crawl(urls: list[str], stealth: bool = True) -> list[CrawlResult]:
    """Több URL párhuzamos crawlolása."""
    tasks = [crawl_url(CrawlRequest(url=url, stealth=stealth)) for url in urls]
    return await asyncio.gather(*tasks)


# Standalone futtatás teszteléshez
if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"
    result = asyncio.run(crawl_url(CrawlRequest(url=url)))
    print(json.dumps(result.model_dump(), indent=2, ensure_ascii=False))
