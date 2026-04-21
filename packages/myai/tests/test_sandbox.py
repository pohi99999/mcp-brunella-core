import pytest
from myai.core.sandbox import run_python_sandbox

def test_run_python_sandbox_success():
    code = "print('Hello from sandbox')"
    rc, out, err = run_python_sandbox(code)
    assert rc == 0
    assert out.strip() == "Hello from sandbox"
    assert err == ""

def test_run_python_sandbox_error():
    code = "raise ValueError('Something went wrong')"
    rc, out, err = run_python_sandbox(code)
    assert rc != 0
    assert "ValueError: Something went wrong" in err

def test_run_python_sandbox_timeout():
    code = "import time; time.sleep(5)"
    rc, out, err = run_python_sandbox(code, timeout=1)
    assert rc == -1
    assert "Execution timed out" in err
