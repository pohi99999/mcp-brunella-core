# 🤖 Jules + Brunella Integráció - Teljes Útmutató

**Probléma:** Jules gyorsan dolgozik (100 session/nap!), GitHub-ra pusholja a munkáját, de a helyi fejlesztés lemarad.

**Megoldás:** 2 módszer Jules és Brunella szinkronizálására.

---

## 🚀 Quick Start (5 perc)

### Módszer 1: Jules CLI (AJÁNLOTT - Natív Jules CLI használat)

**1. Jules CLI telepítés**
```bash
npm install -g @google/jules
```

**2. Bejelentkezés**
```bash
jules login
```

**3. Jules task indítás**
```bash
# Brunella CLI wrapper használat
python scripts/jules_cli_wrapper.py new "Fix robotkéz level 3 testing"

# Vagy natív Jules CLI
jules remote new --session "Fix robotkéz level 3 testing"
```

**4. Watch (vár amíg kész)**
```bash
# Wrapper (auto-pull ha kész)
python scripts/jules_cli_wrapper.py watch <session_id>

# Vagy manuális pull
jules remote pull --session <session_id>
```

### Módszer 2: Jules REST API (Programmatic access)

**1. API Key generálás**
- Nyisd meg: https://jules.google.com/settings
- Generate API Key
- Másold le: `qu7ry0ppQSjg...`

**2. .env frissítés**
```bash
echo "JULES_API_KEY=qu7ry0ppQSjg..." >> .env
```

**3. Jules task indítás API-n keresztül**
```bash
python scripts/jules_api_client.py create "Fix robotkéz level 3 testing"
```

**4. Watch (polling)**
```bash
python scripts/jules_api_client.py watch <session_id>
```

---

## 📋 Használati Példák

### Példa 1: Robotkéz Teszt Jules-szal (CLI)

```bash
# 1. Jules task indítás
python scripts/jules_cli_wrapper.py new "Complete robotkéz level 3 monitoring test with real-time dashboard updates"

# Output:
# ✅ Session ID: 12345678901234567890
#
# 📌 Watch parancs:
#    python scripts/jules_cli_wrapper.py watch 12345678901234567890

# 2. Watch (auto-pull ha kész)
python scripts/jules_cli_wrapper.py watch 12345678901234567890

# 3. Amikor kész:
# ✅ Session kész: 12345678901234567890
# ✅ Auto-pull sikeres!
#
# 📌 Merge parancs:
#    git fetch origin && git merge origin/robotkez-level3-fix-12345
```

### Példa 2: Bulk Task Jules-szal (API + Parallel)

```bash
# 1. Sources listázás (melyik repo-hoz?)
python scripts/jules_api_client.py sources

# Output:
# 📦 Jules Sources (GitHub repos):
#
#   sources/github/pohi99999/mcp-brunella-core
#     ID: github/pohi99999/mcp-brunella-core
#     Repo: pohi99999/mcp-brunella-core

# 2. Session létrehozás
python scripts/jules_api_client.py create "Add tests for all scripts/robotkez_*.py files"

# 3. Parallel task (ugyanaz a prompt, 3 session)
jules remote new --session "Add tests for all scripts/robotkez_*.py files" --parallel 3

# 4. Watch all (külön terminálban mindegyikhez)
python scripts/jules_api_client.py watch <session_id_1>
python scripts/jules_api_client.py watch <session_id_2>
python scripts/jules_api_client.py watch <session_id_3>
```

### Példa 3: Auto-Sync Setup (Óránként check + pull)

**Windows Task Scheduler:**
```powershell
# Jules sync task setup (óránként ellenőrzi + pullolja)
powershell -ExecutionPolicy Bypass -File scripts\setup_jules_sync_task.ps1
```

**Vagy Cron (Linux/Mac):**
```bash
# Add to crontab
crontab -e

# Óránként futtatás
0 * * * * cd /path/to/mcp-brunella-core && python scripts/jules_sync_watchdog.py --once
```

---

## 🔄 Workflow (Napi Rutin)

### Reggel (Munkakezdés)

```bash
# 1. Ellenőrzés: mit csinált Jules éjszaka?
python scripts/jules_cli_wrapper.py list

# Vagy GitHub branch-ek check
python scripts/jules_sync_watchdog.py --check

# 2. Pull Jules munkáját
python scripts/jules_sync_watchdog.py --once

# 3. Review + Merge
git log origin/jules-xxx -5 --stat
git merge origin/jules-xxx

# 4. Saját munka indítás
git checkout -b my-feature
```

### Délben (Új task Jules-nak)

```bash
# 1. Jules task indítás (Brunella mellett dolgozik)
python scripts/jules_cli_wrapper.py new "Implement dashboard real-time metrics for robotkéz status"

# 2. Folytasd a saját munkádat
# Jules a háttérben dolgozik, 30-60 perc múlva kész

# 3. Check session status
python scripts/jules_cli_wrapper.py list
```

### Este (Nap vége)

```bash
# 1. Jules sessions pull (mi készült el ma?)
python scripts/jules_cli_wrapper.py list

# Minden completed session-höz:
python scripts/jules_cli_wrapper.py pull <session_id>

# 2. Review + Merge (ha OK)
git merge origin/jules-dashboard-metrics-xxx

# 3. Push saját munkád
git push origin my-feature

# 4. Holnap Jules látja a te munkádat is!
```

---

## 🛠️ Advanced Use Cases

### Use Case 1: Scheduled Tasks (Recurring Jules tasks)

Jules-nak van **Scheduled Tasks** feature-je. Beállítható Jules UI-ban:
- https://jules.google.com → Repository → Scheduled tab

**Példa: Heti dependency update**
```
Frequency: Weekly (Monday 9:00 AM)
Prompt: "Update all npm dependencies to latest versions, run tests, fix any breaking changes"
Auto-PR: Yes
```

**Brunella side:** Auto-sync watchdog óránként pullolja.

### Use Case 2: Jules + Brunella Orchestration

**Brunella delegál Jules-nak:**

```typescript
// src/agents/JulesProxyAgent.ts (ÚJ)
export class JulesProxyAgent implements IAgent {
  async execute(task: string) {
    // 1. Jules CLI trigger
    const sessionId = await this.triggerJules(task);

    // 2. Wait for completion
    await this.waitForSession(sessionId);

    // 3. Pull results
    await this.pullSession(sessionId);

    // 4. Notify user
    return { status: "success", sessionId, message: "Jules completed task" };
  }
}
```

**Használat:**
```bash
node build/cli.js agent JulesProxy "Implement OAuth2 authentication"
```

### Use Case 3: Jules Repoless Mode (Ephemeral env)

**Mikor használd:**
- Gyors prototípus
- Teszt script generálás
- Izolált kísérlet

**Használat:**
```bash
# Repoless session (nincs GitHub repo, Jules cloud env-ben dolgozik)
python scripts/jules_api_client.py create "Create a FastAPI app with user auth + SQLite DB" --source none

# File outputs letöltés session-ből
python scripts/jules_api_client.py get <session_id> --download-files
```

---

## 🔐 Security & Best Practices

### ✅ DO (Ajánlott)

1. **API Key biztonság**
   - Tárold `.env`-ben (NEM commitolva git-re!)
   - Rotáld API key-t 3 havonta

2. **Review Jules munkáját**
   - NE auto-merge production-re vakon
   - Mindig review PR-t mielőtt merge-elsz

3. **Session limit**
   - 100 session/nap (Pro plan)
   - Tervezd előre a taskokat

4. **Branch cleanup**
   - Jules branch-ek: `jules-*`, `robotkez-*`
   - Merge után töröld: `git push origin --delete jules-xxx`

### ❌ DON'T (Ne csináld)

1. **NE sharelj API key-t** - security risk!
2. **NE force push Jules branch-ekre** - Jules nem látja a változást
3. **NE használj Jules-t confidential code-ra** - adatmegosztási szabályok!
4. **NE várj instant választ** - Jules 10-60 percig dolgozik

---

## 📊 Monitoring & Debugging

### Log fájlok

- **Jules sessions:** `.jules/sessions.json`
- **Sync log:** `logs/jules_sync.log`
- **API requests:** `logs/jules_api.log` (ha debug mode)

### Parancsok

```bash
# Jules sessions helyi fájlban
cat .jules/sessions.json | jq

# Sync log (legutóbbi 20 sor)
tail -20 logs/jules_sync.log

# GitHub Jules branch-ek
git branch -r | grep -E 'jules-|robotkez-'

# Jules session-ök API-n keresztül
python scripts/jules_api_client.py list

# Egy session részletei
python scripts/jules_api_client.py get <session_id>
```

---

## 🎯 Jules + Brunella Együttműködés (Best Workflow)

```
┌──────────────────┐
│  TÉD (Kreatív)   │
│  Ötlet, stratégia│
└────────┬─────────┘
         │
         ├──────────────────────┐
         │                      │
         v                      v
┌─────────────────┐    ┌──────────────────┐
│   BRUNELLA      │    │      JULES       │
│   (Orchestrator)│    │   (Autonomous)   │
│                 │    │                  │
│  - Planning     │    │  - Full impl.    │
│  - Review       │    │  - Testing       │
│  - Integration  │    │  - PR creation   │
│  - Custom tools │    │  - Bug fixing    │
└────────┬────────┘    └──────┬───────────┘
         │                     │
         v                     v
     ┌───────────────────────────┐
     │   GITHUB (mcp-brunella)   │
     │   - main branch           │
     │   - jules-* branches      │
     │   - Pull Requests         │
     └───────────┬───────────────┘
                 │
                 v
         ┌───────────────┐
         │  PRODUCTION   │
         └───────────────┘
```

**Feladatmegosztás:**
- **Jules:** Repetitív kódolás, tesztelés, bug fixing
- **Brunella:** Orchestration, planning, egyedi logika
- **Te:** Kreativitás, döntések, review

**Példa workflow:**
1. **Te:** "Kéne egy robotkéz monitoring dashboard"
2. **Brunella (CLI):** Planning → spec generálás → task breakdown
3. **Jules (delegált task):** Implementáció (UI + backend) → tests → PR
4. **Brunella (auto-sync):** Jules PR pullolása → review → integration
5. **Te:** Final review → merge → production

---

## 🆘 Troubleshooting

### Probléma: Jules CLI nem található

**Megoldás:**
```bash
# Telepítés
npm install -g @google/jules

# Ellenőrzés
which jules  # Linux/Mac
where jules  # Windows
```

### Probléma: "Session ID not found in output"

**Megoldás:**
Jules CLI output formátum változhat. Update wrapper script:
```python
# jules_cli_wrapper.py, line ~65
# Customize session ID parsing based on actual Jules CLI output
```

### Probléma: API 401 Unauthorized

**Megoldás:**
```bash
# Check API key
echo $JULES_API_KEY

# Re-generate API key
# https://jules.google.com/settings

# Update .env
echo "JULES_API_KEY=new-key" >> .env
```

### Probléma: Jules nem látja a legfrissebb kódot

**Megoldás:**
```bash
# Push main-re (Jules a main branch-ről indul)
git checkout main
git pull origin main
git push origin main

# Majd újra trigger Jules-t
python scripts/jules_cli_wrapper.py new "task with latest code"
```

---

## 📚 További Olvasnivaló

- **Jules Docs:** https://jules.google.com/docs
- **Jules API Reference:** https://jules.google.com/docs/api
- **Jules CLI Reference:** https://jules.google.com/docs/tools
- **Jules Examples:** https://jules.google.com/docs/examples
- **Brunella README:** README.md
- **Sync Strategy:** scripts/JULES_SYNC_README.md

---

**Készítette:** Claude Code
**Dátum:** 2026-02-06
**Verzió:** 1.0
**Jules Plan:** Pro (100 sessions/nap, Gemini 3 Pro)
