# Spec — Cloudflare Full Optimization & Domain Rollout

## Cél
A Brunella rendszer Cloudflare rétegének teljes optimalizálása és üzemszerű élesítése:
- kanonikus Cloudflare endpoint contract kialakítása,
- domain alapú végpont-egységesítés,
- tunnel stabilizálás,
- worker routing és auth egységesítés,
- releváns edge-migrációk végrehajtása a meglévő architektúrával kompatibilisen.

## Üzleti/üzemeltetési motiváció
- Van saját domain cím, ezért ideiglenes `workers.dev` és vegyes URL-használat helyett stabil, tartós endpoint-stratégia szükséges.
- A jelenlegi párhuzamos Cloudflare útvonalak (worker URL-ek, chat sync, D1 bridge) törékenységet okoznak.
- A cél egyértelmű: gyorsabb, stabilabb, olcsóbb edge működés és egyszerűbb hibakezelés.

## Scope
1. **Canonical Cloudflare Contract**
   - Egységes endpoint lista: `/health`, `/task`, `/status/:id`, `/history`, `/chat/messages`, `/ai/generate`, `/d1/query`.
   - Egységes request/response schema és hibakódolás.

2. **Domain-alapú URL stratégia**
   - Saját domain alá rendezett API végpontok (prod/stage elválasztással).
   - `.env` felelősségi mátrix: `CLOUDFLARE_WORKER_URL`, `CLOUDFLARE_D1_WORKER_URL`, `CLOUDFLARE_CHAT_SYNC_URL`.

3. **Tunnel hardening**
   - Tunnel health + failover policy.
   - `BAS_LOCAL_URL` / tunnel URL routing validáció.

4. **Worker-fleet konszolidáció**
   - Aktív worker szerepkörök tisztázása (orchestrator, chat-sync, D1 bridge, browser).
   - Duplikált/legacy route-ok visszavezetése kanonikus contractra.

5. **Teljesítményoptimalizálás**
   - D1 query profile + index/TTL/batch javaslatok.
   - KV cache policy és invalidáció.
   - Vectorize usage és fallback policy.

6. **Migrációs terv (Brunella-releváns)**
   - A még lokálfüggő vagy vegyes edge modulok fokozatos migrációja.
   - EdgeProxy/AgentManager útvonalak konzisztensítése.

7. **Deploy & Ops readiness**
   - CI/CD ellenőrzések Cloudflare deploy előtt/után.
   - Smoke/health ellenőrző checklist domainen.

## Nem cél
- Teljes platform újraépítés.
- Üzleti logika átírása, ami nem Cloudflare integrációs jellegű.
- Nem Cloudflare infrastruktúra (pl. unrelated backend feature) bővítés.

## Elvárt kimenetek
- 1 db kanonikus Cloudflare API contract dokumentum.
- Egységesített `.env` használati mátrix.
- Domain + tunnel éles konfig checklist.
- Worker-fleet konszolidációs állapotjelentés (mi marad, mi megy legacy-ba).
- Migrációs lépéssor prioritási sorrenddel.

## Acceptance Criteria
- [ ] Nincs endpoint-inkonzisztencia a backend route-ok és worker implementációk között.
- [ ] A chat/task/status/history útvonalak egyértelműen ugyanarra a kanonikus contractra mutatnak.
- [ ] Domainen elérhető health-check végpontok zöldek.
- [ ] Tunnel fallback működik és dokumentált.
- [ ] `npm run smoke` + Cloudflare route smoke check PASS.
- [ ] Track dokumentáció és állapotfrissítés kész.

## Kapcsolódó track-ek
- `cloudflare_workers_migration_20260226` (proposed)
- `cf_hyperdrive_d1_20260323` (active)

## Státusz
**ACTIVE (ÉLES)** — azonnal végrehajtható, magas prioritású stabilizációs track.
