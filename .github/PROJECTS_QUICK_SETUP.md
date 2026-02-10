# GitHub Projects - Quick Setup Guide

## 🚀 Gyors Telepítés (5 perc)

### 1. Projekt Létrehozása (2 perc)

1. Menj ide: https://github.com/pohi99999/mcp-brunella-core/projects
2. Kattints: **New project**
3. Válaszd: **Board** template
4. Név: **Brunella Development Board**
5. Kattints: **Create**

### 2. Mezők Hozzáadása (2 perc)

A projekt beállításokban add hozzá ezeket a custom field-eket:

#### Status (Single Select)
```
📋 Backlog
🎯 Ready
🔄 In Progress
👀 In Review
✅ Done
🚫 Blocked
```

#### Priority (Single Select)
```
🔴 CRITICAL
🟠 HIGH
🟡 MEDIUM
🟢 LOW
```

#### Track (Single Select)
```
Code Quality
Gold Protocol
Agent Architect
Cloudflare Edge
Dashboard V2
Developer Agent
Phoenix Protocol
Robotkéz
Other
```

#### További mezők:
- **Progress** - Number (0-100)
- **Track ID** - Text
- **Sprint** - Text
- **Assignee Type** - Single Select (👤 Human, 🤖 AI Agent, 🤝 Hybrid)

### 3. Címkék Létrehozása (1 perc)

Futtasd ezt a terminálban:

```bash
# Track labels
gh label create "track:code-quality" --color 0E8A16
gh label create "track:gold-protocol" --color FFD700
gh label create "track:dashboard" --color 5319E7
gh label create "track:developer-agent" --color 0052CC

# Priority labels
gh label create "priority:critical" --color B60205
gh label create "priority:high" --color D93F0B
gh label create "priority:medium" --color FBCA04

# Agent labels
gh label create "agent:gemini" --color 4285F4
gh label create "agent:copilot" --color 000000
```

*(Teljes lista: `.github/PROJECTS.md`)*

### 4. Tesztelés

```bash
# Szinkronizáld a meglévő track-eket
npm run sync:projects:dry   # Előnézet
npm run sync:projects       # Tényleges szinkronizálás
```

### 5. Használat

**Új track létrehozása:**
1. Issues → New issue
2. Válaszd: "🎯 New Development Track"
3. Töltsd ki a template-et
4. Automatikusan megjelenik a projekt táblán!

**Követés:**
- https://github.com/pohi99999/mcp-brunella-core/projects/1
- Különböző nézetek: Board, By Track, By Priority stb.

---

## 📊 Nézetek Konfigurálása

### Board View (Default)
- Type: Board
- Group by: Status
- Sort by: Priority

### By Track
- Type: Board
- Group by: Track
- Sort by: Priority

### By Priority
- Type: Table
- Group by: Priority
- Sort by: Status

---

## ✅ Ellenőrző Lista

- [ ] GitHub Project létrehozva
- [ ] Custom field-ek beállítva (Status, Priority, Track, stb.)
- [ ] Címkék létrehozva (`gh label create ...`)
- [ ] Nézetek konfigurálva (Board, By Track, By Priority)
- [ ] Sync script tesztelve (`npm run sync:projects:dry`)
- [ ] Első issue létrehozva template-ből
- [ ] Issue megjelenik a projekt táblán

---

## 🔗 Linkek

- **Projekt Tábla**: https://github.com/pohi99999/mcp-brunella-core/projects
- **Teljes Útmutató**: `.github/PROJECTS.md`
- **Technikai Docs**: `.github/projects/README.md`
- **Issue Templates**: `.github/ISSUE_TEMPLATE/`

---

**Kérdések?** Olvasd el a teljes útmutatót: `.github/PROJECTS.md`
