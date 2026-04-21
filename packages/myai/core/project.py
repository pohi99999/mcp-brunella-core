from .tools import summarize_project, refactor_project


def analyze_project(root: str = ".", model: str = None) -> str:
    return summarize_project(root=root, model=model)


def refactor_project_highlevel(instruction: str, root: str = ".", model: str = None) -> str:
    return refactor_project(instruction=instruction, root=root, model=model)
