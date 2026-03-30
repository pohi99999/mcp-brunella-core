import sys
import os
import unittest
from unittest.mock import patch, MagicMock
from importlib.machinery import ModuleSpec

# Mock requests so we can import rag without it actually installed
mock_requests = MagicMock()
mock_requests.__spec__ = ModuleSpec('requests', loader=None)
sys.modules['requests'] = mock_requests

# Inject mock modules for optional dependencies
mock_lancedb = MagicMock()
mock_lancedb.__spec__ = ModuleSpec('lancedb', loader=None)
mock_pa = MagicMock()
mock_pa.__spec__ = ModuleSpec('pyarrow', loader=None)
sys.modules['lancedb'] = mock_lancedb
sys.modules['pyarrow'] = mock_pa

from myai.rag import RAGService

class TestRAGEmbeddings(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Reset environment before each test
        os.environ.pop("EMBEDDING_PROVIDER", None)
        os.environ.pop("EMBEDDING_MODEL", None)
        os.environ.pop("EMBEDDING_DIM", None)
        os.environ.pop("OPENAI_API_KEY", None)
        os.environ.pop("OLLAMA_API_BASE", None)

    @patch('myai.rag.requests.post')
    async def test_openai_embedding_success(self, mock_post):
        os.environ["OPENAI_API_KEY"] = "sk-test"
        # We need a new instance because __init__ reads from env
        service = RAGService()

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [{"embedding": [0.1] * 1536}]
        }
        mock_post.return_value = mock_response

        vector = await service._generate_embedding("Hello world")

        # Check call details
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://api.openai.com/v1/embeddings")
        self.assertEqual(kwargs['headers']['Authorization'], "Bearer sk-test")
        self.assertEqual(kwargs['json']['input'], "Hello world")
        self.assertEqual(kwargs['json']['model'], "text-embedding-ada-002")

        # Check vector dimension
        self.assertEqual(len(vector), 1536)

    @patch('myai.rag.requests.post')
    async def test_ollama_embedding_success(self, mock_post):
        os.environ["EMBEDDING_PROVIDER"] = "ollama"
        os.environ["EMBEDDING_MODEL"] = "nomic-embed-text"
        os.environ["EMBEDDING_DIM"] = "768"

        service = RAGService()

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "embedding": [0.2] * 768
        }
        mock_post.return_value = mock_response

        vector = await service._generate_embedding("Test ollama")

        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "http://localhost:11434/api/embeddings")
        self.assertEqual(kwargs['json']['prompt'], "Test ollama")
        self.assertEqual(kwargs['json']['model'], "nomic-embed-text")

        self.assertEqual(len(vector), 768)

    @patch('myai.rag.requests.post')
    async def test_dimension_correction_truncation(self, mock_post):
        os.environ["EMBEDDING_DIM"] = "5"
        os.environ["OPENAI_API_KEY"] = "sk-test"

        service = RAGService()

        mock_response = MagicMock()
        # Mock returns 10 dimensions, but we only want 5
        mock_response.json.return_value = {
            "data": [{"embedding": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]}]
        }
        mock_post.return_value = mock_response

        vector = await service._generate_embedding("Truncate me")

        self.assertEqual(len(vector), 5)
        self.assertEqual(vector, [1.0, 2.0, 3.0, 4.0, 5.0])

    @patch('myai.rag.requests.post')
    async def test_dimension_correction_padding(self, mock_post):
        os.environ["EMBEDDING_DIM"] = "5"
        os.environ["OPENAI_API_KEY"] = "sk-test"

        service = RAGService()

        mock_response = MagicMock()
        # Mock returns 3 dimensions, but we need 5
        mock_response.json.return_value = {
            "data": [{"embedding": [1.0, 2.0, 3.0]}]
        }
        mock_post.return_value = mock_response

        vector = await service._generate_embedding("Pad me")

        self.assertEqual(len(vector), 5)
        self.assertEqual(vector, [1.0, 2.0, 3.0, 0.0, 0.0])

    async def test_openai_missing_key_fallback(self):
        # Do not set OPENAI_API_KEY
        service = RAGService()
        vector = await service._generate_embedding("No key")

        self.assertEqual(len(vector), 1536)
        self.assertEqual(vector, [0.0] * 1536)

    @patch('myai.rag.requests.post')
    async def test_api_failure_fallback(self, mock_post):
        os.environ["OPENAI_API_KEY"] = "sk-test"
        service = RAGService()

        # Simulate network error
        mock_post.side_effect = Exception("Network timeout")

        vector = await service._generate_embedding("Fail me")

        self.assertEqual(len(vector), 1536)
        self.assertEqual(vector, [0.0] * 1536)

if __name__ == '__main__':
    unittest.main()
