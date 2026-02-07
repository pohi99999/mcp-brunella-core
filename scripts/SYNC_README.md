# 🔄 Brunella GitHub Sync Scripts

Automatikus szinkronizáció GitHub-bal minden munkamenet elején.

---

## 📦 Elérhető Script-ek

| Script | Platform | Leírás |
|--------|----------|--------|
| `sync.bat` | Windows CMD | Egyszerű batch script (mindenki számára) |
| `sync.ps1` | PowerShell | Részletes PowerShell (speciális funkciók) |
| `sync.sh` | Git Bash / WSL / Linux | Cross-platform bash script |

---

## 🚀 Használat

### **1. Alapvető Szinkronizálás (Gyors)**

```bash
# Windows CMD
scripts\sync.bat

# PowerShell
.\scripts\sync.ps1

# Git Bash / WSL
bash scripts/sync.sh
```

**Mit csinál:**
1. ✅ Fetch remote changes
2. ✅ Check local status
3. ✅ Pull from GitHub
4. ✅ Auto-stash uncommitted changes (opcionális)
5. ✅ List Jules PRs
6. ✅ Show latest commits

---

### **2. Szinkronizálás + Build Ellenőrzés**

```bash
# Windows CMD
scripts\sync.bat --build

# PowerShell
.\scripts\sync.ps1 -Build

# Git Bash
bash scripts/sync.sh --build
```

**Extra funkció:**
- ✅ `npm run build` futtatás
- ✅ TypeScript compile ellenőrzés
- ❌ Ha build fail → megáll

---

### **3. Teljes Ellenőrzés (Sync + Build + Test)**

```bash
# Windows CMD
scripts\sync.bat --build --test

# PowerShell
.\scripts\sync.ps1 -Build -Test

# Git Bash
bash scripts/sync.sh --build --test
```

**Extra funkciók:**
- ✅ Build check
- ✅ `npm test` futtatás (Vitest)
- ⏱️ Hosszabb futás (~2-5 perc)

---

### **4. Force Mode (Auto-Stash)**

```bash
# Windows CMD
scripts\sync.bat --force

# PowerShell
.\scripts\sync.ps1 -Force

# Git Bash
bash scripts/sync.sh --force
```

**Mit csinál:**
- ✅ Automatikusan stash-eli a uncommitted változásokat
- ✅ Pull után automatikusan visszaállítja
- 🚨 Használd csak ha tudod mit csinálsz!

---

## 📋 Napi Workflow

### **REGGEL (Munkamenet Kezdés)**

```bash
# 1. Szinkronizálás
cd F:\mcp-brunella-core
scripts\sync.bat

# 2. Ellenőrzés (csak ha fontos)
scripts\sync.bat --build

# 3. Indítás
npm run dev          # Backend
npm run dev:ui       # Dashboard
```

---

### **DÉLBEN / ESTE (Jules Check)**

```bash
# Ha Jules dolgozott közben:
scripts\sync.bat

# Ellenőrzés
gh pr list
gh pr view <PR#>
```

---

### **ÉJSZAKA ELŐTT (Push Előtt)**

```bash
# 1. Commit local work
git add -A
git commit -m "feat: My daily work"

# 2. Sync (pull before push!)
scripts\sync.bat

# 3. Push
git push origin main
```

---

## 🛡️ Konfliktus Kezelés

Ha a script conflict-ot észlel:

```bash
# Script megáll és kiírja:
[ERROR] Git pull failed! You may have merge conflicts.

# Megoldás:
git status                 # Lásd melyik fájl konfliktus
git mergetool              # Szerkeszd a konfliktust
# VAGY
code <file>                # Manuálisan szerkeszd (VS Code)

# Ha kész:
git add <file>
git commit -m "chore: Resolve merge conflict"
git push origin main
```

---

## 🎯 Jules Specifikus Workflow

### **Jules task ELŐTT:**

```bash
# 1. Push local work
git add -A && git commit -m "WIP: Before Jules"
git push origin main

# 2. Jules task indítás (Claude.ai/Jules)
# Várj 30-60 percet...
```

---

### **Jules task UTÁN:**

```bash
# 1. Sync (pull Jules work)
scripts\sync.bat

# 2. Review Jules PRs
gh pr list
gh pr view <PR#>

# 3. Merge (ha jó)
gh pr merge <PR#> --squash
git pull origin main
```

---

## ⚙️ Script Opciók

### **Windows CMD (`sync.bat`)**

```
Usage: sync.bat [OPTIONS]

OPTIONS:
  --build    Run build check after sync
  --test     Run tests after sync
  --force    Skip stash prompt (auto-stash)
  --help     Show this help message
```

---

### **PowerShell (`sync.ps1`)**

```
Usage: .\sync.ps1 [OPTIONS]

OPTIONS:
  -Build      Run build check after sync
  -Test       Run tests after sync
  -Force      Skip stash prompt (auto-stash)
  -Verbose    Show detailed output
  -Help       Show this help message
```

---

### **Bash (`sync.sh`)**

```
Usage: ./sync.sh [OPTIONS]

OPTIONS:
  --build    Run build check after sync
  --test     Run tests after sync
  --force    Skip stash prompt (auto-stash)
  --help     Show this help message
```

---

## 💡 Pro Tippek

### **1. Aliasok (Gyorsabb használat)**

**PowerShell ($PROFILE):**
```powershell
function Sync-Brunella { .\scripts\sync.ps1 @args }
Set-Alias sync Sync-Brunella
```

Használat:
```powershell
sync           # Gyors sync
sync -Build    # Sync + build
```

---

**Git Bash (~/.bashrc):**
```bash
alias sync='bash scripts/sync.sh'
alias syncb='bash scripts/sync.sh --build'
alias synct='bash scripts/sync.sh --build --test'
```

Használat:
```bash
sync      # Gyors sync
syncb     # Sync + build
synct     # Sync + build + test
```

---

### **2. VS Code Task (F5 Shortcut)**

Hozz létre `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Sync with GitHub",
      "type": "shell",
      "command": "scripts\\sync.bat",
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

Használat: **Ctrl+Shift+B** (vagy F1 → "Run Task")

---

### **3. Scheduled Task (Windows - Automatikus Sync)**

Reggeli auto-sync (opcionalos):

```powershell
# PowerShell-ben (admin jogok kellenek)
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File F:\mcp-brunella-core\scripts\sync.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Brunella Auto Sync" -Description "Napi GitHub szinkronizálás"
```

---

## 🚨 Hibaelhárítás

### **Hiba: "Not a git repository"**

```bash
# Megoldás: Menj a projekt root-ba
cd F:\mcp-brunella-core
scripts\sync.bat
```

---

### **Hiba: "Git fetch failed"**

```bash
# Ellenőrizd a hálózatot
ping github.com

# Ellenőrizd a git remote-ot
git remote -v

# Ha kell, újra add:
git remote add origin https://github.com/pohi99999/mcp-brunella-core.git
```

---

### **Hiba: "GitHub CLI not available"**

```bash
# Telepítsd a GitHub CLI-t:
# https://cli.github.com/

# Windows: winget install GitHub.cli
winget install GitHub.cli

# Majd login:
gh auth login
```

---

### **Hiba: "Permission denied" (Bash)**

```bash
# Adj execute jogot:
chmod +x scripts/sync.sh

# Majd futtasd:
bash scripts/sync.sh
```

---

## 📊 Script Output Példa

```
========================================
  Brunella GitHub Sync
========================================

[1/8] Validating repository...
[OK] Repository validated.

[2/8] Fetching remote changes...
[OK] Fetch complete.

[3/8] Checking local status...
[OK] Working tree clean.

[4/8] Checking for divergence...
[INFO] Remote has 2 new commit(s).

[5/8] Pulling changes from origin/main...
[OK] Pull complete.

[6/8] No stashed changes to restore.

[7/8] Checking for Jules PRs...
Open PRs:
  #34: feat: Add LangSmith tracing (@google-labs-jules)
  #35: fix: Dashboard accessibility (@google-labs-jules)

[TIP] Review with: gh pr view <number>

========================================
  Sync Complete!
========================================

Latest 5 commits:
afedbf32 feat: improve command menu accessibility and z-index (#33)
eda8de08 feat: Complete Phase 1-3 implementation
2e0e5888 feat(ci): Add Phoenix Protocol workflow
2c14802d Revise project owner
2e2800eb Revise agent name

Current branch: main

[NEXT STEPS]
  - Start working: npm run dev
  - View status: git status
  - View changes: git log --oneline -10
```

---

## 🎓 Tanulságok

1. **Mindig pull-olj munkamenet elején** → Sync script automatizálja
2. **Ellenőrizd a Jules PR-eket** → Script kilistázza
3. **Build check fontos** → `--build` flag használata
4. **Konfliktusokat azonnal oldd meg** → Ne hagyd későbbre

---

## 🔗 További Információk

- [Git dokumentáció](https://git-scm.com/doc)
- [GitHub CLI manual](https://cli.github.com/manual/)
- [Brunella fejlesztési protokoll](../README.md#ai-ügynökök-bootstrap-protokoll)

---

**Készítette:** Claude Sonnet 4.5 (2026-02-07)
