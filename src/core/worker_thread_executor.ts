/**
 * Worker Thread Executor Script
 * 
 * This script runs in isolated Worker Threads to execute code safely.
 * It receives tasks via parentPort messages and returns results.
 * 
 * @track bas_security_sandbox_20260221
 * @phase Phase 2:Sandbox Execution Environment
 */

import { parentPort, workerData } from 'worker_threads';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = util.promisify(exec);

// ============================================================================
// TYPES (must match parent types)
// ============================================================================

interface WorkerTask {
  id: string;
  code: string;
  language: 'python' | 'javascript' | 'typescript';
  timeout?: number;
  env?: Record<string, string>;
  workingDir?: string;
}

interface WorkerResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  stats?: {
    duration_ms: number;
    memory_mb: number;
    cpu_percent: number;
  };
}

// ============================================================================
// EXECUTOR FUNCTIONS
// ============================================================================

async function executePython(task: WorkerTask): Promise<WorkerResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bas-worker-'));
  const scriptPath = path.join(tempDir, 'script.py');

  try {
    // Write code to temp file
    await fs.writeFile(scriptPath, task.code, 'utf-8');

    // Execute Python
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`python "${scriptPath}"`, {
      timeout: task.timeout || 60000,
      env: { ...process.env, ...task.env },
      cwd: task.workingDir || tempDir,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      output: stdout,
      error: stderr || undefined,
      exitCode: 0,
      stats: {
        duration_ms:duration,
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpu_percent: 0 // TODO: Implement CPU tracking
      }
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    
    return {
      success: false,
      output: err.stdout,
      error: err.stderr || String(error),
      exitCode: err.code || 1,
      stats: {
        duration_ms: Date.now() - Date.now(),
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpu_percent: 0
      }
    };
  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function executeJavaScript(task: WorkerTask): Promise<WorkerResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bas-worker-'));
  const scriptPath = path.join(tempDir, 'script.js');

  try {
    // Write code to temp file
    await fs.writeFile(scriptPath, task.code, 'utf-8');

    // Execute Node.js
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
      timeout: task.timeout || 60000,
      env: { ...process.env, ...task.env },
      cwd: task.workingDir || tempDir,
      maxBuffer: 10 * 1024 * 1024
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      output: stdout,
      error: stderr || undefined,
      exitCode: 0,
      stats: {
        duration_ms: duration,
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpu_percent: 0
      }
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    
    return {
      success: false,
      output: err.stdout,
      error: err.stderr || String(error),
      exitCode: err.code || 1,
      stats: {
        duration_ms: Date.now() - Date.now(),
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpu_percent: 0
      }
    };
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
}

async function executeTypeScript(task: WorkerTask): Promise<WorkerResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bas-worker-'));
  const scriptPath = path.join(tempDir, 'script.ts');

  try {
    // Write code to temp file
    await fs.writeFile(scriptPath, task.code, 'utf-8');

    // Execute TypeScript via ts-node or tsx
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(`npx tsx "${scriptPath}"`, {
      timeout: task.timeout || 60000,
      env: { ...process.env, ...task.env },
      cwd: task.workingDir || tempDir,
      maxBuffer: 10 * 1024 * 1024
    });

    const duration = Date.now() - startTime;

    return {
      success: true,
      output: stdout,
      error: stderr || undefined,
      exitCode: 0,
      stats: {
        duration_ms: duration,
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpu_percent: 0
      }
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    
    return {
      success: false,
      output: err.stdout,
      error: err.stderr || String(error),
      exitCode: err.code || 1,
      stats: {
        duration_ms: Date.now() - Date.now(),
        memory_mb: process.memoryUsage().heapUsed / 1024 / 1024,
        cpu_percent: 0
      }
    };
  } finally {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

if (parentPort) {
  parentPort.on('message', async (task: WorkerTask) => {
    let result: WorkerResult;

    try {
      switch (task.language) {
        case 'python':
          result = await executePython(task);
          break;
        case 'javascript':
          result = await executeJavaScript(task);
          break;
        case 'typescript':
          result = await executeTypeScript(task);
          break;
        default:
          result = {
            success: false,
            error: `Unsupported language: ${task.language}`,
            exitCode: 1
          };
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      result = {
        success: false,
        error: `Worker execution failed: ${msg}`,
        exitCode: 1
      };
    }

    // Send result back to parent
    parentPort!.postMessage(result);
  });
} else {
  console.error('This script must be run as a Worker Thread');
  process.exit(1);
}
