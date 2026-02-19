import unittest
from unittest.mock import patch, MagicMock
import os
import asyncio
import sys

# Add project root to sys.path (parent of myai)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

# Mocking modules that might be missing or complex
sys.modules['lancedb'] = MagicMock()
sys.modules['pyarrow'] = MagicMock()
sys.modules['myai.utils.pdfparser'] = MagicMock()
sys.modules['myai.utils.textsplitter'] = MagicMock()
sys.modules['myai.utils.page'] = MagicMock()

# Mock requests as it might be missing
mock_requests = MagicMock()
sys.modules['requests'] = mock_requests

from myai.rag import RAGService

class TestRAGEmbeddings(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Clear env vars before each test and set defaults
        self.env_patcher = patch.dict(os.environ, {}, clear=True)
        self.env_patcher.start()
        # Reset mock
        mock_requests.post.side_effect = None
        mock_requests.post.return_value = MagicMock()

    def tearDown(self):
        self.env_patcher.stop()

    async def test_openai_embedding_success(self):
        os.environ["EMBEDDING_PROVIDER"] = "openai"
        os.environ["OPENAI_API_KEY"] = "fake-key"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1] * 1536}]
        }
        mock_response.status_code = 200
        mock_requests.post.return_value = mock_response

        service = RAGService()
        embedding = await service._generate_embedding("test text")

        self.assertEqual(len(embedding), 1536)
        self.assertEqual(embedding[0], 0.1)
        mock_requests.post.assert_called()

        # Verify call details
        call_args = mock_requests.post.call_args
        self.assertIn("api.openai.com", call_args[0][0])
        self.assertEqual(call_args[1]['json']['model'], "text-embedding-3-small")
        self.assertEqual(call_args[1]['headers']['Authorization'], "Bearer fake-key")

    async def test_ollama_embedding_success(self):
        os.environ["EMBEDDING_PROVIDER"] = "ollama"
        os.environ["EMBEDDING_MODEL"] = "mxbai-embed-large"
        os.environ["EMBEDDING_DIM"] = "1024"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "embedding": [0.2] * 1024
        }
        mock_response.status_code = 200
        mock_requests.post.return_value = mock_response

        service = RAGService()
        embedding = await service._generate_embedding("test text")

        self.assertEqual(len(embedding), 1024)
        self.assertEqual(embedding[0], 0.2)

        # Verify call details
        call_args = mock_requests.post.call_args
        self.assertIn("localhost:11434", call_args[0][0])
        self.assertEqual(call_args[1]['json']['model'], "mxbai-embed-large")

    async def test_dimension_mismatch_correction_truncate(self):
        os.environ["EMBEDDING_PROVIDER"] = "openai"
        os.environ["OPENAI_API_KEY"] = "fake-key"
        os.environ["EMBEDDING_DIM"] = "10"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.5] * 1536}]
        }
        mock_response.status_code = 200
        mock_requests.post.return_value = mock_response

        service = RAGService()
        embedding = await service._generate_embedding("test text")

        self.assertEqual(len(embedding), 10)
        self.assertEqual(embedding[0], 0.5)

    async def test_dimension_mismatch_correction_pad(self):
        os.environ["EMBEDDING_PROVIDER"] = "ollama"
        os.environ["EMBEDDING_DIM"] = "1024"

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "embedding": [0.3] * 512 # Return fewer than expected
        }
        mock_response.status_code = 200
        mock_requests.post.return_value = mock_response

        service = RAGService()
        embedding = await service._generate_embedding("test text")

        self.assertEqual(len(embedding), 1024)
        self.assertEqual(embedding[0], 0.3)
        self.assertEqual(embedding[512], 0.0) # Check padding

    async def test_missing_openai_key_fallback(self):
        os.environ["EMBEDDING_PROVIDER"] = "openai"
        # NO OPENAI_API_KEY

        service = RAGService()
        embedding = await service._generate_embedding("test text")

        # Should fallback to zero vector
        self.assertEqual(len(embedding), 1536)
        self.assertEqual(sum(embedding), 0.0)

    async def test_api_error_fallback(self):
        os.environ["EMBEDDING_PROVIDER"] = "ollama"

        mock_requests.post.side_effect = Exception("Connection error")

        service = RAGService()
        embedding = await service._generate_embedding("test text")

        # Should fallback to zero vector
        self.assertEqual(len(embedding), 1024)
        self.assertEqual(sum(embedding), 0.0)

if __name__ == '__main__':
    unittest.main()
