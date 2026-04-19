import json
from pathlib import Path
from datetime import datetime

GEM = Path(r"C:\Users\pohi9\OneDrive\Desktop\Gemini_cli")
OUT = Path(r"F:\mcp-brunella-core\_br_temp\iszapfalo_analysis")

sessions = []
for p in GEM.glob("session-*.json"):
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        continue
    msgs = data.get("messages", []) if isinstance(data, dict) else []
    roles = {}
    for m in msgs:
        r = m.get("role") if isinstance(m, dict) else None
        if r:
            roles[r] = roles.get(r, 0) + 1
    sessions.append({
        "file": p.name,
        "sessionId": data.get("sessionId"),
        "startTime": data.get("startTime"),
        "lastUpdated": data.get("lastUpdated"),
        "messageCount": len(msgs),
        "roles": roles,
        "kind": data.get("kind"),
    })

# logs.json quick stats
logs_info = {"entries": 0, "topCommands": []}
logp = GEM / "logs.json"
if logp.exists():
    try:
        logs = json.loads(logp.read_text(encoding="utf-8"))
        if isinstance(logs, list):
            logs_info["entries"] = len(logs)
            cmd_counter = {}
            for e in logs:
                # best effort command extraction
                if isinstance(e, dict):
                    cmd = e.get("command") or e.get("name") or e.get("event") or e.get("type")
                    if cmd:
                        cmd_counter[str(cmd)] = cmd_counter.get(str(cmd), 0) + 1
            logs_info["topCommands"] = sorted(cmd_counter.items(), key=lambda x: x[1], reverse=True)[:30]
    except Exception:
        pass

sessions_sorted = sorted(sessions, key=lambda x: x.get("startTime") or "")

md = ["# Gemini CLI Timeline & Activity\n"]
md.append(f"- Session files: **{len(sessions_sorted)}**")
md.append(f"- logs.json entries: **{logs_info['entries']}**\n")
md.append("## Sessions\n")
for s in sessions_sorted:
    md.append(f"- `{s['file']}` | start={s['startTime']} | updated={s['lastUpdated']} | messages={s['messageCount']} | roles={s['roles']}")

md.append("\n## logs.json top events/commands\n")
for c,n in logs_info["topCommands"]:
    md.append(f"- {c}: {n}")

(OUT / "gemini_timeline.md").write_text("\n".join(md), encoding="utf-8")
print("done", OUT / "gemini_timeline.md")
