"""
Unit tests for Web Scraper Worker
Tests: Playwright scraping, selectors, pagination
"""

import pytest
from pathlib import Path
import sys

# Add workers to path
sys.path.insert(0, str(Path(__file__).parent.parent / "workers"))

from web_scraper import (
    SelectorRule,
    ScraperRequest,
    ScraperResponse,
    HAS_PLAYWRIGHT,
    _transform_value,
)


class TestWebScraperModels:
    """Test Web Scraper Pydantic models"""

    def test_selector_rule_model(self):
        """Test SelectorRule model"""
        rule = SelectorRule(
            name="title",
            selector="h1.main-title",
            attribute=None,
            multiple=False,
        )
        
        assert rule.name == "title"
        assert rule.selector == "h1.main-title"
        assert rule.attribute is None
        assert rule.multiple is False
        assert rule.transform is None

    def test_selector_rule_with_attribute(self):
        """Test SelectorRule with attribute extraction"""
        rule = SelectorRule(
            name="link",
            selector="a.product-link",
            attribute="href",
            multiple=True,
        )
        
        assert rule.attribute == "href"
        assert rule.multiple is True

    def test_scraper_request_model(self):
        """Test ScraperRequest model"""
        request = ScraperRequest(
            url="https://example.com",
            selectors=[
                SelectorRule(name="title", selector="h1"),
            ],
            wait_for=".content",
            javascript=True,
            screenshot=False,
        )
        
        assert request.url == "https://example.com"
        assert len(request.selectors) == 1
        assert request.wait_for == ".content"
        assert request.javascript is True
        assert request.screenshot is False
        assert request.wait_timeout == 10000  # default
        assert request.rate_limit == 1.0  # default

    def test_scraper_request_defaults(self):
        """Test ScraperRequest default values"""
        request = ScraperRequest(url="https://example.com")
        
        assert request.selectors == []
        assert request.wait_for is None
        assert request.wait_timeout == 10000
        assert request.javascript is True
        assert request.screenshot is False
        assert request.pagination is False
        assert request.max_pages == 5
        assert request.rate_limit == 1.0

    def test_scraper_response_model(self):
        """Test ScraperResponse model"""
        response = ScraperResponse(
            success=True,
            url="https://example.com",
            data=[{"title": "Test"}],
            pages_scraped=1,
            duration_seconds=2.5,
        )
        
        assert response.success is True
        assert response.url == "https://example.com"
        assert len(response.data) == 1
        assert response.pages_scraped == 1
        assert response.duration_seconds == 2.5
        assert response.error is None

    def test_transform_value_trim(self):
        """Test text transformation: trim"""
        assert _transform_value("  hello  ", "trim") == "hello"
        assert _transform_value("world\n", "trim") == "world"

    def test_transform_value_lowercase(self):
        """Test text transformation: lowercase"""
        assert _transform_value("HELLO", "lowercase") == "hello"
        assert _transform_value("  WORLD  ", "lowercase") == "world"

    def test_transform_value_uppercase(self):
        """Test text transformation: uppercase"""
        assert _transform_value("hello", "uppercase") == "HELLO"
        assert _transform_value("  world  ", "uppercase") == "WORLD"

    def test_transform_value_none(self):
        """Test text transformation: none (default)"""
        assert _transform_value("  hello  ", None) == "hello"
        assert _transform_value("world", None) == "world"

    def test_pagination_config(self):
        """Test pagination configuration"""
        request = ScraperRequest(
            url="https://example.com",
            pagination=True,
            pagination_selector="a.next-page",
            max_pages=10,
            rate_limit=2.0,
        )
        
        assert request.pagination is True
        assert request.pagination_selector == "a.next-page"
        assert request.max_pages == 10
        assert request.rate_limit == 2.0

    def test_custom_headers_and_user_agent(self):
        """Test custom headers and user agent"""
        request = ScraperRequest(
            url="https://example.com",
            user_agent="CustomBot/1.0",
            headers={"Authorization": "Bearer token"},
        )
        
        assert request.user_agent == "CustomBot/1.0"
        assert request.headers == {"Authorization": "Bearer token"}

    def test_screenshot_path(self):
        """Test screenshot configuration"""
        request = ScraperRequest(
            url="https://example.com",
            screenshot=True,
            screenshot_path="data/screenshots/custom.png",
        )
        
        assert request.screenshot is True
        assert request.screenshot_path == "data/screenshots/custom.png"

    def test_playwright_availability(self):
        """Test Playwright availability flag"""
        # This should be True or False depending on installation
        assert isinstance(HAS_PLAYWRIGHT, bool)


@pytest.mark.skipif(not HAS_PLAYWRIGHT, reason="Playwright not installed")
class TestWebScraperIntegration:
    """Integration tests requiring Playwright (skip in CI)"""

    def test_scrape_simple_page(self):
        """Test scraping a simple page (requires Playwright)"""
        # This test would require actual network access
        # Skipping for now unless we have mock server
        pytest.skip("Requires mock HTTP server or network access")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
