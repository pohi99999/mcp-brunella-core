---
description: "EPP v2 alapú új feature megvalósítása. Végigvezet a kötelező ellenőrzőlistán: track létrehozás, backend route, Dashboard panel, CLI parancs, agent registry, tesztek, dokumentáció."
name: "Új BAS Feature (EPP v2)"
argument-hint: "Feature neve és rövid leírása (pl. 'Invoice export endpoint – PDF exportálás API-n keresztül')"
agent: "agent"
---

# Új Feature Megvalósítása — EPP v2 Protokoll

## Argumentum

**Feature:** $args

---

## Fázis 0 — Értelmezés és track létrehozás

Mielőtt bármit kódolnál:

1. Értsd meg a featuret: mi az input, mi az elvárt output, milyen meglévő rendszerkomponenseket érint?
2. Hozd létre a track-et:
   - Adj egyedi track ID-t: `<slug>_<dátum>` formátumban (pl. `invoice_export_20260403`)
   - Hozd létre: `conductor/tracks/<track-id>/meta.json` — status: `"active"`, owner: `"copilot"`
   - Hozd létre: `conductor/tracks/<track-id>/plan.md` — lépésenkénti implementációs checklist
3. Frissítsd `conductor/tracks.md`-t az új track sorával (vagy futtasd: `npx tsx src/cli.ts conductor rescan`)

---

## Fázis 1 — Backend (Node.js / TypeScript)

### 1a. Route modul

- Hozd létre: `src/server/routes/<feature>.ts` — Express router factory
- Regisztráld: `src/server/routes/index.ts` — lazy-load `mount()` mintával
- Ellenőrizd: `GET /api/v1/<feature>/health` ad vissza 200-at

### 1b. Üzleti logika

- Ha agent delegation kell: `src/agents/<FeatureAgent>.ts` (extend `BaseAgent` VAGY implement `IAgent` + `finally { setAgentStatus(name, 'idle') }`)
- Ha MCP tool kell: `src/tools/<featureTool>.ts` + regisztrálj `src/server/registry.ts`-ben `server.tool(...)` hívással
- Ha agent kell: add hozzá `src/agents/registry.json`-hoz

### 1c. Build ellenőrzés

```bash
npm run build
```

> ⛔ Nulla TypeScript hiba szükséges. Ha hiba → javítsd most, ne haladj tovább. (EPP v2 #2)

---

## Fázis 2 — Dashboard panel (React/Vite)

- Hozd létre: `src/dashboard/panels/<FeaturePanel>.tsx` — React komponens (Radix UI + Tailwind)
- Regisztráld: `src/dashboard/lib/navigation.tsx` — `NavigationRegistry`-be add hozzá
- Build ellenőrzés: `npm run build:ui` (külön build! fő `tsconfig.json`-ból ki van zárva)

---

## Fázis 3 — CLI parancs (Magyar nyelvű)

- Hozd létre vagy bővítsd: `src/cli/<feature>Commands.ts`
- Regisztráld: `src/cli.ts`-ben Commander.js parancsként
- **Kötelező UX:** Inquirer.js menü (nyíl + enter), Chalk szín, Ora spinner, Boxen keret
- Parancs neve legyen **magyar** (pl. `brunella export invoice`)

---

## Fázis 4 — Tesztek

```bash
# Írj teszteket MINDEN új modulhoz:
# test/<feature>.test.ts            ← unit
# test/<feature>Integration.test.ts ← integration (ha DB/agent érintett)
```

Kötelező lefedettség:

- [ ] Happy path (normál működés)
- [ ] Error path (hibás input, agent timeout, DB hiba)
- [ ] Edge cases (üres lista, null érték, maximális limit)

Futtatás:

```bash
npx vitest run test/<feature>.test.ts
npm run test:fast
```

> ⛔ Minden tesztnek zölden kell lennie. (EPP v2 #5)

---

## Fázis 5 — Dokumentáció és lezárás

- [ ] `conductor/tracks/<track-id>/plan.md` checklist minden sora kipipálva?
- [ ] `conductor/tracks/<track-id>/meta.json` status: `"testing"` → `"completed"`?
- [ ] `python scripts/sync_foszal.py` futtatva?
- [ ] `.ai/claude.md` (vagy `.ai/copilot.md`) munkamenet napló bejegyzés hozzáadva?

---

## Végső ellenőrzőlista (EPP v2 #6 cross-surface wiring)

```text
[ ] src/server/routes/<feature>.ts          létezik?
[ ] src/server/routes/index.ts              bejegyezve?
[ ] src/agents/registry.json               agent hozzáadva (ha releváns)?
[ ] src/dashboard/lib/navigation.tsx       panel regisztrálva?
[ ] src/cli.ts                             CLI parancs regisztrálva?
[ ] test/<feature>.test.ts                 tesztek írva és zöldek?
[ ] npm run build                          0 hiba?
[ ] npm run test:fast                      0 hiba?
[ ] conductor/tracks/<id>/meta.json        status: "completed"?
[ ] python scripts/sync_foszal.py          lefuttatva?
```

---

> **EPP v2 alapelv:** Egyetlen feature sem "kész", amíg mind a 4 felület (route + panel + CLI + registry) nem érintett, a build nem zöld, és a track nincs lezárva.
