import cron from 'node-cron';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError } from '@packages/utils/logger.js';
import {
  saveTestRun,
  getTestStats,
  deleteOldTestRuns,
  type TestRun
} from '@packages/core-logic/testResultsService.js';

export interface TestRunnerConfig {
  schedule: string;
  enabled: boolean;
  triggerType: 'scheduled' | 'manual' | 'api';
}

let schedulerTask: any | null = null;

export async function runTests(triggerType: 'scheduled' | 'manual' | 'api' = 'manual'): Promise<TestRun> {
  const runId = uuidv4();
  const startedAt = new Date();

  const run: TestRun = {
    id: runId,
    scheduledTime: startedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    status: 'running',
    triggerType,
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    output: '',
    errorLog: '',
    hostname: process.env.HOSTNAME || 'local',
    created_at: startedAt.toISOString()
  };

  try {
    logInfo('TestRunner', `Starting test run ${runId} (trigger: ${triggerType})...`);

    const { output, exitCode } = await executeTests();

    run.endedAt = new Date().toISOString();
    run.duration = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
    run.output = output;
    run.status = exitCode === 0 ? 'passed' : 'failed';

    // Parse vitest output for stats
    const stats = parseTestOutput(output);
    run.totalTests = stats.total;
    run.passed = stats.passed;
    run.failed = stats.failed;
    run.skipped = stats.skipped;

    await saveTestRun(run);
    logInfo('TestRunner', `Test run ${runId} completed. Status: ${run.status}, Passed: ${stats.passed}, Failed: ${stats.failed}`);

    return run;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    run.status = 'failed';
    run.errorLog = msg;
    run.endedAt = new Date().toISOString();
    run.duration = new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime();
    await saveTestRun(run);
    logError('TestRunner', `Test run ${runId} failed: ${msg}`);
    return run;
  } finally {
    // Clean up old test runs (> 30 days)
    try {
      const deletedCount = await deleteOldTestRuns(30);
      if (deletedCount > 0) {
        logInfo('TestRunner', `Cleaned up ${deletedCount} old test runs`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('TestRunner', `Failed to clean up old test runs: ${msg}`);
    }
  }
}

export function startScheduler() {
  const schedule = process.env.TEST_SCHEDULE || '0 2 * * *'; // 2 AM daily
  const enabled = process.env.TEST_SCHEDULER_ENABLED !== 'false';

  if (!enabled) {
    logInfo('TestScheduler', 'Test scheduler is disabled (TEST_SCHEDULER_ENABLED=false)');
    return;
  }

  if (!cron.validate(schedule)) {
    logError('TestScheduler', `Invalid cron expression: ${schedule}`);
    return;
  }

  logInfo('TestScheduler', `Initializing test scheduler with cron expression: ${schedule}`);

  schedulerTask = cron.schedule(schedule, async () => {
    logInfo('TestScheduler', 'Scheduled test run triggered');
    try {
      const result = await runTests('scheduled');
      if (result.status === 'failed') {
        logError('TestScheduler', `Scheduled test run failed: ${result.errorLog}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('TestScheduler', `Scheduled test run exception: ${msg}`);
    }
  });

  logInfo('TestScheduler', `Test scheduler active with schedule: ${schedule}`);
}

export function stopScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    logInfo('TestScheduler', 'Test scheduler stopped');
  }
}

export function getSchedulerStatus() {
  return {
    active: schedulerTask ? true : false,
    schedule: process.env.TEST_SCHEDULE || '0 2 * * *',
    enabled: process.env.TEST_SCHEDULER_ENABLED !== 'false'
  };
}

async function executeTests(): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['test', '--run'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10 * 60 * 1000 // 10 minute timeout
    });

    let output = '';
    let errorOutput = '';

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error('Test execution timeout (10 minutes)'));
    }, 10 * 60 * 1000);

    const handleClose = (code: number | null) => {
      clearTimeout(timeout);
      const exitCode = code ?? 1;
      const fullOutput = output + (errorOutput ? `\n\n=== STDERR ===\n${errorOutput}` : '');
      resolve({ output: fullOutput, exitCode });
    };

    proc.stdout?.on('data', (chunk) => {
      output += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    proc.on('close', handleClose);

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function parseTestOutput(output: string): { total: number; passed: number; failed: number; skipped: number } {
  // Parse vitest output format
  // Look for patterns like: "✓ 45 passed ... × 2 failed ... ⊙ 1 skipped"
  
  const passedMatch = output.match(/✓\s+(\d+)\s+pass/);
  const failedMatch = output.match(/×\s+(\d+)\s+fail/);
  const skippedMatch = output.match(/⊙\s+(\d+)\s+skip/);

  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;

  const total = passed + failed + skipped;

  return { total, passed, failed, skipped };
}
