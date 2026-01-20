import os
import subprocess
import tempfile
from typing import Tuple


def run_python_sandbox(code: str) -> Tuple[int, str, str]:
    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = os.path.join(tmpdir, "script.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(code)

        proc = subprocess.Popen(
            ["python", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            out, err = proc.communicate(timeout=30)
            return proc.returncode, out, err
        except subprocess.TimeoutExpired:
            proc.kill()
            return -1, "", "Execution timed out (30s)"
