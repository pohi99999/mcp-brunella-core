/**
 * Worker Thread Pool Manager for BAS Security Sandbox Phase 2
 * 
 * Purpose: Isolate agent code execution in separate Worker Threads
 * to prevent blocking the main event loop and provide better resource limits.
 * 
 * Features:
 * - Thread pool with configurable size
 * - Task queue management
 * - Resource limits (memory, CPU time)
 * - Automatic thread recycling
 * - Error recovery and thread restart
 * 
 * @track bas_security_sandbox_20260221
 * @phase Phase 2: Sandbox Execution Environment
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logWarn, logError } from '@packages/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);

// ============================================================================
// TYPES
// ============================================================================

export interface WorkerTask {
  id: string;
  code: string;
  language: 'python' | 'javascript' | 'typescript';
  timeout?: number;
  env?: Record<string, string>;
  workingDir?: string;
}

export interface WorkerResult {
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

export interface PoolConfig {
  minThreads: number;
  maxThreads: number;
  idleTimeout: number;
  taskQueueSize: number;
  workerScript: string;
}

export interface PoolStats {
  activeThreads: number;
  idleThreads: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalExecutionTime: number;
}

// ============================================================================
// WORKER THREAD WRAPPER
// ============================================================================

class WorkerThreadWrapper extends EventEmitter {
  private worker: Worker | null = null;
  private busy = false;
  private taskId: string | null = null;
  private startTime: number = 0;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly workerScript: string,
    private readonly idleTimeout: number
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.worker) {
      return; // Already started
    }

    try {
      this.worker = new Worker(this.workerScript, {
        workerData: { poolManaged: true }
      });

      this.worker.on('message', (result) => this.handleMessage(result));
      this.worker.on('error', (error: Error) => this.handleError(error));
      this.worker.on('exit', (code) => this.handleExit(code));

      logInfo('WorkerPool', `Worker thread started: ${this.worker.threadId}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('WorkerPool', `Failed to start worker: ${msg}`);
      throw error;
    }
  }

  async execute(task: WorkerTask): Promise<WorkerResult> {
    if (!this.worker) {
      throw new Error('Worker not started');
    }

    if (this.busy) {
      throw new Error('Worker is busy');
    }

    this.busy = true;
    this.taskId = task.id;
    this.startTime = Date.now();

    // Clear idle timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    // Send task to worker
    this.worker.postMessage(task);

    // Wait for result (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out`));
        this.terminate(); // Kill hanging worker
      }, task.timeout || 60000);

      const messageHandler = (result: WorkerResult) => {
        clearTimeout(timeout);
        this.busy = false;
        this.taskId = null;
        
        const duration = Date.now() - this.startTime;
        result.stats = {
          duration_ms: duration,
          memory_mb: result.stats?.memory_mb || 0,
          cpu_percent: result.stats?.cpu_percent || 0
        };

        // Start idle timer
        this.startIdleTimer();

        resolve(result);
      };

      const errorHandler = (error: Error) => {
        clearTimeout(timeout);
        this.busy = false;
        this.taskId = null;

        reject(error);
      };

      this.once('message', messageHandler);
      this.once('error', errorHandler);
    });
  }

  private handleMessage(result: WorkerResult): void {
    this.emit('message', result);
  }

  private handleError(error: Error): void {
    logError('WorkerPool', `Worker error: ${error.message}`);
    this.emit('error', error);
  }

  private handleExit(code: number): void {
    if (code !== 0) {
      logWarn('WorkerPool', `Worker exited with code ${code}`);
    }
    this.worker = null;
    this.busy = false;
    this.emit('exit', code);
  }

  private startIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      if (!this.busy) {
        logInfo('WorkerPool', 'Terminating idle worker');
        this.terminate();
      }
    }, this.idleTimeout);
  }

  async terminate(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }

    this.busy = false;
    this.taskId = null;
  }

  isBusy(): boolean {
    return this.busy;
  }

  isIdle(): boolean {
    return !this.busy && this.worker !== null;
  }
}

// ============================================================================
// WORKER THREAD POOL
// ============================================================================

export class WorkerThreadPool extends EventEmitter {
  private workers: WorkerThreadWrapper[] = [];
  /** Tracks how many workers are currently being created (concurrent async spawns). */
  private creatingWorkers = 0;
  private taskQueue: Array<{
    task: WorkerTask;
    resolve: (result: WorkerResult) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private stats: PoolStats = {
    activeThreads: 0,
    idleThreads: 0,
    queuedTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    totalExecutionTime: 0
  };

  constructor(private readonly config: PoolConfig) {
    super();
  }

  async initialize(): Promise<void> {
    logInfo('WorkerPool', `Initializing pool: min=${this.config.minThreads}, max=${this.config.maxThreads}`);

    // Start minimum number of workers
    for (let i = 0; i < this.config.minThreads; i++) {
      await this.createWorker();
    }

    logInfo('WorkerPool', `Pool initialized with ${this.workers.length} workers`);
  }

  private async createWorker(): Promise<WorkerThreadWrapper> {
    const worker = new WorkerThreadWrapper(
      this.config.workerScript,
      this.config.idleTimeout
    );

    worker.on('exit', () => {
      // Remove from pool
      this.workers = this.workers.filter(w => w !== worker);
      
      // If pool size drops below minimum, create new worker
      if (this.workers.length < this.config.minThreads) {
        this.createWorker().catch(err => {
          logError('WorkerPool', `Failed to recreate worker: ${err.message}`);
        });
      }
    });

    await worker.start();
    this.workers.push(worker);

    return worker;
  }

  async execute(task: WorkerTask): Promise<WorkerResult> {
    // Check queue size limit
    if (this.taskQueue.length >= this.config.taskQueueSize) {
      throw new Error('Task queue is full');
    }

    // Try to find an idle worker
    let worker = this.workers.find(w => w.isIdle());

    // If no idle worker and pool can grow, create new worker.
    // Include in-flight creations in the capacity check to prevent overshoot
    // when multiple callers race through this branch concurrently (CWE-662).
    if (!worker && (this.workers.length + this.creatingWorkers) < this.config.maxThreads) {
      this.creatingWorkers++;
      try {
        worker = await this.createWorker();
      } finally {
        this.creatingWorkers--;
      }
    }

    // If still no worker available, queue the task
    if (!worker) {
      return new Promise((resolve, reject) => {
        this.taskQueue.push({ task, resolve, reject });
        this.stats.queuedTasks = this.taskQueue.length;
        
        logInfo('WorkerPool', `Task ${task.id} queued (queue size: ${this.taskQueue.length})`);
      });
    }

    // Execute task immediately
    try {
      const result = await worker.execute(task);
      
      this.stats.completedTasks++;
      this.stats.totalExecutionTime += result.stats?.duration_ms || 0;
      
      // Process queue if available
      this.processQueue();
      
      return result;
    } catch (error: unknown) {
      this.stats.failedTasks++;
      
      const msg = error instanceof Error ? error.message : String(error);
      logError('WorkerPool', `Task ${task.id} failed: ${msg}`);
      
      throw error;
    }
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      return;
    }

    const idleWorker = this.workers.find(w => w.isIdle());
    if (!idleWorker) {
      return;
    }

    const queuedItem = this.taskQueue.shift();
    if (!queuedItem) {
      return;
    }

    this.stats.queuedTasks = this.taskQueue.length;

    logInfo('WorkerPool', `Processing queued task ${queuedItem.task.id}`);

    idleWorker.execute(queuedItem.task)
      .then(result => {
        this.stats.completedTasks++;
        this.stats.totalExecutionTime += result.stats?.duration_ms || 0;
        queuedItem.resolve(result);
        
        // Continue processing queue
        this.processQueue();
      })
      .catch(error => {
        this.stats.failedTasks++;
        queuedItem.reject(error);
      });
  }

  getStats(): PoolStats {
    this.stats.activeThreads = this.workers.filter(w => w.isBusy()).length;
    this.stats.idleThreads = this.workers.filter(w => w.isIdle()).length;
    
    return { ...this.stats };
  }

  async shutdown(): Promise<void> {
    logInfo('WorkerPool', 'Shutting down pool...');

    // Reject all queued tasks
    while (this.taskQueue.length > 0) {
      const item = this.taskQueue.shift();
      if (item) {
        item.reject(new Error('Pool shutting down'));
      }
    }

    // Terminate all workers
    await Promise.all(this.workers.map(w => w.terminate()));
    
    this.workers = [];
    
    logInfo('WorkerPool', 'Pool shutdown complete');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalPool: WorkerThreadPool | null = null;

export function getWorkerPool(): WorkerThreadPool {
  if (!globalPool) {
    const isTS = __filename.endsWith('.ts');
    const workerScript = path.resolve(
      path.dirname(__filename),
      isTS ? 'worker_thread_executor.ts' : 'worker_thread_executor.js'
    );

    const config: PoolConfig = {
      minThreads: parseInt(process.env.WORKER_POOL_MIN_THREADS || '2'),
      maxThreads: parseInt(process.env.WORKER_POOL_MAX_THREADS || '10'),
      idleTimeout: parseInt(process.env.WORKER_POOL_IDLE_TIMEOUT || '30000'),
      taskQueueSize: parseInt(process.env.WORKER_POOL_QUEUE_SIZE || '50'),
      workerScript: workerScript
    };

    globalPool = new WorkerThreadPool(config);
    
    // Initialize pool asynchronously
    globalPool.initialize().catch(err => {
      logError('WorkerPool', `Failed to initialize pool: ${err.message}`);
    });
  }

  return globalPool;
}

export async function shutdownWorkerPool(): Promise<void> {
  if (globalPool) {
    await globalPool.shutdown();
    globalPool = null;
  }
}

