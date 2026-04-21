from __future__ import annotations

from typing import List

import pytest

from myai.backend.langgraph_orchestrator import IronCladOrchestrator
from myai.backend.schemas import ChatMessage


def _dummy_llm(messages: List[ChatMessage]) -> str:
    last = messages[-1].content if messages else ""
    return f"ok:{last[:20]}"


@pytest.mark.skipif(
    pytest.importorskip("langgraph", reason="langgraph not installed") is None,
    reason="langgraph not installed",
)
def test_langgraph_orchestrator_runs_full_cycle():
    orchestrator = IronCladOrchestrator(_dummy_llm)
    state = orchestrator.run("Diagnose a failing test suite", thread_id="phase3-test")

    assert "diagnosis" in state
    assert "plan" in state
    assert "actions" in state
    assert state["actions"]
