"""
Jules Auto-Sync & Auto-Merge Script

Automatikusan:
1. Lehúzza Jules branch-eket/PR-eket
2. LLM elemzi: hasznos-e a jelenlegi fejlesztéshez?
3. Ha hasznos (score > 70) -> automatikus merge
4. Conductor track update

Használat:
    python myai/tools/jules_auto_sync.py
"""

import subprocess
import json
import os
import re
from datetime import datetime
from typing import List, Dict, Optional

# LLM import (Gemini fallback)
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

try:
    from langchain_ollama import ChatOllama
    HAS_OLLAMA = True
except ImportError:
    from langchain_community.chat_models import ChatOllama
    HAS_OLLAMA = True


def log(level: str, message: str):
    """Simple logger"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def run_command(cmd: str) -> tuple[bool, str]:
    """Run shell command and return (success, output)"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)


def get_jules_branches() -> List[str]:
    """Get all remote Jules branches"""
    log("INFO", "Fetching Jules branches from GitHub...")

    # Fetch latest from remote
    success, _ = run_command("git fetch origin --prune")
    if not success:
        log("WARN", "Git fetch failed, continuing with local branches")

    # List all remote branches with 'jules/' prefix
    success, output = run_command("git branch -r | grep 'origin/jules/'")
    if not success:
        log("INFO", "No Jules branches found")
        return []

    branches = []
    for line in output.strip().split('\n'):
        line = line.strip()
        if line and 'origin/jules/' in line:
            branch = line.replace('origin/', '').strip()
            branches.append(branch)

    log("INFO", f"Found {len(branches)} Jules branches")
    return branches


def get_branch_info(branch: str) -> Optional[Dict]:
    """Get branch commit info and diff stats"""
    log("INFO", f"Analyzing branch: {branch}")

    # Get commit message
    success, commit_msg = run_command(f"git log origin/{branch} -1 --pretty=format:%s")
    if not success:
        return None

    # Get commit date
    success, commit_date = run_command(f"git log origin/{branch} -1 --pretty=format:%ai")
    if not success:
        commit_date = "unknown"

    # Get diff stats (files changed)
    success, diff_stats = run_command(f"git diff main...origin/{branch} --stat")
    if not success:
        diff_stats = "No diff available"

    # Get full diff (limited to 5000 chars for LLM)
    success, diff_full = run_command(f"git diff main...origin/{branch}")
    if success:
        diff_full = diff_full[:5000]  # Limit size
    else:
        diff_full = ""

    return {
        "branch": branch,
        "commit_message": commit_msg.strip(),
        "commit_date": commit_date.strip(),
        "diff_stats": diff_stats.strip(),
        "diff_full": diff_full
    }


def analyze_usefulness(branch_info: Dict, current_tracks: str) -> Dict:
    """
    LLM-based usefulness analysis

    Returns:
        {
            "score": 0-100,
            "reasoning": "...",
            "recommendation": "merge" | "skip" | "review"
        }
    """
    log("INFO", f"LLM analyzing: {branch_info['branch']}")

    # Initialize LLM (Gemini preferred, Ollama fallback)
    llm = None
    if HAS_GEMINI and os.getenv('GEMINI_API_KEY'):
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            google_api_key=os.getenv('GEMINI_API_KEY'),
            temperature=0.1
        )
    elif HAS_OLLAMA:
        llm = ChatOllama(model="qwen2.5-coder:7b", temperature=0.1)
    else:
        log("ERROR", "No LLM available (Gemini or Ollama)")
        return {"score": 50, "reasoning": "No LLM available for analysis", "recommendation": "review"}

    # Build prompt
    prompt = f"""Analyze this Jules branch for usefulness to current development.

**Jules Branch:**
- Branch: {branch_info['branch']}
- Commit: {branch_info['commit_message']}
- Date: {branch_info['commit_date']}

**Diff Stats:**
{branch_info['diff_stats']}

**Diff Preview (first 5000 chars):**
{branch_info['diff_full'][:5000]}

**Current Active Tracks:**
{current_tracks}

**Task:**
Evaluate if this Jules branch is useful for current development goals.

**Output JSON:**
{{
    "score": 0-100,
    "reasoning": "Why is this useful/not useful?",
    "recommendation": "merge" | "skip" | "review",
    "related_tracks": ["track names that benefit from this"]
}}

**Scoring:**
- 90-100: Critical feature/fix, immediate merge
- 70-89: Useful improvement, auto-merge OK
- 50-69: Potentially useful, manual review
- 0-49: Not relevant, skip

Only return valid JSON, no markdown.
"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, 'content') else str(response)

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            result = json.loads(json_match.group(0))
            log("INFO", f"LLM Score: {result['score']}/100 - {result['recommendation']}")
            return result
        else:
            log("WARN", "LLM response not valid JSON")
            return {"score": 50, "reasoning": "Invalid LLM response", "recommendation": "review"}

    except Exception as e:
        log("ERROR", f"LLM analysis failed: {e}")
        return {"score": 50, "reasoning": f"LLM error: {e}", "recommendation": "review"}


def get_active_tracks() -> str:
    """Read conductor/tracks.md and extract active tracks"""
    tracks_path = os.path.join(os.getcwd(), "conductor", "tracks.md")

    if not os.path.exists(tracks_path):
        return "No active tracks found"

    try:
        with open(tracks_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract active tracks (between "## Active Tracks" and next ##)
        match = re.search(r'## Active Tracks(.*?)##', content, re.DOTALL)
        if match:
            return match.group(1).strip()
        else:
            return content[:1000]  # First 1000 chars as fallback

    except Exception as e:
        log("WARN", f"Failed to read tracks.md: {e}")
        return "Failed to read active tracks"


def merge_branch(branch: str, analysis: Dict) -> bool:
    """Merge Jules branch with detailed commit message"""
    log("INFO", f"Merging branch: {branch}")

    # Ensure we're on main
    success, _ = run_command("git checkout main")
    if not success:
        log("ERROR", "Failed to checkout main")
        return False

    # Pull latest main
    success, _ = run_command("git pull origin main")
    if not success:
        log("WARN", "Failed to pull main, continuing anyway")

    # Merge Jules branch
    commit_msg = f"""Merge Jules branch: {branch}

Auto-merged by JulesAutoSync
LLM Score: {analysis['score']}/100
Recommendation: {analysis['recommendation']}

Reasoning: {analysis['reasoning']}

Related Tracks: {', '.join(analysis.get('related_tracks', []))}

Co-Authored-By: Jules AI <jules@render.com>
"""

    # Create commit message file
    commit_file = ".git/JULES_MERGE_MSG"
    with open(commit_file, 'w', encoding='utf-8') as f:
        f.write(commit_msg)

    # Merge with --no-ff (always create merge commit)
    success, output = run_command(f"git merge origin/{branch} --no-ff --no-edit -m \"$(cat {commit_file})\"")

    if success:
        log("INFO", f"[OK] Merged: {branch}")

        # Push to remote
        success_push, _ = run_command("git push origin main")
        if success_push:
            log("INFO", "[OK] Pushed to remote")
        else:
            log("WARN", "Merge OK, but push failed (manual push needed)")

        return True
    else:
        log("ERROR", f"Merge failed: {output}")
        # Abort merge
        run_command("git merge --abort")
        return False


def main():
    """Main Jules Auto-Sync workflow"""
    print("\n" + "="*60)
    print("Jules Auto-Sync & Auto-Merge")
    print("="*60 + "\n")

    # Step 1: Get Jules branches
    branches = get_jules_branches()
    if not branches:
        log("INFO", "No Jules branches to sync. Exiting.")
        return

    # Step 2: Get current active tracks
    active_tracks = get_active_tracks()
    log("INFO", f"Active tracks loaded ({len(active_tracks)} chars)")

    # Step 3: Analyze each branch
    results = []
    for branch in branches:
        branch_info = get_branch_info(branch)
        if not branch_info:
            log("WARN", f"Failed to get info for {branch}, skipping")
            continue

        analysis = analyze_usefulness(branch_info, active_tracks)

        results.append({
            "branch": branch,
            "info": branch_info,
            "analysis": analysis
        })

    # Step 4: Auto-merge if score > 70
    print("\n" + "="*60)
    print("ANALYSIS RESULTS")
    print("="*60 + "\n")

    merged_count = 0
    skipped_count = 0
    review_count = 0

    for result in results:
        branch = result['branch']
        score = result['analysis']['score']
        recommendation = result['analysis']['recommendation']

        print(f"\n[BRANCH] {branch}")
        print(f"  Commit: {result['info']['commit_message']}")
        print(f"  Score: {score}/100")
        print(f"  Recommendation: {recommendation}")
        print(f"  Reasoning: {result['analysis']['reasoning']}")

        if recommendation == "merge" and score >= 70:
            print(f"  [AUTO-MERGE] Merging...")
            if merge_branch(branch, result['analysis']):
                merged_count += 1
                print(f"  [OK] Merged successfully!")
            else:
                print(f"  [ERROR] Merge failed, manual intervention needed")
                review_count += 1

        elif recommendation == "review" or (50 <= score < 70):
            print(f"  [REVIEW] Manual review recommended")
            review_count += 1

        else:
            print(f"  [SKIP] Not relevant for current work")
            skipped_count += 1

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"  Merged: {merged_count}")
    print(f"  Review needed: {review_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total: {len(results)}")
    print("="*60 + "\n")

    # Log to file
    log_file = "logs/jules_auto_sync.log"
    os.makedirs("logs", exist_ok=True)
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(f"\n[{datetime.now().isoformat()}] Jules Auto-Sync Run\n")
        f.write(f"Merged: {merged_count}, Review: {review_count}, Skipped: {skipped_count}\n")
        for result in results:
            f.write(f"  - {result['branch']}: {result['analysis']['score']}/100 ({result['analysis']['recommendation']})\n")


if __name__ == "__main__":
    main()
