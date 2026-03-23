# Implementációs Terv: Agent Memória & Tanulás
**Track ID:** `agent_memory_structured_20260323`

---

## Phase 1: Structured Memory Store

* [ ] **Task 1.1** — `src/core/structuredMemory.ts`
  - SQLite tábla: `agent_memories` (schema: spec.md-ben)
  - `initMemoryDb()`: tábla létrehozás WAL módban
  - `saveMemory(agent, task, result, confidence, ttlDays?)`: INSERT OR REPLACE
  - `queryMemory(agent, task, limit)`: hash lookup + fallback text search
  - `purgeExpired()`: expired sorok törlése

* [ ] **Task 1.2** — Task normalizáció + hashing
  - `normalizeTask(task)`: lowercase, whitespace trim, stopword eltávolítás
  - `fnvHash(text)`: meglévő FNV-1a implementáció újrafelhasználása (goldenDatasetBridge-ből)

* [ ] **Task 1.3** — Tesztek: `test/memory/structuredMemory.test.ts`
  - Save + query round-trip
  - TTL expiration
  - Duplicate handling (UNIQUE constraint)

## Phase 2: Pattern Reuse Engine

* [ ] **Task 2.1** — `src/core/patternReuse.ts`
  - `checkPattern(agent, task)`: hash lookup → cached result
  - Minimum confidence threshold: 0.7 (konfigurálható)
  - `reuse_count` increment cache hit-nél

* [ ] **Task 2.2** — BaseAgent integráció
  - `execute()` bridge: pattern check BEFORE executeTask()
  - Cache hit → return cached (fromCache: true jelzéssel)
  - Cache miss → executeTask() → save result

* [ ] **Task 2.3** — Cache hit/miss metrikák
  - Prometheus counter: `bas_memory_cache_hits_total`, `bas_memory_cache_misses_total`
  - Per-agent breakdown

## Phase 3: Golden Dataset Local Extension

* [ ] **Task 3.1** — `goldenDatasetBridge.ts` bővítés
  - `saveGoldenSampleLocal(sample)`: SQLite mentés (meglévő D1 mellett)
  - `golden_samples` SQLite tábla (lokális mirror)
  - Quality threshold lokálisan is (RULE-GD1: min 0.5)

* [ ] **Task 3.2** — Szinkronizáció
  - `syncLocalToD1()`: lokális → D1 batch upload
  - `exportGoldenDataset(format)`: JSONL export fine-tuning-hez

## Phase 4: Dashboard + CLI

* [ ] **Task 4.1** — Dashboard: `MemoryPanel.tsx`
  - Per-agent memória statisztikák (entries, avg confidence, cache hit rate)
  - Legutóbbi pattern reuse-ok listája
  - Navigation regisztráció

* [ ] **Task 4.2** — CLI: `src/cli/commands/memory-hu.ts`
  - `brunella memory`: inquirer menü (stats, purge, export)
  - `brunella memory stats`: agent-szintű összesítő
  - `brunella memory purge`: expired + low-confidence törlés

* [ ] **Task 4.3** — Végső tesztek + dokumentáció

---

## 🎯 Sikerességi Kritériumok

1. SQLite `agent_memories` tábla fut
2. Pattern reuse: ≥70% confidence cached task → shortcut (nincs LLM)
3. TTL 30 nap, automatikus purge
4. Golden Dataset lokális + D1
5. Dashboard MemoryPanel + CLI `brunella memory`
6. Összes teszt PASS
