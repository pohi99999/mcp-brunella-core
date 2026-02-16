# 🐙 GitHub Cheat Sheet - Egyszerűen, Magyarul

> **Célközönség:** Nem-programozók, akik GitHub-ot használnak AI ügynökökkel
> **Nyelv:** Magyar, ZERO szakszó, mindent elmagyarázva
> **Frissítve:** 2026-02-16

---

## 📚 Mi az a Git / GitHub? (5 perc bevezetés)

### Git = Időgép a kódodnak

Képzeld el hogy **Word-ben írsz**, de:
- Minden mentés után **látsz egy visszavonás gombot** ("undo" a múltba)
- **Több ember dolgozhat** ugyanazon a dokumentumon
- **Látod ki mit változtatott** és mikor
- **Biztonságos másolat** van minden módosításról

**Git = Ez a "visszavonás gomb" rendszer a kódnak.**

### GitHub = Felhős tárhely a Git projekteknek

- **Git** = Helyi gépen (F:\mcp-brunella-core)
- **GitHub** = Felhőben (github.com/username/repo)

**GitHub = Dropbox a kódnak** (de okosabb!)

---

## 🗂️ Alapfogalmak (szakszavak nélkül)

### 1. Repository (Repo) = Projekt mappa

**Mi ez?** Egy mappád (pl. `F:\mcp-brunella-core`) amit Git figyel.

**Példa:**
```
F:\mcp-brunella-core\        ← EZ A REPO!
├── src/                     ← kód
├── docs/                    ← doksik
├── .git/                    ← Git "adatbázisa" (ne nyúlj hozzá!)
└── README.md
```

**GitHub-on:** `https://github.com/username/mcp-brunella-core`

---

### 2. Commit = Mentés (snapshot)

**Mi ez?** Egy "pillanatkép" a projektről egy adott időpontban.

**Hasonlat:**
- Word: File → Save
- Git: File → Commit (de ez okosabb: látod MI változott)

**Példa commit üzenet:**
```
fix: Conductor hiba javítása

- ProjectConductorAgent defensive programming
- 7 helyen javítva
```

**Mit tartalmaz egy commit?**
- Ki csinálta? (név + email)
- Mikor? (időbélyeg)
- Mit? (változtatások listája)
- Miért? (commit üzenet)

---

### 3. Branch = Párhuzamos munka ág

**Mi ez?** Egy "másolat" ahol BIZTONSÁGOSAN kísérletezhetsz anélkül hogy elrontanád a főprojektet.

**Hasonlat:**
Képzeld el hogy van egy **fő útvonal** (main branch), és csinálsz egy **kerülőutat** (feature branch):

```
main:     A ─── B ─── C ─── D ─── E ─── F ─── G
                      │
feature:              └─── X ─── Y ─── Z
```

- **main** = Működő, stabil verzió (MINDIG MŰKÖDJÖN!)
- **feature** = Kísérleti ág (itt dolgozhatsz bátran, ha elrontod, törlöd)

**Mikor X-Y-Z készen van:**
- **Merge** (összefűzés): Beolvasztod a feature-t a main-be
- Eredmény: `A-B-C-D-E-F-G-X-Y-Z` (most már main-ben is benne van!)

---

### 4. Pull = Letöltés (GitHub → Helyi gép)

**Mi ez?** Lehúzod a legfrissebb változtatásokat GitHub-ról a gépedre.

**Mikor kell?**
- **Reggel** munkakezdés előtt (más dolgozott éjjel? Jules AI, Gemini?)
- **Pull Request merge után** (valaki betolt valamit GitHub-ra)

**Parancs:**
```bash
git pull origin main
```

**Mit csinál?**
```
GitHub (felhő):     A ─── B ─── C ─── D ─── E
                                        ↓
Helyi gép:          A ─── B ─── C ────→ (pull) ────→ D ─── E
```

---

### 5. Push = Feltöltés (Helyi gép → GitHub)

**Mi ez?** Feltolod a helyi commitjaidat GitHub-ra (mások is látják).

**Mikor kell?**
- **Munkamenet végén** (bezárás előtt)
- **Fontos milestone után** (nagy feature kész)

**Parancs:**
```bash
git push origin main
```

**Mit csinál?**
```
Helyi gép:          A ─── B ─── C ─── D ─── E
                                        ↓
GitHub (felhő):     A ─── B ─── C ────→ (push) ────→ D ─── E
```

---

### 6. Pull Request (PR) = Kérés: "Kérlek egyesítsd a munkámat!"

**Mi ez?** Amikor befejezted a feature branch-edet és kéred hogy valaki (vagy te magad) nézze át és merge-elje a main-be.

**Hasonlat:**
- **Word:** "Kérem ellenőrizze a dokumentumot mielőtt véglegesíti"
- **Git:** "Kérem nézze át a kódot mielőtt a main-be kerül"

**Folyamat:**
1. Dolgozol egy feature branch-en (pl. `fix-conductor`)
2. Push-olod GitHub-ra
3. GitHub-on nyitsz egy **Pull Request**-et:
   - Cím: "Fix Conductor defensive programming"
   - Leírás: Mit csináltál, miért, hogyan teszteltél
4. Mások (vagy Jules AI) review-olja
5. Ha OK → **Merge** (beolvasztás a main-be)
6. A branch törölhető

**GitHub URL példa:**
```
https://github.com/username/repo/pull/42
```

---

### 7. Merge = Összefűzés (2 branch egyesítése)

**Mi ez?** Két branch tartalmának egyesítése.

**Példa:**
```
main:     A ─── B ─── C ─────────────── M (merge)
                      │                 │
feature:              └─── X ─── Y ─── Z
```

**Eredmény:** main most tartalmazza X-Y-Z változtatásait is!

**Típusok:**
- **Fast-forward merge:** Egyszerű (nincs konfliktus)
- **3-way merge:** Intelligens összefűzés (ha mindkét ágon volt munka)
- **Merge conflict:** Konfliktus (ugyanazt a sort mindkét ágon módosították)

---

### 8. Conflict = Ütközés (Git nem tudja hogy melyik a jó)

**Mi ez?** Amikor 2 ember ugyanazt a sort változtatta meg MÁSKÉPP.

**Példa:**

**main branch:**
```typescript
const name = "Claude";
```

**feature branch:**
```typescript
const name = "Gemini";
```

**Merge után → CONFLICT! 💥**

Git így jelzi:
```typescript
<<<<<<< HEAD (main)
const name = "Claude";
=======
const name = "Gemini";
>>>>>>> feature
```

**Megoldás (manuálisan):**
1. Döntsd el melyik a helyes (vagy kombináld)
2. Töröld a `<<<`, `===`, `>>>` markereket
3. Commit-old a javítást

**Végeredmény:**
```typescript
const name = "Brunella"; // Döntöttél: egyik sem, hanem harmadik :)
```

---

## 🚀 Gyakori Műveletek (lépésről lépésre)

### 1. Reggel: Szinkronizálás (Pull)

**Cél:** Lehúzod mások (Jules, Gemini) éjszakai munkáját.

```bash
cd F:\mcp-brunella-core
git pull origin main
```

**Ha nincs konfliktus:** ✅ Kész!
**Ha van konfliktus:** 🔧 Lásd "Conflict kezelés" lent.

---

### 2. Munkaidő: Commit gyakran!

**Cél:** Minden nagyobb lépés után mentés (commit).

**Workflow:**
```bash
# 1. Nézd meg mi változott
git status

# 2. Add hozzá a fájlokat (staging)
git add .                        # Minden módosított fájl
git add src/agents/*.ts          # Csak egy mappa

# 3. Commit (mentés) üzenettel
git commit -m "fix: Conductor stabilizálás"

# 4. (Opcionális) Push GitHub-ra
git push origin main
```

**Commit üzenet sablon:**
```
<típus>: <rövid leírás>

<hosszabb magyarázat ha kell>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Típusok:**
- `feat`: Új funkció
- `fix`: Hibajavítás
- `docs`: Dokumentáció
- `refactor`: Kód átírás (működés nem változik)
- `test`: Tesztek hozzáadása

---

### 3. Este: Push GitHub-ra

**Cél:** Mások is lássák a munkádat (backup + sync).

```bash
# 1. Pull (hátha más is dolgozott közben)
git pull origin main

# 2. Ha volt konfliktus → javítsd
# (Lásd "Conflict kezelés")

# 3. Push
git push origin main
```

**Sikeres push:**
```
Enumerating objects: 15, done.
Counting objects: 100% (15/15), done.
Delta compression using up to 8 threads
Compressing objects: 100% (8/8), done.
Writing objects: 100% (9/9), 1.2 KiB | 1.2 MiB/s, done.
Total 9 (delta 6), reused 0 (delta 0)
To https://github.com/username/repo.git
   a1b2c3d..e4f5g6h  main -> main
```

---

### 4. Branch készítés (Kísérleti munka)

**Cél:** Biztonságos munka anélkül hogy elrontanád a main-t.

```bash
# 1. Új branch készítés
git checkout -b feature-name

# Példa:
git checkout -b fix-conductor-bug

# 2. Dolgozz rajta (commit-ok)
git add .
git commit -m "wip: conductor javítás folyamatban"

# 3. Push GitHub-ra (hogy mások is lássák)
git push origin fix-conductor-bug

# 4. Amikor kész → Pull Request GitHub-on
# (Lásd "Pull Request" lent)

# 5. Merge után visszaváltás main-re
git checkout main
git pull origin main

# 6. Branch törlése (ha már merge-elve)
git branch -d fix-conductor-bug
```

---

### 5. Pull Request (PR) készítés GitHub-on

**Lépések:**

1. **Push-old a branch-edet:**
   ```bash
   git push origin feature-name
   ```

2. **Menj GitHub-ra:**
   ```
   https://github.com/username/repo
   ```

3. **"Compare & pull request" gomb** megjelenik → Kattints rá

4. **Töltsd ki a PR formot:**
   - **Title:** `fix: Conductor defensive programming`
   - **Description:**
     ```markdown
     ## Changes
     - Added defensive programming to ProjectConductorAgent
     - Fixed 7 undefined field crashes

     ## Testing
     - ✅ brunella conductor status works
     - ✅ All tests pass

     ## Related Issue
     - Fixes #42
     ```

5. **"Create pull request" gomb** → Kész!

6. **Review várakozás** (vagy instant merge ha te vagy a review-er)

7. **Merge:**
   - **Squash and merge** (ajánlott) - Összes commit → 1 commit
   - **Merge commit** - Megtartja az összes commit-ot
   - **Rebase and merge** - "Átírja a történelmet" (haladó)

---

## ⚠️ Gyakori Hibák & Megoldások

### 1. "Pull kell de uncommitted változások vannak"

**Hiba:**
```
error: Your local changes to the following files would be overwritten by merge:
	src/agents/SomeAgent.ts
Please commit your changes or stash them before you merge.
```

**Megoldás A (Commit):**
```bash
git add .
git commit -m "wip: munka folyamatban"
git pull origin main
```

**Megoldás B (Stash - Ideiglenes elrakás):**
```bash
git stash                  # Változások "elrakása"
git pull origin main       # Pull
git stash pop              # Változások visszaállítása
```

---

### 2. "Merge Conflict" - Mit csináljak?

**Hiba:**
```
Auto-merging src/agents/Agent.ts
CONFLICT (content): Merge conflict in src/agents/Agent.ts
Automatic merge failed; fix conflicts and then commit the result.
```

**Lépések:**

1. **Nyisd meg a konfliktus fájlt** (VS Code-ban látod piros jelöléssel)

2. **Lásd a markereket:**
   ```typescript
   <<<<<<< HEAD (a te változtatásod)
   const version = "2.0";
   =======
   const version = "1.5";
   >>>>>>> main (GitHub változtatás)
   ```

3. **Döntsd el melyik a helyes** (vagy írd át):
   ```typescript
   const version = "2.0"; // Megtartod a tiédet
   ```

4. **Töröld a markereket** (`<<<`, `===`, `>>>`)

5. **Commit:**
   ```bash
   git add src/agents/Agent.ts
   git commit -m "fix: merge conflict resolved"
   ```

---

### 3. "Elfelejtettem commit-olni és push-oltam"

**Hiba:**
```
error: failed to push some refs to 'https://github.com/...'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally.
```

**Megoldás:**
```bash
# 1. Pull először
git pull origin main

# 2. Ha van konfliktus → javítsd (lásd fent)

# 3. Commit
git add .
git commit -m "merge: pulled remote changes"

# 4. Push
git push origin main
```

---

### 4. "Véletlen rossz branch-re commit-oltam"

**Helyzet:**
```bash
# Akarva:
git checkout feature-branch
git commit -m "új funkció"

# Valóság:
# (main-en voltál, oda commit-oltál!)
```

**Megoldás (Commit áthelyezés):**
```bash
# 1. Nézd meg a commit hash-t
git log -1
# commit abc123def456... (ez a hibás commit)

# 2. Menj a helyes branch-re
git checkout feature-branch

# 3. Cherry-pick (átmásol egy commit-ot)
git cherry-pick abc123def456

# 4. Vissza main-re és commit törlése
git checkout main
git reset --hard HEAD~1   # Utolsó commit törlése
```

**⚠️ VIGYÁZAT:** `git reset --hard` TÖRLI a változtatásokat! Csak ha már cherry-pick-elted!

---

### 5. ".gitignore nem működik" - Miért trackeli a fájlt?

**Helyzet:**
```bash
# .gitignore-ban:
.env
node_modules/

# De git status még mindig mutatja:
modified:   .env
```

**Ok:** A fájl **már be volt commit-olva korábban!** A .gitignore csak **ÚJ** fájlokra működik.

**Megoldás:**
```bash
# 1. Unstage (kivesz a Git követésből)
git rm --cached .env
git rm --cached -r node_modules/

# 2. Commit
git commit -m "chore: remove tracked ignored files"

# 3. Most már .gitignore működik!
```

---

## 🎯 Napi Workflow (Ajánlott)

### REGGEL (Munkakezdés)

```bash
cd F:\mcp-brunella-core

# 1. Sync (Pull)
git pull origin main

# 2. Ha konfliktus → javítsd

# 3. Ellenőrizd státuszt
git status

# 4. Kezdj dolgozni!
```

---

### KÖZBEN (Munkaidő)

```bash
# Minden 30-60 percben vagy nagyobb lépés után:

git add .
git commit -m "wip: feature XYZ - step 1"

# Opcionális: Push (backup)
git push origin main
```

---

### ESTE (Munkavég)

```bash
# 1. Utolsó commit (ha van uncommitted változás)
git add .
git commit -m "feat: feature XYZ complete"

# 2. Pull (hátha más is dolgozott)
git pull origin main

# 3. Push (végső backup)
git push origin main

# 4. Státusz ellenőrzés (tiszta?)
git status
# "nothing to commit, working tree clean" ← JÓ!
```

---

## 🔧 Hasznos Parancsok (Cheat Sheet)

| Parancs | Mit csinál? | Mikor használd? |
|---------|-------------|-----------------|
| `git status` | Mutatja mi változott | GYAKRAN! Munka előtt/közben/után |
| `git log` | Commit history | Visszanézel mit csináltál |
| `git log --oneline` | Rövid commit lista | Gyors áttekintés |
| `git diff` | Mutatja a változásokat | Commit előtt ellenőrzés |
| `git diff HEAD~1` | Előző commit óta mi változott | Visszaellenőrzés |
| `git branch` | Branch lista | Melyik branch-en vagy? |
| `git branch -a` | Összes branch (local+remote) | Mi van GitHub-on? |
| `git checkout main` | Váltás main branch-re | Visszatérés főágra |
| `git checkout -b new` | Új branch készítés + váltás | Új feature kezdés |
| `git pull origin main` | Letöltés GitHub-ról | Reggel sync |
| `git push origin main` | Feltöltés GitHub-ra | Este backup |
| `git stash` | Ideiglenes elrakás | Pull előtt ha uncommitted van |
| `git stash pop` | Stash visszaállítás | Pull után |
| `git reset --soft HEAD~1` | Utolsó commit visszavonás (változások megmaradnak) | Rossz commit üzenet |
| `git reset --hard HEAD~1` | Utolsó commit TÖRLÉS (változások is!) | ⚠️ VESZÉLYES! |
| `git clean -fd` | Unstaged fájlok törlése | ⚠️ VESZÉLYES! |

---

## 🆘 Vészhelyzet: "Elrontottam mindent!"

### Helyzet 1: "Commit-oltam valamit amit NEM akartam"

```bash
# Utolsó commit visszavonása (változások megmaradnak)
git reset --soft HEAD~1

# Most szerkeszd át a fájlokat
# Majd commit újra:
git add .
git commit -m "helyes commit üzenet"
```

---

### Helyzet 2: "Push-oltam valamit rossz branch-re"

**Ha még SENKI nem pull-olta le:**

```bash
# Vissza 1 commit-tal (VESZÉLYES!)
git reset --hard HEAD~1
git push origin main --force

# ⚠️ CSAK akkor ha biztos vagy hogy senki nem dolgozik rajta!
```

**Ha MÁR MÁSOK IS LEHÚZTÁK:** Nem tudod visszavonni! Csinálj egy új commit-ot ami javítja!

---

### Helyzet 3: "Merge conflict és nem tudom megoldani"

**Abortálás (újrakezdés):**

```bash
# Merge abortálás (visszatér az előző állapotba)
git merge --abort

# VAGY rebase abortálás
git rebase --abort

# Kezdd elölről, nyugodtan
```

---

### Helyzet 4: "Mindent elrontottam, szeretném az eredeti állapotot"

**⚠️ EZ TÖRLI AZ ÖSSZES HELYI VÁLTOZTATÁST!**

```bash
# 1. Nézd meg van-e commit-olatlan munka (MENTSD EL!)
git status

# 2. Stash (ha kell)
git stash

# 3. Hard reset GitHub main-re
git fetch origin
git reset --hard origin/main

# Most PONTOSAN UGYANAZ mint GitHub main-ben!
```

---

## 📖 GitHub Web Interface (Böngészőben)

### 1. Repository nézet

```
https://github.com/username/mcp-brunella-core
```

**Fő elemek:**
- **Code tab:** Fájlok böngészése
- **Issues tab:** Hibák / feladatok nyilvántartása
- **Pull requests tab:** PR-ek listája
- **Actions tab:** CI/CD automata futások
- **Settings tab:** Repo beállítások

---

### 2. Fájl szerkesztés böngészőben

1. Nyisd meg a fájlt (pl. `README.md`)
2. Kattints a **✏️ (ceruza)** ikonra
3. Szerkeszd
4. Lent:
   - **Commit message:** `docs: update README`
   - **Commit directly to main** VAGY **Create a new branch**
5. **Commit changes**

---

### 3. Issue létrehozás

1. **Issues tab** → **New issue**
2. **Title:** `Bug: Conductor crashes on empty state`
3. **Description:**
   ```markdown
   ## Description
   Conductor status parancs crashel ha nincs recentChanges.

   ## Steps to Reproduce
   1. Run `brunella conductor status`
   2. See error

   ## Expected
   Should show "unknown" instead of crash

   ## Environment
   - OS: Windows 11
   - Node: 20.10.0
   ```
4. **Submit new issue**

---

### 4. Pull Request review

**Ha valaki (Jules AI) nyitott egy PR-t:**

1. **Pull requests tab** → Kattints a PR-re
2. **Files changed tab** → Lásd a változásokat
3. **Review changes gomb:**
   - **Comment:** Csak komment
   - **Approve:** Jóváhagyod
   - **Request changes:** Változtatást kérsz
4. Ha approved → **Merge pull request**

---

## 🎓 Következő Lépések (Haladó témák)

Ha már kényelmes vagy a fentiekkel:

1. **Git Rebase** - Történelem "átírása" (haladó)
2. **Git Hooks** - Automatikus futtatás commit előtt/után
3. **GitHub Actions** - CI/CD automatizálás
4. **Git Submodules** - Repo a repo-ban
5. **Git Tags** - Verziók jelölése (v1.0.0, v2.0.0)

---

## 📚 További Segítség

### Hivatalos GitHub Dokumentáció
- https://docs.github.com/en/get-started

### Interaktív Git Tutorial
- https://learngitbranching.js.org/ (vizuális!)

### Git Cheat Sheet (Angol)
- https://education.github.com/git-cheat-sheet-education.pdf

### Stack Overflow (Ha elakadtál)
- https://stackoverflow.com/questions/tagged/git

---

## ✅ Összefoglalás (30 másodperc)

**Git = Időgép a kódnak**

**Alapműveletek:**
1. `git pull` - Reggel (sync)
2. `git add .` + `git commit -m "..."` - Közben (mentés)
3. `git push` - Este (backup)

**Ha baj van:**
1. `git status` - Mi a helyzet?
2. `git stash` - Ideiglenes elrakás
3. `git merge --abort` - Merge megszakítás
4. `git reset --hard origin/main` - ⚠️ Végső megoldás (VESZÉLYES!)

**Segítség:**
- `git --help` - Minden parancs súgója
- Stack Overflow - Google: "git <problem>"
- GitHub Docs - https://docs.github.com

---

**Készítette:** Claude Sonnet 4.5
**Projekt:** Brunella Agent System
**Verzió:** 1.0.0
**Dátum:** 2026-02-16

**Használd egészséggel! 🚀**
