# GitHub Projects Útmutató - Brunella Rendszer Követése

## 📋 Tartalom

1. [Áttekintés](#áttekintés)
2. [Beállítás](#beállítás)
3. [Használat](#használat)
4. [Automatizálás](#automatizálás)
5. [Szinkronizálás a Conductor-ral](#szinkronizálás-a-conductor-ral)
6. [Gyakori Kérdések](#gyakori-kérdések)

---

## Áttekintés

A Brunella Agent System (BAS) fejlesztését GitHub Projects segítségével követjük nyomon. Ez az útmutató megmutatja, hogyan használd a projekt táblát a fejlesztés követésére.

### Miért GitHub Projects?

- ✅ **Központosított követés**: Minden munka egy helyen látható
- ✅ **Automatizálás**: Issue-k és PR-ok automatikusan frissülnek
- ✅ **Szinkronizálás**: Összekapcsolódik a `conductor/tracks.md` fájllal
- ✅ **AI Integráció**: AI ügynökök is használhatják
- ✅ **Vizualizáció**: Különböző nézetek a jobb átláthatóságért

---

## Beállítás

### 1. GitHub Project Létrehozása

A projekt tulajdonos (te) létrehozhatja a projekt táblát:

1. Menj a repository-hoz: https://github.com/pohi99999/mcp-brunella-core
2. Kattints a **Projects** tabra
3. Kattints **New project**
4. Válaszd: **Board** template
5. Nevezd el: **Brunella Development Board**
6. Kattints **Create**

### 2. Mezők Beállítása

Adj hozzá egyedi mezőket a projekthez:

#### Status (Állapot)
- 📋 Backlog
- 🎯 Ready
- 🔄 In Progress
- 👀 In Review
- ✅ Done
- 🚫 Blocked

#### Priority (Prioritás)
- 🔴 CRITICAL
- 🟠 HIGH
- 🟡 MEDIUM
- 🟢 LOW

#### Track (Fejlesztési Szál)
- Code Quality
- Gold Protocol
- Agent Architect
- Cloudflare Edge
- Dashboard V2
- Developer Agent
- Phoenix Protocol
- Robotkéz
- Other

#### További Mezők
- **Progress**: Szám (0-100) - befejezettség százalékban
- **Track ID**: Szöveg - conductor track azonosító
- **Sprint**: Szöveg - sprint/fázis azonosító
- **Assignee Type**: 👤 Human / 🤖 AI Agent / 🤝 Hybrid

### 3. Nézetek Létrehozása

Hozz létre különböző nézeteket:

1. **📊 Board View** (alapértelmezett)
   - Type: Board
   - Group by: Status
   - Sort by: Priority

2. **🎯 By Track**
   - Type: Board
   - Group by: Track
   - Sort by: Priority

3. **🔥 By Priority**
   - Type: Table
   - Group by: Priority
   - Sort by: Status

4. **✅ Completed**
   - Type: Table
   - Filter: Status = Done
   - Sort by: Updated (desc)

5. **🤖 AI Agent Work**
   - Type: Table
   - Filter: Assignee Type = AI Agent
   - Sort by: Status

### 4. Címkék (Labels) Létrehozása

Futtasd ezt a scriptet a címkék létrehozásához:

```bash
# Track labels
gh label create "track:code-quality" --color 0E8A16 --description "Code quality improvements"
gh label create "track:gold-protocol" --color FFD700 --description "Gold Protocol implementation"
gh label create "track:agent-architect" --color 1D76DB --description "Agent architecture"
gh label create "track:cloudflare" --color F38020 --description "Cloudflare integration"
gh label create "track:dashboard" --color 5319E7 --description "Dashboard development"
gh label create "track:developer-agent" --color 0052CC --description "Developer agent"
gh label create "track:phoenix-protocol" --color D93F0B --description "Phoenix Protocol"
gh label create "track:robotkez" --color C5DEF5 --description "Robotkéz features"

# Priority labels
gh label create "priority:critical" --color B60205 --description "Critical priority"
gh label create "priority:high" --color D93F0B --description "High priority"
gh label create "priority:medium" --color FBCA04 --description "Medium priority"
gh label create "priority:low" --color 0E8A16 --description "Low priority"

# Agent labels
gh label create "agent:claude" --color 7057FF --description "Work by Claude"
gh label create "agent:gemini" --color 4285F4 --description "Work by Gemini"
gh label create "agent:copilot" --color 000000 --description "Work by Copilot"
gh label create "agent:jules" --color 00D4AA --description "Work by Jules"
```

---

## Használat

### Új Track Létrehozása

1. **Menj a repository-hoz** → Issues → New issue
2. **Válaszd**: "🎯 New Development Track" template
3. **Töltsd ki** az alábbi adatokat:
   - Track Name
   - Track ID (formátum: `name_YYYYMMDD`)
   - Priority
   - Description
   - Goals (célok)
   - Phases (fázisok)
4. **Add hozzá a címkéket**:
   - Track category (pl. `track:dashboard`)
   - Priority (pl. `priority:high`)
   - Agent (pl. `agent:gemini`)
5. **Create issue**

A GitHub Actions automatikusan hozzáadja a projekt táblához!

### Sprint/Fázis Létrehozása

1. **New issue** → "🏃 Sprint/Phase Task" template
2. **Link a parent track-hez**: Hivatkozz a fő track issue-ra
3. **Feladatok listája**: Részletezd a konkrét feladatokat
4. **Create issue**

### Bug Jelentése

1. **New issue** → "🐛 Track Bug/Issue" template
2. **Töltsd ki** a reprodukálási lépéseket
3. **Add hozzá** a címkéket és prioritást
4. **Create issue**

### Issue Frissítése

#### Manuális Frissítés
1. Menj a **Projects** tabra
2. Nyisd meg a **Brunella Development Board**-ot
3. **Húzd** az issue-t az új oszlopba
4. **Kattints** az issue-ra és frissítsd a mezőket

#### Automatikus Frissítés
- **PR nyitása** → Status: "👀 In Review"
- **PR merge** → Status: "✅ Done"
- **"blocked" label** → Status: "🚫 Blocked"

### Progress (Előrehaladás) Frissítése

Az issue kommentjében:

```markdown
## Progress Update - 2026-02-10

**Completed:**
- [x] Task 1: Implemented feature X
- [x] Task 2: Added tests

**In Progress:**
- [ ] Task 3: Working on integration (60% done)

**Blocked:**
- [ ] Task 4: Waiting for PR #123 to be merged

**Overall Progress: 60%**
```

Frissítsd a **Progress** mezőt a projektben is (0-100).

---

## Automatizálás

### GitHub Actions Workflow

A `.github/workflows/github-projects-sync.yml` automatikusan:

1. **Új issue** → Hozzáadja a projekthez Backlog állapotban
2. **PR nyitás** → Issue státusz frissítés "In Review"-ra
3. **PR merge** → Issue státusz frissítés "Done"-ra
4. **Label változás** → Mezők frissítése

### Conductor Sync Script

A `scripts/sync_github_projects.js` szinkronizálja a conductor/tracks.md fájlt:

```bash
# Futtasd a szinkronizálást
node scripts/sync_github_projects.js

# Vagy npm script-tel
npm run sync:projects
```

**Mit csinál:**
1. Beolvassa `conductor/tracks.md`-t
2. Minden track-hez keres/létrehoz issue-t
3. Frissíti a progress, priority, status mezőket
4. Szinkronizálja a címkéket

---

## Szinkronizálás a Conductor-ral

### conductor/tracks.md → GitHub Projects

**Automatikus** (push után):
```bash
git add conductor/tracks.md
git commit -m "docs: update track progress"
git push
# → GitHub Action fut és szinkronizál
```

**Manuális**:
```bash
node scripts/sync_github_projects.js
```

### GitHub Projects → conductor/tracks.md

**Manuális frissítés szükséges!** Amikor:
- Issue-t lezársz
- Track status változik
- Fázis befejeződik

Lépések:
1. Frissítsd `conductor/tracks.md` fájlt az aktuális állapottal
2. Commit és push
3. A sync script automatikusan fut

**Példa frissítés:**

```markdown
# conductor/tracks.md

- [x] **Code Quality Improvements** [MEDIUM]
  - **Progress:** 100% (8/8 feladat KÉSZ! 🎉)  # ← FRISSÍTSD
  - **Utolsó aktivitás:** 2026-02-10  # ← FRISSÍTSD
```

---

## Gyakori Kérdések

### Hogyan látom az összes track-et?

1. Menj a **Projects** tabra
2. Válaszd a **Brunella Development Board**-ot
3. Használd a **🎯 By Track** nézetet

### Hogyan követem az AI agent munkát?

Használd a **🤖 AI Agent Work** nézetet vagy szűrj `agent:*` címkékre.

### Mi a különbség Issue és PR között a projektben?

- **Issue**: Munka tervezés, follow-up, discussion
- **PR**: Konkrét kód változás, review, merge
- Mindkettő megjelenik a projektben!

### Hogyan jelölöm blokkolt munkát?

1. Add hozzá a `blocked` címkét az issue-hoz
2. Írj kommentet a blokkról
3. A status automatikusan "🚫 Blocked"-ra változik

### Mikor frissítsem a conductor/tracks.md-t?

- Sprint/fázis befejezésekor
- Track státusz változásakor (In Progress → Done)
- Progress jelentős változásakor (pl. 50% → 100%)
- Heti rendszerességgel minimálisan

### Használhatom a projektet CI/CD-ből?

Igen! GitHub Actions-ből elérhető:

```yaml
- name: Update project
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    node scripts/sync_github_projects.js
```

### Mit jelent a Track ID?

A `conductor/tracks/<track_id>` mappa neve. Formátum:
- `feature_name_YYYYMMDD`
- Példa: `code_quality_improvements_20260210`

### Hogyan adom át a munkát másik ügynöknek?

1. Frissítsd az issue **Assignee Type** mezőt
2. Add hozzá az új agent címkét (pl. `agent:claude`)
3. Írj kommentet az átadásról
4. Távolítsd el a régi agent címkét

---

## További Linkek

- [GitHub Projects Dokumentáció](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [.github/projects/README.md](.github/projects/README.md) - Technikai dokumentáció
- [conductor/tracks.md](conductor/tracks.md) - Aktív track-ek
- [conductor/workflow.md](conductor/workflow.md) - BAS workflow

---

**Utolsó frissítés:** 2026-02-10
**Karbantartó:** Brunella Team
