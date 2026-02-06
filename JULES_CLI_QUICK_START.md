# 🤖 Jules CLI - Gyors Útmutató (Interaktív Menük)

**Te mondtad:** "CLI sokat használom de nem a kód beírásos hanem perjel max, inkább interaktív menük szöveges kontextus"

**Megoldás:** Interaktív Jules menü slash commands-okkal! ✅

---

## 🚀 Használat (3 módszer)

### 1️⃣ **Interaktív Menü** (AJÁNLOTT - Kevés gépelés!)

```bash
# Indítás
brunella jules menu

# Vagy közvetlenül
node build/cli-jules-interactive.js
```

**Mit látsz:**
```
╔════════════════════════════════════════╗
║   🤖 Brunella + Jules Integráció      ║
║   Interaktív CLI Menü                  ║
╚════════════════════════════════════════╝

? 🤖 Brunella + Jules
  🆕 Új Jules task
  🔄 Sync (pull Jules branch-ek)
  📊 Status (sessions + branches)
  ❓ Help
  ─────────
❯ 🚪 Exit
```

**Nyilakkal navigálsz, Enter = kiválasztás!**

---

### 2️⃣ **Slash Commands** (Chat-ben)

```bash
# Indítsd a Brunella chat-et
brunella chat

# Majd használd a slash command-okat
brunella> /jules
brunella> /jules new
brunella> /jules sync
brunella> /jules status
```

**Példa:**
```
brunella> /jules new
? Jules task prompt: Complete robotkéz level 3 monitoring

🚀 Jules task indítás: "Complete robotkéz level 3 monitoring"...
✅ Session létrehozva: 12345678901234567890
```

---

### 3️⃣ **Közvetlen Parancsok** (Gyors!)

```bash
# Új task
brunella jules new "Fix all TypeScript errors"

# Sync
brunella jules sync

# Status
brunella jules status

# Interaktív menü
brunella jules menu
```

---

## 📋 Interaktív Menü Flow

### Új Task Létrehozás

```
1. Válassz: "🆕 Új Jules task"

2. Mit delegálsz?
   ❯ 🐛 Bug fixing
     ✨ Feature implementation
     🧪 Write tests
     📦 Dependency update
     📝 Custom prompt

3. (Ha bug fixing választottad)
   ? Használod ezt a promptot?
     "Fix all linting errors and type issues in the codebase"
     ❯ Yes
       No (saját prompt)

4. Trigger metódus?
   ❯ 🔌 REST API (ajánlott)
     💻 CLI (natív jules command)

5. ✅ Session létrehozva!

6. ? Watch mode indítása? (vár amíg kész)
     ❯ No
       Yes
```

**Kevés gépelés, sok kontextus!** 🎯

---

### Sync (Pull Jules Branch-ek)

```
1. Válassz: "🔄 Sync (pull Jules branch-ek)"

2. Ellenőrzés...
   ✅ 3 Jules branch találva:
     1. robotkez-setup-10830104862054860677 (3 új commit)
     2. jules-maintenance-fixes-13826855540892526715 (6 új commit)
     3. jules-setup-14782448924770257556 (12 új commit)

3. Mit szeretnél csinálni?
   ❯ 📥 Pull all (összes branch)
     🔍 Review specific branch
     🔀 Merge specific branch
     🔙 Vissza

4. (Ha "Review specific branch")
   ? Melyik branch?
     ❯ robotkez-setup-... (3 commits)
       jules-maintenance-... (6 commits)
       jules-setup-... (12 commits)

5. Review output:
   abc123 Add robotkéz CLI wrapper
   def456 Fix level 3 monitoring
   ghi789 Add tests for all scenarios
```

---

### Status

```
1. Válassz: "📊 Status"

2. Output:
   📋 Helyi sessions (5):
     ✅ 12345678901234567890
        Complete robotkéz level 3 monitoring with real-time...

     ⏳ 98765432109876543210
        Fix all TypeScript errors in src/agents/...

   📦 GitHub Jules branches (3):
     1. robotkez-setup-10830104862054860677 (3 commits)
     2. jules-maintenance-fixes-13826855540892526715 (6 commits)
     3. jules-setup-14782448924770257556 (12 commits)

   ? Lekérdezzem a Jules API sessions-t is?
     ❯ No
       Yes
```

---

## 🎯 Workflow Példa (Napi Rutin)

### Reggel

```bash
# 1. Indítsd az interaktív menüt
brunella jules menu

# 2. Válassz: "📊 Status"
# Látod mit csinált Jules éjszaka

# 3. Válassz: "🔄 Sync"
# Pull all → Összes branch lehúzva

# 4. Review (külön terminálban)
git log origin/jules-xxx -5 --stat

# 5. Merge (ha OK)
git merge origin/jules-xxx
```

### Délben (Új task Jules-nak)

```bash
# Chat módban
brunella chat

brunella> /jules new
? Jules task prompt: Implement dashboard real-time metrics for robotkéz
🚀 Jules task indítás...
✅ Session létrehozva!

# Folytasd a saját munkádat
# Jules a háttérben dolgozik
```

### Este

```bash
# Interaktív menü
brunella jules menu

# Status → Check mi készült el
# Sync → Pull completed sessions
# Review + Merge
```

---

## 💡 Előnyök (Slash + Menük)

✅ **Kevés gépelés** - Nyilak + Enter
✅ **Kontextus-alapú** - Látod az opciókat
✅ **Validáció** - Nem tudsz hibás input-ot adni
✅ **Gyors** - 3-5 kattintás vs 50 karakter gépelés
✅ **Felhasználóbarát** - Emlékeztet mit kell csinálni

---

## 🆚 Összehasonlítás

| Módszer | Gépelés | Sebesség | Kezdőbarát |
|---------|---------|----------|------------|
| **Python script** | 🔴 Sok | 🟡 Közepes | 🔴 Nem |
| **Slash commands** | 🟡 Kevés | 🟢 Gyors | 🟢 Igen |
| **Interaktív menü** | 🟢 Minimális | 🟡 Közepes | 🟢 Igen |

**Te:** Slash + Interaktív menü kombináció! 🎯

---

## 🔧 Setup (Első használat)

```bash
# 1. Build (ha még nem volt)
npm run build

# 2. API Key (.env-ben)
echo "JULES_API_KEY=qu7ry0ppQSjg..." >> .env

# 3. Próbáld ki!
brunella jules menu
```

---

## 📚 További Parancsok

```bash
# Help
brunella jules --help

# Chat-ben
brunella chat
brunella> /jules help

# Interaktív menüben
? 🤖 Brunella + Jules
  ❯ ❓ Help
```

---

**Készítette:** Claude Code
**Dátum:** 2026-02-06
**Stílus:** Interaktív menük + Slash commands (minimal typing!)
