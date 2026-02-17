import unittest
import asyncio
import sys
import os
import json
from unittest.mock import MagicMock, AsyncMock, patch

# Add myai to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from interactive_browser import highlight_element, main

class TestInteractiveBrowser(unittest.IsolatedAsyncioTestCase):
    async def test_highlight_element(self):
        page = AsyncMock()
        page.evaluate = AsyncMock()

        selector = "#test-btn"
        await highlight_element(page, selector)

        page.evaluate.assert_called_once()
        # Verify the script contains the style injection
        args, _ = page.evaluate.call_args
        script = args[0]
        self.assertIn("outline = '3px solid red'", script)
        self.assertIn("scrollIntoView", script)

    @patch('interactive_browser.async_playwright')
    # Use side_effect for readline to simulate stream
    @patch('interactive_browser.sys.stdin.readline')
    @patch('interactive_browser.print') # Mock print to avoid stdout noise
    async def test_click_action(self, mock_print, mock_readline, mock_playwright):
        # Setup mocks
        mock_context_manager = AsyncMock()
        mock_playwright.return_value = mock_context_manager

        mock_browser = AsyncMock()
        mock_context_manager.__aenter__.return_value.chromium.launch.return_value = mock_browser

        mock_context = AsyncMock()
        mock_browser.new_context.return_value = mock_context

        mock_page = AsyncMock()
        mock_context.new_page.return_value = mock_page

        # Mock screenshot return
        mock_page.screenshot.return_value = b'fake_png_bytes'

        # Setup stdin commands
        # We need to use a side_effect that returns futures because the code awaits run_in_executor
        # Actually, run_in_executor(None, sys.stdin.readline) calls the sync readline in a thread.
        # But here we are mocking sys.stdin.readline directly?
        # Wait, the code is: await loop.run_in_executor(None, sys.stdin.readline)
        # So we mock sys.stdin.readline as a normal function.

        mock_readline.side_effect = [
            json.dumps({"action": "launch"}),
            json.dumps({"action": "click", "selector": "#btn"}),
            ""
        ]

        # Run main
        # We need to ensure the loop stops. The empty string in readline breaks the loop.
        await main()

        # Verify launch happened
        mock_context_manager.__aenter__.return_value.chromium.launch.assert_called()

        # Verify click happened
        mock_page.click.assert_called_with("#btn", timeout=5000)

        # Verify evaluate (highlight) was called
        mock_page.evaluate.assert_called()

        # Verify screenshot was taken
        mock_page.screenshot.assert_called()

        # Check output (mock_print) to see if screenshot is in response
        found_click_response = False
        for call in mock_print.call_args_list:
            args, _ = call
            if args and isinstance(args[0], str):
                try:
                    data = json.loads(args[0])
                    if data.get('message') == 'Clicked #btn':
                        found_click_response = True
                        self.assertEqual(data['status'], 'success')
                        self.assertIn('screenshot', data)
                        break
                except json.JSONDecodeError:
                    pass

        self.assertTrue(found_click_response, "Did not find click response with screenshot")

if __name__ == '__main__':
    unittest.main()
