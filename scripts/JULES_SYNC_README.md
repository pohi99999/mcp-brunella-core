# 🤖 Jules Sync Automation - Teljes Útmutató

**Probléma:** Jules gyorsan dolgozik, GitHub-ra pusholja a munkáját, de a helyi fejlesztés lemarad.

**Megoldás:** 3 szintű automatikus sync rendszer.

---

## 🚀 Gyors Start (5 perc)

### 1️⃣ Azonnali Sync (Manuális)

```bash
# Ellenőrzés: milyen Jules branch-ek vannak?
python scripts/jules_sync_watchdog.py --check

# Pullolás (review módban)
python scripts/jules_sync_watchdog.py --once

# Merge manuálisan (biztonságos)
git merge origin/robotkez-setup-10830104862054860677
```

### 2️⃣ Automatikus Sync Beállítás (Óránként)

**Windows:**
```powershell
# Task Scheduler setup
powershell -ExecutionPolicy Bypass -File scripts\setup_jules_sync_task.ps1

# Ellenőrzés
Get-ScheduledTask -TaskName JulesSyncWatchdog

# Azonnali futtatás (teszt)
Start-ScheduledTask -TaskName JulesSyncWatchdog

# Log megtekintés
cat logs\jules_sync.log
```

**Linux/Mac:**
```bash
# Cron job hozzáadás (óránként)
crontab -e

# Add ezt a sort:
0 * * * * cd /path/to/mcp-brunella-core && python scripts/jules_sync_watchdog.py --once
```

### 3️⃣ GitHub Actions Értesítés

✅ Már beállítva! Ha Jules pushol, GitHub Actions értesít.

Nézd meg: `.github/workflows/jules-notify.yml`

---

## 📋 Használati Módok

### Mód 1: Manuális Review (AJÁNLOTT)

```bash
# 1. Ellenőrzés
python scripts/jules_sync_watchdog.py --check

# 2. Pullolás
python scripts/jules_sync_watchdog.py --once

# 3. Review
git log origin/jules-xxx --oneline -10

# 4. Merge (ha OK)
git merge origin/jules-xxx
```

**Előny:** Biztonságos, te döntöd el mit merge-elsz.

### Mód 2: Auto-Merge (KÍSÉRLETI)

```bash
# FIGYELEM: Automatikusan merge-el mindent!
python scripts/jules_sync_watchdog.py --once --auto-merge
```

**Előny:** Teljesen automatikus.
**Hátrány:** Conflict esetén elszállhat.

### Mód 3: Daemon (Háttérben fut)

```bash
# Háttérben fut, óránként ellenőrzi
python scripts/jules_sync_watchdog.py --daemon

# Vagy nohup (háttérben, kimenet logba)
nohup python scripts/jules_sync_watchdog.py --daemon > logs/jules_daemon.log 2>&1 &
```

---

## 🛡️ Biztonság & Best Practices

### ✅ DOS (Ajánlott)

1. **Review mód használata** - ne auto-merge, nézd át a változásokat
2. **Óránkénti ellenőrzés** - Windows Task Scheduler vagy Cron
3. **Conflict kezelés** - merge conflict esetén manuális javítás
4. **Log követés** - `logs/jules_sync.log` rendszeres ellenőrzése

### ❌ DON'Ts (Ne csináld)

1. **Auto-merge production-re** - mindig review először!
2. **Force push** - soha ne force-olj Jules branch-ekre
3. **Conflict mellőzés** - conflict esetén ne használj `--theirs` vagy `--ours` vakon

---

## 📊 Monitoring

### Log fájlok

- `logs/jules_sync.log` - Sync log
- `logs/jules_daemon.log` - Daemon mode log

### Parancsok

```bash
# Legutóbbi 20 sor a logból
tail -20 logs/jules_sync.log

# Követés (live)
tail -f logs/jules_sync.log

# Jules aktivitás GitHub-on
git log origin/jules-* --oneline --all --graph -10
```

---

## 🔧 Troubleshooting

### Probléma: "git fetch sikertelen"

**Megoldás:**
```bash
git remote -v  # Ellenőrzés
git fetch origin --prune  # Teljes fetch
```

### Probléma: "Merge conflict"

**Megoldás:**
```bash
# 1. Státusz
git status

# 2. Conflict fájlok szerkesztése
code <fájlnév>  # VS Code

# 3. Resolve
git add .
git commit -m "Merge conflict resolved"
```

### Probléma: "Task nem fut"

**Windows:**
```powershell
# Task státusz
Get-ScheduledTask -TaskName JulesSyncWatchdog | fl *

# Task history
Get-ScheduledTask -TaskName JulesSyncWatchdog | Get-ScheduledTaskInfo

# Újra setup
powershell -ExecutionPolicy Bypass -File scripts\setup_jules_sync_task.ps1
```

---

## 🎯 Workflow Példa (Napi Rutin)

### Reggel (Munkakezdés)

```bash
# 1. Jules aktivitás ellenőrzés
python scripts/jules_sync_watchdog.py --check

# 2. Ha van új munka, pullolás
python scripts/jules_sync_watchdog.py --once

# 3. Review (mi változott?)
git log origin/jules-xxx -5 --stat

# 4. Merge (ha OK)
git merge origin/jules-xxx

# 5. Saját munka folytatása
git checkout -b my-feature
```

### Délután (Közben ellenőrzés)

A Task Scheduler automatikusan óránként ellenőrzi, de manuálisan is:

```bash
cat logs/jules_sync.log  # Volt-e új aktivitás?
```

### Este (Nap vége)

```bash
# 1. Utolsó sync
python scripts/jules_sync_watchdog.py --once

# 2. Push saját munkát
git push origin my-feature

# 3. Holnap reggel Jules is látja a te munkádat!
```

---

## 📈 Előnyök

✅ **Soha nem maradsz le** - óránként auto-check
✅ **Biztonságos** - review mód alapértelmezett
✅ **Értesítés** - GitHub Actions értesít ha Jules pushol
✅ **Log-olható** - minden sync log-ba íródik
✅ **Windows friendly** - Task Scheduler integráció

---

## 🤝 Jules + Te Együttműködés

```
┌─────────────┐
│   Jules     │  (GitHub: 100 session/nap)
│  (Google)   │
└──────┬──────┘
       │ push (robotkez-*, jules-*)
       ↓
┌─────────────────┐
│  GitHub Repo    │
│  (origin/main)  │
└──────┬──────────┘
       │ auto-pull (óránként)
       ↓
┌─────────────────┐
│  Helyi Gép (Te) │
│  (F:\mcp-...)   │
└─────────────────┘
       │ review + merge
       ↓
┌─────────────────┐
│   main branch   │  ✅ Szinkronban!
└─────────────────┘
```

---

**Készítette:** Claude Code
**Dátum:** 2026-02-06
**Verzió:** 1.0
