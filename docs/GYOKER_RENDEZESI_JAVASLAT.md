# 📂 GYÖKÉR DOKUMENTUM RENDEZÉSI JAVASLAT

**Készítette:** Claude Code
**Dátum:** 2026-02-14
**Cél:** Tiszta, átlátható gyökér struktúra - csak a LEGFONTOSABB fájlok maradjanak

---

## 🎯 JELENLEGI HELYZET (Tumultus!)

Jelenleg **41 dokumentum** van a gyökérben, ebből sok:
- ❌ **Working notes** (`_AI_*`, `_COPILOT_*`, `_DASHBOARD_*`)
- ❌ **Session logs** (`2026-02-06-*.txt`, `2026-02-07-*.txt`)
- ❌ **Duplikált dokumentációk** (README, CLAUDE, GEMINI, Brunella, USER_START)
- ❌ **Temp fájlok** (`vitest_output.txt`, `audit_report.json`)

**Probléma:** Zavaró navigáció, nehéz megtalálni a fontos fájlokat.

---

## ✅ MI MARADJON A GYÖKÉRBEN? (11 FÁJL)

### 1️⃣ DOKUMENTÁCIÓ (4 fájl)

| Fájl | Státusz | Indok |
|------|---------|-------|
| **README.md** | ✅ MARAD | Master dokumentum (Bootstrap protokoll, Architecture) |
| **CLAUDE.md** | ✅ MARAD | Claude Code-specifikus útmutató (frissen frissítve) |
| **CONTRIBUTING.md** | ✅ MARAD | Contributor guidelines (GitHub standard) |
| ~~**GEMINI.md**~~ | ❌ TÖRÖLD | Elavult redirect (README-re mutat) |

**Akció:**
```bash
# GEMINI.md törlése (már elavult, csak redirect)
rm GEMINI.md
```

### 2️⃣ PROJEKT KONFIGURÁCIÓK (4 fájl)

| Fájl | Státusz | Indok |
|------|---------|-------|
| **package.json** | ✅ MARAD | Node.js projekt manifest |
| **tsconfig.json** | ✅ MARAD | TypeScript compiler config |
| **vitest.config.ts** | ✅ MARAD | Vitest test runner config |
| **mcp_servers.json** | ✅ MARAD | MCP server registry |

### 3️⃣ INDÍTÓ SCRIPTEK (2 fájl)

| Fájl | Státusz | Indok |
|------|---------|-------|
| **start.bat** | ✅ MARAD | Gyors rendszer indítás (Windows) |
| **start-full.bat** | ✅ MARAD | Teljes rendszer indítás (Ollama + AnythingLLM + server) |

### 4️⃣ EGYÉB FONTOS (1 fájl)

| Fájl | Státusz | Indok |
|------|---------|-------|
| **docker-compose.yml** | ✅ MARAD | Docker stack definíció |

---

## 📦 MI KERÜLJÖN `docs/` MAPPÁBA? (20+ fájl)

### `docs/user/` - Felhasználói Dokumentáció

| Régi Hely (gyökér) | Új Hely | Indok |
|--------------------|---------|-------|
| `USER_START.md` | `docs/user/USER_START.md` | Felhasználói gyors indítás |
| `Brunella.md` | `docs/user/Brunella.md` | Vision statement |
| `JULES_INTEGRATION.md` | `docs/user/JULES_INTEGRATION.md` | Jules AI integráció |
| `JULES_CLI_QUICK_START.md` | `docs/user/JULES_CLI_QUICK_START.md` | Jules CLI gyors útmutató |

### `docs/project/` - Projekt Dokumentáció

| Régi Hely (gyökér) | Új Hely | Indok |
|--------------------|---------|-------|
| `PROJEKT_DIAGRAM_2026-02-13.md` | `docs/PROJECT_ARCHITECTURE_DIAGRAM.md` | Projekt architektúra (MA LÉTREHOZVA!) |
| `Toolskeszlet.md` | `docs/project/TOOLSET.md` | Eszközkészlet dokumentáció |
| `konyvtarfa.md` | `docs/project/DIRECTORY_TREE.md` | Könyvtár struktúra |
| `workflow.md` | `conductor/workflow.md` | ⚠️ Inkább conductor/-ba! |
| `mag.md` | `docs/project/CORE_CONCEPTS.md` | Mag koncepciók |

### `docs/temp/` - Ideiglenes Jegyzetek (ARCHIVÁLANDÓ!)

| Régi Hely (gyökér) | Új Hely | Indok |
|--------------------|---------|-------|
| `_AI_CHAT_LOG.json` | `docs/temp/_AI_CHAT_LOG.json` | AI chat log (archív) |
| `_AI_CHAT_LOG.md` | `docs/temp/_AI_CHAT_LOG.md` | AI chat log (archív) |
| `_AI_CONTEXT.md` | `docs/temp/_AI_CONTEXT.md` | AI context notes |
| `_AI_WORKFLOW.md` | `docs/temp/_AI_WORKFLOW.md` | AI workflow notes |
| `_CHANGE_REPORT.md` | `docs/temp/_CHANGE_REPORT.md` | Change report |
| `_CONDUCTOR_UPDATE_TEMPLATE.md` | `conductor/templates/UPDATE_TEMPLATE.md` | ⚠️ Inkább conductor/-ba! |
| `_COPILOT_NEXT_TASKS.md` | `docs/temp/_COPILOT_NEXT_TASKS.md` | Copilot notes |
| `_DASHBOARD_IMPLEMENTATION_PLAN.md` | `docs/temp/_DASHBOARD_IMPLEMENTATION_PLAN.md` | Dashboard plan |
| `_FIX_INSTRUCTIONS.md` | `docs/temp/_FIX_INSTRUCTIONS.md` | Fix instrukciók |
| `_JULES_MAINTENANCE_TASKS.md` | `docs/temp/_JULES_MAINTENANCE_TASKS.md` | Jules maintenance |
| `_PROJECT_STRUCTURE.md` | `docs/temp/_PROJECT_STRUCTURE.md` | Project structure notes |
| `_QUICK_START.md` | `docs/temp/_QUICK_START.md` | Quick start notes |
| `rendszer ellenorzes.md.txt` | `docs/temp/rendszer_ellenorzes.txt` | Rendszer ellenőrzés notes |

### `logs/` - Log Fájlok (ÚJ MAPPA!)

| Régi Hely (gyökér) | Új Hely | Indok |
|--------------------|---------|-------|
| `vitest_output.txt` | `logs/vitest_output.txt` | Test output log |
| `audit_report.json` | `logs/audit_report.json` | Audit report |
| `2026-02-06-*.txt` | `logs/sessions/2026-02-06-*.txt` | Session logs |
| `2026-02-07-*.txt` | `logs/sessions/2026-02-07-*.txt` | Session logs |
| `2026-02-11-*.txt` | `logs/sessions/2026-02-11-*.txt` | Session logs |

---

## 🗑️ MI TÖRÖLHETŐ? (Ha már nincs rá szükség)

### Elavult Dokumentációk

| Fájl | Törlés | Indok |
|------|--------|-------|
| `GEMINI.md` | ✅ TÖRÖLD | Elavult redirect (README.md-re mutat) |
| `2026-02-06-*.txt` | ⚠️ ARCHIVÁLT | Régi session logok (már .ai/FOSZAL.md-ben van) |
| `2026-02-07-*.txt` | ⚠️ ARCHIVÁLT | Régi session logok |
| `2026-02-11-*.txt` | ⚠️ ARCHIVÁLT | Régi session logok |

### Duplikált Jegyzetek

| Fájl | Törlés | Indok |
|------|--------|-------|
| `_AI_CHAT_LOG.*` | ⚠️ ARCHIVÁLT | Már .ai/claude.md tartalmazza |
| `_QUICK_START.md` | ⚠️ ARCHIVÁLT | Már README.md tartalmazza |
| `_PROJECT_STRUCTURE.md` | ⚠️ ARCHIVÁLT | Elavult (README.md frissebb) |

---

## 📋 VÉGREHAJTÁSI TERV (3 lépésben)

### LÉPÉS 1: Mappák létrehozása

```bash
# Új mappák
mkdir -p docs/user
mkdir -p docs/project
mkdir -p docs/temp
mkdir -p logs/sessions
```

### LÉPÉS 2: Fájlok áthelyezése

```bash
# Felhasználói dokumentáció
mv USER_START.md docs/user/
mv Brunella.md docs/user/
mv JULES_INTEGRATION.md docs/user/
mv JULES_CLI_QUICK_START.md docs/user/

# Projekt dokumentáció
mv PROJEKT_DIAGRAM_2026-02-13.md docs/PROJECT_ARCHITECTURE_DIAGRAM.md  # Már létrehozva!
mv Toolskeszlet.md docs/project/TOOLSET.md
mv konyvtarfa.md docs/project/DIRECTORY_TREE.md
mv mag.md docs/project/CORE_CONCEPTS.md

# Ideiglenes jegyzetek
mv _AI_* docs/temp/
mv _CHANGE_REPORT.md docs/temp/
mv _COPILOT_NEXT_TASKS.md docs/temp/
mv _DASHBOARD_IMPLEMENTATION_PLAN.md docs/temp/
mv _FIX_INSTRUCTIONS.md docs/temp/
mv _JULES_MAINTENANCE_TASKS.md docs/temp/
mv _PROJECT_STRUCTURE.md docs/temp/
mv _QUICK_START.md docs/temp/
mv "rendszer ellenorzes.md.txt" docs/temp/rendszer_ellenorzes.txt

# Log fájlok
mv vitest_output.txt logs/
mv audit_report.json logs/
mv 2026-02-*.txt logs/sessions/
```

### LÉPÉS 3: Elavult fájlok törlése (OPCIONÁLIS!)

```bash
# CSAK akkor futtasd, ha biztosan nem kell már!
rm GEMINI.md  # Elavult redirect

# Session logok már .ai/FOSZAL.md-ben vannak
rm logs/sessions/2026-02-06-*.txt
rm logs/sessions/2026-02-07-*.txt
rm logs/sessions/2026-02-11-*.txt
```

---

## ✨ VÉGEREDMÉNY - TISZTA GYÖKÉR

### Gyökér (11 fájl) ✅

```
F:\mcp-brunella-core\
├── README.md                    # Master dokumentum
├── CLAUDE.md                    # Claude Code útmutató
├── CONTRIBUTING.md              # Contributor guidelines
├── package.json                 # Node.js manifest
├── tsconfig.json                # TypeScript config
├── vitest.config.ts             # Vitest config
├── mcp_servers.json             # MCP server registry
├── docker-compose.yml           # Docker stack
├── start.bat                    # Gyors indítás
├── start-full.bat               # Teljes indítás
└── .env                         # Environment variables (NEM LÁTHATÓ)
```

### docs/ (Jól szervezett) ✅

```
docs/
├── PROJECT_ARCHITECTURE_DIAGRAM.md  # Projekt architektúra (MA LÉTREHOZVA!)
├── GYOKER_RENDEZESI_JAVASLAT.md     # Ez a dokumentum
├── MONITORING_PROMETHEUS.md          # Monitoring
├── AGENT_PERMISSIONS_GUIDE.md        # RBAC
├── MCP_TOOL_PERMISSIONS_GUIDE.md     # Tool permissions
├── user/
│   ├── USER_START.md
│   ├── Brunella.md
│   ├── JULES_INTEGRATION.md
│   └── JULES_CLI_QUICK_START.md
├── project/
│   ├── TOOLSET.md
│   ├── DIRECTORY_TREE.md
│   └── CORE_CONCEPTS.md
├── temp/
│   ├── _AI_CHAT_LOG.json
│   ├── _AI_CONTEXT.md
│   ├── _COPILOT_NEXT_TASKS.md
│   └── (egyéb working notes)
└── agents/
    └── (agent-specifikus docs)
```

### logs/ (Új, elkülönített) ✅

```
logs/
├── vitest_output.txt
├── audit_report.json
└── sessions/
    ├── 2026-02-06-*.txt
    ├── 2026-02-07-*.txt
    └── 2026-02-11-*.txt
```

---

## ⚠️ FIGYELMEZTETÉSEK

### 1. Ellenőrizd előtte!

Mielőtt törölsz vagy áthelyezel:
```bash
# Nézd meg mi van benne
cat GEMINI.md
cat _AI_CHAT_LOG.md
```

### 2. Git commit előtt!

```bash
# Commit a jelenlegi állapotot
git add -A
git commit -m "chore: backup before root directory cleanup"
```

### 3. Fokozatosan!

**NE** csináld egyszerre! Javasolt sorrend:
1. ✅ **MA:** Mappák létrehozása
2. ✅ **MA:** Felhasználói + Projekt docs áthelyezése
3. ⏳ **HOLNAP:** Temp notes áthelyezése + ellenőrzés
4. ⏳ **KÉSŐBB:** Elavult fájlok törlése (ha biztosan nem kell)

---

## 📊 HATÁS ÖSSZEFOGLALÁS

| Kategória | Előtte | Utána | Változás |
|-----------|--------|-------|----------|
| **Gyökér fájlok** | 41 | 11 | **-73%** 🎉 |
| **Dokumentumok** | Gyökérben | docs/ | ✅ Szervezett |
| **Temp notes** | Gyökérben | docs/temp/ | ✅ Elkülönítve |
| **Logok** | Gyökérben | logs/ | ✅ Elkülönítve |
| **Navigáció** | Zavaró | Tiszta | ✅ Könnyű |

---

## 🎯 KÖVETKEZŐ LÉPÉS

**Javaslat:** Futtasd le a PowerShell scriptet (alább) ami automatikusan elvégzi a rendezést!

```powershell
# cleanup_root.ps1 (Windows PowerShell)
# IMPORTANT: Review before running!

# 1. Mappák létrehozása
New-Item -ItemType Directory -Force -Path "docs/user"
New-Item -ItemType Directory -Force -Path "docs/project"
New-Item -ItemType Directory -Force -Path "docs/temp"
New-Item -ItemType Directory -Force -Path "logs/sessions"

# 2. Felhasználói docs
Move-Item -Path "USER_START.md" -Destination "docs/user/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "Brunella.md" -Destination "docs/user/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "JULES_INTEGRATION.md" -Destination "docs/user/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "JULES_CLI_QUICK_START.md" -Destination "docs/user/" -Force -ErrorAction SilentlyContinue

# 3. Projekt docs
Move-Item -Path "Toolskeszlet.md" -Destination "docs/project/TOOLSET.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "konyvtarfa.md" -Destination "docs/project/DIRECTORY_TREE.md" -Force -ErrorAction SilentlyContinue
Move-Item -Path "mag.md" -Destination "docs/project/CORE_CONCEPTS.md" -Force -ErrorAction SilentlyContinue

# 4. Temp notes (working files)
Move-Item -Path "_AI_*.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_AI_*.json" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_CHANGE_REPORT.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_COPILOT_NEXT_TASKS.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_DASHBOARD_IMPLEMENTATION_PLAN.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_FIX_INSTRUCTIONS.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_JULES_MAINTENANCE_TASKS.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_PROJECT_STRUCTURE.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "_QUICK_START.md" -Destination "docs/temp/" -Force -ErrorAction SilentlyContinue

# 5. Logs
Move-Item -Path "vitest_output.txt" -Destination "logs/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "audit_report.json" -Destination "logs/" -Force -ErrorAction SilentlyContinue
Move-Item -Path "2026-*.txt" -Destination "logs/sessions/" -Force -ErrorAction SilentlyContinue

# 6. Elavult fájlok törlése (OPCIONÁLIS - kommenteld ki ha nem vagy biztos!)
# Remove-Item -Path "GEMINI.md" -Force -ErrorAction SilentlyContinue

Write-Host "✅ Gyökér rendezés befejezve!" -ForegroundColor Green
Write-Host "📂 Ellenőrizd a docs/, logs/ mappákat" -ForegroundColor Yellow
```

---

**Összefoglalás:** A gyökér directory 41 fájlról 11-re csökken (**-73%**), minden dokumentum jól szervezett helyre kerül, navigáció sokkal egyszerűbb lesz! 🎉

**Következő lépés:** Futtasd le a cleanup_root.ps1 scriptet (fenti), VAGY csináld manuálisan lépésről lépésre!
