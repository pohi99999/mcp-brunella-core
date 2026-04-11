# Workflow: The Data Flywheel & Phoenix Protocol

**Verzió:** 2.1.0
**Utolsó frissítés:** 2026-02-02

---

## 0.0 SYSTEM INITIALIZATION (Karmesteri Indító Protokoll)

**KÖTELEZŐ LÉPÉS:** Mielőtt bármilyen fejlesztési vagy elemzési feladatba kezdenél:

```bash
# 1. Rendszer diagnosztika
node scripts/conductor_diagnostics.mjs

# 2. Projekt állapot ellenőrzés (ÚJ)
brunella agent ProjectConductor "status"

# 3. Dokumentáció szinkron (ha szükséges)
brunella agent ProjectConductor "sync"
```

Ennek eredménye alapján dönts a további lépésekről.

---

## 0.1 PROJEKT KARMESTER (ProjectConductor) - ÚJ

A **ProjectConductorAgent** a projekt központi menedzsment ügynöke:

### Felelősségek

| Terület             | Funkció                                           |
| ------------------- | ------------------------------------------------- |
| **Dokumentáció**    | Brunella.md, konyvtarfa.md automatikus frissítése |
| **Track-ek**        | tracks.md, SUMMARY.md karbantartása               |
| **Health Check**    | Build, tesztek, dokumentáció szinkron ellenőrzése |
| **Változáskövetés** | Minden módosítás naplózása                        |

### Parancsok

```bash
# Projekt státusz
brunella agent ProjectConductor "status"

# Dokumentáció szinkron
brunella agent ProjectConductor "sync"

# Új track létrehozása
brunella agent ProjectConductor "track create [név]"

# Track-ek frissítése
brunella agent ProjectConductor "track update"

# Health check
brunella agent ProjectConductor "health"

# Teljes szinkron
brunella agent ProjectConductor "full"
```

### Automatikus Futtatás

A ProjectConductor automatikusan fut:

- Minden `git commit` előtt (pre-commit hook)
- Naponta egyszer (scheduler)
- Track lezárásakor

---

## 1. Az Adat-Volán (Data Flywheel)

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA FLYWHEEL                            │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Gyűjtés │───▶│Tisztítás│───▶│Indexelés│───▶│ Tanulás │  │
│  │Harvesters│   │Refiners │    │LanceDB  │    │Ügynökök │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       ▲                                              │      │
│       └──────────────────────────────────────────────┘      │
│                      Végrehajtás                            │
└─────────────────────────────────────────────────────────────┘
```

1. **Gyűjtés (Harvesters):** A raj beküldi a nyers adatokat a `Raw Lake`-be
2. **Tisztítás (Refiners):** Az Adattudós ügynökök lefuttatják a `refiner_logic.py`-t
3. **Indexelés:** A tiszta adat bekerül a Vektor Memóriába (RAG/LanceDB)
4. **Tanulás:** A "Kis Csibészek" frissítik tudásukat
5. **Végrehajtás:** Az Orchestrator delegálja a feladatokat

---

## 2. Phoenix Protocol (Öngyógyítás)

```
┌─────────────────────────────────────────────────────────────┐
│                    PHOENIX PROTOCOL                          │
│                                                              │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐             │
│  │Checkpointing│──▶│Auto-Reset │──▶│Git Recovery│            │
│  │állapot mentés│  │újraindítás│   │verziókezelés│           │
│  └───────────┘   └───────────┘   └───────────┘             │
│                                                              │
│  Trigger: Hiba detektálás ───▶ Automatikus helyreállítás   │
└─────────────────────────────────────────────────────────────┘
```

- **Checkpointing:** Minden ügynök-művelet állapota mentésre kerül
- **Auto-Reset:** Ha egy perzisztens shell vagy tool elhasal, az Ops Agent azonnal újraindítja
- **Git Recovery:** Automatikus mentés és verziókövetés (`git_sync.ps1`)

---

## 3. Fejlesztési Szabályok (0-Hiba)

### Build & Test Workflow

```bash
# Minden kódmódosítás után
npm run build          # TypeScript compile
npm run test           # Vitest tesztek

# Sikertelen build esetén
# - NE commitolj
# - Javítsd a hibát
# - Futtasd újra
```

### Code Review Checklist

- [ ] Build sikeres (0 hiba)
- [ ] Tesztek futnak
- [ ] Dokumentáció frissítve
- [ ] Track napló frissítve
- [ ] **EPP v2 Compliance:** Dashboard + CLI komponensek párhuzamosan készültek (lásd [EPP v2 Protocol](./epp-v2.md))

### RED PROTOCOL — Track closure enforcement

Track lezárás vagy archiválás **nem** lehet pusztán `meta.json` manipuláció.

```json
"dod": {
  "tests_pass": true,
  "build_clean": true,
  "code_committed": true,
  "no_verify_used": false
}
```

Kötelező lezárási szabályok:

- `status: completed|archived` és `progress: 100` csak érvényes `dod` mellett lehet igaz.
- `completed` állapothoz kötelező `verificationNotes` + `completedAt`.
- `archived` állapothoz kötelező `archiveReason` + `archivedAt`.
- Meta-only lezárás TILOS: a lezáró commitnak valódi repo-munkát kell tartalmaznia, nem csak conductor meta-változást.
- `git commit --no-verify` és `git push --no-verify` TILOS.
- Ha a bizonyíték hiányzik, a tracket vissza kell tenni javításra vagy follow-up tracket kell nyitni.

### Engineering Precision Protocol v2 (EPP v2)

**Hatálybalépés:** 2026-02-11

**Alapelv:** Minden új feature két felületen is használható legyen:

1. **Dashboard UI** (`src/dashboard/components/`)
2. **Magyar CLI** (`src/cli/commands/` vagy `src/cli-hu.ts`)

**Kötelező checklist minden új feature-höz:**

- [ ] React komponens létrehozva a Dashboardhoz
- [ ] Inquirer menü létrehozva a CLI-hez
- [ ] Mindkét felület azonos backend API-t hív
- [ ] Mindkét felületen tesztelve
- [ ] Track markdown frissítve mindkét komponenssel

**Részletes szabályok:** [conductor/epp-v2.md](./epp-v2.md)

**Track követés:**

```bash
# Aktuális trackek listázása
brunella conductor status

# Track részleteinek megtekintése
brunella conductor track <track-name>
```

---

## 4. Edge-First Workflow (ÚJ)

Ha a Cloudflare Edge integráció aktív:

```
┌─────────────────────────────────────────────────────────────┐
│                    EDGE-FIRST WORKFLOW                       │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │  Task   │───▶│  Edge   │───▶│ Routing │───▶│ Execute │  │
│  │ Submit  │    │ Worker  │    │ Decision│    │ Agent   │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                      │              │                        │
│                      ▼              ▼                        │
│              ┌─────────────┐ ┌─────────────┐                │
│              │ Workers AI  │ │   Tunnel    │                │
│              │  (Fallback) │ │  (Lokális)  │                │
│              └─────────────┘ └─────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

1. Task beküldés az edge-re
2. Workers AI osztályozza a feladatot
3. Routing döntés: Edge vagy Lokális
4. Végrehajtás a megfelelő ügynökkel
5. Eredmény visszajelzés

---

## 5. Többszálas Fejlesztés Koordináció (ÚJ)

### Konfliktus Megelőzés

```
┌─────────────────────────────────────────────────────────────┐
│              MULTI-TRACK COORDINATION                        │
│                                                              │
│  Track A ────┐                                               │
│              │     ┌─────────────────┐                      │
│  Track B ────┼────▶│ ProjectConductor│────▶ Unified Docs    │
│              │     │   (Karmester)   │                      │
│  Track C ────┘     └─────────────────┘                      │
│                                                              │
│  Szabályok:                                                  │
│  1. Minden track frissíti a saját plan.md-jét               │
│  2. ProjectConductor szinkronizálja a központi fájlokat     │
│  3. Konfliktus esetén a track owner dönt                    │
└─────────────────────────────────────────────────────────────┘
```

### Track Tulajdonosi Rendszer

| Track             | Owner        | Fő fájlok                          |
| ----------------- | ------------ | ---------------------------------- |
| Cloudflare Edge   | Péter/Claude | `cloudflare/`, `EdgeProxyAgent.ts` |
| BAS Stabilization | Péter        | `src/core/`, tesztek               |
| Robotkéz n8n      | Péter        | `myai/browser_worker.py`, n8n      |

### Napi Szinkronizációs Rutin

```bash
# Reggel (munka előtt)
brunella agent ProjectConductor "status"      # Hol tartunk?
git pull                                       # Friss kód

# Este (munka után)
brunella agent ProjectConductor "sync"        # Dokumentáció frissítés
git add -A && git commit -m "Daily sync"      # Commit
git push                                       # Push
```

---

## 6. Track Életciklus

```
┌─────────────────────────────────────────────────────────────┐
│                    TRACK LIFECYCLE                           │
│                                                              │
│  PROPOSED ──▶ ACTIVE ──▶ TESTING ──▶ COMPLETED ──▶ ARCHIVED │
│      │          │           │            │                   │
│      ▼          ▼           ▼            ▼                   │
│   plan.md    Kódolás    Tesztek      Merge &              │
│   review     & docs     & review      cleanup              │
└─────────────────────────────────────────────────────────────┘
```

### Státusz Jelentések

| Ikon | Státusz   | Jelentés                              |
| ---- | --------- | ------------------------------------- |
| 🔵   | PROPOSED  | Track tervezett, de még nem kezdődött |
| 🟡   | ACTIVE    | Aktív fejlesztés alatt                |
| 🟠   | TESTING   | Kód kész, tesztelés folyamatban       |
| 🟢   | COMPLETED | Minden kész, merge megtörtént         |
| ⏸️   | PAUSED    | Ideiglenesen szüneteltetve            |
| 🗄️   | ARCHIVED  | Régi track, archívumban               |

---

## 7. Dokumentációs Hierarchia

```
┌─────────────────────────────────────────────────────────────┐
│                 DOCUMENTATION HIERARCHY                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              BRUNELLA.md (Fő README)                │    │
│  │              - Projekt áttekintés                    │    │
│  │              - Quick start                           │    │
│  │              - Aktív track-ek összefoglaló          │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│           ┌───────────────┼───────────────┐                 │
│           ▼               ▼               ▼                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │konyvtarfa.md │ │conductor/    │ │_KNOWLEDGE_   │        │
│  │- Fájlstruktúra│ │- tracks.md  │ │BASE/         │        │
│  │- Mappák leírás│ │- workflow.md│ │- Technikai   │        │
│  └──────────────┘ │- tech-stack │ │  dokumentáció│        │
│                   └──────────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Auto-Update Fájlok

A **ProjectConductorAgent** automatikusan frissíti:

| Fájl                    | Frissítési gyakoriság | Tartalom               |
| ----------------------- | --------------------- | ---------------------- |
| `konyvtarfa.md`         | Minden sync           | Teljes könyvtárfa      |
| `conductor/tracks.md`   | Minden track változás | Track lista            |
| `conductor/SUMMARY.md`  | Naponta               | Összefoglaló           |
| `Brunella.md` (részben) | Hetente               | Aktív track-ek szekció |

---

## 8. Hibakezelés és Escalation

```
┌─────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING                            │
│                                                              │
│  Hiba detektálva                                            │
│        │                                                     │
│        ▼                                                     │
│  ┌─────────────┐   Nem   ┌─────────────┐                   │
│  │ Auto-fix?   │────────▶│  Escalate   │                   │
│  └─────────────┘         │  to Human   │                   │
│        │ Igen            └─────────────┘                   │
│        ▼                        │                           │
│  ┌─────────────┐                │                           │
│  │ Phoenix     │                │                           │
│  │ Protocol    │                │                           │
│  └─────────────┘                │                           │
│        │                        │                           │
│        └────────┬───────────────┘                           │
│                 ▼                                            │
│        ┌─────────────┐                                      │
│        │   Napló     │                                      │
│        │   Frissítés │                                      │
│        └─────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

### Escalation Szintek

1. **L0 - Automatikus:** Phoenix Protocol, újraindítás
2. **L1 - Agent:** EvaluatorAgent elemzi és javasolja a javítást
3. **L2 - Human:** Péter beavatkozása szükséges
4. **L3 - External:** Külső szakértő vagy dokumentáció

---

## 9. Quick Reference

### Gyakori Parancsok

```bash
# Projekt státusz
brunella agent ProjectConductor "status"

# Track létrehozása
brunella agent ProjectConductor "track create MyCoolFeature"

# Dokumentáció szinkron
brunella agent ProjectConductor "sync"

# Build és teszt
npm run build && npm run test

# Teljes rendszer indítás
npm run full:start

# Edge teszt (ha aktív)
brunella agent EdgeProxy "health"
```

### Fájl Szerkesztési Szabályok

| Fájl          | Ki szerkesztheti         | Hogyan      |
| ------------- | ------------------------ | ----------- |
| Track plan.md | Track owner              | Kézzel      |
| Brunella.md   | ProjectConductor + Human | Auto + kézi |
| konyvtarfa.md | ProjectConductor         | Auto        |
| tracks.md     | ProjectConductor         | Auto        |
| Kód fájlok    | Developer                | IDE         |

---

_Dokumentum verzió: 2.1.0_
_Utolsó frissítés: 2026-02-02_
_Karbantartó: ProjectConductorAgent_
