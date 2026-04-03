"""
wab_health.py — Windows Automation Bridge HTTP Health Server
Port: 3002 (alapertelmezett)

Ezt a run_bridge.bat (vagy start-full.bat) indítja a wab_server.py mellé.
Lehetővé teszi, hogy a smoke test és a Dashboard HTTP-n keresztül ellenőrizze
a WAB elérhetőségét anélkül, hogy MCP stdio protokollon kellene kommunikálni.

Futtatás: python windows_bridge/wab_health.py [--port 3002]
"""

import argparse
import json
import platform
import subprocess
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

WAB_VERSION = "0.2.0"
START_TIME = time.time()


def check_powershell() -> bool:
    """Ellenőrzi, hogy a PowerShell (pwsh) elérhető-e."""
    try:
        result = subprocess.run(
            ["pwsh", "-NoLogo", "-NoProfile", "-Command", "echo health_ok"],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0 and "health_ok" in result.stdout
    except Exception:
        return False


class HealthHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Ne logolja a HTTP requesteket stdout-ra (MCP stderr-rel zavarhat)

    def do_GET(self):
        if self.path in ("/health", "/"):
            uptime = round(time.time() - START_TIME)
            ps_ok = check_powershell()
            payload = {
                "status": "ok",
                "service": "windows-automation-bridge",
                "version": WAB_VERSION,
                "uptime_seconds": uptime,
                "platform": platform.system(),
                "powershell_available": ps_ok,
            }
            body = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(body))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def main():
    parser = argparse.ArgumentParser(description="WAB HTTP Health Server")
    parser.add_argument("--port", type=int, default=3002, help="HTTP port (default: 3002)")
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.port), HealthHandler)
    print(f"[WAB-HEALTH] Listening on http://127.0.0.1:{args.port}/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
