import unittest
import asyncio
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock

# Mock dependencies before importing the module
sys.modules['dotenv'] = MagicMock()
sys.modules['browser_use'] = MagicMock()

# Ensure myai is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import with mocked modules
from browser_task_runner import run_browser_task, BrowserTaskResult

class TestRobotkezCometLogic(unittest.IsolatedAsyncioTestCase):

    @patch('browser_task_runner.Agent')
    async def test_successful_run(self, mock_agent_class):
        # Setup mock Agent
        mock_agent = mock_agent_class.return_value

        # Setup mock history returned by run()
        mock_history = MagicMock()
        mock_history.final_result.return_value = "Sikeresen megtaláltam a szócikket. A mesterséges intelligencia..."
        mock_history.history = [1, 2, 3] # fake history len

        mock_agent.run = AsyncMock(return_value=mock_history)

        # We need to mock the API keys to avoid ValueError
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'fake_key'}):
            result = await run_browser_task("Menj fel a hu.wikipedia.org oldalra, keresd meg a 'Mesterséges intelligencia' szócikket, és írd le az első mondatot.")

        self.assertTrue(result.success)
        self.assertEqual(result.status, "success")
        self.assertIn("Sikeresen megtaláltam", result.final_answer)

    @patch('browser_task_runner.Agent')
    async def test_handoff_stuck_run(self, mock_agent_class):
        # Setup mock Agent
        mock_agent = mock_agent_class.return_value

        # Setup mock history returned by run()
        mock_history = MagicMock()
        mock_history.final_result.return_value = "Hiba történt a gomb megnyomásakor."
        mock_history.history = [1, 2, 3] # fake history len

        mock_agent.run = AsyncMock(return_value=mock_history)

        # We need to mock the API keys to avoid ValueError
        with patch.dict('os.environ', {'GEMINI_API_KEY': 'fake_key'}):
            result = await run_browser_task("Menj fel a hu.wikipedia.org oldalra, de kattints egy rossz gombra")

        self.assertFalse(result.success)
        self.assertEqual(result.status, "handoff")
        self.assertIn("Kérlek segíts, elakadtam", result.final_answer)

if __name__ == '__main__':
    unittest.main()
