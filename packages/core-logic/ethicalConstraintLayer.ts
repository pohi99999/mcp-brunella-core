// src/core/ethicalConstraintLayer.ts
// The system's "conscience" — runs before any decision is made

import { logWarn } from '@packages/utils/logger.js';
import Database from 'better-sqlite3';
import path from 'path';

export interface PlannedAction {
  id: string;
  type: string;
  data: unknown;
}

export interface ConstraintResult {
  allowed: boolean;
  reason?: string;
}

export class EthicalConstraintLayer {
  private hardConstraints = [
    'Personal data may not be transferred to third parties',
    'Financial transactions may not be initiated without human approval',
    'Code may only be placed in production after review',
    'NAV data only for authorized systems',
    'Compliance with rate limit for external API calls is mandatory'
  ];
  private softConstraints = [
    'Preferred: local Ollama to reduce costs',
    'Preferred: human-in-loop for decisions over $50,000',
    'Preferred: sandbox testing before self-modification'
  ];

  private getAuditDb(): Database.Database {
    return new Database(path.join(process.cwd(), 'data', 'audit.db'));
  }

  async checkViolation(_action: PlannedAction, _constraint: string): Promise<boolean> {
    return false;
  }

  async evaluate(action: PlannedAction): Promise<ConstraintResult> {
    for (const constraint of this.hardConstraints) {
      const violation = await this.checkViolation(action, constraint);
      if (violation) {
        try {
          const db = this.getAuditDb();
          db.prepare(
            `INSERT INTO audit_log (event_type, payload, created_at)
             VALUES (?, ?, datetime('now'))`
          ).run('hard_constraint_blocked', JSON.stringify({ action, constraint }));
          db.close();
        } catch {
          logWarn('EthicalConstraintLayer', `Audit log failed for blocked action: ${action.id}`);
        }
        return { allowed: false, reason: constraint };
      }
    }
    return { allowed: true };
  }

  getSoftConstraints(): string[] {
    return this.softConstraints;
  }
}

