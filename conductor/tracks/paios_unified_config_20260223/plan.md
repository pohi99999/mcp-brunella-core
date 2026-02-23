# Implementációs Terv: PAIOS Unified Config Réteg
**Track ID:** `paios_unified_config_20260223`

> LOW prioritás — csak akkor kezd bele, ha az Orchestrator Chat és ModelSelector UI kész!

---

## Phase 1: Config séma

* [ ] **Task 1.1** — `npm install js-yaml @types/js-yaml` (ha nincs telepítve)

* [ ] **Task 1.2** — `src/config/paiosConfig.ts` — Zod schema + `loadPaiosConfig()` (lásd spec.md §3)

* [ ] **Task 1.3** — `paios.config.example.yaml` — dokumentált példa (lásd spec.md §2)

---

## Phase 2: Integráció

* [ ] **Task 2.1** — `src/orchestrator/orchestratorCore.ts` bővítése:
  - `loadPaiosConfig()` hívás induláskor
  - `default_model` a config alapján (nem hardcoded 'local')
  - `system_prompt_path` a config alapján

* [ ] **Task 2.2** — `src/core/modelRouter.ts` bővítése:
  - Provider enabled/disabled flagek ellenőrzése config alapján
  - Model string a config-ból (ne csak env var)

* [ ] **Task 2.3** — `src/core/retryStrategy.ts` bővítése:
  - `retry_max_attempts` és `retry_base_delay_ms` a Phoenix config-ból

---

## Phase 3: Dokumentáció + tesztek

* [ ] **Task 3.1** — `CLAUDE.md` frissítése: `paios.config.yaml` dokumentálása

* [ ] **Task 3.2** — `test/paiosConfig.test.ts`:
  - YAML betöltés + Zod parse → helyes típusok
  - Hiányzó YAML → .env fallback működik
  - Hibás YAML → Zod validation error

* [ ] **Task 3.3** — `npm run build && npm test` → 0 hiba

---

## 🎯 Sikerességi Kritériumok

- `paios.config.yaml` betöltödik és validálódik induláskor
- Ha nincs YAML → .env fallback, nem crashel
- Hibás YAML → érthető hibaüzenet
- `npm run build` → 0 TypeScript hiba
- `npm test` → minden PASS
