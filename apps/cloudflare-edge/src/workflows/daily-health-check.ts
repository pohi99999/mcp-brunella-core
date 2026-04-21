import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

interface Env {
  DB: D1Database;
  AI: Ai;
  BAS_ANALYTICS: AnalyticsEngineDataset;
  TASK_QUEUE: Queue;
  R2_ARTIFACTS: R2Bucket;
  BAS_TASKS: KVNamespace;
  DISCORD_WEBHOOK_URL?: string;
}

export class DailyHealthCheckWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: WorkflowEvent<{ trigger: string }>, step: WorkflowStep) {
    // Step 1: Check D1 database health
    const dbHealth = await step.do('check-d1-health', async () => {
      try {
        const result = await this.env.DB.prepare(
          "SELECT COUNT(*) as count FROM tasks"
        ).first<{ count: number }>();
        return { status: 'ok', taskCount: result?.count ?? 0 };
      } catch (e) {
        return { status: 'error', error: String(e) };
      }
    });

    // Step 2: Check KV store
    const kvHealth = await step.do('check-kv-health', async () => {
      try {
        const keys = await this.env.BAS_TASKS.list({ limit: 1 });
        return { status: 'ok', keyCount: keys.keys.length };
      } catch (e) {
        return { status: 'error', error: String(e) };
      }
    });

    // Step 3: Check R2 bucket
    const r2Health = await step.do('check-r2-health', async () => {
      try {
        const objects = await this.env.R2_ARTIFACTS.list({ limit: 1 });
        return { status: 'ok', objectCount: objects.objects.length };
      } catch (e) {
        return { status: 'error', error: String(e) };
      }
    });

    // Step 4: Generate report
    const report = await step.do('generate-report', async () => {
      const allHealthy = dbHealth.status === 'ok' && kvHealth.status === 'ok' && r2Health.status === 'ok';
      return {
        timestamp: new Date().toISOString(),
        healthy: allHealthy,
        services: { d1: dbHealth, kv: kvHealth, r2: r2Health },
        trigger: event.payload?.trigger || 'cron',
      };
    });

    // Step 5: Record telemetry
    await step.do('record-telemetry', async () => {
      if (this.env.BAS_ANALYTICS) {
        this.env.BAS_ANALYTICS.writeDataPoint({
          blobs: ['health-check', report.healthy ? 'healthy' : 'unhealthy', report.trigger],
          doubles: [report.healthy ? 1 : 0],
          indexes: ['workflow_health'],
        });
      }
    });

    // Step 6: Save to D1
    await step.do('save-report', async () => {
      try {
        await this.env.DB.prepare(
          'INSERT INTO health_checks (id, status, report, created_at) VALUES (?, ?, ?, ?)'
        ).bind(
          `hc_${Date.now()}`,
          report.healthy ? 'healthy' : 'unhealthy',
          JSON.stringify(report),
          new Date().toISOString()
        ).run();
      } catch {
        // Table might not exist yet — silent fail
      }
    });

    // Step 7: Alert if unhealthy
    if (!report.healthy) {
      await step.do('send-alert', async () => {
        const webhookUrl = this.env.DISCORD_WEBHOOK_URL;
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `⚠️ BAS Health Check FAILED:\n${JSON.stringify(report.services, null, 2)}`,
            }),
          });
        }
      });
    }

    return report;
  }
}
