// src/core/organizationalSelfModel.ts
// System state and capability awareness for L5 autonomous infrastructure

import { logInfo } from '../utils/logger.js';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

export interface OrgState {
  activeAgents: number;
  availableTools: number;
  systemHealth: string;
  tasksToday: number;
  successRate: number;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  dailyCostUsd: number;
}

export interface CapabilityAssessment {
  feasible: boolean;
  confidence: number;
  bottleneck: string | null;
}

export class OrganizationalSelfModel {
  async getCurrentState(): Promise<OrgState> {
    const tasksDb = new Database(path.join(process.cwd(), 'data', 'tasks.db'));
    let tasksToday = 0;
    let successRate = 0;
    try {
      const today = new Date().toISOString().split('T')[0];
      const row = tasksDb.prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
         FROM tasks WHERE created_at >= ?`
      ).get(today) as { total: number; completed: number } | undefined;
      tasksToday = row?.total ?? 0;
      successRate = tasksToday > 0 ? Math.round(((row?.completed ?? 0) / tasksToday) * 100) : 100;
    } catch {
      // tasks table may not exist yet
    } finally {
      tasksDb.close();
    }

    const memUsed = process.memoryUsage().rss / 1024 / 1024;
    const cpuPercent = os.loadavg()[0] * 10;

    logInfo('OrganizationalSelfModel', 'State snapshot taken');
    return {
      activeAgents: 0,
      availableTools: 0,
      systemHealth: 'ok',
      tasksToday,
      successRate,
      cpuUsagePercent: Math.round(cpuPercent),
      memoryUsageMb: Math.round(memUsed),
      dailyCostUsd: 0,
    };
  }

  async assessCapability(_task: string, state: OrgState): Promise<CapabilityAssessment> {
    const bottleneck = state.cpuUsagePercent > 80 ? 'CPU overload' :
                       state.memoryUsageMb > 1500 ? 'Memory pressure' : null;
    return {
      feasible: bottleneck === null,
      confidence: bottleneck ? 0.4 : 0.85,
      bottleneck,
    };
  }
}
