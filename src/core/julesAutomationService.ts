import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '../utils/logger.js';
import { JulesConfigParser, type ScheduledTaskSpec } from './julesConfigParser.js';

export interface CreateTaskOptions {
  skipIfExists?: boolean;
  enableImmediately?: boolean;
}

export class JulesAutomationService {
  private db: Database.Database;
  private parser: JulesConfigParser;

  constructor(db: Database.Database, configPath?: string) {
    this.db = db;
    this.parser = new JulesConfigParser(configPath);
  }

  /**
   * Import Jules automation rules as scheduled tasks
   */
  async importJulesAutomations(options: CreateTaskOptions = {}): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const result: { imported: number; skipped: number; errors: string[] } = { imported: 0, skipped: 0, errors: [] };

    try {
      const rules = this.parser.getAutomationRules();
      logInfo('JulesAutomation', `Found ${rules.length} automation rules to import`);

      for (const rule of rules) {
        try {
          const taskSpec = this.parser.ruleToScheduledTask(rule);
          const created = this.createScheduledTask(taskSpec, options);

          if (created) {
            result.imported++;
            logInfo('JulesAutomation', `Imported rule: ${rule.name}`);
          } else {
            result.skipped++;
            logInfo('JulesAutomation', `Skipped existing rule: ${rule.name}`);
          }
        } catch (err) {
          result.errors.push(`${rule.name}: ${err}`);
          logError('JulesAutomation', `Failed to import rule ${rule.name}: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Import failed: ${err}`);
      logError('JulesAutomation', `Import failed: ${err}`);
    }

    return result;
  }

  /**
   * Create a scheduled task from Jules task spec
   */
  createScheduledTask(spec: ScheduledTaskSpec, options: CreateTaskOptions = {}): boolean {
    try {
      // Check if exists
      const existing = this.db
        .prepare('SELECT id FROM scheduled_tasks WHERE title = ?')
        .get(spec.title);

      if (existing && options.skipIfExists) {
        logInfo('JulesAutomation', `Task already exists: ${spec.title}`);
        return false;
      }

      const taskId = uuidv4();
      const now = new Date().toISOString();

      this.db
        .prepare(
          `
        INSERT INTO scheduled_tasks (
          id, title, prompt, cron_expression, handler,
          enabled, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          taskId,
          spec.title,
          spec.prompt,
          spec.cron_expression,
          spec.handler,
          options.enableImmediately ? 1 : 0,
          JSON.stringify(spec.metadata || {}),
          now,
          now,
        );

      logInfo('JulesAutomation', `Created scheduled task: ${spec.title}`);
      return true;
    } catch (err) {
      logError('JulesAutomation', `Failed to create task: ${err}`);
      throw err;
    }
  }

  /**
   * Handle Render webhook and import Jules config
   */
  async handleRenderWebhook(payload: Record<string, unknown>): Promise<{
    success: boolean;
    message: string;
    result?: { imported: number; skipped: number; errors: string[] };
  }> {
    try {
      logInfo('JulesAutomation', 'Processing Render webhook');

      // Trigger Jules config import
      const importResult = await this.importJulesAutomations({
        skipIfExists: true,
        enableImmediately: false,
      });

      return {
        success: true,
        message: `Imported ${importResult.imported} Jules automation rules`,
        result: importResult,
      };
    } catch (err) {
      const message = `Render webhook processing failed: ${err}`;
      logError('JulesAutomation', message);
      return { success: false, message };
    }
  }

  /**
   * Get all imported Jules tasks
   */
  getImportedTasks(): Array<{
    id: string;
    title: string;
    source: string;
  }> {
    try {
      const tasks = this.db
        .prepare("SELECT id, title FROM scheduled_tasks WHERE metadata LIKE ?")
        .all('%"source":"jules_config"%') as Array<{ id: string; title: string }>;

      return tasks.map((t) => ({
        ...t,
        source: 'jules_config',
      }));
    } catch (err) {
      logError('JulesAutomation', `Failed to get imported tasks: ${err}`);
      return [];
    }
  }
}
