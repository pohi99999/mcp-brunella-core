# Végrehajtási Terv: Cloudflare Queues Aszinkron Task Elosztás

**Track ID:** `cf_queues_task_distribution_20260323`
**Prioritás:** HIGH
**Becsült idő:** 3-5 nap

---

## Fázis 1: Queue infrastruktúra létrehozása

- [ ] Queue-ok létrehozása wrangler CLI-vel:
  ```bash
  wrangler queues create bas-task-queue
  wrangler queues create bas-priority-queue
  wrangler queues create bas-task-dlq
  ```
- [ ] Queue-ok megjelennek a CF Dashboard-on
- [ ] `wrangler.jsonc` frissítése a producers/consumers konfigurációval

## Fázis 2: Producer implementáció (Orchestrator Worker)

- [ ] `cloudflare/src/queue-producer.ts` létrehozása
  - [ ] `enqueueTask()` — egyedi feladat küldés
  - [ ] `enqueueBatch()` — batch küldés DAG részfeladatokhoz
  - [ ] Prioritás alapú routing (CRITICAL → priority queue)
- [ ] `/api/enqueue` endpoint hozzáadása az orchestrator Worker-hez
- [ ] Egységteszt a producer logikára
- [ ] Lokális teszt `wrangler dev`-vel

## Fázis 3: Consumer implementáció (Agent Workers)

- [ ] `cloudflare/src/queue-consumer.ts` létrehozása
  - [ ] `queue()` handler a batch feldolgozáshoz
  - [ ] `processTask()` helper az agent feladat végrehajtáshoz
  - [ ] Retry logika exponenciális visszalépéssel
  - [ ] Hiba kezelés és DLQ továbbirányítás
- [ ] Consumer export hozzáadása a Worker entry point-hoz
- [ ] Egységteszt a consumer logikára

## Fázis 4: Dead Letter Queue és monitoring

- [ ] DLQ consumer létrehozása a sikertelen feladatok naplózásához
- [ ] Riasztás beállítása: ha a DLQ-ban üzenet van
- [ ] Queue metrikák integrálása az Analytics Engine-nel
- [ ] Dashboard panel a queue állapothoz (opcionális)

## Fázis 5: TaskDecomposerAgent integráció

- [ ] `src/agents/taskDecomposer.ts` módosítása:
  - [ ] Szinkron végrehajtás helyett Queue-ba küldés
  - [ ] Callback/webhook a feladat befejezés jelzésére
- [ ] `src/agents/dagOrchestrator.ts` módosítása:
  - [ ] DAG állapot frissítés Queue consumer visszajelzés alapján
  - [ ] Függőség-alapú Queue küldés ütemezés
- [ ] Integrációs teszt a teljes pipeline-ra
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- A `bas-task-queue`, `bas-priority-queue` és `bas-task-dlq` Queue-ok létrehozva és működnek
- A TaskDecomposerAgent sikeresen küld feladatokat a Queue-ba
- A consumer Worker-ek feldolgozzák a feladatokat retry logikával
- A DLQ fogadja a 3x sikertelen feladatokat
- Az end-to-end pipeline működik: feladat → Queue → agent → eredmény
