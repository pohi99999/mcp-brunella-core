import os

def test_package_initialization():
    assert os.path.exists("myai/__init__.py"), "myai/__init__.py is missing"
    assert os.path.exists("myai/core/__init__.py"), "myai/core/__init__.py is missing"

def test_required_modules():
    core_modules = ["agent.py", "llm.py", "project.py", "sandbox.py", "tools.py"]
    for module in core_modules:
        path = os.path.join("myai/core", module)
        assert os.path.exists(path), f"{path} is missing"
