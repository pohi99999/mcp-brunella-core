import subprocess
import textwrap
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel

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
        return {
            "ok": is_ok,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }
    except Exception as e:
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
