from __future__ import annotations

import ast
import math
import operator as op
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from .models import CalculationResult, PathEntry, PathInspection, SearchMatch, SearchResults

MAX_PREVIEW_CHARS = 4000
MAX_SEARCH_QUERY_LENGTH = 200
MAX_SEARCH_RESULTS = 100
MAX_SEARCH_FILE_BYTES = 1_000_000
MAX_EXPRESSION_LENGTH = 500
MAX_POWER = 1_000
MAX_DIRECTORY_ENTRIES = 200

IGNORED_DIRECTORIES = {
    ".git",
    ".idea",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
}

TEXT_SUFFIXES = {
    ".bat",
    ".css",
    ".csv",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".py",
    ".ps1",
    ".rst",
    ".sh",
    ".sql",
    ".svg",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yaml",
    ".yml",
}

ALLOWED_CONSTANTS = {
    "e": math.e,
    "pi": math.pi,
    "tau": math.tau,
}

ALLOWED_FUNCTIONS = {
    "abs": abs,
    "ceil": math.ceil,
    "cos": math.cos,
    "floor": math.floor,
    "log": math.log,
    "log10": math.log10,
    "max": max,
    "min": min,
    "pow": pow,
    "round": round,
    "sin": math.sin,
    "sqrt": math.sqrt,
    "tan": math.tan,
}

ALLOWED_BINARY_OPERATORS = {
    ast.Add: op.add,
    ast.Div: op.truediv,
    ast.FloorDiv: op.floordiv,
    ast.Mod: op.mod,
    ast.Mult: op.mul,
    ast.Pow: op.pow,
    ast.Sub: op.sub,
}

ALLOWED_UNARY_OPERATORS = {
    ast.UAdd: op.pos,
    ast.USub: op.neg,
}


def format_timestamp(timestamp: float) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


def resolve_workspace_path(workspace_root: Path, user_path: str) -> Path:
    if not user_path or not user_path.strip():
        raise ValueError("Path must not be empty.")

    root = workspace_root.expanduser().resolve()
    candidate = Path(user_path).expanduser()
    resolved = candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()

    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Path escapes the workspace root: {user_path}") from exc

    return resolved


def _is_large(path: Path) -> bool:
    try:
        return path.stat().st_size > MAX_SEARCH_FILE_BYTES
    except OSError:
        return True


def is_text_file(path: Path) -> bool:
    suffix = path.suffix.lower()
    if suffix in TEXT_SUFFIXES:
        return True

    try:
        with path.open("rb") as handle:
            sample = handle.read(4096)
    except OSError:
        return False

    if b"\x00" in sample:
        return False

    try:
        sample.decode("utf-8")
    except UnicodeDecodeError:
        return False

    return True


def file_kind(path: Path) -> str:
    if path.is_symlink():
        return "symlink"
    if path.is_dir():
        return "directory"
    if path.is_file():
        return "file"
    return "other"


def _safe_stat(path: Path) -> os.stat_result | None:
    try:
        return path.stat()
    except OSError:
        return None


def _read_text_preview(path: Path, preview_chars: int) -> tuple[str | None, bool, int | None]:
    if preview_chars <= 0:
        raise ValueError("preview_chars must be greater than zero.")

    if not is_text_file(path):
        return None, False, None

    line_count = None
    try:
        with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
            content = handle.read(preview_chars + 1)
    except OSError as exc:
        raise ValueError(f"Unable to read text preview: {exc}") from exc

    preview_truncated = len(content) > preview_chars
    preview = content[:preview_chars].rstrip()

    try:
        stat_result = path.stat()
    except OSError:
        stat_result = None

    if stat_result is not None and stat_result.st_size <= MAX_SEARCH_FILE_BYTES:
        try:
            with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
                line_count = sum(1 for _ in handle)
        except OSError:
            line_count = None

    return preview, preview_truncated, line_count


def describe_path(workspace_root: Path, user_path: str, preview_chars: int = MAX_PREVIEW_CHARS) -> PathInspection:
    if preview_chars <= 0:
        raise ValueError("preview_chars must be greater than zero.")

    if preview_chars > MAX_PREVIEW_CHARS:
        preview_chars = MAX_PREVIEW_CHARS

    resolved = resolve_workspace_path(workspace_root, user_path)
    exists = resolved.exists()
    kind = file_kind(resolved) if exists else "missing"

    if not exists:
        return PathInspection(
            ok=False,
            query_path=user_path,
            resolved_path=str(resolved),
            exists=False,
            kind=kind,
            error="Path does not exist.",
        )

    stat_result = _safe_stat(resolved)
    if stat_result is None:
        return PathInspection(
            ok=False,
            query_path=user_path,
            resolved_path=str(resolved),
            exists=True,
            kind=kind,
            error="Unable to read file metadata.",
        )

    inspection = PathInspection(
        ok=True,
        query_path=user_path,
        resolved_path=str(resolved),
        exists=True,
        kind=kind,
        size_bytes=stat_result.st_size,
        modified_at=format_timestamp(stat_result.st_mtime),
    )

    if resolved.is_dir():
        entries: list[PathEntry] = []
        try:
            children = sorted(resolved.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower()))
        except OSError as exc:
            return PathInspection(
                ok=False,
                query_path=user_path,
                resolved_path=str(resolved),
                exists=True,
                kind=kind,
                size_bytes=stat_result.st_size,
                modified_at=format_timestamp(stat_result.st_mtime),
                error=f"Unable to list directory: {exc}",
            )

        for child in children[:MAX_DIRECTORY_ENTRIES]:
            child_stat = _safe_stat(child)
            entries.append(
                PathEntry(
                    name=child.name,
                    path=str(child),
                    kind=file_kind(child),
                    size_bytes=None if child_stat is None else child_stat.st_size,
                    modified_at=None if child_stat is None else format_timestamp(child_stat.st_mtime),
                )
            )

        inspection.entries = entries
        inspection.entry_count = len(children)
        inspection.entries_truncated = len(children) > MAX_DIRECTORY_ENTRIES
        return inspection

    if resolved.is_file():
        preview, preview_truncated, line_count = _read_text_preview(resolved, preview_chars)
        inspection.preview = preview
        inspection.preview_truncated = preview_truncated
        inspection.line_count = line_count
        return inspection

    inspection.kind = kind
    return inspection


def iter_workspace_files(workspace_root: Path) -> Iterator[Path]:
    root = workspace_root.expanduser().resolve()

    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = [name for name in dirnames if name not in IGNORED_DIRECTORIES]
        base = Path(dirpath)
        for filename in filenames:
            candidate = base / filename
            try:
                if candidate.is_symlink() or _is_large(candidate):
                    continue
            except OSError:
                continue

            if is_text_file(candidate):
                yield candidate


def search_workspace_text(
    workspace_root: Path,
    query: str,
    *,
    case_sensitive: bool = False,
    max_results: int = MAX_SEARCH_RESULTS,
) -> SearchResults:
    if not query or not query.strip():
        raise ValueError("Query must not be empty.")

    if len(query) > MAX_SEARCH_QUERY_LENGTH:
        raise ValueError(f"Query must be at most {MAX_SEARCH_QUERY_LENGTH} characters.")

    if max_results <= 0:
        raise ValueError("max_results must be greater than zero.")

    max_results = min(max_results, MAX_SEARCH_RESULTS)
    root = workspace_root.expanduser().resolve()
    needle = query if case_sensitive else query.casefold()
    matches: list[SearchMatch] = []
    scanned_files = 0
    matched_files = 0
    truncated = False

    for candidate in iter_workspace_files(root):
        scanned_files += 1
        file_matched = False

        try:
            with candidate.open("r", encoding="utf-8", errors="replace", newline="") as handle:
                for line_number, line in enumerate(handle, start=1):
                    haystack = line if case_sensitive else line.casefold()
                    if needle in haystack:
                        matches.append(
                            SearchMatch(
                                path=str(candidate),
                                line_number=line_number,
                                line=line.rstrip("\r\n"),
                            )
                        )
                        file_matched = True
                        if len(matches) >= max_results:
                            truncated = True
                            break
        except OSError:
            continue

        if file_matched:
            matched_files += 1

        if truncated:
            break

    return SearchResults(
        ok=True,
        query=query,
        root=str(root),
        case_sensitive=case_sensitive,
        scanned_files=scanned_files,
        matched_files=matched_files,
        matches=matches,
        truncated=truncated,
    )


def _normalize_numeric_result(value: float | int) -> float | int:
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


class _SafeExpressionEvaluator:
    def __init__(self, expression: str) -> None:
        self._expression = expression
        self._tree = ast.parse(expression, mode="eval")

    def evaluate(self) -> float | int:
        return _normalize_numeric_result(self._evaluate_node(self._tree.body))

    def normalized_expression(self) -> str:
        return ast.unparse(self._tree.body).strip()

    def _evaluate_node(self, node: ast.AST) -> float | int:
        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
                raise ValueError("Only numeric constants are allowed.")
            return node.value

        if isinstance(node, ast.Name):
            if node.id not in ALLOWED_CONSTANTS:
                raise ValueError(f"Unknown name: {node.id}")
            return ALLOWED_CONSTANTS[node.id]

        if isinstance(node, ast.UnaryOp):
            operator = ALLOWED_UNARY_OPERATORS.get(type(node.op))
            if operator is None:
                raise ValueError("Unary operator is not allowed.")
            return _normalize_numeric_result(operator(self._evaluate_node(node.operand)))

        if isinstance(node, ast.BinOp):
            operator = ALLOWED_BINARY_OPERATORS.get(type(node.op))
            if operator is None:
                raise ValueError("Binary operator is not allowed.")

            left = self._evaluate_node(node.left)
            right = self._evaluate_node(node.right)

            if isinstance(node.op, ast.Pow) and abs(float(right)) > MAX_POWER:
                raise ValueError("Exponent is too large.")

            return _normalize_numeric_result(operator(left, right))

        if isinstance(node, ast.Call):
            if node.keywords:
                raise ValueError("Keyword arguments are not allowed in expressions.")

            if not isinstance(node.func, ast.Name):
                raise ValueError("Only simple function calls are allowed.")

            function = ALLOWED_FUNCTIONS.get(node.func.id)
            if function is None:
                raise ValueError(f"Function is not allowed: {node.func.id}")

            args = [self._evaluate_node(argument) for argument in node.args]
            try:
                return _normalize_numeric_result(function(*args))
            except TypeError as exc:
                raise ValueError(str(exc)) from exc

        raise ValueError(f"Expression element is not allowed: {type(node).__name__}")


def calculate_expression(expression: str) -> CalculationResult:
    if not expression or not expression.strip():
        raise ValueError("Expression must not be empty.")

    if len(expression) > MAX_EXPRESSION_LENGTH:
        raise ValueError(f"Expression must be at most {MAX_EXPRESSION_LENGTH} characters.")

    try:
        evaluator = _SafeExpressionEvaluator(expression.strip())
        result = evaluator.evaluate()
        return CalculationResult(
            ok=True,
            expression=expression,
            normalized_expression=evaluator.normalized_expression(),
            result=result,
        )
    except (SyntaxError, TypeError, ValueError, ZeroDivisionError, OverflowError) as exc:
        return CalculationResult(ok=False, expression=expression, error=str(exc))


def render_workspace_resource(workspace_root: Path, user_path: str, preview_chars: int = MAX_PREVIEW_CHARS) -> str:
    inspection = describe_path(workspace_root, user_path, preview_chars=preview_chars)
    if not inspection.ok:
        raise ValueError(inspection.error or "Unable to render resource.")

    lines = [
        f"# Workspace resource: `{inspection.query_path}`",
        "",
        f"- **Resolved path:** `{inspection.resolved_path}`",
        f"- **Kind:** `{inspection.kind}`",
        f"- **Exists:** `{inspection.exists}`",
    ]

    if inspection.size_bytes is not None:
        lines.append(f"- **Size:** `{inspection.size_bytes}` bytes")
    if inspection.modified_at is not None:
        lines.append(f"- **Modified:** `{inspection.modified_at}`")

    if inspection.kind == "directory":
        lines.append("")
        lines.append("## Directory entries")
        if not inspection.entries:
            lines.append("_Directory is empty._")
        else:
            for entry in inspection.entries:
                details = [entry.kind]
                if entry.size_bytes is not None:
                    details.append(f"{entry.size_bytes} bytes")
                if entry.modified_at is not None:
                    details.append(entry.modified_at)
                lines.append(f"- `{entry.name}` ({', '.join(details)})")

        if inspection.entries_truncated:
            lines.append("")
            lines.append("_Directory listing truncated._")

        return "\n".join(lines).strip()

    lines.append("")
    lines.append("## Preview")
    if inspection.preview is not None:
        if inspection.preview_truncated:
            lines.append("_Preview truncated._")
        lines.append("```text")
        lines.append(inspection.preview)
        lines.append("```")
    else:
        lines.append("_No text preview available for this path._")

    if inspection.line_count is not None:
        lines.append("")
        lines.append(f"- **Line count:** `{inspection.line_count}`")

    return "\n".join(lines).strip()


def build_review_prompt(workspace_root: Path, user_path: str, focus: str = "correctness") -> str:
    root = workspace_root.expanduser().resolve()
    resolved = resolve_workspace_path(root, user_path)
    if not focus or not focus.strip():
        raise ValueError("focus must not be empty.")

    resource_path = resolved.relative_to(root).as_posix()

    return (
        f"You are reviewing the workspace file at `{resolved}`.\n\n"
        f"Focus on {focus.strip()}.\n"
        f"Use the `workspace://file/{resource_path}` resource to inspect the file contents.\n\n"
        "Return:\n"
        "1. A short summary\n"
        "2. Ordered findings with severity\n"
        "3. Concrete recommendations\n"
        "4. Any test ideas that would reduce risk\n"
    )
