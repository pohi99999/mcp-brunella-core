from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional, TypedDict

import requests

from .config import BackendConfig, get_backend_config
from .interpreter_adapter import OpenInterpreterAdapter
from .opendevin_adapter import OpenDevinAdapter
from .schemas import ChatMessage


class IronCladState(TypedDict, total=False):
    messages: List[ChatMessage]
    diagnosis: str
    plan: str
    actions: List[str]
    execution_result: str
    execution_error: str
    devin_result: str
    devin_error: str
    next: str


@dataclass(frozen=True)
class IronCladWorkflowConfig:
    gateway_url: str
    default_model: str


class IronCladGatewayClient:
    def __init__(self, config: BackendConfig, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or config.gateway_base_url or "http://127.0.0.1:8010").rstrip("/")
        self.model = model or config.default_model

    def complete(self, messages: List[ChatMessage]) -> str:
        payload = {
            "model": self.model,
            "messages": [m.model_dump() for m in messages],
            "stream": False,
        }
        response = requests.post(
            f"{self.base_url}/chat/completions",
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        choices = data.get("choices") or []
        message = choices[0].get("message") if choices else {}
        return str((message or {}).get("content", ""))


class IronCladOrchestrator:
    def __init__(
        self,
        llm: Callable[[List[ChatMessage]], str],
        interpreter: Optional[OpenInterpreterAdapter] = None,
        devin: Optional[OpenDevinAdapter] = None,
    ):
        self._llm = llm
        self._graph = build_iron_clad_graph(llm, interpreter, devin)

    def run(self, user_input: str, thread_id: str | None = None) -> IronCladState:
        state: IronCladState = {
            "messages": [ChatMessage(role="user", content=user_input)],
        }
        config = {"configurable": {"thread_id": thread_id or "iron-clad"}}
        return self._graph.invoke(state, config=config)


def build_iron_clad_graph(
    llm: Callable[[List[ChatMessage]], str],
    interpreter: Optional[OpenInterpreterAdapter] = None,
    devin: Optional[OpenDevinAdapter] = None,
):
    try:
        from langgraph.checkpoint.memory import MemorySaver
        from langgraph.graph import END, StateGraph
    except Exception as exc:  # pragma: no cover - optional dependency
        raise RuntimeError(
            "LangGraph dependency missing. Install with `pip install langgraph`."
        ) from exc

    def supervisor_node(state: IronCladState) -> IronCladState:
        if not state.get("diagnosis"):
            return {"next": "diagnose"}
        if not state.get("plan"):
            return {"next": "plan"}
        if not state.get("actions"):
            return {"next": "remediate"}
        if interpreter and interpreter.enabled and not state.get("execution_result"):
            return {"next": "execute"}
        if devin and devin.enabled and not state.get("devin_result"):
            return {"next": "devin"}
        return {"next": "end"}

    def diagnose_node(state: IronCladState) -> IronCladState:
        messages = list(state.get("messages", []))
        messages.append(
            ChatMessage(
                role="system",
                content="You are a diagnostic agent. Summarize the root cause in one short paragraph.",
            )
        )
        response = llm(messages)
        messages.append(ChatMessage(role="assistant", content=response))
        return {"messages": messages, "diagnosis": response}

    def plan_node(state: IronCladState) -> IronCladState:
        messages = list(state.get("messages", []))
        messages.append(
            ChatMessage(
                role="system",
                content="You are a planning agent. Propose a concise plan with 3-5 bullet steps.",
            )
        )
        response = llm(messages)
        messages.append(ChatMessage(role="assistant", content=response))
        return {"messages": messages, "plan": response}

    def remediate_node(state: IronCladState) -> IronCladState:
        messages = list(state.get("messages", []))
        messages.append(
            ChatMessage(
                role="system",
                content="You are a fixing agent. Provide the best next action to resolve the issue.",
            )
        )
        response = llm(messages)
        messages.append(ChatMessage(role="assistant", content=response))
        return {"messages": messages, "actions": [response]}

    def execute_node(state: IronCladState) -> IronCladState:
        if not interpreter:
            return {"execution_error": "OpenInterpreter adapter not configured"}
        action = ""
        actions = state.get("actions") or []
        if actions:
            action = actions[0]
        if not action:
            return {"execution_error": "No action provided for execution"}
        try:
            result = interpreter.run(action, mode="python")
            return {"execution_result": result.output}
        except Exception as exc:
            return {"execution_error": str(exc)}

    def devin_node(state: IronCladState) -> IronCladState:
        if not devin:
            return {"devin_error": "OpenDevin adapter not configured"}
        plan = state.get("plan") or ""
        diagnosis = state.get("diagnosis") or ""
        action = ""
        actions = state.get("actions") or []
        if actions:
            action = actions[0]
        task = "\n".join([item for item in [diagnosis, plan, action] if item])
        if not task:
            return {"devin_error": "No task available for OpenDevin execution"}
        try:
            result = devin.run(task)
            return {"devin_result": result.output}
        except Exception as exc:
            return {"devin_error": str(exc)}

    graph = StateGraph(IronCladState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("diagnose", diagnose_node)
    graph.add_node("plan", plan_node)
    graph.add_node("remediate", remediate_node)
    graph.add_node("execute", execute_node)
    graph.add_node("devin", devin_node)

    graph.set_entry_point("supervisor")
    graph.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next", "end"),
        {
            "diagnose": "diagnose",
            "plan": "plan",
            "remediate": "remediate",
            "execute": "execute",
            "devin": "devin",
            "end": END,
        },
    )
    graph.add_edge("diagnose", "supervisor")
    graph.add_edge("plan", "supervisor")
    graph.add_edge("remediate", "supervisor")
    graph.add_edge("execute", "supervisor")
    graph.add_edge("devin", "supervisor")

    return graph.compile(checkpointer=MemorySaver())


def build_gateway_orchestrator(config: Optional[BackendConfig] = None) -> IronCladOrchestrator:
    backend_config = config or get_backend_config()
    client = IronCladGatewayClient(backend_config)
    interpreter = OpenInterpreterAdapter(backend_config)
    devin = OpenDevinAdapter(backend_config)
    return IronCladOrchestrator(client.complete, interpreter, devin)
