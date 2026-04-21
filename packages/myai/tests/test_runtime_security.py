from __future__ import annotations

import os
from pathlib import Path

import pytest

from myai import runtime_security


# ===========================================================================
# resolve_harvest_scenario_path -- happy paths
# ===========================================================================

def test_resolve_harvest_scenario_path_accepts_valid_relative_json_path() -> None:
    resolved = runtime_security.resolve_harvest_scenario_path("myai/scenarios/example.json")

    assert resolved == str(Path(runtime_security.SCENARIO_ROOT) / "example.json")


def test_resolve_harvest_scenario_path_accepts_nested_subdirectory_path() -> None:
    """Path in a sub-directory of scenarios/ resolves; file need not exist."""
    result = runtime_security.resolve_harvest_scenario_path("myai/scenarios/sub/workflow.json")
    expected = os.path.realpath(
        os.path.join(runtime_security.PROJECT_ROOT_REALPATH, "myai", "scenarios", "sub", "workflow.json")
    )
    assert result == expected


def test_resolve_harvest_scenario_path_accepts_json_extension_case_insensitively() -> None:
    """.JSON (uppercase) must pass the extension check."""
    result = runtime_security.resolve_harvest_scenario_path("myai/scenarios/data.JSON")
    assert result.lower().endswith(".json")


# ===========================================================================
# resolve_harvest_scenario_path -- traversal rejection
# ===========================================================================

@pytest.mark.parametrize(
    ("scenario_path", "expected_message"),
    [
        ("../outside.json", "Scenario path must stay within myai/scenarios"),
        ("../../etc/passwd", "Scenario path must stay within myai/scenarios"),
        ("../../evil.json", "Scenario path must stay within myai/scenarios"),
        # Traversal embedded inside a seemingly valid prefix
        ("myai/scenarios/../../../etc/shadow.json", "Scenario path must stay within myai/scenarios"),
        # Path resolving to project root itself (not in scenarios/)
        (".", "Scenario path must stay within myai/scenarios"),
    ],
)
def test_resolve_harvest_scenario_path_rejects_traversal_attempts(
    scenario_path: str,
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        runtime_security.resolve_harvest_scenario_path(scenario_path)


def test_resolve_harvest_scenario_path_rejects_absolute_path_outside_project() -> None:
    """Absolute path one level above project root is rejected (file need not exist)."""
    # Path to parent of project root -- always outside SCENARIO_ROOT
    outside_json = os.path.join(
        os.path.dirname(runtime_security.PROJECT_ROOT_REALPATH),
        "outside_project.json",
    )
    with pytest.raises(ValueError, match="Scenario path must stay within myai/scenarios"):
        runtime_security.resolve_harvest_scenario_path(outside_json)


# ===========================================================================
# resolve_harvest_scenario_path -- within-project but outside scenarios/
# ===========================================================================

@pytest.mark.parametrize(
    "scenario_path",
    [
        "config.json",           # project root level
        "myai/config.json",      # myai/ but not myai/scenarios/
        "myai/schemas/def.json", # sibling directory to scenarios/
    ],
)
def test_resolve_harvest_scenario_path_rejects_paths_inside_project_but_outside_scenarios(
    scenario_path: str,
) -> None:
    """JSON files within the project root but not in myai/scenarios/ must be rejected."""
    with pytest.raises(ValueError, match="Scenario path must stay within myai/scenarios"):
        runtime_security.resolve_harvest_scenario_path(scenario_path)


# ===========================================================================
# resolve_harvest_scenario_path -- non-JSON extension rejection
# ===========================================================================

@pytest.mark.parametrize(
    ("scenario_path", "expected_message"),
    [
        ("myai/scenarios/not-json.txt", "Scenario path must point to a JSON file"),
        ("myai/scenarios/evil.sh", "Scenario path must point to a JSON file"),
        ("myai/scenarios/run.py", "Scenario path must point to a JSON file"),
        ("myai/scenarios/config.yaml", "Scenario path must point to a JSON file"),
        ("myai/scenarios/no_extension", "Scenario path must point to a JSON file"),
    ],
)
def test_resolve_harvest_scenario_path_rejects_invalid_inputs(
    scenario_path: str,
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        runtime_security.resolve_harvest_scenario_path(scenario_path)


# ===========================================================================
# resolve_json_schema_source -- inline JSON pass-through
# ===========================================================================

def test_resolve_json_schema_source_preserves_inline_json_schema() -> None:
    raw_schema = '{"type":"object","properties":{"name":{"type":"string"}}}'

    resolved = runtime_security.resolve_json_schema_source(raw_schema)

    assert resolved == raw_schema


def test_resolve_json_schema_source_preserves_inline_json_array() -> None:
    """Inline JSON array (starting with '[') is returned unchanged."""
    schema = '[{"type": "string"}]'
    assert runtime_security.resolve_json_schema_source(schema) == schema


def test_resolve_json_schema_source_returns_original_string_with_leading_whitespace_for_inline_json() -> None:
    """Detection trims to find '{'; the original (untrimmed) string is returned."""
    schema_source = '   {"type": "object"}'
    result = runtime_security.resolve_json_schema_source(schema_source)
    assert result == schema_source  # original, not trimmed


# ===========================================================================
# resolve_json_schema_source -- path resolution (valid)
# ===========================================================================

def test_resolve_json_schema_source_accepts_project_relative_json_path() -> None:
    resolved = runtime_security.resolve_json_schema_source("myai/scenarios/schema.json")

    expected = Path(runtime_security.PROJECT_ROOT_REALPATH) / "myai" / "scenarios" / "schema.json"
    assert resolved == str(expected)


def test_resolve_json_schema_source_accepts_json_extension_case_insensitively() -> None:
    """.JSON (uppercase) is accepted as a path source."""
    result = runtime_security.resolve_json_schema_source("myai/scenarios/data.JSON")
    assert result.lower().endswith(".json")


# ===========================================================================
# resolve_json_schema_source -- empty/blank rejection
# ===========================================================================

@pytest.mark.parametrize(
    ("schema_source", "expected_message"),
    [
        ("", "Schema source is required"),
        ("   \t\n  ", "Schema source is required"),
    ],
)
def test_resolve_json_schema_source_rejects_empty_and_whitespace_inputs(
    schema_source: str,
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        runtime_security.resolve_json_schema_source(schema_source)


# ===========================================================================
# resolve_json_schema_source -- traversal rejection
# ===========================================================================

@pytest.mark.parametrize(
    ("schema_source", "expected_message"),
    [
        ("../../etc/passwd.json", "Schema path must stay within the project root"),
        ("../../evil.json", "Schema path must stay within the project root"),
        # Traversal embedded in a valid-looking prefix
        ("myai/schemas/../../../evil.json", "Schema path must stay within the project root"),
        # Traversal with surrounding whitespace (trimmed before resolution)
        ("  ../../evil.json  ", "Schema path must stay within the project root"),
    ],
)
def test_resolve_json_schema_source_rejects_traversal_attempts(
    schema_source: str,
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        runtime_security.resolve_json_schema_source(schema_source)


def test_resolve_json_schema_source_rejects_out_of_root_absolute_path() -> None:
    """Absolute path one level above project root is rejected (file need not exist)."""
    outside_schema = str(
        Path(runtime_security.PROJECT_ROOT_REALPATH).parent / "outside-schema.json"
    )
    with pytest.raises(ValueError, match="Schema path must stay within the project root"):
        runtime_security.resolve_json_schema_source(outside_schema)


# ===========================================================================
# resolve_json_schema_source -- non-JSON extension rejection (path sources)
# ===========================================================================

@pytest.mark.parametrize(
    ("schema_source", "expected_message"),
    [
        ("myai/scenarios/schema.txt", "Schema path must point to a JSON file"),
        ("myai/schemas/config.yaml", "Schema path must point to a JSON file"),
        ("myai/schema_builder.py", "Schema path must point to a JSON file"),
        ("myai/schema_data", "Schema path must point to a JSON file"),
        ("myai/schemas/schema.xml", "Schema path must point to a JSON file"),
    ],
)
def test_resolve_json_schema_source_rejects_invalid_relative_inputs(
    schema_source: str,
    expected_message: str,
) -> None:
    with pytest.raises(ValueError, match=expected_message):
        runtime_security.resolve_json_schema_source(schema_source)
