from typing import Dict
from .llm import simple_completion
from .tools import generate_code, summarize_project, refactor_project
from .sandbox import run_python_sandbox

try:
    from langsmith import traceable
except Exception:  # pragma: no cover - optional dependency
    def traceable(*args, **kwargs):  # type: ignore[override]
        def _decorator(fn):
            return fn
        return _decorator


@traceable(run_type="llm", name="planner_agent")
def planner_agent(task: str, model: str = None) -> str:
    prompt = (
        "You are a planning agent.\n"
        "Break down the user's task into clear steps.\n"
        "Return a concise numbered plan.\n\n"
        f"Task:\n{task}"
    )
    return simple_completion(prompt, model=model) if model else simple_completion(prompt)


@traceable(run_type="llm", name="coder_agent")
def coder_agent(task: str, model: str = None) -> str:
    return generate_code(instruction=task, context_files=None, model=model)

@traceable(run_type="tool", name="executor_agent")
def executor_agent(code: str) -> str:
    rc, out, err = run_python_sandbox(code)
    return f"Return code: {rc}\nSTDOUT:\n{out}\nSTDERR:\n{err}"

@traceable(run_type="llm", name="reviewer_agent")
def reviewer_agent(task: str, plan: str, code: str, exec_result: str, model: str = None) -> str:
    prompt = (
        "You are a reviewer agent.\n"
        "You get the original task, a plan, generated code, and execution result.\n"
        "Evaluate quality, correctness, and suggest improvements.\n\n"
        f"Task:\n{task}\n\n"
        f"Plan:\n{plan}\n\n"
        f"Code:\n{code}\n\n"
        f"Execution result:\n{exec_result}\n"
    )
    return simple_completion(prompt, model=model) if model else simple_completion(prompt)

@traceable(run_type="chain", name="multi_agent_dev_flow")
def multi_agent_dev_flow(task: str, model: str = None) -> Dict[str, str]:
    plan = planner_agent(task, model=model)
    code = coder_agent(task + "\n\nFollow this plan:\n" + plan, model=model)
    exec_result = executor_agent(code)
    review = reviewer_agent(task, plan, code, exec_result, model=model)

    return {
        "plan": plan,
        "code": code,
        "exec_result": exec_result,
        "review": review,
    }
