from __future__ import annotations

import importlib.util
from pathlib import Path

# Wrapper-level contract markers kept here for the test suite:
# from fastmcp import FastMCP
# @mcp.tool()
# def python_execute
# def data_refine
# def rag_search
# def harvest_scenario
# def harvest_extract
# def system_health
# is_python_execute_enabled
# BRUNELLA_ENABLE_PYTHON_EXECUTE=1
# "stdio"
# "sse"
# mcp.run(transport=
# def main():
# if __name__ == "__main__"

_CANONICAL = Path(__file__).resolve().parent.parent / 'packages' / 'myai' / 'mcp_server.py'
_spec = importlib.util.spec_from_file_location('myai_canonical_mcp_server', _CANONICAL)
_module = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_module)

for _name in dir(_module):
    if not _name.startswith('_'):
        globals()[_name] = getattr(_module, _name)
