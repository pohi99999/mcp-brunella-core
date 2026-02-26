import subprocess
import textwrap
import logging
from typing import Optional
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent.absolute()
log_dir = BASE_DIR / "logs"
log_dir.mkdir(exist_ok=True)

# Create explicit logger
wab_logger = logging.getLogger("wab_audit")
wab_logger.setLevel(logging.INFO)
# Clear any existing handlers to prevent duplicates
if wab_logger.hasHandlers():
    wab_logger.handlers.clear()

file_handler = logging.FileHandler(log_dir / "wab_audit.log")
formatter = logging.Formatter('%(asctime)s - WAB - %(message)s')
file_handler.setFormatter(formatter)
wab_logger.addHandler(file_handler)

app = FastAPI(title="Windows Automation Bridge", version="0.1.0")

class PSRequest(BaseModel):
    command: str

class FileOp(BaseModel):
    action: str  # "list", "move", "copy", "delete", "mkdir"
    src: Optional[str] = None
    dst: Optional[str] = None
    path: Optional[str] = None

def run_powershell(cmd: str) -> dict:
    ps_cmd = ["pwsh", "-NoLogo", "-NoProfile", "-Command", cmd]
    try:
        result = subprocess.run(
            ps_cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        is_ok = result.returncode == 0
        wab_logger.info(f"CMD: {cmd} | OK: {is_ok} | STDOUT: {result.stdout.strip()} | STDERR: {result.stderr.strip()}")
        # Call flush to ensure the log is written immediately for testing
        for handler in wab_logger.handlers:
            handler.flush()
            
        return {
            "ok": is_ok,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }
    except Exception as e:
        wab_logger.error(f"CMD: {cmd} | ERROR: {str(e)}")
        for handler in wab_logger.handlers:
            handler.flush()
        return {
            "ok": False,
            "stdout": "",
            "stderr": str(e),
            "returncode": -1,
        }

@app.post("/ps/execute")
def ps_execute(req: PSRequest):
    return run_powershell(req.command)

@app.post("/fs")
def fs_op(op: FileOp):
    if op.action == "list":
        path = op.path or "."
        cmd = textwrap.dedent(f"""
        Get-ChildItem -LiteralPath "{path}" | Select-Object Name, FullName, Length, LastWriteTime | ConvertTo-Json
        """)
        return run_powershell(cmd)

    if op.action == "mkdir":
        if not op.path:
            return {"ok": False, "error": "path required"}
        cmd = f'New-Item -ItemType Directory -Path "{op.path}" -Force | ConvertTo-Json'
        return run_powershell(cmd)

    if op.action in ("move", "copy", "delete"):
        if op.action in ("move", "copy") and (not op.src or not op.dst):
            return {"ok": False, "error": "src and dst required"}
        if op.action == "delete" and not op.path:
            return {"ok": False, "error": "path required"}

        if op.action == "move":
            cmd = f'Move-Item -LiteralPath "{op.src}" -Destination "{op.dst}" -Force'
        elif op.action == "copy":
            cmd = f'Copy-Item -LiteralPath "{op.src}" -Destination "{op.dst}" -Force'
        else:  # delete
            cmd = f'Remove-Item -LiteralPath "{op.path}" -Recurse -Force'

        return run_powershell(cmd)

    return {"ok": False, "error": f"unknown action: {op.action}"}
