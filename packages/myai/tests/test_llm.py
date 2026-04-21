import pytest
from unittest.mock import patch, MagicMock
from myai.core.llm import ollama_chat, simple_completion

@patch("myai.core.llm.requests.post")
def test_ollama_chat_success(mock_post):
    # Mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "message": {"role": "assistant", "content": "Hello! I am an AI."}
    }
    mock_post.return_value = mock_response

    messages = [{"role": "user", "content": "Hi"}]
    response = ollama_chat(messages)

    assert response == "Hello! I am an AI."
    mock_post.assert_called_once()

@patch("myai.core.llm.requests.post")
def test_simple_completion(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "message": {"role": "assistant", "content": "Completed."}
    }
    mock_post.return_value = mock_response

    response = simple_completion("Test prompt")
    assert response == "Completed."
