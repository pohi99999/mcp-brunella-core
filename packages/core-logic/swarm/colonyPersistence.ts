/**
 * Colony Persistence — SQLite checkpoint save/restore for Swarm colonies
 * Track #5: Swarm Intelligence v2 — Phase 1
 *
 * Uses globalDb (data/brunella.db) to persist colony state as JSON snapshots.
 * Supports auto-checkpoint after N completed tasks and manual save/restore.
 */

import { getGlobalDb } from '@packages/utils/globalDb.js';
import { logInfo, logWarn, logError } from '@packages/utils/logger.js';
import type { SwarmColony, ColonyMetrics } from '@packages/agents/swarm/SwarmManager.js';

export interface ColonyCheckpoint {
  id: number;
  colonyId: string;
  colonyName: string;
  state: 'active' | 'paused' | 'completed' | 'degraded';
  agentsJson: string;
  sharedKnowledgeJson: string | null;
  taskQueueJson: string | null;
  completedTasks: number;
  createdAt: string;
}

export interface ColonySnapshotData {
  agents: Array<{
    agentId: string;
    role: string;
    capabilities: string[];
    stats: { completed: number; failed: number; active: number; successRate: number };
  }>;
  leaderId: string | null;
  metrics: ColonyMetrics;
  objective: string;
}

let initialized = false;

function ensureTable(): void {
  if (initialized) return;
  try {
    const db = getGlobalDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS colony_checkpoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        colony_id TEXT NOT NULL,
        colony_name TEXT,
        state TEXT NOT NULL DEFAULT 'active',
        agents_json TEXT NOT NULL,
        shared_knowledge_json TEXT,
        task_queue_json TEXT,
        completed_tasks INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_colony_checkpoints_colony
        ON colony_checkpoints(colony_id, created_at DESC)
    `);
    initialized = true;
    logInfo('ColonyPersistence', 'colony_checkpoints table ready');
  } catch (err) {
    logError('ColonyPersistence', `Table init failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Save a colony checkpoint — serializes the full colony state to SQLite
 */
export function saveCheckpoint(colony: SwarmColony, sharedKnowledge?: Record<string, unknown>, taskQueue?: string[]): number {
  ensureTable();
  const db = getGlobalDb();

  const agents: ColonySnapshotData['agents'] = [];
  for (const [id, agent] of colony.agents) {
    agents.push({
      agentId: id,
      role: agent.role,
      capabilities: agent.capabilities,
      stats: agent.getStats(),
    });
  }

  const snapshot: ColonySnapshotData = {
    agents,
    leaderId: colony.leaderId,
    metrics: colony.metrics,
    objective: colony.objective,
  };

  const stmt = db.prepare(`
    INSERT INTO colony_checkpoints (colony_id, colony_name, state, agents_json, shared_knowledge_json, task_queue_json, completed_tasks)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    colony.swarmId,
    colony.name,
    colony.status === 'forming' ? 'active' : colony.status,
    JSON.stringify(snapshot),
    sharedKnowledge ? JSON.stringify(sharedKnowledge) : null,
    taskQueue ? JSON.stringify(taskQueue) : null,
    colony.metrics.tasksCompleted,
  );

  logInfo('ColonyPersistence', `Checkpoint saved for colony ${colony.swarmId} (id: ${result.lastInsertRowid})`);
  return Number(result.lastInsertRowid);
}

/**
 * Restore the latest checkpoint for a colony
 */
export function restoreCheckpoint(colonyId: string): ColonyCheckpoint | null {
  ensureTable();
  const db = getGlobalDb();

  const row = db.prepare(`
    SELECT id, colony_id as colonyId, colony_name as colonyName, state, agents_json as agentsJson,
           shared_knowledge_json as sharedKnowledgeJson, task_queue_json as taskQueueJson,
           completed_tasks as completedTasks, created_at as createdAt
    FROM colony_checkpoints
    WHERE colony_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(colonyId) as ColonyCheckpoint | undefined;

  if (!row) {
    logWarn('ColonyPersistence', `No checkpoint found for colony ${colonyId}`);
    return null;
  }

  logInfo('ColonyPersistence', `Checkpoint restored for colony ${colonyId} (id: ${row.id}, tasks: ${row.completedTasks})`);
  return row;
}

/**
 * List all checkpoints for a colony (most recent first)
 */
export function listCheckpoints(colonyId: string, limit = 10): ColonyCheckpoint[] {
  ensureTable();
  const db = getGlobalDb();

  return db.prepare(`
    SELECT id, colony_id as colonyId, colony_name as colonyName, state, agents_json as agentsJson,
           shared_knowledge_json as sharedKnowledgeJson, task_queue_json as taskQueueJson,
           completed_tasks as completedTasks, created_at as createdAt
    FROM colony_checkpoints
    WHERE colony_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(colonyId, limit) as ColonyCheckpoint[];
}

/**
 * Delete old checkpoints, keep only the latest N per colony
 */
export function pruneCheckpoints(colonyId: string, keepCount = 5): number {
  ensureTable();
  const db = getGlobalDb();

  const result = db.prepare(`
    DELETE FROM colony_checkpoints
    WHERE colony_id = ? AND id NOT IN (
      SELECT id FROM colony_checkpoints WHERE colony_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(colonyId, colonyId, keepCount);

  if (result.changes > 0) {
    logInfo('ColonyPersistence', `Pruned ${result.changes} old checkpoints for colony ${colonyId}`);
  }
  return result.changes;
}

/**
 * Parse snapshot JSON back to structured data
 */
export function parseSnapshot(checkpoint: ColonyCheckpoint): ColonySnapshotData | null {
  try {
    return JSON.parse(checkpoint.agentsJson) as ColonySnapshotData;
  } catch {
    logWarn('ColonyPersistence', `Failed to parse snapshot for checkpoint ${checkpoint.id}`);
    return null;
  }
}

/**
 * Get checkpoint statistics across all colonies
 */
export function getCheckpointStats(): { totalCheckpoints: number; colonies: number; latestAt: string | null } {
  ensureTable();
  const db = getGlobalDb();

  const row = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT colony_id) as colonies, MAX(created_at) as latest
    FROM colony_checkpoints
  `).get() as { total: number; colonies: number; latest: string | null };

  return {
    totalCheckpoints: row.total,
    colonies: row.colonies,
    latestAt: row.latest,
  };
}
