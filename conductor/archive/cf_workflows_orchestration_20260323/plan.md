# Végrehajtási Terv: Cloudflare Workflows Orkesztráció

**Track ID:** `cf_workflows_orchestration_20260323`
**Prioritás:** MEDIUM
**Becsült idő:** 8-12 nap

---

## Fázis 1: Pilot workflow (Napi rendszer health check)

- [ ] `cloudflare/src/workflows/daily-health-check.ts` létrehozása
  - [ ] Rendszerállapot lekérdezés lépés
  - [ ] Agent-ek állapota lekérdezés lépés
  - [ ] D1 adatbázis méret ellenőrzés lépés
  - [ ] Jelentés generálás lépés
  - [ ] Értesítés küldés lépés (ha probléma van)
- [ ] Workflow binding hozzáadása a `wrangler.jsonc`-hez
- [ ] Cron trigger beállítás: `0 6 * * *` (minden nap 6:00 UTC)
- [ ] Deploy és tesztelés
- [ ] Workflow futás ellenőrzés a CF Dashboard-on

## Fázis 2: Lead mining pipeline workflow

- [ ] `cloudflare/src/workflows/lead-mining.ts` létrehozása
  - [ ] Forrás adatok gyűjtése lépés
  - [ ] AI elemzés lépés (Workers AI integráció)
  - [ ] Szűrés és prioritizálás lépés
  - [ ] D1 mentés lépés
  - [ ] Összesítő értesítés lépés
- [ ] Workflow binding és cron trigger (`0 8 * * 1`)
- [ ] Integrációs teszt valós adatforrásokkal

## Fázis 3: Pályázat monitoring workflow

- [ ] `cloudflare/src/workflows/grant-monitoring.ts` létrehozása
  - [ ] Pályázati portál scraping lépés
  - [ ] AI szűrés lépés (relevancia elemzés)
  - [ ] Értesítés és naplózás lépés
- [ ] Workflow binding és cron trigger (`0 7 * * 1,4`)
- [ ] D1 tábla létrehozás: `grant_checks`

## Fázis 4: Dashboard workflow állapot panel

- [ ] Worker API endpoint-ok:
  - [ ] `GET /api/workflows` — workflow lista és állapotok
  - [ ] `GET /api/workflows/:id/runs` — futási előzmények
  - [ ] `POST /api/workflows/:id/trigger` — manuális indítás
- [ ] React komponens: `src/dashboard/components/WorkflowPanel.tsx`
  - [ ] Workflow lista állapot jelzőkkel
  - [ ] Futási előzmények és logok
  - [ ] Manuális trigger gomb

## Fázis 5: N8N migráció terv végrehajtás

- [ ] N8N workflow-ok áttekintése: melyeket érdemes migrálni
- [ ] Maradék workflow-ok implementálása CF Workflows-ban
- [ ] N8N és CF Workflows párhuzamos futtatás (átmeneti időszak)
- [ ] N8N leállítása a sikeresen migrált workflow-oknál
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- A napi health check workflow automatikusan fut és értesítést küld
- A lead mining pipeline heti rendszerességgel fut
- A pályázat monitoring heti 2x ellenőrzi a portálokat
- A dashboard megjeleníti a workflow állapotokat
- Legalább 3 N8N workflow sikeresen migrálva
