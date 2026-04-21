import importlib
import importlib.util


def test_dependencies_installed():
    dependencies = ["typer", "requests", "rich", "pytest", "pydantic", "langsmith", "lancedb", "chromadb"]
    for dep in dependencies:
        spec = importlib.util.find_spec(dep)
        assert spec is not None, f"Dependency {dep} is not installed"

    autogen_modules = [
        "autogen_agentchat.agents",
        "autogen_ext.models.openai",
        "autogen_ext.models.azure",
    ]
    for module in autogen_modules:
        imported = importlib.import_module(module)
        assert imported is not None, f"Dependency {module} is not installed"
