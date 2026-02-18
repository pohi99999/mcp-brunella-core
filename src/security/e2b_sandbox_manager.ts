import { Sandbox, Result } from '@e2b/code-interpreter';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { SafeZoneValidator, getSafeZoneValidator } from './safe_zone_validator.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * E2BSandboxManager - Secure Python code execution in isolated E2B sandboxes
 *
 * Purpose:
 * - Execute untrusted Python code safely (DataScientistAgent workflows)
 * - Prevent filesystem access outside sandbox
 * - Export artifacts to Safe Zone after validation
 * - Manage sandbox lifecycle (create, cleanup, timeout)
 *
 * Usage:
 * ```typescript
 * const manager = new E2BSandboxManager();
 * const result = await manager.executeCode('print("Hello E2B")');
 * ```
 */

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  logs?: string[];
  artifacts?: string[];  // Paths to exported files
  duration_ms?: number;
  metadata?: {
    sandbox_id?: string;
    python_version?: string;
    packages_installed?: string[];
  };
}

export interface SandboxOptions {
  timeout_ms?: number;        // Max execution time (default: 60000)
  apiKey?: string;             // E2B API key (defaults to env)
  template?: string;           // E2B template (default: 'python')
  packages?: string[];         // Pip packages to install
  export_artifacts?: boolean;  // Export results to Safe Zone (default: true)
  safe_zone_path?: string;     // Target Safe Zone directory
}

/**
 * Manages E2B sandbox lifecycle for secure Python execution
 */
export class E2BSandboxManager {
  private validator: ReturnType<typeof getSafeZoneValidator>;
  private activeSandboxes: Map<string, Sandbox>;
  private executionCount: number;
  private totalDuration: number;

  constructor() {
    this.validator = getSafeZoneValidator();
    this.activeSandboxes = new Map();
    this.executionCount = 0;
    this.totalDuration = 0;
  }

  /**
   * Execute Python code in isolated E2B sandbox
   *
   * @param code - Python code to execute
   * @param options - Execution options (timeout, packages, etc.)
   * @returns ExecutionResult with output, artifacts, and metadata
   */
  async executeCode(
    code: string,
    options: SandboxOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const {
      timeout_ms = 60000,
      apiKey = process.env.E2B_API_KEY,
      template = 'python',
      packages = [],
      export_artifacts = true,
      safe_zone_path = './data/e2b_artifacts'
    } = options;

    if (!apiKey || apiKey === '' || apiKey === 'your-e2b-api-key-here') {
      logError('E2BSandboxManager', 'E2B_API_KEY not configured in .env');
      return {
        success: false,
        error: 'E2B_API_KEY not configured. Please add it to .env file.',
        duration_ms: Date.now() - startTime
      };
    }

    let sandbox: Sandbox | null = null;
    const logs: string[] = [];
    const artifacts: string[] = [];

    try {
      // 1. Create sandbox (with startup timeout)
      logInfo('E2BSandboxManager', `Creating ${template} sandbox...`);

      // Use base Python sandbox (no template required)
      const sandboxPromise = Sandbox.create({ apiKey });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sandbox startup timeout (5s)')), 5000)
      );

      sandbox = await Promise.race([sandboxPromise, timeoutPromise]) as Sandbox;

      this.activeSandboxes.set(sandbox.sandboxId, sandbox);
      logInfo('E2BSandboxManager', `Sandbox ${sandbox.sandboxId} created`);

      // 2. Install packages if needed
      if (packages.length > 0) {
        logInfo('E2BSandboxManager', `Installing packages: ${packages.join(', ')}`);
        const installCode = `
import subprocess
import sys
packages = ${JSON.stringify(packages)}
for pkg in packages:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', pkg])
print(f"Installed {len(packages)} packages")
`;
        const installResult = await this.runWithTimeout(
          () => sandbox!.runCode(installCode),
          10000,
          'Package installation timeout (10s)'
        );

        if (installResult.error) {
          throw new Error(`Package installation failed: ${installResult.error.value}`);
        }
        logs.push(`Installed packages: ${packages.join(', ')}`);
      }

      // 3. Execute user code (with execution timeout)
      logInfo('E2BSandboxManager', `Executing code (${code.length} chars)...`);
      const execution = await this.runWithTimeout(
        () => sandbox!.runCode(code),
        timeout_ms,
        `Execution timeout (${timeout_ms}ms)`
      );

      // 4. Process results
      const duration = Date.now() - startTime;
      this.executionCount++;
      this.totalDuration += duration;

      if (execution.error) {
        logWarn('E2BSandboxManager', `Execution error: ${execution.error.name}`);
        return {
          success: false,
          error: `${execution.error.name}: ${execution.error.value}`,
          logs,
          duration_ms: duration,
          metadata: {
            sandbox_id: sandbox.sandboxId,
            python_version: '3.11'
          }
        };
      }

      // 5. Collect output - stdout logs (print() output) + rich results
      const stdoutOutput = (execution.logs?.stdout || []).join('\n');
      const richOutput = execution.results
        .map((r: Result) => r.text || r.html || r.png || '')
        .filter(Boolean)
        .join('\n');
      const output = [stdoutOutput, richOutput].filter(Boolean).join('\n');

      logs.push(`Execution successful (${duration}ms)`);
      logInfo('E2BSandboxManager', `Execution complete: ${output.slice(0, 100)}...`);

      // 6. Export artifacts to Safe Zone
      if (export_artifacts) {
        const exportedArtifacts = await this.exportArtifacts(
          sandbox,
          safe_zone_path,
          execution,
          stdoutOutput
        );
        artifacts.push(...exportedArtifacts);
      }

      return {
        success: true,
        output,
        logs,
        artifacts,
        duration_ms: duration,
        metadata: {
          sandbox_id: sandbox.sandboxId,
          python_version: '3.11',
          packages_installed: packages
        }
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('E2BSandboxManager', `Execution failed: ${error}`);
      return {
        success: false,
        error,
        logs,
        duration_ms: Date.now() - startTime,
        metadata: sandbox ? { sandbox_id: sandbox.sandboxId } : undefined
      };
    } finally {
      // 7. Cleanup sandbox
      if (sandbox) {
        await this.cleanup(sandbox);
      }
    }
  }

  /**
   * Export sandbox artifacts to Safe Zone directory
   *
   * @param sandbox - Active E2B sandbox
   * @param targetPath - Safe Zone target directory
   * @param execution - Execution result containing artifacts
   * @returns Array of exported file paths
   */
  private async exportArtifacts(
    sandbox: Sandbox,
    targetPath: string,
    execution: { results: Result[] },
    stdoutText?: string
  ): Promise<string[]> {
    const exported: string[] = [];

    try {
      // Create target directory (no need to validate directory path itself)
      await fs.mkdir(targetPath, { recursive: true });

      // Export stdout as JSON artifact if it looks like JSON (from print() calls)
      if (stdoutText && (stdoutText.trim().startsWith('{') || stdoutText.trim().startsWith('['))) {
        try {
          JSON.parse(stdoutText.trim()); // Validate JSON
          const filename = `artifact_${Date.now()}_stdout.json`;
          const filepath = path.join(targetPath, filename);

          if (this.validator.validate(filepath, 'write')) {
            await fs.writeFile(filepath, stdoutText.trim(), 'utf-8');
            exported.push(filepath);
            logInfo('E2BSandboxManager', `Exported JSON: ${filepath}`);
          }
        } catch {
          // Not valid JSON, skip
        }
      }

      // Export rich results (PNG images, HTML, JSON from execution.results)
      for (let i = 0; i < execution.results.length; i++) {
        const result = execution.results[i];

        if (result.png) {
          const filename = `artifact_${Date.now()}_${i}.png`;
          const filepath = path.join(targetPath, filename);

          if (this.validator.validate(filepath, 'write')) {
            // Decode base64 PNG
            const buffer = Buffer.from(result.png, 'base64');
            await fs.writeFile(filepath, buffer);
            exported.push(filepath);
            logInfo('E2BSandboxManager', `Exported PNG: ${filepath}`);
          }
        }

        // Export HTML
        if (result.html) {
          const filename = `artifact_${Date.now()}_${i}.html`;
          const filepath = path.join(targetPath, filename);

          if (this.validator.validate(filepath, 'write')) {
            await fs.writeFile(filepath, result.html, 'utf-8');
            exported.push(filepath);
            logInfo('E2BSandboxManager', `Exported HTML: ${filepath}`);
          }
        }

        // Export JSON (if text looks like JSON)
        if (result.text && (result.text.startsWith('{') || result.text.startsWith('['))) {
          try {
            JSON.parse(result.text);  // Validate JSON
            const filename = `artifact_${Date.now()}_${i}.json`;
            const filepath = path.join(targetPath, filename);

            if (this.validator.validate(filepath, 'write')) {
              await fs.writeFile(filepath, result.text, 'utf-8');
              exported.push(filepath);
              logInfo('E2BSandboxManager', `Exported JSON: ${filepath}`);
            }
          } catch {
            // Not valid JSON, skip
          }
        }
      }

      return exported;
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('E2BSandboxManager', `Artifact export failed: ${error}`);
      return exported;
    }
  }

  /**
   * Run async operation with timeout
   */
  private async runWithTimeout<T>(
    operation: () => Promise<T>,
    timeout_ms: number,
    errorMessage: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeout_ms)
    );

    return Promise.race([operation(), timeoutPromise]);
  }

  /**
   * Cleanup sandbox and remove from active list
   */
  private async cleanup(sandbox: Sandbox): Promise<void> {
    try {
      this.activeSandboxes.delete(sandbox.sandboxId);
      await sandbox.kill();
      logInfo('E2BSandboxManager', `Sandbox ${sandbox.sandboxId} terminated`);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logWarn('E2BSandboxManager', `Cleanup warning: ${error}`);
    }
  }

  /**
   * Kill all active sandboxes (emergency cleanup)
   */
  async cleanupAll(): Promise<void> {
    logInfo('E2BSandboxManager', `Cleaning up ${this.activeSandboxes.size} sandboxes...`);

    const cleanupPromises = Array.from(this.activeSandboxes.values()).map(
      sandbox => this.cleanup(sandbox)
    );

    await Promise.allSettled(cleanupPromises);
    this.activeSandboxes.clear();
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    total_executions: number;
    active_sandboxes: number;
    avg_duration_ms: number;
  } {
    return {
      total_executions: this.executionCount,
      active_sandboxes: this.activeSandboxes.size,
      avg_duration_ms: this.executionCount > 0
        ? Math.round(this.totalDuration / this.executionCount)
        : 0
    };
  }
}

// Singleton instance
let managerInstance: E2BSandboxManager | null = null;

/**
 * Get singleton E2BSandboxManager instance
 */
export function getE2BSandboxManager(): E2BSandboxManager {
  if (!managerInstance) {
    managerInstance = new E2BSandboxManager();
  }
  return managerInstance;
}
