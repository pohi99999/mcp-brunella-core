# BAS Átfogó Tesztprotokol — Terv & Spec

**Track ID:** `bas_comprehensive_test_protocol_20260210`
**Prioritás:** CRITICAL
**Létrehozva:** 2026-02-10
**Státusz:** `frozen` (implementáció engedélyezve)
**Assigned:** DeveloperAgent

---

## 0. Helyzetelemzés — Mi VAN és mi HIÁNYZIK

### ✅ MEGLÉVŐ (nem kell újraépíteni)
| Elem | Állapot | Fájlok |
|------|---------|--------|
| Unit tesztek (Vitest) | 394 teszt, 46 fájl | `test/*.test.ts` |
| Dashboard E2E (Playwright) | 37 teszt, 5 fájl | `test/e2e/*.spec.ts` |
| Smoke script | Működik | `scripts/smoke.mjs` |
| Conductor diagnostics | Fájl + process check | `scripts/conductor_diagnostics.mjs` |
| Bridge teszt | Alapvetően működik | `scripts/test_bridge.ts` |
| Config validáció | Zod séma | `src/config/schema.ts` |
| Secret validáció | 5 kulcs ellenőrzés | `src/utils/validateSecrets.ts` |
| CI workflow (GitHub) | Build + test | `.github/workflows/phoenix-protocol.yml` |
| Checkpoint rendszer | SQLite alapú | `src/utils/checkpoint.ts` |

### ❌ HIÁNYZIK (implementálandó)
| Elem | Kritikusság | Megjegyzés |
|------|-------------|------------|
| **Health Check script** (startup) | CRITICAL | Ollama + Python + LanceDB + API kulcs érvényesség |
| **Phoenix crash recovery teszt** | CRITICAL | Szándékos kill + újraindulás validáció |
| **State restoration teszt** | HIGH | Checkpoint → recovery → állapot ellenőrzés |
| **Socket.IO reconnect teszt** | HIGH | Hálózat megszakadás → auto-reconnect |
| **Pre-commit hook (Husky)** | HIGH | `npm test` + `npm run build` → commitolás előtt |
| **Nightly E2E job** | MEDIUM | `playwright test` GitHub Actions-ban |
| **Delegálási lánc teszt** | HIGH | Orchestrator → Developer/Researcher routing |
| **Strukturált output validáció** | HIGH | Pydantic/Zod séma ellenőrzés pipeline-ban |
| **Robotkéz Level 1-3 tesztek** | MEDIUM | Automatizált headless böngésző tesztek |
| **Error Boundary audit** | MEDIUM | Dashboard widget izolált crash teszt |

---

## 1. FÁZIS: Életjel Tesztek (Smoke / Health Check) — CRITICAL

### 1.1 Startup Health Check Script
**Fájl:** `scripts/health_check.ts`
**Futtatás:** `npm run health` (és automatikusan az `npm run dev` elején)

| # | Ellenőrzés | Parancs/API | Sikeres ha |
|---|------------|-------------|------------|
| 1.1.1 | Ollama válaszol | `GET http://localhost:11434/api/tags` | HTTP 200 + ≥1 model |
| 1.1.2 | Ollama betöltött modellek | Modellek listája | `llama3.1:8b` van |
| 1.1.3 | LanceDB elérhető | `rag.ts` → search('test') | Nem dob hibát |
| 1.1.4 | Python FastAPI elérhető | `GET http://localhost:8000/health` | HTTP 200 |
| 1.1.5 | API kulcsok érvényesek | `validateSecrets()` kiterjesztés | 0 WARN |
| 1.1.6 | SQLite DB-k léteznek | `data/checkpoint.db`, `data/audit.db` | Fájlok léteznek |
| 1.1.7 | Build friss | `build/index.js` timestamp vs `src/` | Nem régebbi |

**Implementáció:**
```typescript
// scripts/health_check.ts
export async function runHealthCheck(): Promise<HealthReport> {
  const results = await Promise.allSettled([
    checkOllama(), checkPython(), checkLanceDB(),
    checkSecrets(), checkDatabases(), checkBuild()
  ]);
  return { overall: results.every(r => r.status === 'fulfilled'), checks: results };
}
```

### 1.2 Node.js ↔ Python Híd Stabilitás
**Fájl:** `test/bridge_health.test.ts`

| # | Teszt | Elvárt |
|---|-------|--------|
| 1.2.1 | Python process spawn | PID visszatér, exit code 0 |
| 1.2.2 | JSON kommunikáció round-trip | Küldött adat = fogadott adat |
| 1.2.3 | Timeout kezelés | 30s után timeout error (nem végtelen hang) |
| 1.2.4 | UTF-8 magyar karakter | "Árvíztűrő tükörfúrógép" sértetlenül megy át |

### 1.3 Extended Secret Validation
**Fájl:** `src/utils/validateSecrets.ts` bővítése

| # | Kulcs | Jelenlegi | Bővítés |
|---|-------|-----------|---------|
| 1.3.1 | LANGCHAIN_API_KEY | - | `GET /api/v1/sessions` → 200 |
| 1.3.2 | GOOGLE_API_KEY | van (meglét) | API hívás teszt |
| 1.3.3 | CF_API_TOKEN | - | `GET /accounts` → 200 |
| 1.3.4 | GITHUB_TOKEN | - | `GET /user` → 200 |

---

## 2. FÁZIS: Phoenix Protocol (Reziliencia) Tesztek — CRITICAL

### 2.1 Crash Recovery Teszt
**Fájl:** `test/phoenix_recovery.test.ts`

| # | Teszt | Lépések | Elvárt |
|---|-------|---------|--------|
| 2.1.1 | Python worker kill + recovery | 1) Python spawn, 2) `process.kill()`, 3) Wait 5s | AgentManager érzékeli → újraindít |
| 2.1.2 | Checkpoint mentés hiba közben | 1) Task indul, 2) Hiba közben, 3) Checkpoint ellenőrzés | Utolsó stabil állapot mentve |
| 2.1.3 | Graceful shutdown | `SIGTERM` küldés → cleanup | Nincs adatvesztés, DB-k lezárva |

### 2.2 State Restoration (Amnézia Teszt)
**Fájl:** `test/state_restoration.test.ts`

| # | Teszt | Lépések | Elvárt |
|---|-------|---------|--------|
| 2.2.1 | Checkpoint save + load | 1) Checkpoint mentés, 2) Szerver restart szimuláció, 3) Betöltés | Adatok egyeznek |
| 2.2.2 | Corrupt checkpoint kezelés | Érvénytelen JSON a DB-ben | Graceful fallback, nem crash |
| 2.2.3 | Task Queue persistence | 1) Task-ok hozzáadása, 2) Restart, 3) Queue ellenőrzés | Pending task-ok megmaradtak |

### 2.3 Socket.IO Reconnect
**Fájl:** `test/e2e/socket-reconnect.spec.ts` (Playwright)

| # | Teszt | Elvárt |
|---|-------|--------|
| 2.3.1 | Backend leáll → UI graceful | Disconnect jelző, log megáll, nem crash |
| 2.3.2 | Backend újraindul → auto-reconnect | 5 próba 1s-enként, majd helyreáll |
| 2.3.3 | Log stream folytonossága | Disconnect/reconnect után a log újraindul |

---

## 3. FÁZIS: Ügynök Logika Tesztek — HIGH

### 3.1 Delegálási Lánc
**Fájl:** `test/delegation_chain.test.ts`

| # | Teszt | Bemenet | Elvárt kimenet |
|---|-------|---------|----------------|
| 3.1.1 | Orchestrator → Developer | "Írj Unit tesztet a file.ts-hez" | Developer.execute() hívódik |
| 3.1.2 | Orchestrator → Researcher | "Keress információt a React 19 újdonságokról" | Researcher.execute() hívódik |
| 3.1.3 | Ismeretlen feladat | "Rendezd a táskámat" | Graceful "not supported" válasz |
| 3.1.4 | Delegálás lánc: O → D → visszajelzés | Build feladat | Orchestrator fogadja a sikert/hibát |

### 3.2 Strukturált Output Validáció
**Fájl:** `test/structured_output.test.ts`

| # | Teszt | Elvárt |
|---|-------|--------|
| 3.2.1 | Agent JSON válasz formátum | `{ status: 'success'|'error', result: unknown }` sémának megfelel |
| 3.2.2 | Pipeline result validáció | PipelineResult interface-nek megfelel |
| 3.2.3 | Zod config séma runtime | parseConfig() dob hibát rossz inputra |
| 3.2.4 | Pydantic modell (Python) | browser_worker kimenet validálása |

### 3.3 Hallucináció / Garbage Input Szűrés
**Fájl:** `test/input_sanitization.test.ts`

| # | Teszt | Bemenet | Elvárt |
|---|-------|---------|--------|
| 3.3.1 | Üres task | `""` | Validációs hiba, nem LLM hívás |
| 3.3.2 | 100K karakter input | Nagyon hosszú string | Truncation vagy elutasítás |
| 3.3.3 | Shell injection kísérlet | `` `rm -rf /` `` | Escaped, nem fut le |
| 3.3.4 | SQL injection | `'; DROP TABLE audit_log; --` | Parametrized query védi |

---

## 4. FÁZIS: Dashboard Error Boundary Audit — HIGH

### 4.1 Widget Izolált Crash Tesztek
**Fájl:** `test/dashboard/components/ErrorBoundary.test.tsx`

| # | Widget | Teszt | Elvárt |
|---|--------|-------|--------|
| 4.1.1 | SystemHealthCard | Props undefined | ErrorBoundary fogja, többi widget él |
| 4.1.2 | TerminalLog | Socket hiba | Log üres, nem crash |
| 4.1.3 | AgentStatusCard | API 500 | Error state megjelenik |
| 4.1.4 | DeveloperPanel | Backend timeout | Loading → Error, layout stabil |

### 4.2 Dashboard Action Triggering
**Fájl:** `test/e2e/action-triggering.spec.ts` (Playwright)

| # | Teszt | Trigger | Elvárt API hívás |
|---|-------|---------|------------------|
| 4.2.1 | Agent Execute gomb | Kattintás | `POST /api/agents/:name/execute` |
| 4.2.2 | Service Start toggle | Toggle ON | `POST /api/system/start-service` |
| 4.2.3 | Task Execute Next | Kattintás | `POST /api/tasks/execute` |
| 4.2.4 | File Upload | Dragndrop/Browse | `POST /rag/ingest` |

---

## 5. FÁZIS: Robotkéz (Browser-Use) Szinttesztek — MEDIUM

### 5.1 Level 1: Alapvető Navigáció
**Fájl:** `test/robotkez/level1_navigation.test.ts`

| # | Teszt | Lépés | Validáció |
|---|-------|-------|-----------|
| 5.1.1 | Google keresés | Navigáció → input → Enter | Eredmény oldal betölt |
| 5.1.2 | Screenshot készítés | Navigáció → screenshot | PNG fájl ≥ 10KB |
| 5.1.3 | Headless mód | Futtatás `--headless` | Ugyanaz az eredmény |

### 5.2 Level 2: Interakciós Teszt
**Fájl:** `test/robotkez/level2_interaction.test.ts`

| # | Teszt | Lépés | Validáció |
|---|-------|-------|-----------|
| 5.2.1 | Form kitöltés | Input → Fill → Submit | HTTP 200 válasz |
| 5.2.2 | Multi-step navigáció | 3 click → result | Helyes végállapot |

### 5.3 Level 3: Monitoring (n8n)
**Fájl:** `test/robotkez/level3_monitoring.test.ts`

| # | Teszt | Elvárt |
|---|-------|--------|
| 5.3.1 | n8n bejelentkezés | Dashboard betölt |
| 5.3.2 | Workflow lista lekérés | ≥ 0 workflow |

---

## 6. FÁZIS: CI/CD & Automatizáció — HIGH

### 6.1 Pre-Commit Hook (Husky)
**Fájl:** `.husky/pre-commit`

```bash
#!/bin/sh
npm run build || exit 1
npx vitest run --reporter=dot || exit 1
```

**Implementáció:**
```bash
npm install -D husky
npx husky init
echo "npm run build && npx vitest run --reporter=dot" > .husky/pre-commit
```

### 6.2 GitHub Actions — Nightly E2E
**Fájl:** `.github/workflows/nightly-e2e.yml`

```yaml
name: Nightly E2E Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Minden éjjel 2:00 UTC
  workflow_dispatch: {}
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install chromium --with-deps
      - run: npm run build
      - name: Start backend
        run: node build/index.js &
        env: { WEB_UI_ENABLED: '1' }
      - name: Start frontend
        run: npm run dev:ui &
      - run: npx playwright test --reporter=html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### 6.3 Phoenix Protocol CI Bővítés
**Fájl:** `.github/workflows/phoenix-protocol.yml` bővítése

Hozzáadandó step-ek:
1. Health check script futtatás
2. E2E tesztek (Playwright)
3. Coverage report upload

---

## 7. NPM Scripts Összefoglaló

| Script | Parancs | Mikor fut |
|--------|---------|-----------|
| `test` | `npm run build && vitest run` | CI, pre-commit |
| `test:e2e` | `playwright test` | Nightly, manuális |
| `test:dashboard` | `vitest run --config vitest.dashboard.config.ts` | Manuális |
| `test:health` | `tsx scripts/health_check.ts` | **ÚJ** — startup, manuális |
| `test:bridge` | `tsx scripts/test_bridge.ts` | **ÚJ** — Python bridge |
| `test:phoenix` | `vitest run test/phoenix_recovery.test.ts test/state_restoration.test.ts` | **ÚJ** — reziliencia |
| `test:full` | `npm test && npm run test:e2e && npm run test:health` | **ÚJ** — mindent |
| `smoke` | `node scripts/smoke.mjs` | Startup |

---

## 8. Implementációs Prioritás

| Sorrend | Fázis | Kritikusság | Becsült idő |
|---------|-------|-------------|-------------|
| **1.** | Health Check script (1.1) | CRITICAL | 2 óra |
| **2.** | Pre-commit hook / Husky (6.1) | HIGH | 30 perc |
| **3.** | Phoenix crash recovery (2.1-2.2) | CRITICAL | 3 óra |
| **4.** | Delegálási lánc teszt (3.1) | HIGH | 2 óra |
| **5.** | Dashboard Error Boundary (4.1) | HIGH | 2 óra |
| **6.** | Strukturált output validáció (3.2-3.3) | HIGH | 1.5 óra |
| **7.** | Socket.IO reconnect E2E (2.3) | HIGH | 1 óra |
| **8.** | Nightly CI job (6.2-6.3) | MEDIUM | 1 óra |
| **9.** | Robotkéz szinttesztek (5.1-5.3) | MEDIUM | 3 óra |
| **ÖSSZESEN** | | | **~16 óra** |

---

## 9. Acceptance Criteria

- [ ] Fázis 1: `npm run test:health` PASS — minden szolgáltatás elérhető
- [ ] Fázis 2: Phoenix tesztek PASS — crash recovery igazolt
- [ ] Fázis 3: Delegálási lánc tesztek PASS
- [ ] Fázis 4: Dashboard Error Boundary audit PASS
- [ ] Fázis 5: Robotkéz Level 1-3 PASS (headless)
- [ ] Fázis 6: Husky pre-commit aktív + Nightly CI zöld
- [ ] `npm run test:full` — MINDEN PASS
- [ ] 0 TypeScript error, 0 console.log production kódban
