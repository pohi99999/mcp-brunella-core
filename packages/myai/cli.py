import typer
from rich.console import Console
from rich.panel import Panel

from myai.config import DEFAULT_MODEL
from myai.core.llm import simple_completion
from myai.core.tools import (
    read_file,
    write_file,
    generate_code,
)
from myai.core.project import analyze_project, refactor_project_highlevel
from myai.core.sandbox import run_python_sandbox
from myai.core.agent import multi_agent_dev_flow

app = typer.Typer()
console = Console()


@app.command()
def chat(
    prompt: str = typer.Argument(..., help="Prompt az LLM-nek."),
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m"),
):
    """Egyszerű chat az LLM-mel."""
    resp = simple_completion(prompt, model=model)
    console.print(Panel(resp, title=f"Model: {model}"))


@app.command()
def codegen(
    instruction: str = typer.Argument(..., help="Mit generáljon a kód-agent?"),
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m"),
    out: str = typer.Option(None, "--out", "-o", help="Ha megadod, fájlba írja a kódot."),
):
    """Kódgenerálás – saját coder agent."""
    code = generate_code(instruction=instruction, context_files=None, model=model)
    if out:
        write_file(out, code)
        console.print(Panel(f"Kód kiírva ide: {out}", title="Mentve"))
    else:
        console.print(Panel(code, title="Generated code"))


@app.command()
def read(
    path: str = typer.Argument(..., help="Fájl elérési útja."),
):
    """Fájl tartalmának kiolvasása."""
    content = read_file(path)
    console.print(Panel(content, title=f"File: {path}"))


@app.command()
def project_analyze(
    root: str = typer.Option(".", "--root", "-r", help="Projekt gyökérkönyvtár."),
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m"),
):
    """Projekt-szintű elemzés."""
    summary = analyze_project(root=root, model=model)
    console.print(Panel(summary, title=f"Project analysis ({root})"))


@app.command()
def project_refactor(
    instruction: str = typer.Argument(..., help="Mit refaktoráljon / változtasson a projekten?"),
    root: str = typer.Option(".", "--root", "-r"),
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m"),
):
    """Projekt-szintű refaktor terv (nem ír fájlt, csak tervet ad)."""
    plan = refactor_project_highlevel(instruction=instruction, root=root, model=model)
    console.print(Panel(plan, title="Refactor plan"))


@app.command()
def sandbox(
    code: str = typer.Argument(..., help="Python kód, amit sandboxban futtatunk."),
):
    """Python sandbox futtatás (izolált temp dir)."""
    rc, out, err = run_python_sandbox(code)
    console.print(Panel(f"RC: {rc}\n\nSTDOUT:\n{out}\n\nSTDERR:\n{err}", title="Sandbox result"))


@app.command()
def dev_agent(
    task: str = typer.Argument(..., help="Fejlesztési feladat leírása."),
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m"),
):
    """Multi-agent dev flow: planner → coder → executor → reviewer."""
    result = multi_agent_dev_flow(task=task, model=model)

    console.print(Panel(result["plan"], title="Plan"))
    console.print(Panel(result["code"], title="Code"))
    console.print(Panel(result["exec_result"], title="Execution"))
    console.print(Panel(result["review"], title="Review"))


if __name__ == "__main__":
    app()
