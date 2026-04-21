"""Unit tesztek: Comet CriticAgent — mockolva a Gemini Vision API-t"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from myai.agents.comet.critic import CriticAgent
from myai.agents.comet.models import CriticResult


@pytest.fixture
def critic_no_key():
    """CriticAgent API kulcs nélkül — heurisztikus mód."""
    with patch.dict("os.environ", {}, clear=True):
        agent = CriticAgent()
    return agent


@pytest.fixture
def critic_with_key():
    """CriticAgent mockolt Gemini kliensssel."""
    with patch.dict("os.environ", {"GEMINI_API_KEY": "test-gemini-key"}):
        with patch("myai.agents.comet.critic.genai") as mock_genai:
            mock_client = MagicMock()
            mock_genai.Client.return_value = mock_client
            agent = CriticAgent()
            agent._client = mock_client
            agent._use_new_sdk = True
    return agent


@pytest.mark.asyncio
async def test_heuristic_mode_returns_success(critic_no_key):
    result = await critic_no_key.evaluate(
        screenshot_bytes=b"fake_image_data",
        task="Teszt feladat",
        last_step={"action": "click", "selector": "#btn"}
    )
    assert isinstance(result, CriticResult)
    assert result.success is True


@pytest.mark.asyncio
async def test_gemini_success_response(critic_with_key):
    response_json = json.dumps({"success": True, "error": None, "suggestion": None})
    mock_response = MagicMock()
    mock_response.text = response_json
    critic_with_key._client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    result = await critic_with_key.evaluate(
        screenshot_bytes=b"fake_png_data",
        task="Kattints a gombra",
        last_step={"action": "click", "selector": "#submit"}
    )
    assert result.success is True


@pytest.mark.asyncio
async def test_gemini_failure_response(critic_with_key):
    response_json = json.dumps({
        "success": False,
        "error": "ELEMENT_NOT_FOUND",
        "suggestion": "Próbáld .btn-primary selectorral"
    })
    mock_response = MagicMock()
    mock_response.text = response_json
    critic_with_key._client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    result = await critic_with_key.evaluate(
        screenshot_bytes=b"fake_png_data",
        task="Kattints a gombra",
        last_step={"action": "click", "selector": "#submit"}
    )
    assert result.success is False
    assert result.error == "ELEMENT_NOT_FOUND"
    assert "btn-primary" in result.suggestion


@pytest.mark.asyncio
async def test_gemini_api_error_fallback(critic_with_key):
    critic_with_key._client.aio.models.generate_content = AsyncMock(
        side_effect=Exception("API quota exceeded")
    )
    result = await critic_with_key.evaluate(
        screenshot_bytes=b"fake_png_data",
        task="Teszt",
        last_step={"action": "navigate", "url": "https://test.com"}
    )
    assert result.success is True
    assert "quota" in result.error
