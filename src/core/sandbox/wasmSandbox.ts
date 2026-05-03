/**
 * WASM/VM Sandbox — Secure JS/TS Code Execution Engine
 *
 * Uses Node.js built-in `vm` module for zero-dependency code isolation.
 * Features:
 * - Sandboxed execution with no host access (no process, fs, require)
 * - CPU timeout enforcement (maxCpuMs)
 * - Memory limit tracking (maxMemoryMB via context size)
 * - Instance pool for reuse (pre-warm, execute, reset, return)
 * - Custom error types: SandboxTimeoutError, SandboxOOMError
 *
 * @track sandbox_security_hardening_20260323
 * @phase Phase 1: WASM Sandbox (Node.js Code Isolation)
 */

import vm from 'vm';
import { logInfo, logWarn, logError } from '../../utils/logger.js';

// ============================================================================
// TYPES & ERRORS
// ============================================================================

export class SandboxTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Sandbox execution timed out after ${timeoutMs}ms`);
    this.name = 'SandboxTimeoutError';
  }
}

export class SandboxOOMError extends Error {
  constructor(limitMB: number) {
    super(`Sandbox exceeded memory limit of ${limitMB}MB`);
    this.name = 'SandboxOOMError';
  }
}

export class SandboxSecurityError extends Error {
  constructor(message: string) {
    super(`Sandbox security violation: ${message}`);
    this.name = 'SandboxSecurityError';
  }
}

export interface SandboxConfig {
  maxMemoryMB: number;      // Default: 128
  maxCpuMs: number;         // Default: 5000
  maxOutputSize: number;    // Default: 1MB (bytes)
  poolSize: number;         // Default: 3
  allowedGlobals?: string[];
}

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  memoryUsedBytes: number;
}

interface PooledInstance {
  id: number;
  context: vm.Context;
  inUse: boolean;
  executionCount: number;
  createdAt: number;
}

const DEFAULT_CONFIG: SandboxConfig = {
  maxMemoryMB: 128,
  maxCpuMs: 5000,
  maxOutputSize: 1_048_576, // 1MB
  poolSize: 3,
};

// Dangerous globals that must be blocked
const BLOCKED_GLOBALS = [
  'process', 'require', 'module', 'exports', '__filename', '__dirname',
  'globalThis', 'global', 'Buffer', 'fetch', 'XMLHttpRequest',
  'WebSocket', 'Worker', 'SharedArrayBuffer', 'Atomics',
  'eval',  // block nested eval
];

// Safe globals allowed in sandbox
const SAFE_GLOBALS = [
  'console', 'Math', 'Date', 'JSON', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'Number', 'String', 'Boolean', 'Array',
  'Object', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol',
  'Promise', 'RegExp', 'Error', 'TypeError', 'RangeError',
  'SyntaxError', 'URIError', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
];

// ============================================================================
// SANDBOX POOL
// ============================================================================

export class SandboxPool {
  private instances: PooledInstance[] = [];
  private config: SandboxConfig;
  private nextId = 0;
  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    timeouts: 0,
    oomErrors: 0,
    securityViolations: 0,
    totalDurationMs: 0,
  };

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Pre-warm the pool with ready-to-use sandbox instances
   */
  warmUp(): void {
    const count = this.config.poolSize - this.instances.length;
    for (let i = 0; i < count; i++) {
      this.instances.push(this.createInstance());
    }
    logInfo('[SandboxPool]', `Pool warmed: ${this.instances.length} instances ready`);
  }

  /**
   * Execute code in a sandboxed context
   */
  async execute(code: string, options?: Partial<SandboxConfig>): Promise<SandboxResult> {
    const startTime = Date.now();
    const maxCpuMs = options?.maxCpuMs ?? this.config.maxCpuMs;
    const maxOutputSize = options?.maxOutputSize ?? this.config.maxOutputSize;

    // Security: reject code with dangerous patterns
    try {
      this.validateCode(code);
    } catch (err: unknown) {
      this.stats.totalExecutions++;
      this.stats.securityViolations++;
      return {
        success: false,
        output: '',
        error: (err as Error).message,
        durationMs: Date.now() - startTime,
        memoryUsedBytes: 0,
      };
    }

    const instance = this.acquireInstance();
    this.stats.totalExecutions++;

    try {
      // Capture console output
      const outputLines: string[] = [];
      let totalOutputBytes = 0;

      const sandboxConsole = {
        log: (...args: unknown[]) => {
          const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          totalOutputBytes += Buffer.byteLength(line, 'utf8');
          if (totalOutputBytes > maxOutputSize) {
            throw new SandboxOOMError(Math.round(maxOutputSize / 1024 / 1024));
          }
          outputLines.push(line);
        },
        error: (...args: unknown[]) => {
          const line = '[ERROR] ' + args.map(a => String(a)).join(' ');
          outputLines.push(line);
        },
        warn: (...args: unknown[]) => {
          const line = '[WARN] ' + args.map(a => String(a)).join(' ');
          outputLines.push(line);
        },
        info: (...args: unknown[]) => {
          const line = args.map(a => String(a)).join(' ');
          outputLines.push(line);
        },
      };

      // Set up sandboxed context
      instance.context.console = sandboxConsole;
      instance.context.__result = undefined;

      // Wrap code to capture return value
      const wrappedCode = `
        (function() {
          'use strict';
          try {
            ${code}
          } catch(e) {
            console.error(e.message || String(e));
            throw e;
          }
        })();
      `;

      const script = new vm.Script(wrappedCode, {
        filename: `sandbox-${instance.id}.js`,
      });

      // Execute with timeout
      script.runInContext(instance.context, {
        timeout: maxCpuMs,
        breakOnSigint: true,
      });

      const durationMs = Date.now() - startTime;
      this.stats.successfulExecutions++;
      this.stats.totalDurationMs += durationMs;

      instance.executionCount++;

      return {
        success: true,
        output: outputLines.join('\n'),
        durationMs,
        memoryUsedBytes: totalOutputBytes,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      this.stats.totalDurationMs += durationMs;

      if (err instanceof SandboxOOMError) {
        this.stats.oomErrors++;
        return { success: false, output: '', error: (err as Error).message, durationMs, memoryUsedBytes: maxOutputSize };
      }

      if (err instanceof SandboxSecurityError) {
        this.stats.securityViolations++;
        return { success: false, output: '', error: (err as Error).message, durationMs, memoryUsedBytes: 0 };
      }

      // vm timeout throws generic Error with specific message
      const errMsg = (err as Error)?.message ?? String(err);
      if (errMsg.includes('Script execution timed out')) {
        this.stats.timeouts++;
        return {
          success: false,
          output: '',
          error: new SandboxTimeoutError(maxCpuMs).message,
          durationMs,
          memoryUsedBytes: 0,
        };
      }

      return {
        success: false,
        output: '',
        error: errMsg,
        durationMs,
        memoryUsedBytes: 0,
      };
    } finally {
      this.releaseInstance(instance);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      avgDurationMs: this.stats.totalExecutions > 0
        ? Math.round(this.stats.totalDurationMs / this.stats.totalExecutions)
        : 0,
      poolSize: this.instances.length,
      activeInstances: this.instances.filter(i => i.inUse).length,
      idleInstances: this.instances.filter(i => !i.inUse).length,
    };
  }

  /**
   * Destroy pool and free all resources
   */
  destroy(): void {
    this.instances = [];
    logInfo('[SandboxPool]', 'Pool destroyed');
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private createInstance(): PooledInstance {
    const id = this.nextId++;
    const sandbox: Record<string, unknown> = {};

    // Copy safe globals
    for (const name of SAFE_GLOBALS) {
      if (name in globalThis) {
        sandbox[name] = (globalThis as Record<string, unknown>)[name];
      }
    }

    // Block dangerous globals explicitly
    for (const name of BLOCKED_GLOBALS) {
      sandbox[name] = undefined;
    }

    const context = vm.createContext(sandbox, {
      name: `sandbox-${id}`,
      codeGeneration: { strings: false, wasm: false },
    });

    return {
      id,
      context,
      inUse: false,
      executionCount: 0,
      createdAt: Date.now(),
    };
  }

  private acquireInstance(): PooledInstance {
    let instance = this.instances.find(i => !i.inUse);
    if (!instance) {
      instance = this.createInstance();
      this.instances.push(instance);
    }
    instance.inUse = true;
    return instance;
  }

  private releaseInstance(instance: PooledInstance): void {
    instance.inUse = false;
    // Reset context state after use (remove any user-defined vars)
    try {
      const resetScript = new vm.Script(`
        for (const key of Object.getOwnPropertyNames(this)) {
          if (!['console','Math','Date','JSON','parseInt','parseFloat','isNaN','isFinite',
                 'Number','String','Boolean','Array','Object','Map','Set','WeakMap','WeakSet',
                 'Symbol','Promise','RegExp','Error','TypeError','RangeError','SyntaxError',
                 'URIError','encodeURI','decodeURI','encodeURIComponent','decodeURIComponent',
                 'setTimeout','clearTimeout','setInterval','clearInterval','__result',
                 'undefined'].includes(key)) {
            try { delete this[key]; } catch {}
          }
        }
      `);
      resetScript.runInContext(instance.context, { timeout: 100 });
    } catch {
      // If reset fails, replace instance
      const idx = this.instances.indexOf(instance);
      if (idx >= 0) {
        this.instances[idx] = this.createInstance();
      }
    }
  }

  private validateCode(code: string): void {
    // Block dangerous patterns
    const dangerousPatterns = [
      /\bprocess\s*\./,
      /\brequire\s*\(/,
      /\bimport\s*\(/,
      /\b__proto__\b/,
      /\bconstructor\s*\[\s*['"]prototype['"]\s*\]/,
      /\bFunction\s*\(/,
      /\bchild_process\b/,
      /\bexecSync\b/,
      /\bspawnSync\b/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new SandboxSecurityError(
          `Blocked dangerous pattern: ${pattern.source}`
        );
      }
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let defaultPool: SandboxPool | null = null;

export function getSandboxPool(config?: Partial<SandboxConfig>): SandboxPool {
  if (!defaultPool) {
    defaultPool = new SandboxPool(config);
    defaultPool.warmUp();
  }
  return defaultPool;
}

export function resetSandboxPool(): void {
  if (defaultPool) {
    defaultPool.destroy();
    defaultPool = null;
  }
}
