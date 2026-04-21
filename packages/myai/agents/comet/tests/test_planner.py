"""Unit tesztek: Comet TaskPlanner — mockolva az LLM hívást"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from myai.agents.comet.planner import TaskPlanner
from myai.agents.comet.models import BrowserStep


@pytest.fixture
def mock_planner():
    """Mockolja az OpenAI klienst, hogy ne kelljen valódi API kulcs."""
    with patch.dict("os.environ", {"GITHUB_PAT": "test-pat-key"}):
        planner = TaskPlanner(model="gpt-4o")
    return planner


def _make_mock_response(steps_json: str):
    """Helper: OpenAI response mock létrehozása."""
    choice = MagicMock()
    choice.message.content = steps_json
    response = MagicMock()
    response.choices = [choice]
    return response


@pytest.mark.asyncio
async def test_plan_parse_json_array(mock_planner):
    steps = [
        {"action": "navigate", "url": "https://google.com"},
        {"action": "fill", "selector": "#search", "text": "test"},
        {"action": "click", "selector": "#submit"},
    ]
    mock_response = _make_mock_response(json.dumps(steps))
    mock_planner.client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await mock_planner.plan("Keress rá a Google-on")
    assert len(result) == 3
    assert isinstance(result[0], BrowserStep)
    assert result[0].action == "navigate"
    assert result[1].text == "test"


@pytest.mark.asyncio
async def test_plan_parse_json_object_with_steps_key(mock_planner):
    data = {"steps": [{"action": "navigate", "url": "https://bing.com"}]}
    mock_response = _make_mock_response(json.dumps(data))
    mock_planner.client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await mock_planner.plan("Nyisd meg a Bing-et")
    assert len(result) == 1
    assert result[0].url == "https://bing.com"


@pytest.mark.asyncio
async def test_plan_with_memory_hints(mock_planner):
    steps = [{"action": "click", "selector": "#login-btn"}]
    mock_response = _make_mock_response(json.dumps(steps))
    mock_planner.client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await mock_planner.plan(
        "Jelentkezz be",
        current_url="https://example.com",
        memory_hints=["Selector '#login-btn' (már 5x működött)"]
    )
    assert len(result) == 1
    call_args = mock_planner.client.chat.completions.create.call_args
    user_msg = call_args.kwargs["messages"][1]["content"]
    assert "Memory" in user_msg
    assert "#login-btn" in user_msg


@pytest.mark.asyncio
async def test_plan_error_fallback(mock_planner):
    mock_planner.client.chat.completions.create = AsyncMock(side_effect=Exception("API error"))
    result = await mock_planner.plan("Valami feladat")
    assert len(result) == 1
    assert result[0].action == "navigate"
    assert "google.com" in result[0].url


@pytest.mark.asyncio
async def test_plan_extra_text_around_json(mock_planner):
    response_text = 'Íme a terv:\n[{"action": "navigate", "url": "https://test.com"}]\nEz volt a terv.'
    mock_response = _make_mock_response(response_text)
    mock_planner.client.chat.completions.create = AsyncMock(return_value=mock_response)

    result = await mock_planner.plan("Nyisd meg")
    assert len(result) == 1
    assert result[0].url == "https://test.com"
