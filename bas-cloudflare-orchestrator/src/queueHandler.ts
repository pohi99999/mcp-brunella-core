export async function enqueueTask(
  queue: { send: (task: unknown, options?: { contentType?: string }) => Promise<unknown> },
  task: unknown,
): Promise<void> {
  await queue.send(task, { contentType: "json" });
}

export async function handleQueueBatch(): Promise<void> {
  return;
}
