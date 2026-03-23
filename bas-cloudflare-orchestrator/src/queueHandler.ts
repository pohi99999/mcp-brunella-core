/**
 * BAS Queue Handler — Aszinkron task feldolgozás Cloudflare Queues-szal
 *
 * Producer: Task-okat küld a bas-task-queue-ba
 * Consumer: Feldolgozza a task-okat, eredményt a bas-result-queue-ba írja
 * DLQ: Sikertelen task-ok a bas-dlq-ba kerülnek (max 3 retry után)
 *
 * @track cf_queues_integration_20260323
 */

interface QueueEnv {
  AI: any;
  D1_METADATA: D1Database;
  BAS_TASKS: KVNamespace;
  R2_KNOWLEDGE: R2Bucket;
  TASK_QUEUE: Queue<TaskMessage>;
  RESULT_QUEUE: Queue<ResultMessage>;
  DLQ: Queue<TaskMessage>;
  BAS_ANALYTICS: AnalyticsEngineDataset;
  DEFAULT_CODE_MODEL: string;
  FALLBACK_CODE_MODEL: string;
  REASONING_MODEL: string;
  FAST_MODEL: string;
}

export interface TaskMessage {
  taskId: string;
  instruction: string;
  type: string;
  priority: "critical" | "high" | "normal" | "low";
  metadata?: Record<string, unknown>;
  createdAt: string;
  retryCount?: number;
}

export interface ResultMessage {
  taskId: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
  model?: string;
  durationMs: number;
  tokensUsed?: number;
  processedAt: string;
}

/**
 * Enqueue a task for async processing
 */
export async function enqueueTask(
  queue: Queue<TaskMessage>,
  task: TaskMessage,
): Promise<void> {
  await queue.send(task, {
    contentType: "json",
  });
}

/**
 * Enqueue multiple tasks in batch
 */
export async function enqueueBatch(
  queue: Queue<TaskMessage>,
  tasks: TaskMessage[],
): Promise<void> {
  const messages = tasks.map((task) => ({
    body: task,
    contentType: "json" as const,
  }));
  await queue.sendBatch(messages);
}

/**
 * Select the best model based on task type and priority
 */
function selectModel(env: QueueEnv, task: TaskMessage): string {
  if (task.priority === "critical" || task.type === "code") {
    return env.REASONING_MODEL || "@cf/deepseek/deepseek-r1-distill-qwen-32b";
  }
  if (task.priority === "low" || task.type === "general") {
    return env.FAST_MODEL || "@cf/microsoft/phi-4";
  }
  return env.DEFAULT_CODE_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
}

/**
 * Process a single task message via Workers AI
 */
async function processTask(
  env: QueueEnv,
  task: TaskMessage,
): Promise<ResultMessage> {
  const startTime = Date.now();
  const model = selectModel(env, task);

  try {
    const response = (await env.AI.run(model as any, {
      messages: [
        {
          role: "system",
          content: `You are a BAS (Brunella Agent System) task executor. Process the task efficiently and return structured results. Task type: ${task.type}`,
        },
        {
          role: "user",
          content: task.instruction,
        },
      ],
      max_tokens: 2048,
    })) as { response: string; usage?: { total_tokens?: number } };

    const durationMs = Date.now() - startTime;

    // Update D1 status
    await env.D1_METADATA.prepare(
      `UPDATE tasks SET status = 'completed', completed_at = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.model', ?, '$.duration_ms', ?, '$.tokens', ?) WHERE id = ?`,
    )
      .bind(
        Date.now(),
        model,
        durationMs,
        response.usage?.total_tokens || 0,
        task.taskId,
      )
      .run()
      .catch(() => {});

    return {
      taskId: task.taskId,
      status: "completed",
      result: response.response,
      model,
      durationMs,
      tokensUsed: response.usage?.total_tokens,
      processedAt: new Date().toISOString(),
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    // Try fallback model
    if (model !== env.FALLBACK_CODE_MODEL) {
      try {
        const fallbackResponse = (await env.AI.run(
          env.FALLBACK_CODE_MODEL as any,
          {
            messages: [
              { role: "system", content: `Task type: ${task.type}` },
              { role: "user", content: task.instruction },
            ],
            max_tokens: 1024,
          },
        )) as { response: string };

        return {
          taskId: task.taskId,
          status: "completed",
          result: fallbackResponse.response,
          model: env.FALLBACK_CODE_MODEL,
          durationMs: Date.now() - startTime,
          processedAt: new Date().toISOString(),
        };
      } catch {
        // Both models failed
      }
    }

    return {
      taskId: task.taskId,
      status: "failed",
      error: String(error),
      model,
      durationMs,
      processedAt: new Date().toISOString(),
    };
  }
}

/**
 * Queue consumer — batch process incoming tasks
 * Called automatically by CF when messages arrive in bas-task-queue
 */
export async function handleQueueBatch(
  batch: MessageBatch<TaskMessage>,
  env: QueueEnv,
): Promise<void> {
  const results: ResultMessage[] = [];

  for (const message of batch.messages) {
    const task = message.body;

    try {
      const result = await processTask(env, task);
      results.push(result);

      // Report telemetry
      if (env.BAS_ANALYTICS) {
        env.BAS_ANALYTICS.writeDataPoint({
          blobs: [task.taskId, task.type, result.model || "unknown", result.status],
          doubles: [result.durationMs, result.tokensUsed || 0],
          indexes: [task.type],
        });
      }

      message.ack();
    } catch (error) {
      const retryCount = (task.retryCount || 0) + 1;
      if (retryCount >= 3) {
        // Send to DLQ after 3 retries
        message.ack();
      } else {
        message.retry({ delaySeconds: retryCount * 10 });
      }
    }
  }

  // Send results to result queue
  if (results.length > 0 && env.RESULT_QUEUE) {
    try {
      await env.RESULT_QUEUE.sendBatch(
        results.map((r) => ({ body: r, contentType: "json" as const })),
      );
    } catch {
      // Result queue send failed — results already in D1
    }
  }
}
