import cron from 'node-cron';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';
import { agentManager } from '../../agents/AgentManager.js';
import { PythonShell } from 'python-shell';
import { JulesAutomationService } from '../../core/julesAutomationService.js';
import { executeLearningLoopCycle } from '../../core/learningLoopService.js';
import { eventFabric, createSchedulerTaskOutcomeEnvelope } from '../../core/eventFabric.js';

interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  cron_expression: string;
  handler: string;
  enabled: boolean;
  metadata?: string | null;
}

interface JulesAutomationAction {
  type: string;
  target: string;
  params?: Record<string, unknown>;
}

interface WeeklyResearchSource {
  name: string;
  url: string;
}

interface WeeklyResearchTaskMetadata extends Record<string, unknown> {
  agentName?: string;
  reportTitle?: string;
  reportType?: string;
  reportOutputDir?: string;
  lookbackDays?: number;
  githubQueries?: string[];
  sourcePages?: WeeklyResearchSource[];
  topics?: string[];
  tags?: string[];
  maxGitHubResults?: number;
  maxExcerptLength?: number;
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
    await this.ensureWeeklyResearchTask();
    await this.importJulesAutomations();
    await this.refreshSchedule();
  }

  /**
   * Import enabled Jules automation rules from .jules.yml into scheduled_tasks.
   * Safe and idempotent: existing tasks are skipped by title.
   */
  private async importJulesAutomations() {
    try {
      const db = getGlobalDb();
      const julesService = new JulesAutomationService(db);

      const result = await julesService.importJulesAutomations({
        skipIfExists: true,
        enableImmediately: true,
      });

      logInfo(
        'ScheduledTasksRunner',
        `Jules automations import complete: ${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} errors`,
      );

      if (result.errors.length > 0) {
        for (const err of result.errors) {
          logError('ScheduledTasksRunner', `Jules automation import error: ${err}`);
        }
      }
    } catch (error) {
      logError('ScheduledTasksRunner', `Failed to import Jules automations: ${error}`);
    }
  }

  /**
   * Ensure the weekly AI research task exists and stays configured.
   */
  private async ensureWeeklyResearchTask() {
    try {
      const db = getGlobalDb();
      const now = new Date().toISOString();
      const metadata: WeeklyResearchTaskMetadata = {
        agentName: 'AIResearchWeekly',
        reportTitle: 'Heti AI Ökoszisztéma Figyelő',
        reportType: 'weekly_ai_ecosystem_watch',
        reportOutputDir: 'docs/001_Jelentés',
        lookbackDays: 7,
        githubQueries: [
          'topic:ai-agent sort:updated stars:>50',
          'topic:agentic sort:updated stars:>50',
          'topic:mcp sort:updated stars:>50',
          'browser automation playwright agent sort:updated stars:>25',
        ],
        sourcePages: [
          { name: 'GitHub Changelog', url: 'https://github.blog/changelog/' },
          { name: 'Chrome DevTools - What\'s New', url: 'https://developer.chrome.com/docs/devtools/whatsnew/' },
          { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/' },
          { name: 'Microsoft AI Foundry', url: 'https://www.microsoft.com/en-us/ai/ai-foundry' },
          { name: 'LangChain Blog', url: 'https://blog.langchain.dev/' },
          { name: 'Anthropic News', url: 'https://www.anthropic.com/news' },
          { name: 'OpenAI News', url: 'https://openai.com/news/' },
        ],
        topics: [
          'GitHub open source AI agent framework updates',
          'Chrome DevTools / browser automation updates',
          'Google AI / Gemini updates',
          'Azure AI Foundry updates',
          'AI agent ecosystem experiments and releases',
        ],
        tags: ['weekly', 'ai', 'research', 'agents', 'foundry'],
        maxGitHubResults: 4,
        maxExcerptLength: 3500,
      };

      const prompt = 'Heti AI ökoszisztéma kutatás és jelentéskészítés';

      db.prepare(`
        INSERT INTO scheduled_tasks (
          id,
          title,
          prompt,
          cron_expression,
          handler,
          enabled,
          metadata,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          prompt = excluded.prompt,
          cron_expression = excluded.cron_expression,
          handler = excluded.handler,
          enabled = excluded.enabled,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `).run(
        'weekly-ai-research',
        'Weekly AI Ecosystem Research',
        prompt,
        '0 5 * * 1',
        'agent',
        JSON.stringify(metadata),
        now,
        now,
      );

      logInfo('ScheduledTasksRunner', 'Weekly AI research task ensured.');
    } catch (error) {
      logError('ScheduledTasksRunner', `Failed to ensure weekly AI research task: ${error}`);
    }
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
          },
          {
            id: 'nightly-reflection-cycle',
            title: 'Nightly Reflection & Continual Learning Cycle',
            prompt: 'Run ReflectionEngine.runNightlyCycle(): consolidate lessons from the past day, detect pain points, update SelfModel, and persist meta-insights to GraphRAG.',
            cron_expression: '0 2 * * *',
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
      let result: unknown = null;
      const metadata = this.parseTaskMetadata(task) as WeeklyResearchTaskMetadata;
      const taskContext = {
        ...metadata,
        scheduledTaskId: task.id,
        scheduledTaskTitle: task.title,
        scheduledCronExpression: task.cron_expression,
        scheduledHandler: task.handler,
        scheduledTaskStartedAt: startTime,
      };

      if (task.handler === 'agent') {
        const preferredAgent = typeof metadata.agentName === 'string' && metadata.agentName.trim()
          ? metadata.agentName.trim()
          : undefined;

        if (preferredAgent) {
          logInfo('ScheduledTasksRunner', `Executing scheduled task via explicit agent: ${preferredAgent}`);
          result = await agentManager.delegate(preferredAgent, task.prompt, taskContext);
        } else {
          // Execute via Agent Manager with auto-routing
          result = await agentManager.delegateTask({
            id: `scheduled-${task.id}-${Date.now()}`,
            instruction: task.prompt,
            context: taskContext,
            source: 'scheduler',
            createdAt: new Date().toISOString(),
          });
        }
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
          pythonShell.on('stdout', (message: string) => {
            scriptOutput += message;
          });
          pythonShell.end((err: Error | null, code: number | undefined, signal: string | undefined) => {
            if (err) return reject(err);
            resolve({ output: scriptOutput, code, signal });
          });
        });
      } else if (task.handler === 'jules_automation') {
        result = await this.executeJulesAutomation(task);
      } else if (task.handler === 'learning_loop_cycle') {
        const loopMeta = this.parseTaskMetadata(task);
        result = await executeLearningLoopCycle({
          dryRun: typeof loopMeta.dryRun === 'boolean' ? loopMeta.dryRun : true,
          promotePassed: typeof loopMeta.promotePassed === 'boolean' ? loopMeta.promotePassed : false,
          baselineModel: typeof loopMeta.baselineModel === 'string' ? loopMeta.baselineModel : undefined,
        });
        const finishedAt = new Date().toISOString();
        const envelope = createSchedulerTaskOutcomeEnvelope(task, {
          status: 'success',
          startedAt: startTime,
          finishedAt,
          durationMs: Date.now() - new Date(startTime).getTime(),
        });
        eventFabric.publish(envelope);
      } else if (task.handler === 'project_maintainer') {
        const { runProjectMaintainerReport } = await import('../services/projectMaintainerService.js');
        const { ReflectionEngine } = await import('../../core/reflectionEngine.js');
        const pmMeta = this.parseTaskMetadata(task);
        const dryRun = typeof pmMeta.dryRun === 'boolean' ? pmMeta.dryRun : true;
        const triggeredBy = typeof pmMeta.triggeredBy === 'string' ? pmMeta.triggeredBy : 'scheduler';
        const report = await runProjectMaintainerReport({ dryRun, triggeredBy });
        await ReflectionEngine.getInstance().ingestProjectMaintainerReport(report);
        result = report;
      } else {
        throw new Error(`Unknown handler: ${task.handler}`);
      }

      // Update DB with success
      this.updateTaskStatus(task.id, 'success', result);
      logInfo('ScheduledTasksRunner', `Task executed successfully: ${task.title}`);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError('ScheduledTasksRunner', `Task execution failed (${task.title}): ${errorMsg}`);
      this.updateTaskStatus(task.id, 'failed', { error: errorMsg });
    }
  }

  private parseTaskMetadata(task: ScheduledTask): Record<string, unknown> {
    if (!task.metadata) {
      return {};
    }

    try {
      return JSON.parse(task.metadata) as Record<string, unknown>;
    } catch (error) {
      logWarn('ScheduledTasksRunner', `Invalid metadata JSON for task ${task.id}: ${error}`);
      return {};
    }
  }

  private async executeJulesAutomation(task: ScheduledTask): Promise<Record<string, unknown>> {
    const metadata = this.parseTaskMetadata(task);
    const actions = Array.isArray(metadata.actions)
      ? (metadata.actions as JulesAutomationAction[])
      : [];

    if (actions.length === 0) {
      logWarn('ScheduledTasksRunner', `Jules task ${task.id} has no actions, skipping.`);
      return {
        handler: 'jules_automation',
        executed: 0,
        skipped: 0,
        failed: 0,
        details: ['No actions found in task metadata'],
      };
    }

    const details: string[] = [];
    let executed = 0;
    let skipped = 0;
    let failed = 0;

    for (const action of actions) {
      const label = `${action.type}:${action.target}`;

      // First useful integration: wire Jules "scan/suggested-tasks" to existing scanner endpoint.
      if (action.type === 'scan' && action.target === 'suggested-tasks') {
        try {
          const response = await fetch('http://localhost:3000/api/v1/suggested-tasks/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'jules_automation',
              taskId: task.id,
              ruleId: metadata.ruleId,
              params: action.params || {},
            }),
            signal: AbortSignal.timeout(30_000),
          });

          const payload = await response.json();
          executed++;
          details.push(`${label} -> ok (${response.status})`);
          details.push(`scan result: ${JSON.stringify(payload).slice(0, 400)}`);
        } catch (error) {
          failed++;
          details.push(`${label} -> failed (${error})`);
        }
        continue;
      }

      skipped++;
      details.push(`${label} -> skipped (no native executor yet)`);
      logWarn('ScheduledTasksRunner', `Jules action skipped for task ${task.id}: ${label}`);
    }

    return {
      handler: 'jules_automation',
      ruleId: metadata.ruleId,
      executed,
      skipped,
      failed,
      details,
    };
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
