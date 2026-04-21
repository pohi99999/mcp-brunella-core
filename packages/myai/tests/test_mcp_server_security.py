"""
Focused security and error-path tests for high-risk MCP tools.

Tests:
  - rag_search()       -- ImportError / generic error fallback paths
  - harvest_scenario() -- path traversal protection
  - harvest_extract()  -- schema/path error handling and delegation

Run: pytest myai/tests/test_mcp_server_security.py -v
"""
from __future__ import annotations

import json
import os
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import myai.mcp_server as mcp_module


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_browser_worker_mock() -> types.ModuleType:
    """Create a minimal browser_worker mock module for injection into sys.modules."""
    mod = types.ModuleType("myai.browser_worker")
    mod.run_scenario = AsyncMock(return_value={"items": []})
    mod.run_structured_extraction = AsyncMock(return_value={"data": {}})
    mod.check_setup = MagicMock(return_value=True)
    return mod


@pytest.fixture()
def mock_browser_worker(monkeypatch):
    """Inject a minimal browser_worker mock for the duration of the test.

    This prevents real Playwright / browser-use imports and lets us test
    the pure validation / error-handling logic in mcp_server tools.
    """
    mod = _make_browser_worker_mock()
    monkeypatch.setitem(sys.modules, "myai.browser_worker", mod)
    return mod


# ===========================================================================
# rag_search -- fallback / error paths
# ===========================================================================

class TestRagSearchErrors:
    """rag_search() must return error JSON for all failure modes gracefully."""

    @pytest.mark.asyncio
    async def test_should_return_lancedb_unavailable_error_when_import_fails(self) -> None:
        """ImportError from _get_rag is caught and returns user-friendly JSON."""
        with patch.object(mcp_module, "_get_rag", side_effect=ImportError("No module named 'lancedb'")):
            result = await mcp_module.rag_search("test query")

        data = json.loads(result)
        assert data["status"] == "error"
        # The hardcoded message must mention lancedb so callers know what to install
        assert "lancedb" in data["error"].lower()

    @pytest.mark.asyncio
    async def test_should_return_error_json_when_rag_search_raises_runtime_error(self) -> None:
        """Generic RuntimeError from rag.search is caught and surfaced in error JSON."""
        mock_rag = MagicMock()
        mock_rag.search = AsyncMock(side_effect=RuntimeError("Vector DB connection refused"))
        with patch.object(mcp_module, "_get_rag", return_value=mock_rag):
            result = await mcp_module.rag_search("find me data")

        data = json.loads(result)
        assert data["status"] == "error"
        assert "Vector DB connection refused" in data["error"]

    @pytest.mark.asyncio
    async def test_should_return_error_json_when_rag_search_raises_os_error(self) -> None:
        """OSError from rag.search (e.g., disk full) is caught and returned as error JSON."""
        mock_rag = MagicMock()
        mock_rag.search = AsyncMock(side_effect=OSError("No space left on device"))
        with patch.object(mcp_module, "_get_rag", return_value=mock_rag):
            result = await mcp_module.rag_search("test")

        data = json.loads(result)
        assert data["status"] == "error"
        assert "No space left on device" in data["error"]

    @pytest.mark.asyncio
    async def test_should_clamp_limit_to_maximum_of_20(self) -> None:
        """Limit > 20 must be silently clamped; the underlying search sees at most 20."""
        mock_rag = MagicMock()
        mock_rag.search = AsyncMock(return_value=[])
        with patch.object(mcp_module, "_get_rag", return_value=mock_rag):
            await mcp_module.rag_search("query", limit=999)

        mock_rag.search.assert_called_once_with("query", limit=20)

    @pytest.mark.asyncio
    async def test_should_return_success_json_with_results_list_and_count(self) -> None:
        """Successful search returns status=success with results list and count field."""
        mock_rag = MagicMock()
        fake_results = [{"text": "result 1"}, {"text": "result 2"}]
        mock_rag.search = AsyncMock(return_value=fake_results)
        with patch.object(mcp_module, "_get_rag", return_value=mock_rag):
            result = await mcp_module.rag_search("query", limit=5)

        data = json.loads(result)
        assert data["status"] == "success"
        assert data["count"] == 2
        assert len(data["results"]) == 2

    @pytest.mark.asyncio
    async def test_should_return_success_with_empty_results_when_nothing_found(self) -> None:
        """Empty result list is returned as success with count=0 (not an error)."""
        mock_rag = MagicMock()
        mock_rag.search = AsyncMock(return_value=[])
        with patch.object(mcp_module, "_get_rag", return_value=mock_rag):
            result = await mcp_module.rag_search("no match query")

        data = json.loads(result)
        assert data["status"] == "success"
        assert data["count"] == 0
        assert data["results"] == []


# ===========================================================================
# harvest_scenario -- path validation
# ===========================================================================

class TestHarvestScenarioPathValidation:
    """harvest_scenario() must block path traversal before any browser interaction."""

    @pytest.mark.asyncio
    async def test_should_reject_simple_dotdot_traversal(self, mock_browser_worker) -> None:
        """../../etc/passwd is detected as path traversal and rejected immediately."""
        result = await mcp_module.harvest_scenario("../../etc/passwd")

        data = json.loads(result)
        assert data["status"] == "error"
        assert "must stay within" in data["error"].lower()

    @pytest.mark.asyncio
    async def test_should_reject_multi_level_dotdot_traversal(self, mock_browser_worker) -> None:
        """Multiple .. levels are resolved and the resulting out-of-root path is rejected."""
        result = await mcp_module.harvest_scenario("../../../../root/.ssh/id_rsa")

        data = json.loads(result)
        assert data["status"] == "error"
        assert "must stay within" in data["error"].lower()

    @pytest.mark.asyncio
    async def test_should_reject_absolute_path_outside_project_root(
        self, mock_browser_worker
    ) -> None:
        """Absolute path one level above project root is caught and rejected (file need not exist)."""
        from myai import runtime_security as _sec

        outside = os.path.join(
            os.path.dirname(_sec.PROJECT_ROOT_REALPATH), "evil_scenario.json"
        )

        result = await mcp_module.harvest_scenario(outside)

        data = json.loads(result)
        assert data["status"] == "error"
        assert "must stay within" in data["error"].lower()

    @pytest.mark.asyncio
    async def test_should_return_not_found_for_valid_path_inside_root_that_does_not_exist(
        self, mock_browser_worker
    ) -> None:
        """A path within project root that does not exist returns a 'not found' error (not traversal)."""
        result = await mcp_module.harvest_scenario(
            "myai/scenarios/nonexistent_xyzabc_99999.json"
        )

        data = json.loads(result)
        assert data["status"] == "error"
        # Should report missing file, not traversal
        assert "not found" in data["error"].lower()
        assert "traversal" not in data["error"].lower()

    @pytest.mark.asyncio
    async def test_should_call_run_scenario_for_existing_valid_scenario_file(
        self, mock_browser_worker
    ) -> None:
        """An existing, in-root scenario file causes run_scenario to be called once."""
        scenario_dir = os.path.join(mcp_module.PROJECT_ROOT_REALPATH, "myai", "scenarios")
        test_scenario = os.path.join(scenario_dir, "n8n_training_ui.json")
        if not os.path.exists(test_scenario):
            pytest.skip("n8n_training_ui.json not present -- cannot test successful dispatch")

        mock_browser_worker.run_scenario = AsyncMock(return_value={"items": []})
        result = await mcp_module.harvest_scenario("myai/scenarios/n8n_training_ui.json")

        data = json.loads(result)
        assert data["status"] == "success"
        mock_browser_worker.run_scenario.assert_called_once()


# ===========================================================================
# harvest_extract -- schema/path error handling and delegation
# ===========================================================================

class TestHarvestExtractSchemaValidation:
    """harvest_extract() error handling: result dict errors and runtime exceptions."""

    @pytest.mark.asyncio
    async def test_should_return_error_json_when_extraction_result_contains_error_key(
        self, mock_browser_worker
    ) -> None:
        """When run_structured_extraction returns {'error': ...}, returns error JSON."""
        mock_browser_worker.run_structured_extraction = AsyncMock(
            return_value={"error": "Schema validation failed: missing required field 'name'"}
        )

        result = await mcp_module.harvest_extract(
            target_url="https://example.com",
            schema_source='{"type": "object"}',
        )

        data = json.loads(result)
        assert data["status"] == "error"
        assert "Schema validation failed" in data["error"]

    @pytest.mark.asyncio
    async def test_should_return_success_json_when_extraction_returns_data(
        self, mock_browser_worker
    ) -> None:
        """Successful extraction returns status=success with the data payload."""
        mock_browser_worker.run_structured_extraction = AsyncMock(
            return_value={"data": {"name": "ACME Corp", "revenue": "1M"}}
        )

        result = await mcp_module.harvest_extract(
            target_url="https://example.com",
            schema_source='{"type": "object"}',
        )

        data = json.loads(result)
        assert data["status"] == "success"
        assert data["data"]["name"] == "ACME Corp"

    @pytest.mark.asyncio
    async def test_should_return_error_json_when_extraction_raises_runtime_exception(
        self, mock_browser_worker
    ) -> None:
        """Runtime exception inside extraction is caught and returned as error JSON."""
        mock_browser_worker.run_structured_extraction = AsyncMock(
            side_effect=RuntimeError("Playwright browser process crashed")
        )

        result = await mcp_module.harvest_extract(
            target_url="https://example.com",
            schema_source='{"type": "object"}',
        )

        data = json.loads(result)
        assert data["status"] == "error"
        assert "Playwright browser process crashed" in data["error"]

    @pytest.mark.asyncio
    async def test_should_return_success_with_none_data_when_extraction_returns_no_data_key(
        self, mock_browser_worker
    ) -> None:
        """When result has no 'data' key, data=None is included in the success response."""
        mock_browser_worker.run_structured_extraction = AsyncMock(return_value={})

        result = await mcp_module.harvest_extract(
            target_url="https://example.com",
            schema_source='{"type": "object"}',
        )

        data = json.loads(result)
        assert data["status"] == "success"
        assert data["data"] is None  # result.get("data") with missing key

    @pytest.mark.asyncio
    async def test_should_pass_schema_source_as_second_positional_argument(
        self, mock_browser_worker
    ) -> None:
        """schema_source is forwarded unchanged as the second arg to run_structured_extraction."""
        schema = '{"type": "object", "required": ["id", "name"]}'
        mock_browser_worker.run_structured_extraction = AsyncMock(return_value={"data": {}})

        await mcp_module.harvest_extract(
            target_url="https://example.com",
            schema_source=schema,
        )

        call_args = mock_browser_worker.run_structured_extraction.call_args
        # Signature: run_structured_extraction(config, schema_source)
        assert call_args[0][1] == schema

    @pytest.mark.asyncio
    async def test_should_include_target_url_in_config_dict_passed_to_extraction(
        self, mock_browser_worker
    ) -> None:
        """target_url is embedded in the config dict (first arg) to run_structured_extraction."""
        mock_browser_worker.run_structured_extraction = AsyncMock(return_value={"data": {}})

        await mcp_module.harvest_extract(
            target_url="https://target.example.com/data",
            schema_source='{"type": "object"}',
        )

        call_args = mock_browser_worker.run_structured_extraction.call_args
        config_dict = call_args[0][0]
        assert config_dict["target_url"] == "https://target.example.com/data"

    @pytest.mark.asyncio
    async def test_should_return_error_json_when_browser_worker_lacks_required_function(
        self, monkeypatch
    ) -> None:
        """If browser_worker module is present but run_structured_extraction is missing, error JSON is returned."""
        broken_mod = types.ModuleType("myai.browser_worker")
        # run_structured_extraction intentionally absent -- triggers ImportError on 'from ... import'
        monkeypatch.setitem(sys.modules, "myai.browser_worker", broken_mod)

        result = await mcp_module.harvest_extract(
            target_url="https://example.com",
            schema_source='{"type": "object"}',
        )

        data = json.loads(result)
        assert data["status"] == "error"
        # Error message should be non-empty
        assert data["error"]
