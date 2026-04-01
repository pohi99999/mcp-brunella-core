import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT_REALPATH = os.path.realpath(PROJECT_ROOT)
SCENARIO_ROOT = os.path.join(PROJECT_ROOT_REALPATH, "myai", "scenarios")
MAX_DYNAMIC_CODE_SIZE = 16_384


def _is_truthy(value: str | None) -> bool:
    normalized = (value or "").strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def is_python_execute_enabled() -> bool:
    return _is_truthy(os.getenv("BRUNELLA_ENABLE_PYTHON_EXECUTE"))


def _resolve_under_project(path_value: str) -> str:
    candidate = (
        os.path.join(PROJECT_ROOT_REALPATH, path_value)
        if not os.path.isabs(path_value)
        else path_value
    )
    return os.path.realpath(candidate)


def resolve_harvest_scenario_path(scenario_path: str) -> str:
    resolved_path = _resolve_under_project(scenario_path)
    if (
        not resolved_path.startswith(SCENARIO_ROOT + os.sep)
        and resolved_path != SCENARIO_ROOT
    ):
        raise ValueError("Scenario path must stay within myai/scenarios")

    if not resolved_path.lower().endswith(".json"):
        raise ValueError("Scenario path must point to a JSON file")

    return resolved_path


def resolve_json_schema_source(schema_source: str) -> str:
    trimmed = schema_source.strip()
    if not trimmed:
        raise ValueError("Schema source is required")

    if trimmed.startswith("{") or trimmed.startswith("["):
        return schema_source

    resolved_path = _resolve_under_project(trimmed)
    if (
        not resolved_path.startswith(PROJECT_ROOT_REALPATH + os.sep)
        and resolved_path != PROJECT_ROOT_REALPATH
    ):
        raise ValueError("Schema path must stay within the project root")

    if not resolved_path.lower().endswith(".json"):
        raise ValueError("Schema path must point to a JSON file")

    return resolved_path
