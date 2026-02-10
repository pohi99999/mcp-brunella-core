# GitHub Projects Setup - Summary

## 🎉 Mit Készítettünk?

A Brunella rendszer fejlesztését mostantól **GitHub Projects** segítségével követheted nyomon. Az alábbiakat hoztam létre:

---

## 📁 Létrehozott Fájlok

### 1. Konfiguráció és Dokumentáció

#### `.github/projects/` mappa
- **`brunella-development.yml`** - Projekt tábla teljes konfigurációja
  - Mezők definíciója (Status, Priority, Track, Progress, stb.)
  - Nézetek konfigurációja (Board, By Track, By Priority)
  - Automatizálási szabályok
  - Címkék listája
  
- **`README.md`** - Technikai dokumentáció
  - Projekt struktúra leírása
  - Használati útmutatók AI ügynökök és emberek számára
  - Szinkronizálási útmutató
  - Hibakeresési tippek

#### `.github/` mappa
- **`PROJECTS.md`** - **Teljes magyar nyelvű útmutató** (8900+ karakter)
  - Beállítási útmutató lépésről lépésre
  - Használati példák
  - Szinkronizálás a conductor/tracks.md-vel
  - Gyakori kérdések
  
- **`PROJECTS_QUICK_SETUP.md`** - Gyors telepítési útmutató (5 perc alatt kész)

### 2. Issue Template-ek

#### `.github/ISSUE_TEMPLATE/`
- **`track.md`** - Új fejlesztési track létrehozása
  - Track információk (név, ID, prioritás)
  - Célok és fázisok
  - Conductor integráció
  - Automatikus címkézés
  
- **`sprint.md`** - Sprint/fázis feladat létrehozása
  - Sprint információk és feladatlista
  - Acceptance criteria
  - Tesztelési stratégia
  - Kapcsolódó PR-ek nyomon követése
  
- **`track-bug.md`** - Bug jelentés track-en belül
  - Reprodukálási lépések
  - Környezet információk
  - Root cause analysis
  - Javítási javaslat

- **`config.yml`** - Frissítve GitHub Projects linkekkel

### 3. Automatizálás

#### `.github/workflows/`
- **`github-projects-sync.yml`** - GitHub Actions workflow
  - Automatikusan hozzáadja az új issue-kat a projekthez
  - PR nyitásakor frissíti az issue státuszt
  - PR merge-kor lezárja az issue-t
  - Label alapú automatizálás

#### `scripts/`
- **`sync_github_projects.js`** - Node.js sync script
  - Szinkronizálja a `conductor/tracks.md` fájlt GitHub Projects-el
  - Létrehozza/frissíti az issue-kat minden track-hez
  - Beállítja a megfelelő címkéket és mezőket
  - Dry-run mód teszteléshez
  - Használat: `npm run sync:projects`

- **`setup_github_labels.sh`** - Bash script (Linux/Mac)
  - Automatikusan létrehozza mind a 20 címkét
  - Ellenőrzi a gh CLI telepítését és auth-ot
  
- **`setup_github_labels.bat`** - Windows batch script
  - Ugyanaz mint a .sh, de Windows-ra

### 4. README Frissítés

- Hozzáadtam egy új szekciót: **"📊 GitHub Projects - Fejlesztés Követése"**
- Gyors linkek a projekt táblához
- npm scriptek ismertetése
- Automatizálás áttekintése

### 5. Package.json Frissítés

Új npm scriptek:
```json
"sync:projects": "node scripts/sync_github_projects.js",
"sync:projects:dry": "node scripts/sync_github_projects.js --dry-run"
```

---

## 🚀 Mit Kell Most Csinálnod? (Lépésről Lépésre)

### Lépés 1: GitHub Project Létrehozása (2 perc)

1. Menj ide: https://github.com/pohi99999/mcp-brunella-core/projects
2. Kattints: **New project**
3. Template: **Board**
4. Név: **Brunella Development Board**
5. **Create**

### Lépés 2: Custom Field-ek Beállítása (3 perc)

A projekt Settings → Fields menüjében add hozzá:

1. **Status** (Single select)
   - 📋 Backlog, 🎯 Ready, 🔄 In Progress, 👀 In Review, ✅ Done, 🚫 Blocked

2. **Priority** (Single select)
   - 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW

3. **Track** (Single select)
   - Code Quality, Gold Protocol, Agent Architect, Cloudflare Edge, Dashboard V2, Developer Agent, Phoenix Protocol, Robotkéz, Other

4. **Progress** (Number) - 0-100 százalék
5. **Track ID** (Text) - conductor track azonosító
6. **Sprint** (Text) - sprint/fázis azonosító
7. **Assignee Type** (Single select) - 👤 Human, 🤖 AI Agent, 🤝 Hybrid

### Lépés 3: Címkék Létrehozása (1 perc)

**Option A - Automatikus (ajánlott):**
```bash
# Windows:
scripts\setup_github_labels.bat

# Linux/Mac/Git Bash:
bash scripts/setup_github_labels.sh
```

**Option B - Manuális:**
Nyisd meg `.github/PROJECTS.md` és futtasd le a `gh label create` parancsokat.

### Lépés 4: Nézetek Konfigurálása (2 perc)

A projekt Settings → Views menüjében hozd létre:

1. **📊 Board View** (már létezik)
   - Group by: Status

2. **🎯 By Track** (új)
   - Type: Board
   - Group by: Track

3. **🔥 By Priority** (új)
   - Type: Table
   - Group by: Priority

### Lépés 5: Első Szinkronizálás (30 másodperc)

```bash
# Előnézet (nem ír semmit):
npm run sync:projects:dry

# Tényleges szinkronizálás (létrehozza az issue-kat):
npm run sync:projects
```

Ez automatikusan létrehozza az issue-kat minden aktív track-hez a `conductor/tracks.md` alapján!

---

## 📊 Hogyan Működik?

### Automatizálás Flow

```
1. conductor/tracks.md frissül
   ↓
2. git push
   ↓
3. npm run sync:projects (manuális vagy CI)
   ↓
4. Script létrehozza/frissíti az issue-kat
   ↓
5. GitHub Actions workflow hozzáadja őket a projekthez
   ↓
6. Issue megjelenik a Brunella Development Board-on
```

### Issue → PR → Done Flow

```
1. Issue létrehozva (pl. "New Development Track")
   ↓
2. Automatikusan "📋 Backlog" státuszban
   ↓
3. Developer elkezdi → Manuálisan "🔄 In Progress"-re húzza
   ↓
4. PR nyitás → Automatikusan "👀 In Review"
   ↓
5. PR merge → Automatikusan "✅ Done"
```

---

## 🎯 Használati Példák

### Példa 1: Új Track Indítása

```bash
# 1. Menj a GitHub-ra
https://github.com/pohi99999/mcp-brunella-core/issues/new/choose

# 2. Válaszd: "🎯 New Development Track"

# 3. Töltsd ki:
Title: [TRACK] Payment Integration
Track ID: payment_integration_20260210
Priority: HIGH
Description: Integrate Stripe payment system

# 4. Add hozzá a címkéket:
- track:payment (vagy legközelebbi)
- priority:high
- agent:gemini (ha AI ügynök dolgozik rajta)

# 5. Create issue

# 6. Issue automatikusan megjelenik a projektben!
```

### Példa 2: Progress Frissítés

```bash
# 1. Frissítsd a conductor/tracks.md-t
- [ ] **Payment Integration** [HIGH]
  - **Progress:** 60% (3/5 feladat kész)  # ← FRISSÍTSD

# 2. Commit & push
git add conductor/tracks.md
git commit -m "docs: update payment integration progress"
git push

# 3. Szinkronizáld
npm run sync:projects

# 4. Script automatikusan frissíti az issue progress mezőt és comment-et ír
```

### Példa 3: Track Nézetek

**Board View:** Kanban stílusú tábla státusz szerint
```
📋 Backlog  |  🔄 In Progress  |  ✅ Done
-----------    ---------------    --------
Issue #123  |  Issue #124     |  Issue #125
Issue #126  |                 |  Issue #127
```

**By Track View:** Track-ek szerint csoportosítva
```
Gold Protocol  |  Dashboard V2  |  Developer Agent
--------------    ------------    ---------------
Issue #123     |  Issue #125  |  Issue #127
Issue #124     |  Issue #126  |
```

---

## 🔗 Hasznos Linkek

### Dokumentáció
- **[PROJECTS_QUICK_SETUP.md](.github/PROJECTS_QUICK_SETUP.md)** - Gyors indítás (5 perc)
- **[PROJECTS.md](.github/PROJECTS.md)** - Teljes útmutató magyarul
- **[projects/README.md](.github/projects/README.md)** - Technikai dokumentáció

### GitHub
- **Projekt Tábla**: https://github.com/pohi99999/mcp-brunella-core/projects
- **Issue Templates**: https://github.com/pohi99999/mcp-brunella-core/issues/new/choose
- **Labels**: https://github.com/pohi99999/mcp-brunella-core/labels

### Scripts
- `npm run sync:projects` - Szinkronizálás
- `npm run sync:projects:dry` - Dry-run teszt
- `scripts/setup_github_labels.sh` - Címkék létrehozása (bash)
- `scripts/setup_github_labels.bat` - Címkék létrehozása (Windows)

---

## ✅ Ellenőrző Lista

Használd ezt a listát a beállításhoz:

- [ ] GitHub Project létrehozva ("Brunella Development Board")
- [ ] Custom field-ek beállítva (Status, Priority, Track, Progress, Track ID, Sprint, Assignee Type)
- [ ] Címkék létrehozva (futtattam `setup_github_labels.sh/bat`)
- [ ] Nézetek konfigurálva (Board View, By Track, By Priority)
- [ ] Sync script tesztelve (`npm run sync:projects:dry`)
- [ ] Első szinkronizálás lefutott (`npm run sync:projects`)
- [ ] Issue-k megjelennek a projekt táblán
- [ ] Első teszt issue létrehozva template-ből
- [ ] Elolvastam a PROJECTS.md útmutatót

---

## 🎉 Kész!

Most már:
- ✅ Követheted a Brunella fejlesztést GitHub Projects-en
- ✅ Automatikusan szinkronizálódik a conductor/tracks.md
- ✅ Issue template-ek segítik a track létrehozást
- ✅ GitHub Actions automatizálja a státusz frissítéseket
- ✅ Vizuális board-on látod az összes munkát

**Következő lépés:** Olvasd el a `.github/PROJECTS.md` fájlt a részletes használati útmutatóért!

---

**Készítette:** GitHub Copilot
**Dátum:** 2026-02-10
**Verzió:** 1.0
