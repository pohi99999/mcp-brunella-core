import importlib.util

def test_dependencies_installed():
    dependencies = ["typer", "requests", "rich", "pytest", "pydantic", "langsmith", "lancedb", "chromadb"]
    for dep in dependencies:
        spec = importlib.util.find_spec(dep)
        assert spec is not None, f"Dependency {dep} is not installed"
