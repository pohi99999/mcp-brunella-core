import subprocess
import textwrap
import logging
import platform
import time
from typing import Optional
from pathlib import Path
from pydantic import BaseModel
from fastmcp import FastMCP

WAB_VERSION = "0.2.0"
WAB_START_TIME = time.time()

BASE_DIR = Path(__file__).parent.absolute()
log_dir = BASE_DIR / "logs"
log_dir.mkdir(exist_ok=True)

wab_logger = logging.getLogger("wab_audit")
wab_logger.setLevel(logging.INFO)
if wab_logger.hasHandlers():
    wab_logger.handlers.clear()

file_handler = logging.FileHandler(log_dir / "wab_audit.log")
formatter = logging.Formatter('%(asctime)s - WAB - %(message)s')
file_handler.setFormatter(formatter)
wab_logger.addHandler(file_handler)

mcp = FastMCP("Windows Automation Bridge", version="0.1.0")

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

@mcp.tool()
def ps_execute(command: str) -> dict:
    """
    Tetszoleges PowerShell parancs futtatasa.
    FIGYELEM: Ezt csak megbizhato LLM-eknek add oda.
    """
    return run_powershell(command)

@mcp.tool()
def fs_op(action: str, src: str = None, dst: str = None, path: str = None) -> dict:
    """
    Alap fajlmuveletek – LLM-barat, strukturalt API.
    A valid actions: list, move, copy, delete, mkdir
    """
    if action == "list":
        path = path or "."
        cmd = textwrap.dedent(f"""
        Get-ChildItem -LiteralPath "{path}" | Select-Object Name, FullName, Length, LastWriteTime | ConvertTo-Json
        """)
        return run_powershell(cmd)

    if action == "mkdir":
        if not path:
            return {"ok": False, "error": "path required"}
        cmd = f'New-Item -ItemType Directory -Path "{path}" -Force | ConvertTo-Json'
        return run_powershell(cmd)

    if action in ("move", "copy", "delete"):
        if action in ("move", "copy") and (not src or not dst):
            return {"ok": False, "error": "src and dst required"}
        if action == "delete" and not path:
            return {"ok": False, "error": "path required"}

        if action == "move":
            cmd = f'Move-Item -LiteralPath "{src}" -Destination "{dst}" -Force'
        elif action == "copy":
            cmd = f'Copy-Item -LiteralPath "{src}" -Destination "{dst}" -Force'
        else:  # delete
            cmd = f'Remove-Item -LiteralPath "{path}" -Recurse -Force'

        return run_powershell(cmd)

    return {"ok": False, "error": f"unknown action: {action}"}

@mcp.tool()
def wab_health() -> dict:
    """
    Windows Automation Bridge allapot ellenorzese.
    Visszaadja a verziot, uptime-ot es a PowerShell elerhetoseget.
    """
    uptime_seconds = round(time.time() - WAB_START_TIME)
    ps_ok = run_powershell("echo health_ok")
    return {
        "status": "ok",
        "service": "windows-automation-bridge",
        "version": WAB_VERSION,
        "uptime_seconds": uptime_seconds,
        "platform": platform.system(),
        "powershell_available": ps_ok.get("ok", False),
    }

if __name__ == "__main__":
    mcp.run()
