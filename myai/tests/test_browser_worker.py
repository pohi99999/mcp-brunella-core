"""
Robotkéz n8n browser_worker tesztek.
- check_setup: mindig fut (import, scenario betöltés)
- API scenario: csak ha N8N_API_KEY és N8N_TEST_URL be van állítva
"""
import os
import sys
import asyncio

# Projekt gyökér a path-on
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.chdir(ROOT)


def test_browser_worker_import():
    """browser_worker modul importálható."""
    from myai import browser_worker
    assert hasattr(browser_worker, "run_n8n_api_scenario")
    assert hasattr(browser_worker, "run_n8n_scenario_ui")
    assert hasattr(browser_worker, "run_structured_extraction")
    assert hasattr(browser_worker, "run_scenario")
    assert hasattr(browser_worker, "check_setup")


def test_ui_scenario_exists():
    """n8n_training_ui.json létezik és valid."""
    path = os.path.join(ROOT, "myai/scenarios/n8n_training_ui.json")
    assert os.path.exists(path), f"Missing: {path}"
    import json
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    assert cfg.get("mode") == "ui"
    assert len(cfg.get("steps", [])) >= 1


def test_check_setup_ui_scenario():
    """check_setup UI scenario-val (GOOGLE_API_KEY nélkül is fut)."""
    from myai.browser_worker import check_setup
    result = check_setup(os.path.join(ROOT, "myai/scenarios/n8n_training_ui.json"))
    # False ha GOOGLE_API_KEY hiányzik, de nem dob hibát
    assert isinstance(result, bool)


def test_api_scenario_if_configured():
    """API scenario futtatása ha N8N_API_KEY és N8N_TEST_URL be van állítva."""
    if not os.getenv("N8N_API_KEY") or not os.getenv("N8N_TEST_URL"):
        return  # skip ha nincs konfig

    from myai.browser_worker import run_n8n_api_scenario

    async def _run():
        return await run_n8n_api_scenario(os.path.join(ROOT, "myai/scenarios/n8n_training.json"))

    result = asyncio.run(_run())
    assert result is not None
    assert "error" not in result, f"API scenario failed: {result.get('error')}"


def test_structured_schema_validation():
    """Pydantic schema validáció működik."""
    from myai.pydantic_models import validate_with_schema
    schema = {
        "title": "JobPosting",
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "company": {"type": "string"},
            "salary": {"type": "string"},
            "url": {"type": "string"},
        },
        "required": ["title", "company", "url"]
    }
    data = {
        "title": "Python Developer",
        "company": "ACME",
        "salary": "competitive",
        "url": "https://example.com/job"
    }
    validated = validate_with_schema(schema, data, name="JobPosting")
    assert validated["title"] == "Python Developer"
