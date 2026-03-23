# Specifikáció: Cloudflare Queues Aszinkron Task Elosztás

**Track ID:** `cf_queues_task_distribution_20260323`
**Prioritás:** HIGH
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Áttekintés

A Cloudflare Queues bevezetése a BAS rendszerbe aszinkron feladatelosztáshoz. A cél: a `TaskDecomposerAgent` által felbontott részfeladatokat párhuzamosan, megbízhatóan kiosztani az agent Worker-eknek.

### Jelenlegi állapot

A BAS rendszerben a feladatok szinkron módon kerülnek kiosztásra a `TaskDecomposerAgent` → `DAGOrchestratorAgent` láncon keresztül. Ez a megközelítés:

- **Nem skálázódik** — egyidejűleg csak korlátozott számú feladat futhat
- **Nincs retry logika** — ha egy agent worker hiba miatt leáll, a feladat elvész
- **Nincs dead letter queue** — ismételten hibázó feladatok nincsenek kezelve
- **Blokkoló** — a koordinátor várakozik az összes részfeladat befejezésére

### Cél állapot

```
TaskDecomposerAgent
    │
    ▼
[bas-task-queue]  ← Cloudflare Queue (producer)
    │
    ├──▶ Agent Worker 1 (consumer)
    ├──▶ Agent Worker 2 (consumer)
    └──▶ Agent Worker N (consumer)
         │
         ▼
    [bas-task-dlq]  ← Dead Letter Queue (hibás feladatok)
```

---

## 2. Architektúra

### 2.1 Queue definíciók

| Queue név | Típus | Leírás |
|-----------|-------|--------|
| `bas-task-queue` | Fő queue | Feladatok elosztása agent-eknek |
| `bas-task-dlq` | Dead Letter Queue | 3x sikertelen feladatok gyűjtése |
| `bas-priority-queue` | Prioritásos queue | CRITICAL prioritású feladatok |

### 2.2 Üzenet formátum

```typescript
interface TaskMessage {
  taskId: string;
  trackId: string;
  agentType: string;          // pl. "CoderAgent", "ReviewerAgent"
  payload: {
    instruction: string;
    context: Record<string, unknown>;
    files: string[];
  };
  metadata: {
    priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    createdAt: string;        // ISO 8601
    retryCount: number;
    maxRetries: number;       // alapértelmezett: 3
    timeout: number;          // ms, alapértelmezett: 300000 (5 perc)
    parentTaskId?: string;    // DAG szülő feladat
  };
}
```

### 2.3 Producer (Orchestrator Worker)

```typescript
// cloudflare/src/queue-producer.ts
export async function enqueueTask(
  env: Env,
  task: TaskMessage
): Promise<void> {
  const queue = task.metadata.priority === "CRITICAL"
    ? env.BAS_PRIORITY_QUEUE
    : env.BAS_TASK_QUEUE;

  await queue.send(task, {
    contentType: "json",
    delaySeconds: 0,
  });
}

// Batch küldés DAG részfeladatokhoz
export async function enqueueBatch(
  env: Env,
  tasks: TaskMessage[]
): Promise<void> {
  const messages = tasks.map(task => ({
    body: task,
    contentType: "json" as const,
  }));

  await env.BAS_TASK_QUEUE.sendBatch(messages);
}
```

### 2.4 Consumer (Agent Workers)

```typescript
// cloudflare/src/queue-consumer.ts
export default {
  async queue(
    batch: MessageBatch<TaskMessage>,
    env: Env
  ): Promise<void> {
    for (const message of batch.messages) {
      try {
        const result = await processTask(message.body, env);
        message.ack();  // Sikeres feldolgozás
      } catch (error) {
        if (message.body.metadata.retryCount >= message.body.metadata.maxRetries) {
          message.ack();  // DLQ-ba kerül automatikusan
        } else {
          message.retry({
            delaySeconds: Math.pow(2, message.body.metadata.retryCount) * 10,
          });
        }
      }
    }
  },
};
```

---

## 3. Wrangler konfiguráció

A `cloudflare/wrangler.jsonc` fájlba a következő bővítések szükségesek:

```jsonc
{
  "queues": {
    "producers": [
      {
        "binding": "BAS_TASK_QUEUE",
        "queue": "bas-task-queue"
      },
      {
        "binding": "BAS_PRIORITY_QUEUE",
        "queue": "bas-priority-queue"
      }
    ],
    "consumers": [
      {
        "queue": "bas-task-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 30,
        "max_retries": 3,
        "dead_letter_queue": "bas-task-dlq",
        "max_concurrency": 5
      },
      {
        "queue": "bas-priority-queue",
        "max_batch_size": 5,
        "max_batch_timeout": 10,
        "max_retries": 5,
        "dead_letter_queue": "bas-task-dlq",
        "max_concurrency": 10
      }
    ]
  }
}
```

---

## 4. Integráció a meglévő rendszerrel

### 4.1 TaskDecomposerAgent kapcsolódás

A `src/agents/taskDecomposer.ts`-ben a feladat felbontás után a részfeladatok a Queue-ba kerülnek az edge Worker-en keresztül:

```typescript
// Jelenlegi: közvetlen végrehajtás
const subtasks = await decompose(task);
for (const subtask of subtasks) {
  await executeAgent(subtask); // szinkron, blokkoló
}

// Új: Queue-alapú aszinkron elosztás
const subtasks = await decompose(task);
await fetch("https://bas-orchestrator.workers.dev/api/enqueue", {
  method: "POST",
  body: JSON.stringify({ tasks: subtasks }),
});
```

### 4.2 DAG Orchestrator kapcsolódás

A `src/agents/dagOrchestrator.ts` a DAG gráf függőségei alapján ütemezi a Queue-ba küldést:
- Csak azok a feladatok kerülnek a Queue-ba, amelyek összes előfeltétele teljesült
- A Queue consumer visszajelzése alapján frissül a DAG állapot

---

## 5. Monitoring és megfigyelhetőség

- **Queue méret:** CF Dashboard → Queues → Messages in queue
- **DLQ figyelés:** Riasztás ha a `bas-task-dlq` nem üres
- **Feldolgozási idő:** Analytics Engine metrika minden consumer futásról
- **Retry arány:** Consumer-ben logolt retry/ack arány

---

## 6. Kockázatok és korlátozások

- **Queue méret limit:** Cloudflare Queues max 100,000 üzenet / queue (Free tier)
- **Üzenet méret:** Max 128 KB / üzenet — nagy payload-ok R2-be töltendők, csak referencia a Queue-ban
- **Latency:** ~50-200ms a Queue feldolgozási idő — szinkron feladatoknál nem ideális
- **Költség:** Free tier 1M üzenet/hó — a BAS jelenlegi terhelése ezt bőven tartja

---

## 7. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — Queue binding konfiguráció
- `cloudflare/src/index.ts` — Worker entry point
- `src/agents/taskDecomposer.ts` — TaskDecomposerAgent (producer oldal)
- `src/agents/dagOrchestrator.ts` — DAG alapú feladat ütemezés
- `src/agents/registry.json` — Agent regisztráció
