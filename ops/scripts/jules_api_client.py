#!/usr/bin/env python3
"""
Jules REST API Client - Programmatic access Jules-hoz

Használat:
    export JULES_API_KEY="your-api-key"
    python scripts/jules_api_client.py sources
    python scripts/jules_api_client.py create "Fix bug in auth"
    python scripts/jules_api_client.py list
    python scripts/jules_api_client.py get <session_id>
    python scripts/jules_api_client.py watch <session_id>

API Docs: https://jules.google.com/docs/api
"""
import os
import sys
import json
import time
import httpx
from datetime import datetime
from pathlib import Path

API_BASE = "https://jules.googleapis.com/v1alpha"
REPO_ROOT = Path(__file__).parent.parent
JULES_CONFIG_FILE = REPO_ROOT / ".jules" / "config.json"

def get_api_key():
    """API kulcs lekérése .env-ből vagy config-ból"""
    # Try environment variable first
    api_key = os.getenv("JULES_API_KEY")
    if api_key:
        return api_key

    # Try config file
    if JULES_CONFIG_FILE.exists():
        with open(JULES_CONFIG_FILE, "r") as f:
            config = json.load(f)
            return config.get("api_key")

    print("❌ JULES_API_KEY nem található!")
    print("\n📌 Setup:")
    print("1. Generálj API key-t: https://jules.google.com/settings")
    print("2. Export: export JULES_API_KEY='your-key'")
    print("3. Vagy add hozzá .env-hez: JULES_API_KEY=your-key")
    sys.exit(1)

def api_request(method, endpoint, data=None, params=None):
    """Jules API request"""
    api_key = get_api_key()
    url = f"{API_BASE}{endpoint}"

    headers = {
        "X-Goog-Api-Key": api_key,
        "Content-Type": "application/json"
    }

    try:
        if method == "GET":
            response = httpx.get(url, headers=headers, params=params, timeout=60.0)
        elif method == "POST":
            response = httpx.post(url, headers=headers, json=data, timeout=60.0)
        else:
            raise ValueError(f"Unsupported method: {method}")

        response.raise_for_status()
        return response.json()

    except httpx.HTTPStatusError as e:
        print(f"❌ API Error {e.response.status_code}: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Request failed: {e}")
        sys.exit(1)

def list_sources():
    """GitHub repo-k listázása"""
    print("📦 Jules Sources (GitHub repos):\n")
    data = api_request("GET", "/sources")

    if not data.get("sources"):
        print("Nincs csatlakoztatott repo. Add hozzá: https://jules.google.com")
        return

    for source in data["sources"]:
        name = source.get("name", "")
        source_id = source.get("id", "")
        github = source.get("githubRepo", {})
        owner = github.get("owner", "")
        repo = github.get("repo", "")

        print(f"  {name}")
        print(f"    ID: {source_id}")
        print(f"    Repo: {owner}/{repo}\n")

def create_session(prompt, source=None, auto_pr=True, repo_inference=True):
    """Új Jules session létrehozás"""
    print(f"🚀 Jules session indítás...\n")

    # Ha nincs megadva source, használd a jelenlegi repo-t
    if not source:
        if repo_inference:
            # Try auto-detect from git remote
            import subprocess
            result = subprocess.run(
                ["git", "remote", "get-url", "origin"],
                capture_output=True,
                text=True,
                cwd=REPO_ROOT
            )
            if result.returncode == 0:
                remote_url = result.stdout.strip()
                # Parse github.com/owner/repo
                if "github.com" in remote_url:
                    parts = remote_url.replace(".git", "").split("/")
                    owner = parts[-2].split(":")[-1]  # Handle SSH format
                    repo = parts[-1]
                    source = f"sources/github/{owner}/{repo}"
                    print(f"📍 Auto-detected repo: {owner}/{repo}")

    if not source:
        print("❌ Repo nem található! Add meg manuálisan:")
        print("   python scripts/jules_api_client.py create \"task\" --source sources/github/owner/repo")
        sys.exit(1)

    payload = {
        "prompt": prompt,
        "sourceContext": {
            "source": source,
            "githubRepoContext": {
                "startingBranch": "main"
            }
        },
        "automationMode": "AUTO_CREATE_PR" if auto_pr else "MANUAL",
        "title": prompt[:100]  # First 100 chars as title
    }

    data = api_request("POST", "/sessions", data=payload)

    session_id = data.get("id")
    session_name = data.get("name")

    print(f"✅ Session létrehozva!")
    print(f"   ID: {session_id}")
    print(f"   Name: {session_name}")
    print(f"   Prompt: {prompt}\n")

    print(f"📌 Watch parancs:")
    print(f"   python scripts/jules_api_client.py watch {session_id}\n")

    return session_id

def list_sessions(page_size=10):
    """Sessions listázása"""
    print(f"📋 Jules Sessions (legutóbbi {page_size}):\n")

    params = {"pageSize": page_size}
    data = api_request("GET", "/sessions", params=params)

    sessions = data.get("sessions", [])

    if not sessions:
        print("Nincs session még.")
        return

    for session in sessions:
        session_id = session.get("id", "")
        title = session.get("title", "")
        prompt = session.get("prompt", "")
        outputs = session.get("outputs", [])

        print(f"  {session_id}")
        print(f"    Title: {title}")
        print(f"    Prompt: {prompt[:60]}...")

        # Check for PR
        for output in outputs:
            if "pullRequest" in output:
                pr = output["pullRequest"]
                print(f"    PR: {pr['url']}")

        print()

def get_session(session_id):
    """Session részletek lekérése"""
    print(f"🔍 Session részletek: {session_id}\n")

    data = api_request("GET", f"/sessions/{session_id}")

    print(f"ID: {data.get('id')}")
    print(f"Title: {data.get('title')}")
    print(f"Prompt: {data.get('prompt')}")

    # Outputs
    outputs = data.get("outputs", [])
    if outputs:
        print("\nOutputs:")
        for output in outputs:
            if "pullRequest" in output:
                pr = output["pullRequest"]
                print(f"  PR: {pr['url']}")
                print(f"      Title: {pr.get('title', '')}")
                print(f"      Description: {pr.get('description', '')[:100]}...")

    return data

def watch_session(session_id, poll_interval=30):
    """Vár amíg session kész (polling)"""
    print(f"⏳ Watching session: {session_id}")
    print(f"   Poll interval: {poll_interval}s\n")

    while True:
        data = api_request("GET", f"/sessions/{session_id}")

        # Check for outputs (PR created = done)
        outputs = data.get("outputs", [])

        if outputs:
            print("\n✅ Session befejezve!")

            for output in outputs:
                if "pullRequest" in output:
                    pr = output["pullRequest"]
                    print(f"\n🎉 PR létrehozva:")
                    print(f"   {pr['url']}")
                    print(f"\n📌 Merge parancs:")

                    # Extract branch from PR URL
                    # Format: https://github.com/owner/repo/pull/123
                    # Branch általában: jules-xxx vagy robotkez-xxx
                    print(f"   # Review a PR-t a böngészőben:")
                    print(f"   open {pr['url']}")
                    print(f"\n   # Ha OK, merge GitHub UI-ban vagy:")
                    print(f"   gh pr merge {pr['url']} --squash")

            break

        print(f"⏳ Session még fut... újra ellenőrzés {poll_interval}s múlva")
        time.sleep(poll_interval)

def main():
    if len(sys.argv) < 2:
        print("Használat:")
        print("  python scripts/jules_api_client.py sources")
        print("  python scripts/jules_api_client.py create \"task prompt\"")
        print("  python scripts/jules_api_client.py list")
        print("  python scripts/jules_api_client.py get <session_id>")
        print("  python scripts/jules_api_client.py watch <session_id>")
        sys.exit(1)

    command = sys.argv[1]

    if command == "sources":
        list_sources()

    elif command == "create":
        if len(sys.argv) < 3:
            print("❌ Hiányzó prompt!")
            sys.exit(1)
        prompt = sys.argv[2]
        source = sys.argv[3] if len(sys.argv) > 3 else None
        create_session(prompt, source)

    elif command == "list":
        page_size = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        list_sessions(page_size)

    elif command == "get":
        if len(sys.argv) < 3:
            print("❌ Hiányzó session_id!")
            sys.exit(1)
        session_id = sys.argv[2]
        get_session(session_id)

    elif command == "watch":
        if len(sys.argv) < 3:
            print("❌ Hiányzó session_id!")
            sys.exit(1)
        session_id = sys.argv[2]
        poll_interval = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        watch_session(session_id, poll_interval)

    else:
        print(f"❌ Ismeretlen parancs: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()
