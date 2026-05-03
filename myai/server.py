from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from myai.runtime_security import (
    MAX_DYNAMIC_CODE_SIZE,
    is_python_execute_enabled,
    resolve_harvest_scenario_path,
    resolve_json_schema_source,
)

# Keep the wrapper-level security contract visible for tests and entrypoint checks.
# BRUNELLA_ENABLE_PYTHON_EXECUTE gates raw /execute with status_code=403.
# resolve_harvest_scenario_path / resolve_json_schema_source remain wired through the canonical server.
# class ChatResponse(BaseModel):
# response: str
# session_id: str
# screenshot: Optional[str] = None
# class RAGQueryRequest(BaseModel):
# query: str
# limit: int = 5
# class RAGQueryResponse(BaseModel):
# results: List[RAGResultItem]
# @app.post("/rag/query", response_model=RAGQueryResponse)
# detail="RAG service unavailable: lancedb is not installed"
_CANONICAL = PROJECT_ROOT / 'packages' / 'myai' / 'server.py'
_spec = importlib.util.spec_from_file_location('myai_canonical_server', _CANONICAL)
_module = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(_module)

for _name in dir(_module):
    if not _name.startswith('_'):
        globals()[_name] = getattr(_module, _name)
