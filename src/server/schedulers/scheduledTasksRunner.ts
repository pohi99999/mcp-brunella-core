import cron from 'node-cron';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logInfo, logError } from '../../utils/logger.js';
import { agentManager } from '../../agents/AgentManager.js';
import { PythonShell } from 'python-shell';

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  cron_expression: string;
  handler: string;
  enabled: boolean;
}

/**
 * ScheduledTasksRunner - Dynamically executes tasks from the database
 */
export class ScheduledTasksRunner {
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Start the runner and schedule all enabled tasks
   */
  public async start() {
    logInfo('ScheduledTasksRunner', 'Initializing dynamic task scheduler...');
    await this.seedDefaults();
    await this.refreshSchedule();
  }

  /**
   * Populate default tasks if the table is empty
   */
  private async seedDefaults() {
    try {
      const db = getGlobalDb();
      const count = (db.prepare('SELECT COUNT(*) as count FROM scheduled_tasks').get() as { count: number }).count;

      if (count === 0) {
        logInfo('ScheduledTasksRunner', 'Seeding default scheduled tasks...');
        const now = new Date().toISOString();
        
        const defaults = [
          {
            id: 'default-market-intel',
            title: 'Market Intel Update',
            prompt: 'Update market prices and intelligence reports',
            cron_expression: '0 8 * * *',
            handler: 'agent'
          },
          {
            id: 'default-sales-hunter',
            title: 'Daily Sales Lead Hunt',
            prompt: 'Find 5 new high-quality leads for automation services in Hungary',
            cron_expression: '0 9 * * *',
            handler: 'agent'
          },
          {
            id: 'default-evaluator-audit',
            title: 'System Health Audit',
            prompt: 'Perform a comprehensive system audit and report any anomalies',
            cron_expression: '0 12 * * *',
            handler: 'agent'
          },
          {
            id: 'data-flywheel-harvester',
            title: 'Tech Harvester - Daily Harvest',
            prompt: 'Run myai/agents/tech_harvester.py with --mode auto to collect new tech trends and competitor info.',
            cron_expression: '0 3 * * *',
            handler: 'python_script'
          },
          {
            id: 'data-flywheel-integrator',
            title: 'Knowledge Integrator - Daily Refine & Index',
            prompt: 'Run myai/tools/knowledge_integrator.py to refine collected data, generate embeddings, and save to LanceDB and golden_dataset.jsonl.',
            cron_expression: '30 3 * * *',
            handler: 'python_script'
          },
          {
            id: 'golden-dataset-verification',
            title: 'Golden Dataset Growth Verification',
            prompt: 'Verify if data/training/golden_dataset.jsonl has increased in size in the last 24 hours. Report status to dashboard/logs.',
            cron_expression: '0 4 * * *',
            handler: 'agent'
          }
        ];

        const insert = db.prepare(`
          INSERT INTO scheduled_tasks (id, title, prompt, cron_expression, handler, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `);

        for (const task of defaults) {
          insert.run(task.id, task.title, task.prompt, task.cron_expression, task.handler, now, now);
        }
        
        logInfo('ScheduledTasksRunner', 'Default tasks seeded successfully.');
      }
    } catch (error) {
      logError('ScheduledTasksRunner', `Failed to seed default tasks: ${error}`);
    }
  }

  /**
   * Refresh the schedule by reloading tasks from the database
   */
  public async refreshSchedule() {
    try {
      const db = getGlobalDb();
      const tasks = db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1').all() as ScheduledTask[];

      logInfo('ScheduledTasksRunner', `Found ${tasks.length} enabled tasks in DB.`);

      // Stop all existing jobs
      this.stopAll();

      // Schedule each task
      for (const task of tasks) {
        this.scheduleTask(task);
      }

      logInfo('ScheduledTasksRunner', 'Schedule refresh complete.');
    } catch (error) {
      logError('ScheduledTasksRunner', `Failed to refresh schedule: ${error}`);
    }
  }

  /**
   * Stop all active cron jobs
   */
  public stopAll() {
    for (const [id, job] of this.activeJobs.entries()) {
      job.stop();
    }
    this.activeJobs.clear();
  }

  /**
   * Schedule a single task
   */
  private scheduleTask(task: ScheduledTask) {
    if (!cron.validate(task.cron_expression)) {
      logError('ScheduledTasksRunner', `Invalid cron expression for task ${task.id}: ${task.cron_expression}`);
      return;
    }

    const job = cron.schedule(task.cron_expression, async () => {
      await this.executeTask(task);
    });

    this.activeJobs.set(task.id, job);
    logInfo('ScheduledTasksRunner', `Task scheduled: ${task.title} (${task.cron_expression})`);
  }

  /**
   * Execute a task based on its handler
   */
  public async executeTask(task: ScheduledTask) {
    const startTime = new Date().toISOString();
    logInfo('ScheduledTasksRunner', `Executing task: ${task.title} (ID: ${task.id})`);

    try {
      let result: any = null;

      if (task.handler === 'agent') {
        // Execute via Agent Manager with auto-routing
        result = await agentManager.delegateTask({
          id: `scheduled-${task.id}-${Date.now()}`,
          instruction: task.prompt,
          source: 'scheduler',
          createdAt: new Date().toISOString()
        });
      } else if (task.handler === 'scan-todos') {
        // Trigger todo scanner via internal API call simulation
        const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'scheduled', taskId: task.id })
        });
        result = await response.json();
      } else if (task.handler === 'python_script') {
        const path = await import('path');
        const scriptPath = task.prompt.split(' ')[0];
        const absoluteScriptPath = path.default.resolve(process.cwd(), scriptPath);
        
        logInfo('ScheduledTasksRunner', `Executing Python script: ${absoluteScriptPath}`);
        const pythonShell = new PythonShell(absoluteScriptPath, {
          mode: 'text',
          pythonOptions: ['-u'],
          args: task.prompt.split(' ').slice(1),
        });

        result = await new Promise((resolve, reject) => {
          let scriptOutput = '';
          pythonShell.on('stdout', (message) => {
            scriptOutput += message;
          });
          pythonShell.end((err, code, signal) => {
            if (err) return reject(err);
            resolve({ output: scriptOutput, code, signal });
          });
        });
      } else {
        throw new Error(`Unknown handler: ${task.handler}`);
      }

      // Update DB with success
      this.updateTaskStatus(task.id, 'success', result);
      logInfo('ScheduledTasksRunner', `Task executed successfully: ${task.title}`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('ScheduledTasksRunner', `Task execution failed (${task.title}): ${errorMsg}`);
      this.updateTaskStatus(task.id, 'failed', { error: errorMsg });
    }
  }

  /**
   * Update task status in database
   */
  private updateTaskStatus(id: string, status: 'success' | 'failed', result: any) {
    try {
      const db = getGlobalDb();
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE scheduled_tasks 
        SET last_run_at = ?, last_status = ?, last_result = ?
        WHERE id = ?
      `).run(now, status, JSON.stringify(result), id);
    } catch (error) {
      logError('ScheduledTasksRunner', `Failed to update task status in DB: ${error}`);
    }
  }
}

// Singleton instance
export const scheduledTasksRunner = new ScheduledTasksRunner();
