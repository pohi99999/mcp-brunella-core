#!/usr/bin/env python3
"""
Jules CLI Wrapper - Brunella <-> Jules integráció

Használat:
    python scripts/jules_cli_wrapper.py new "Fix robotkéz testing"
    python scripts/jules_cli_wrapper.py list
    python scripts/jules_cli_wrapper.py pull <session_id>
    python scripts/jules_cli_wrapper.py watch <session_id>  # Vár a befejezésre + auto-pull

Funkciók:
- Jules CLI parancsok wrapper-je
- Session ID tárolás/visszakeresés
- Automatikus pull ha session kész
- Notification Brunella dashboard-ra
"""
import subprocess
import sys
import json
import time
from pathlib import Path
from datetime import datetime

REPO_ROOT = Path(__file__).parent.parent
JULES_SESSIONS_FILE = REPO_ROOT / ".jules" / "sessions.json"
JULES_CLI = "jules"  # Feltételezve hogy globálisan telepítve van

def log(message, level="INFO"):
    """Logolás timestamppel"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")

def run_jules_cli(command):
    """Jules CLI parancs futtatás"""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=300,
            cwd=REPO_ROOT
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        log("Jules CLI timeout (5 perc)", "ERROR")
        return "", "Timeout", 1
    except Exception as e:
        log(f"Jules CLI hiba: {e}", "ERROR")
        return "", str(e), 1

def save_session(session_id, prompt, branch=None):
    """Session ID mentése fájlba"""
    JULES_SESSIONS_FILE.parent.mkdir(exist_ok=True)

    sessions = []
    if JULES_SESSIONS_FILE.exists():
        with open(JULES_SESSIONS_FILE, "r", encoding="utf-8") as f:
            sessions = json.load(f)

    sessions.append({
        "session_id": session_id,
        "prompt": prompt,
        "branch": branch,
        "created_at": datetime.now().isoformat(),
        "status": "running"
    })

    with open(JULES_SESSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2, ensure_ascii=False)

    log(f"Session mentve: {session_id}")

def load_sessions():
    """Session-ök betöltése"""
    if not JULES_SESSIONS_FILE.exists():
        return []

    with open(JULES_SESSIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def update_session_status(session_id, status, branch=None):
    """Session státusz frissítés"""
    sessions = load_sessions()

    for session in sessions:
        if session["session_id"] == session_id:
            session["status"] = status
            if branch:
                session["branch"] = branch
            session["updated_at"] = datetime.now().isoformat()
            break

    with open(JULES_SESSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2, ensure_ascii=False)

def jules_new(prompt, repo="."):
    """Új Jules session létrehozás"""
    log(f"Jules session indítás: {prompt[:50]}...")

    # Jules CLI new command
    cmd = f'{JULES_CLI} remote new --repo {repo} --session "{prompt}"'
    stdout, stderr, code = run_jules_cli(cmd)

    if code != 0:
        log(f"Jules new sikertelen: {stderr}", "ERROR")
        return None

    # Parse session ID from output
    # Format: "Session created: sessions/1234567890"
    session_id = None
    for line in stdout.split("\n"):
        if "Session" in line or "session" in line:
            # Try to extract ID
            parts = line.split("/")
            if len(parts) > 1:
                session_id = parts[-1].strip()
                break

    if not session_id:
        log("Session ID nem található a kimenetben!", "WARN")
        log(f"stdout: {stdout}")
        # Fallback: használjuk a teljes outputot mint ID
        session_id = f"unknown-{int(time.time())}"

    # Session mentése
    save_session(session_id, prompt)

    log(f"✅ Session létrehozva: {session_id}", "SUCCESS")
    return session_id

def jules_list():
    """Jules session-ök listázása"""
    log("Jules session-ök lekérdezése...")

    cmd = f"{JULES_CLI} remote list --session"
    stdout, stderr, code = run_jules_cli(cmd)

    if code != 0:
        log(f"Jules list sikertelen: {stderr}", "ERROR")
        return

    print(stdout)

    # Helyi sessions is
    local_sessions = load_sessions()
    if local_sessions:
        print("\n=== Helyi Sessions ===")
        for s in local_sessions:
            status_icon = "✅" if s["status"] == "completed" else "⏳"
            print(f"{status_icon} {s['session_id']}: {s['prompt'][:60]}")

def jules_pull(session_id):
    """Jules session eredmények pullolása"""
    log(f"Jules pull: {session_id}")

    cmd = f"{JULES_CLI} remote pull --session {session_id}"
    stdout, stderr, code = run_jules_cli(cmd)

    if code != 0:
        log(f"Jules pull sikertelen: {stderr}", "ERROR")
        return False

    print(stdout)

    # Parse branch név ha van
    branch = None
    for line in stdout.split("\n"):
        if "branch" in line.lower():
            # Try extract branch name
            parts = line.split()
            for part in parts:
                if "jules-" in part or "robotkez-" in part:
                    branch = part
                    break

    # Update session status
    update_session_status(session_id, "completed", branch)

    log(f"✅ Pull kész: {session_id}", "SUCCESS")
    if branch:
        log(f"   Branch: {branch}")

    return True

def jules_watch(session_id, poll_interval=60):
    """Vár amíg session kész, majd auto-pull"""
    log(f"Jules watch: {session_id} (poll interval: {poll_interval}s)")

    while True:
        # Check status via CLI (list command)
        cmd = f"{JULES_CLI} remote list --session"
        stdout, stderr, code = run_jules_cli(cmd)

        if code != 0:
            log(f"Státusz check sikertelen: {stderr}", "WARN")
            time.sleep(poll_interval)
            continue

        # Check if session is complete
        # (Jules CLI output parsing - ezt customize-olni kell a tényleges output alapján)
        if session_id in stdout and "completed" in stdout.lower():
            log(f"✅ Session kész: {session_id}", "SUCCESS")

            # Auto-pull
            if jules_pull(session_id):
                log("✅ Auto-pull sikeres!")

                # Merge javaslat
                sessions = load_sessions()
                for s in sessions:
                    if s["session_id"] == session_id and s.get("branch"):
                        log(f"\n📌 Merge parancs:")
                        log(f"   git fetch origin && git merge origin/{s['branch']}")
                        break
            break

        log(f"⏳ Session még fut... újra ellenőrzés {poll_interval}s múlva")
        time.sleep(poll_interval)

def main():
    if len(sys.argv) < 2:
        print("Használat:")
        print("  python scripts/jules_cli_wrapper.py new \"task prompt\"")
        print("  python scripts/jules_cli_wrapper.py list")
        print("  python scripts/jules_cli_wrapper.py pull <session_id>")
        print("  python scripts/jules_cli_wrapper.py watch <session_id>")
        sys.exit(1)

    command = sys.argv[1]

    if command == "new":
        if len(sys.argv) < 3:
            log("Hiányzó prompt!", "ERROR")
            sys.exit(1)
        prompt = sys.argv[2]
        session_id = jules_new(prompt)
        if session_id:
            print(f"\n✅ Session ID: {session_id}")
            print(f"\n📌 Watch parancs:")
            print(f"   python scripts/jules_cli_wrapper.py watch {session_id}")

    elif command == "list":
        jules_list()

    elif command == "pull":
        if len(sys.argv) < 3:
            log("Hiányzó session_id!", "ERROR")
            sys.exit(1)
        session_id = sys.argv[2]
        jules_pull(session_id)

    elif command == "watch":
        if len(sys.argv) < 3:
            log("Hiányzó session_id!", "ERROR")
            sys.exit(1)
        session_id = sys.argv[2]
        poll_interval = int(sys.argv[3]) if len(sys.argv) > 3 else 60
        jules_watch(session_id, poll_interval)

    else:
        log(f"Ismeretlen parancs: {command}", "ERROR")
        sys.exit(1)

if __name__ == "__main__":
    # Windows console encoding fix
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding='utf-8')
    main()
