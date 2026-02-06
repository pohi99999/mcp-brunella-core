#!/usr/bin/env python3
"""
Jules Sync Watchdog - Automatikus GitHub szinkronizálás Jules branch-ekhez

Használat:
    python scripts/jules_sync_watchdog.py --once       # Egyszer fut
    python scripts/jules_sync_watchdog.py --daemon     # Óránként fut
    python scripts/jules_sync_watchdog.py --check      # Csak ellenőrzés

Funkciók:
- Figyeli a jules-* és robotkez-* branch-eket
- Automatikusan pullolja az új commit-okat
- Értesítést küld ha új munkát talál
- Opcionális auto-merge (review után)
"""
import subprocess
import time
import sys
import argparse
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
JULES_BRANCH_PATTERNS = ["jules-", "robotkez-"]
CHECK_INTERVAL = 3600  # 1 óra
LOG_FILE = REPO_ROOT / "logs" / "jules_sync.log"

def log(message):
    """Log üzenet timestamppel"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_msg = f"[{timestamp}] {message}"
    # Windows encoding fix
    try:
        print(log_msg)
    except UnicodeEncodeError:
        print(log_msg.encode('ascii', errors='replace').decode('ascii'))

    # File log
    LOG_FILE.parent.mkdir(exist_ok=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_msg + "\n")

def run_git(command):
    """Git parancs futtatás"""
    try:
        result = subprocess.run(
            command,
            cwd=REPO_ROOT,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout.strip(), result.returncode
    except Exception as e:
        log(f"❌ Git hiba: {e}")
        return "", 1

def get_remote_jules_branches():
    """Jules branch-ek lekérdezése GitHub-ról"""
    log("🔍 Jules branch-ek keresése...")
    output, code = run_git("git fetch origin --prune")

    if code != 0:
        log("⚠️ Git fetch sikertelen!")
        return []

    output, _ = run_git("git branch -r")
    branches = []

    for line in output.split("\n"):
        line = line.strip()
        for pattern in JULES_BRANCH_PATTERNS:
            if pattern in line and "origin/" in line:
                branch_name = line.replace("origin/", "")
                branches.append(branch_name)
                break

    log(f"✅ Találtam {len(branches)} Jules branch-et")
    return branches

def get_branch_commits(branch):
    """Branch commit count helyi main-hez képest"""
    output, _ = run_git(f"git rev-list --count main..origin/{branch}")
    try:
        return int(output)
    except:
        return 0

def pull_jules_branch(branch, auto_merge=False):
    """Jules branch pullolása"""
    log(f"📥 Pullolás: {branch}")

    # Fetch
    output, code = run_git(f"git fetch origin {branch}")
    if code != 0:
        log(f"❌ Fetch sikertelen: {branch}")
        return False

    # Check commit count
    new_commits = get_branch_commits(branch)
    if new_commits == 0:
        log(f"ℹ️ Nincs új commit: {branch}")
        return True

    log(f"🆕 {new_commits} új commit: {branch}")

    # Auto-merge (ha engedélyezve)
    if auto_merge:
        log(f"🔄 Auto-merge: {branch} → main")
        output, code = run_git(f"git merge origin/{branch} --no-edit")

        if code != 0:
            log(f"⚠️ CONFLICT! Manuális review szükséges: {branch}")
            log(f"Merge parancs: git merge origin/{branch}")
            return False
        else:
            log(f"✅ Sikeresen merge-elve: {branch}")
            return True
    else:
        log(f"ℹ️ Review mód - manuális merge szükséges:")
        log(f"   git merge origin/{branch}")
        return True

def check_current_branch():
    """Jelenlegi branch ellenőrzés"""
    output, _ = run_git("git rev-parse --abbrev-ref HEAD")
    return output

def sync_all(auto_merge=False):
    """Összes Jules branch szinkronizálása"""
    log("=" * 60)
    log("🚀 Jules Sync Watchdog indítás...")

    # Ellenőrzés: main branch-en vagyunk?
    current = check_current_branch()
    if current != "main":
        log(f"⚠️ Nem main branch-en vagy ({current})! Váltás main-re...")
        run_git("git checkout main")

    # Jules branch-ek lekérése
    jules_branches = get_remote_jules_branches()

    if not jules_branches:
        log("ℹ️ Nincs aktív Jules branch")
        return

    # Pullolás
    for branch in jules_branches:
        pull_jules_branch(branch, auto_merge)

    log("✅ Szinkronizálás kész!")
    log("=" * 60)

def daemon_mode():
    """Daemon mód - óránként fut"""
    log("🔁 Daemon mód: óránként ellenőrzés...")

    while True:
        try:
            sync_all(auto_merge=False)  # Manual review by default
            log(f"💤 Alvás {CHECK_INTERVAL}s...")
            time.sleep(CHECK_INTERVAL)
        except KeyboardInterrupt:
            log("👋 Daemon leállítva")
            break
        except Exception as e:
            log(f"❌ Hiba daemon módban: {e}")
            time.sleep(60)  # Retry 1 perc múlva

def main():
    parser = argparse.ArgumentParser(description="Jules Sync Watchdog")
    parser.add_argument("--once", action="store_true", help="Egyszer fut")
    parser.add_argument("--daemon", action="store_true", help="Daemon mód (óránként)")
    parser.add_argument("--check", action="store_true", help="Csak ellenőrzés")
    parser.add_argument("--auto-merge", action="store_true", help="Auto-merge (veszélyes!)")

    args = parser.parse_args()

    if args.daemon:
        daemon_mode()
    elif args.check:
        branches = get_remote_jules_branches()
        for b in branches:
            commits = get_branch_commits(b)
            print(f"  {b}: {commits} új commit")
    else:
        sync_all(auto_merge=args.auto_merge)

if __name__ == "__main__":
    main()
