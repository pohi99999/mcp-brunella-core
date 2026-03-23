# Specifikáció: Agent Memória & Tanulás
**Track ID:** `agent_memory_structured_20260323`
**Státusz:** active | **Prioritás:** HIGH
**Assignee:** Copilot + Pohánka Péter
**Függőség:** guardrails_evaluation_20260323

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz |
|---|---|
| `src/utils/rag.ts` HybridMemory | ✅ LanceDB vektor keresés + JSONL backup |
| `BaseAgent.queryMemory/saveToMemory` | ✅ RAG szöveg mentés/lekérdezés |
| `goldenDatasetBridge.ts` | ✅ D1 cloud mentés, FNV-1a dedup |
| **Strukturált memória** | ❌ Nincs agent-specifikus SQL memória |
| **Pattern reuse** | ❌ Nincs sikeres minta cache |
| **Memória TTL** | ❌ Nincs automatikus lejárat |

## 2. Cél: Hybrid Memory Architecture

```
Agent.execute(task)
    │
    ├── [1] Pattern Check (SQLite) ── HIT → cached result (shortcut)
    │                                  MISS ↓
    ├── [2] RAG Query (LanceDB) ── releváns kontextus
    │
    ├── [3] Execute Task
    │
    ├── [4] Guardrails Validáció (confidence, schema)
    │
    └── [5] Memory Save
         ├── SQLite structured_memory (agent, task_hash, result, confidence)
         ├── LanceDB RAG (szöveg + embedding)
         └── Golden Dataset (ha quality > 0.5)
```

## 3. SQLite Séma

```sql
CREATE TABLE agent_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  task_type TEXT,
  task_hash TEXT NOT NULL,       -- FNV-1a hash a task szövegből
  task_text TEXT,
  result_status TEXT NOT NULL,   -- 'success' | 'error' | 'partial'
  result_data TEXT,              -- JSON stringified
  confidence REAL DEFAULT 0.5,
  reuse_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,               -- NULL = never expires
  UNIQUE(agent_name, task_hash)
);

CREATE INDEX idx_agent_memories_lookup ON agent_memories(agent_name, task_hash);
CREATE INDEX idx_agent_memories_expiry ON agent_memories(expires_at);
```

## 4. Pattern Reuse Logic

```typescript
async function checkPattern(agent: string, task: string): Promise<CachedResult | null> {
  const hash = fnvHash(normalizeTask(task));
  const cached = await db.get(
    'SELECT * FROM agent_memories WHERE agent_name = ? AND task_hash = ? AND result_status = ? AND (expires_at IS NULL OR expires_at > datetime("now"))',
    [agent, hash, 'success']
  );
  if (cached && cached.confidence >= 0.7) {
    await db.run('UPDATE agent_memories SET reuse_count = reuse_count + 1 WHERE id = ?', [cached.id]);
    return { data: JSON.parse(cached.result_data), fromCache: true, confidence: cached.confidence };
  }
  return null;
}
```

## 5. Sikerességi Kritériumok

- [ ] SQLite `agent_memories` tábla létezik és működik
- [ ] Pattern reuse: azonos task → cached result (shortcut, nincs LLM hívás)
- [ ] TTL: 30 napos lejárat default, purge automatikus
- [ ] Golden Dataset lokális mentés D1 mellett
- [ ] Dashboard MemoryPanel: per-agent stats, cache hit rate
- [ ] CLI: `brunella memory` parancs
- [ ] `npm run build && npm test` → 0 hiba
