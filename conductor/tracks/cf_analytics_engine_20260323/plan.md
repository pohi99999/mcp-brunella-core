# Végrehajtási Terv: Cloudflare Analytics Engine Egyedi Metrikák

**Track ID:** `cf_analytics_engine_20260323`
**Prioritás:** LOW
**Becsült idő:** 5-7 nap

---

## Fázis 1: Analytics Engine engedélyezés és adatpont definíció

- [ ] Analytics Engine engedélyezése a CF Dashboard-on
- [ ] `bas_metrics` dataset létrehozása
- [ ] `wrangler.jsonc` frissítése az `analytics_engine_datasets` binding-gal:
  ```jsonc
  "analytics_engine_datasets": [
    {
      "binding": "BAS_ANALYTICS",
      "dataset": "bas_metrics"
    }
  ]
  ```
- [ ] Adatpont séma dokumentálása (blobs, doubles, indexes)
- [ ] Teszt: egyszerű `writeDataPoint()` hívás a Worker-ből

## Fázis 2: Workers instrumentálás writeDataPoint()-tal

- [ ] `cloudflare/src/analytics.ts` létrehozása:
  - [ ] `BASAnalytics` osztály
  - [ ] `recordAgentRun()` metódus
  - [ ] `recordWorkerRequest()` metódus
- [ ] Worker middleware integráció (`cloudflare/src/index.ts`):
  - [ ] Minden kérés automatikus mérése
  - [ ] Agent futások mérése az agent handler-ekben
- [ ] Deploy és adatgyűjtés ellenőrzése a CF Dashboard-on

## Fázis 3: SQL lekérdezés API

- [ ] Worker API endpoint-ok az Analytics Engine lekérdezéshez:
  - [ ] `GET /api/analytics/agents` — agent teljesítmény összesítés
  - [ ] `GET /api/analytics/models` — modell használat eloszlás
  - [ ] `GET /api/analytics/errors` — hiba arány elemzés
  - [ ] `GET /api/analytics/tokens` — token használat statisztikák
- [ ] Cloudflare Analytics Engine SQL API integráció
- [ ] Lekérdezés cache-elés (1 perces TTL)

## Fázis 4: Dashboard analytics panel

- [ ] React komponens: `src/dashboard/components/AnalyticsPanel.tsx`
  - [ ] Agent teljesítmény táblázat
  - [ ] Hiba arány vonaldiagram (chart.js vagy recharts)
  - [ ] Token használat oszlopdiagram
  - [ ] Modell eloszlás kördiagram
  - [ ] Response time hisztogram
- [ ] Időszak választó (24 óra, 7 nap, 30 nap)
- [ ] Auto-refresh (30 másodpercenként)

## Fázis 5: Riasztási küszöbértékek

- [ ] Riasztási szabályok implementálása:
  - [ ] Agent sikerességi arány < 80% → figyelmeztetés
  - [ ] Agent sikerességi arány < 50% → kritikus
  - [ ] Átlagos futási idő > 30 sec → figyelmeztetés
  - [ ] Napi token használat > 80% limit → figyelmeztetés
- [ ] Discord webhook értesítés küszöbérték túllépésnél
- [ ] Cron trigger a riasztások ellenőrzéséhez (15 percenként)
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- Az Analytics Engine aktív és adatokat gyűjt
- A Workers minden kérést és agent futást mér
- Az SQL lekérdezések működnek és helyes adatokat adnak
- A dashboard analytics panel megjeleníti a metrikákat
- A riasztási rendszer értesítést küld küszöbérték túllépésnél
