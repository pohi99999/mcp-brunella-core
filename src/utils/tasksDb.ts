import { defaultTasksDatabaseManager, TasksDatabaseManager } from './tasksDatabaseManager.js';

export { defaultTasksDatabaseManager, TasksDatabaseManager } from './tasksDatabaseManager.js';

export async function initTasksDb(): Promise<void> {
  await defaultTasksDatabaseManager.open();
}

export async function closeTasksDb(): Promise<void> {
  defaultTasksDatabaseManager.close();
}

export async function saveTask(task: { agent: string; task: string; context?: string | null }): Promise<number | bigint | null> {
  return defaultTasksDatabaseManager.saveTask(task);
}

export async function updateTaskStatus(id: number | bigint, status: string, result?: string): Promise<void> {
  return defaultTasksDatabaseManager.updateTaskStatus(id, status, result);
}

export async function loadQueuedTasksForHydration(): Promise<Array<{
  id: number;
  agent: string;
  task: string;
  status: string;
  context: string | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}>> {
  return defaultTasksDatabaseManager.loadQueuedTasksForHydration();
}

export async function getTasks(limit: number = 20, offset: number = 0, status?: string): Promise<Array<{
  id: number;
  agent: string;
  task: string;
  status: string;
  context: string | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}>> {
  return defaultTasksDatabaseManager.getTasks(limit, offset, status);
}

export async function getTaskCount(status?: string): Promise<number> {
  return defaultTasksDatabaseManager.getTaskCount(status);
}

export async function getTaskById(id: number): Promise<{
  id: number;
  agent: string;
  task: string;
  status: string;
  context: string | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
} | null> {
  return defaultTasksDatabaseManager.getTaskById(id);
}

export async function getTaskStats(): Promise<{
  total: number;
  successCount: number;
  errorCount: number;
  pendingCount: number;
  runningCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
  failedByAgent: Array<{ agent: string; count: number }>;
}> {
  return defaultTasksDatabaseManager.getTaskStats();
}

export async function saveBackgroundTask(task: Parameters<TasksDatabaseManager['saveBackgroundTask']>[0]): Promise<void> {
  return defaultTasksDatabaseManager.saveBackgroundTask(task);
}

export async function updateBackgroundTask(task: Parameters<TasksDatabaseManager['updateBackgroundTask']>[0]): Promise<void> {
  return defaultTasksDatabaseManager.updateBackgroundTask(task);
}

export async function loadBackgroundTask(id: string): Promise<Awaited<ReturnType<TasksDatabaseManager['loadBackgroundTask']>>> {
  return defaultTasksDatabaseManager.loadBackgroundTask(id);
}

export async function loadAllBackgroundTasks(limit: number = 50, status?: string): Promise<Awaited<ReturnType<TasksDatabaseManager['loadAllBackgroundTasks']>>> {
  return defaultTasksDatabaseManager.loadAllBackgroundTasks(limit, status);
}

export async function deleteBackgroundTask(id: string): Promise<void> {
  return defaultTasksDatabaseManager.deleteBackgroundTask(id);
}

export async function getBackgroundTaskStats(): Promise<Awaited<ReturnType<TasksDatabaseManager['getBackgroundTaskStats']>>> {
  return defaultTasksDatabaseManager.getBackgroundTaskStats();
}
