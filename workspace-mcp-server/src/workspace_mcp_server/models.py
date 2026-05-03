from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

TransportType = Literal["stdio", "streamable-http"]
PathKind = Literal["file", "directory", "symlink", "missing", "other"]


class ServerInfo(BaseModel):
    ok: bool = True
    name: str
    version: str
    transport: TransportType
    workspace_root: str
    host: str | None = None
    port: int | None = None
    python_version: str
    platform: str
    available_tools: list[str] = Field(default_factory=list)
    available_resources: list[str] = Field(default_factory=list)
    available_prompts: list[str] = Field(default_factory=list)


class PathEntry(BaseModel):
    name: str
    path: str
    kind: PathKind
    size_bytes: int | None = None
    modified_at: str | None = None


class PathInspection(BaseModel):
    ok: bool = True
    query_path: str
    resolved_path: str | None = None
    exists: bool = False
    kind: PathKind = "missing"
    size_bytes: int | None = None
    modified_at: str | None = None
    line_count: int | None = None
    preview: str | None = None
    preview_truncated: bool = False
    entry_count: int | None = None
    entries_truncated: bool = False
    entries: list[PathEntry] = Field(default_factory=list)
    error: str | None = None


class SearchMatch(BaseModel):
    path: str
    line_number: int
    line: str


class SearchResults(BaseModel):
    ok: bool = True
    query: str
    root: str
    case_sensitive: bool
    scanned_files: int
    matched_files: int
    matches: list[SearchMatch] = Field(default_factory=list)
    truncated: bool = False
    error: str | None = None


class CalculationResult(BaseModel):
    ok: bool = True
    expression: str
    normalized_expression: str | None = None
    result: float | int | None = None
    error: str | None = None
