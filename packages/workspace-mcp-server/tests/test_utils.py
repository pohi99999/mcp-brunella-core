from __future__ import annotations

from pathlib import Path

import pytest

from workspace_mcp_server.utils import (
    build_review_prompt,
    calculate_expression,
    describe_path,
    render_workspace_resource,
    resolve_workspace_path,
    search_workspace_text,
)


def test_resolve_workspace_path_allows_paths_inside_root(tmp_path: Path) -> None:
    nested = tmp_path / "docs"
    nested.mkdir()
    file_path = nested / "notes.txt"
    file_path.write_text("hello", encoding="utf-8")

    resolved = resolve_workspace_path(tmp_path, "docs/notes.txt")

    assert resolved == file_path.resolve()


def test_resolve_workspace_path_rejects_escape_attempts(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="escapes the workspace root"):
        resolve_workspace_path(tmp_path, "../outside.txt")


def test_calculate_expression_supports_safe_math() -> None:
    result = calculate_expression("sqrt(81) + pi")

    assert result.ok is True
    assert result.result == pytest.approx(12.141592653589793)
    assert result.normalized_expression is not None


def test_calculate_expression_rejects_unsafe_input() -> None:
    result = calculate_expression("__import__('os').system('whoami')")

    assert result.ok is False
    assert result.error is not None


def test_describe_path_returns_preview_for_text_files(tmp_path: Path) -> None:
    file_path = tmp_path / "notes.txt"
    file_path.write_text("hello\nworld\n", encoding="utf-8")

    inspection = describe_path(tmp_path, "notes.txt", preview_chars=20)

    assert inspection.ok is True
    assert inspection.line_count == 2
    assert inspection.preview is not None
    assert "hello" in inspection.preview


def test_render_workspace_resource_includes_directory_listing(tmp_path: Path) -> None:
    (tmp_path / "alpha.txt").write_text("alpha", encoding="utf-8")
    (tmp_path / "beta.txt").write_text("beta", encoding="utf-8")

    rendered = render_workspace_resource(tmp_path, ".")

    assert "Directory entries" in rendered
    assert "alpha.txt" in rendered
    assert "beta.txt" in rendered


def test_search_workspace_text_finds_matches(tmp_path: Path) -> None:
    (tmp_path / "alpha.txt").write_text("hello world\nbye world\n", encoding="utf-8")
    nested = tmp_path / "nested"
    nested.mkdir()
    (nested / "beta.txt").write_text("world peace\n", encoding="utf-8")

    results = search_workspace_text(tmp_path, "world", max_results=10)

    assert results.ok is True
    assert results.matched_files == 2
    assert len(results.matches) >= 2


def test_build_review_prompt_mentions_resource_path(tmp_path: Path) -> None:
    file_path = tmp_path / "notes.txt"
    file_path.write_text("hello", encoding="utf-8")

    prompt = build_review_prompt(tmp_path, "notes.txt", focus="security")

    assert "security" in prompt
    assert str(file_path.resolve()) in prompt
