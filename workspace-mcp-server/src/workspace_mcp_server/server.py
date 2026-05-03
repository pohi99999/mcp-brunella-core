from __future__ import annotations

import argparse
import logging
import os
import platform
import sys
from pathlib import Path
from typing import Sequence

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

from .models import CalculationResult, PathInspection, SearchResults, ServerInfo, TransportType
from .utils import (
    build_review_prompt,
    calculate_expression,
    describe_path,
    render_workspace_resource,
    search_workspace_text,
)

VERSION = "0.1.0"
SERVER_NAME = "workspace-mcp-server"
AVAILABLE_TOOLS = ["workspace_info", "inspect_path", "search_text", "calculate"]
AVAILABLE_RESOURCES = ["workspace://file/{path}"]
AVAILABLE_PROMPTS = ["review_workspace_file"]

logger = logging.getLogger(__name__)


def build_server(
    workspace_root: Path,
    *,
    transport: TransportType = "stdio",
    host: str | None = None,
    port: int | None = None,
) -> FastMCP:
    root = workspace_root.expanduser().resolve()
    mcp = FastMCP(SERVER_NAME)

    @mcp.tool()
    def workspace_info() -> ServerInfo:
        """Report server and workspace metadata."""

        return ServerInfo(
            name=SERVER_NAME,
            version=VERSION,
            transport=transport,
            workspace_root=str(root),
            host=host,
            port=port,
            python_version=sys.version.split()[0],
            platform=platform.platform(),
            available_tools=AVAILABLE_TOOLS,
            available_resources=AVAILABLE_RESOURCES,
            available_prompts=AVAILABLE_PROMPTS,
        )

    @mcp.tool()
    def inspect_path(path: str, preview_chars: int = 400) -> PathInspection:
        """Inspect a file or directory under the workspace root."""

        try:
            preview_chars = max(1, min(preview_chars, 4000))
            return describe_path(root, path, preview_chars=preview_chars)
        except (FileNotFoundError, NotADirectoryError, PermissionError, ValueError) as exc:
            return PathInspection(ok=False, query_path=path, error=str(exc))

    @mcp.tool()
    def search_text(query: str, case_sensitive: bool = False, max_results: int = 20) -> SearchResults:
        """Search text across the workspace root."""

        try:
            max_results = max(1, min(max_results, 100))
            return search_workspace_text(root, query, case_sensitive=case_sensitive, max_results=max_results)
        except ValueError as exc:
            return SearchResults(
                ok=False,
                query=query,
                root=str(root),
                case_sensitive=case_sensitive,
                scanned_files=0,
                matched_files=0,
                error=str(exc),
            )

    @mcp.tool()
    def calculate(expression: str) -> CalculationResult:
        """Evaluate a restricted math expression."""

        try:
            return calculate_expression(expression)
        except ValueError as exc:
            return CalculationResult(ok=False, expression=expression, error=str(exc))

    @mcp.resource("workspace://file/{path}")
    def workspace_file(path: str) -> str:
        """Return a read-only snapshot of a workspace file or directory."""

        return render_workspace_resource(root, path)

    @mcp.prompt()
    def review_workspace_file(path: str, focus: str = "correctness") -> str:
        """Generate a prompt for reviewing a workspace file."""

        return build_review_prompt(root, path, focus=focus)

    return mcp


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_transport(name: str, default: str = "stdio") -> str:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    normalized = value.strip().lower()
    if normalized in {"stdio", "streamable-http"}:
        return normalized
    return default


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Workspace MCP server.")
    parser.add_argument(
        "--transport",
        choices=("stdio", "streamable-http"),
        default=_env_transport("MCP_TRANSPORT", "stdio"),
        help="Transport to use when starting the server.",
    )
    parser.add_argument(
        "--workspace-root",
        default=os.getenv("MCP_WORKSPACE_ROOT", "."),
        help="Root directory that the server can inspect.",
    )
    parser.add_argument("--host", default=os.getenv("MCP_HOST", "127.0.0.1"), help="HTTP bind host.")
    parser.add_argument(
        "--port",
        type=int,
        default=_env_int("MCP_PORT", 8000),
        help="HTTP bind port.",
    )
    parser.add_argument(
        "--stateless-http",
        action="store_true",
        default=_env_flag("MCP_STATELESS_HTTP", False),
        help="Enable stateless HTTP mode.",
    )
    parser.add_argument(
        "--json-response",
        action="store_true",
        default=_env_flag("MCP_JSON_RESPONSE", False),
        help="Return JSON responses for HTTP transport.",
    )
    parser.add_argument(
        "--log-level",
        default=os.getenv("MCP_LOG_LEVEL", "INFO"),
        help="Logging level for the server process.",
    )
    return parser.parse_args(argv)


def _configure_logging(log_level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def main(argv: Sequence[str] | None = None) -> None:
    load_dotenv()
    args = parse_args(argv)
    _configure_logging(args.log_level)

    workspace_root = Path(args.workspace_root).expanduser().resolve()
    if not workspace_root.exists():
        raise SystemExit(f"Workspace root does not exist: {workspace_root}")
    if not workspace_root.is_dir():
        raise SystemExit(f"Workspace root must be a directory: {workspace_root}")

    logger.info("Starting %s transport=%s workspace_root=%s", SERVER_NAME, args.transport, workspace_root)

    mcp = build_server(
        workspace_root,
        transport=args.transport,
        host=args.host if args.transport == "streamable-http" else None,
        port=args.port if args.transport == "streamable-http" else None,
    )

    if args.transport == "stdio":
        mcp.run(transport="stdio")
        return

    mcp.run(
        transport="streamable-http",
        host=args.host,
        port=args.port,
        stateless_http=args.stateless_http,
        json_response=args.json_response,
    )
