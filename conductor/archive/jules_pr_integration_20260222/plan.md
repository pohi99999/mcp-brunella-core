# Jules PR Integration Track — Végrehajtási Terv

**Track:** `jules_pr_integration_20260222`
**Cél:** 30 Jules GitHub PR beépítése 4 fázisban, 2 nap alatt

## 2026-04-01 — Archiválási megjegyzés

Ez a track 2026-04-01-én **lezárva és archiválva** lett.

Archiválási ok:

- a releváns Jules-elemek döntő része már a fő kódbázisban van,
- nem maradt nyitott, kötelezően feldolgozandó Jules PR a repositoryban,
- a megmaradt régi Jules-anyagok nagy része duplikált, történeti vagy session-artifakt jellegű volt.

Végső döntés:

- **ne nyissuk újra automatikusan** ezt a tracket régi Jules-masszák miatt,
- csak külön, konkrét üzleti vagy technikai indok esetén érdemes egy-egy Jules-változást újra elővenni,
- a track lezárásával együtt a régi `.jules_audit_tmp/` és `.tmp_jules_extract/` tartalmakat a repo-ból eltávolítottuk és ignore-oltuk.

## 2026-04-01 — Kurációs megjegyzés

Ez a terv részben történeti snapshot. A jelenlegi kódbázis alapján több Jules-változás **már integrálva van**, ezért ezeket nem szabad újra vakon merge-elni:

- már bent van a **FastAPI silent restart** vonal (`src/services/fastApiService.ts`, `src/server/web.ts`)
- már bent van a **cron-parser / next run** logika (`src/core/scheduledTasksEngine.ts`)
- már bent van a **permission denial audit** (`src/agents/permissions.ts`, `src/tools/toolPermissions.ts`)
- már bent van a **Jules API + mock fallback** (`src/core/julesMock.ts`)
- már bent van a **GitHubModelsAgent tool loop** (`src/agents/GitHubModelsAgent.ts`, `src/server/toolRegistry.ts`)
- már bent van a **pull_requests SQLite tracking** (`src/utils/db.ts`)

### Amit érdemes MOSTANTÓL így kezelni

- **KEEP / review-only:** csak azokat a Jules PR-eket érdemes újra elővenni, amelyek ma is mérhető javulást hoznak és nem duplikálják a jelenlegi rendszert.
- **SKIP / obsolete:** régi, már kiváltott vagy konfliktusos PR-eket ne merge-eljünk csak azért, mert szerepelnek ebben a tervben.
- **IGNORE session artifacts:** a `.jules_audit_tmp/` és `.tmp_jules_extract/` könyvtárak nem termék-kódok, hanem régi Jules kiexportált session-artifaktok; ezeket a repo-ból eltávolítottuk és `.gitignore` alá tettük.

### Jelenlegi ajánlás

1. **Ne nyúljunk újra** a már beépült Phase 1/2 elemekhez.
2. **Csak cherry-pick / review alapon** nézzük át az esetleges maradék hasznos PR-eket.
3. **Skip/close** minden olyan Jules-anyagot, ami:
   - régi workaroundot tartalmaz egy már javított problémára,
   - idegen / nem Brunella-fókuszú területet érint,
   - vagy csak lokális session extract / prompt-massaging maradvány.

---

## Általános Szabályok

```bash
# MINDEN merge előtt KÖTELEZŐ:
npm run build   # 0 TypeScript hiba
npm test        # 100% PASS

# Merge parancs (squash = tiszta git history):
gh pr merge <NUM> --squash --delete-branch
```

---

## PHASE 1 — Reliability (MA, ~2-3 óra)

**Cél:** A rendszer öngyógyító képessége — ha valami meghal, újraindul magától.

### PR #94 — Ollama Silent Restart

```bash
gh pr checkout 94
npm run build && npm test
# Ha PASS:
gh pr merge 94 --squash --delete-branch
```

**Mit csinál:** `SystemController` + `HeartbeatMonitor` figyeli az Ollamát, hiba esetén újraindítja.
**Kockázat:** ALACSONY — csak monitoring logika.

---

### PR #92 — FastAPI Silent Restart

```bash
gh pr checkout 92
npm run build && npm test
gh pr merge 92 --squash --delete-branch
```

**Mit csinál:** `src/services/fastApiService.ts` (új fájl) kezeli a Python alrendszer újraindítását.
**Kockázat:** ALACSONY — új service file, nem érinti a meglévőt.

---

### PR #96 — Cron-Parser Next Run

```bash
gh pr checkout 96
npm install  # új: cron-parser csomag
npm run build && npm test
gh pr merge 96 --squash --delete-branch
```

**Mit csinál:** A scheduled tasks engine pontosan számolja ki a következő futási időt a cron kifejezésből (nem +1h hardcode).
**Kockázat:** KÖZEPES — új npm csomag, de jó teszt coverage.

---

### PR #66 — Audit Trail Permission Denial

```bash
gh pr checkout 66
npm run build && npm test
gh pr merge 66 --squash --delete-branch
```

**Mit csinál:** Minden jogosultság-megtagadás bekerül az audit logba.
**Kockázat:** ALACSONY.

---

### PR #89 — EdgeProxy KV-SQLite Sync

```bash
gh pr checkout 89
# ⚠️ FONTOS: edge_tasks tábla már létezik globalDb.ts-ben!
# Nézd meg: git diff HEAD src/utils/globalDb.ts
npm run build && npm test
gh pr merge 89 --squash --delete-branch
```

**Kockázat:** KÖZEPES — globalDb.ts conflict lehetséges.

---

## PHASE 2 — Core Features (HOLNAP DÉLELŐTT, ~3-4 óra)

### PR #98 — Valódi Jules API Kliens

**Mit csinál:** `src/core/julesMock.ts` → igazi Jules API hívás, graceful fallback mock-ra ha nincs Jules.
**Kockázat:** KÖZEPES — production API integráció, teszt alaposan.

### PR #99 — GitHubModelsAgent Tool Loop

**Mit csinál:** A GitHubModelsAgent most már MCP tool-okat tud hívni (nem csak szöveget generál).
**Kockázat:** KÖZEPES — registry.ts módosítás.

### PR #93 — PR Tracking Adatbázisban

**Mit csinál:** `pull_requests` tábla SQLite-ban, auto-merge előkészítés.
**Kockázat:** ALACSONY — csak DB schema bővítés.

### PR #81 vs #89

> **#89 az újabb és jobb — #81-et CLOSE-old!**

```bash
gh pr close 81 --comment "Superseded by PR #89 (newer implementation)"
```

---

## PHASE 3 — Performance (HOLNAP DÉLUTÁN, ~2 óra)

Batch merge — mind safe refactor:

```bash
# Sorban:
gh pr merge 100 --squash  # ConfigManager caching
gh pr merge 91 --squash   # MCP async reads
gh pr merge 90 --squash   # listSpecStatuses concurrent
gh pr merge 72 --squash   # file listing async
gh pr merge 64 --squash   # memoryContext async
gh pr merge 63 --squash   # codebaseIndexer concurrent
gh pr merge 74 --squash   # myai log streaming async
gh pr merge 71 --squash   # whisper async

npm run build && npm test  # Egy körben mindegyik után
```

---

## PHASE 4 — UX Batch (HOLNAP ESTE)

### ⚠️ CONFLICT FIGYELMEZTETÉS — PR #101

**PR #101 azt állítja hogy javítja az infinite re-render-t** — de mi már javítottuk `useShallow`-val a `useSystemSignal.ts`-ben!

```bash
gh pr checkout 101
git diff main src/dashboard/hooks/useSystemSignal.ts
# Ha conflict → csak a tooltip részt cherry-pick-old, a hook-ot NE:
# git checkout main -- src/dashboard/hooks/useSystemSignal.ts
```

### UX PR-ok sorrendben (legújabbtól a legrégebbiig):

```bash
gh pr merge 102 --squash  # ProcessControlWidget tooltips (legújabb)
# 101 → csak részleges (conflict miatt)
gh pr merge 97 --squash   # NeuralLinkChat a11y
gh pr merge 88 --squash   # AgentStatusCard tooltips (újabb)
# 77, 69, 59 → ha 88 merge-elve, ezek outdatedek lehetnek
```

---

## PHASE 5 — Cleanup

### Copilot WIP PR-ok — CLOSE

```bash
gh pr close 87 --comment "WIP PR, nem kész implementáció"
gh pr close 76 --comment "Bootstrap task, nem szükséges"
gh pr close 75 --comment "Analysis only, no implementation needed"
```

### Dependabot — #86

```bash
# Csak ha az A2A Go projekt aktív:
gh pr merge 86 --squash
```

---

## Eredmény-ellenőrzés

```bash
npm run build   # 0 hiba
npm test        # 817+ PASS
npm run health  # Minden szolgáltatás healthy
```

---

## Git History Takarítás

```bash
git log --oneline -20  # Ellenőrzés
git push origin main   # Push ha minden PASS
```
