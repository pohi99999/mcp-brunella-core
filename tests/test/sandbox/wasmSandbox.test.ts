/**
 * Tests: SandboxPool (WASM/VM Sandbox Engine)
 * @track sandbox_security_hardening_20260323
 * @phase Phase 1
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SandboxPool, SandboxTimeoutError, SandboxSecurityError, resetSandboxPool } from '../../src/core/sandbox/wasmSandbox.js';

describe('SandboxPool', () => {
  let pool: SandboxPool;

  beforeEach(() => {
    resetSandboxPool();
    pool = new SandboxPool({ poolSize: 2, maxCpuMs: 2000 });
    pool.warmUp();
  });

  afterEach(() => {
    pool.destroy();
  });

  it('should execute simple code', async () => {
    const result = await pool.execute('console.log("hello sandbox")');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello sandbox');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should capture multiple console.log calls', async () => {
    const result = await pool.execute('console.log("a"); console.log("b"); console.log("c")');
    expect(result.success).toBe(true);
    expect(result.output).toBe('a\nb\nc');
  });

  it('should handle JSON output', async () => {
    const result = await pool.execute('console.log({x: 1, y: 2})');
    expect(result.success).toBe(true);
    expect(result.output).toContain('"x":1');
  });

  it('should catch runtime errors', async () => {
    const result = await pool.execute('throw new Error("boom")');
    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('should timeout on infinite loops', async () => {
    const result = await pool.execute('while(true) {}', { maxCpuMs: 100 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  });

  it('should block process access', async () => {
    const result = await pool.execute('console.log(process.env)');
    expect(result.success).toBe(false);
    // validateCode catches process. pattern before vm execution
    expect(result.error).toContain('Blocked dangerous pattern');
  });

  it('should block require()', async () => {
    const result = await pool.execute('const fs = require("fs")');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked dangerous pattern');
  });

  it('should block dynamic import()', async () => {
    const result = await pool.execute('import("fs")');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked dangerous pattern');
  });

  it('should block Function() constructor', async () => {
    const result = await pool.execute('new Function("return process")()');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Blocked dangerous pattern');
  });

  it('should allow Math operations', async () => {
    const result = await pool.execute('console.log(Math.PI.toFixed(4))');
    expect(result.success).toBe(true);
    expect(result.output).toBe('3.1416');
  });

  it('should allow Date usage', async () => {
    const result = await pool.execute('console.log(typeof Date.now())');
    expect(result.success).toBe(true);
    expect(result.output).toBe('number');
  });

  it('should handle output size limits', async () => {
    const result = await pool.execute(
      'for(let i=0; i<100000; i++) console.log("x".repeat(100))',
      { maxOutputSize: 1000 }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('memory limit');
  });

  it('should track pool statistics', async () => {
    await pool.execute('console.log(1)');
    await pool.execute('console.log(2)');
    await pool.execute('throw new Error("test")', {});

    const stats = pool.getStats();
    expect(stats.totalExecutions).toBe(3);
    expect(stats.successfulExecutions).toBe(2);
    expect(stats.poolSize).toBeGreaterThanOrEqual(2);
  });

  it('should reuse pool instances', async () => {
    const stats1 = pool.getStats();
    await pool.execute('console.log("reuse test")');
    const stats2 = pool.getStats();
    // Pool size should not grow for a single execution
    expect(stats2.poolSize).toBe(stats1.poolSize);
  });

  it('should isolate between executions', async () => {
    await pool.execute('var secret = "hidden"');
    const result = await pool.execute('console.log(typeof secret)');
    expect(result.success).toBe(true);
    // After reset, variable should not leak
    expect(result.output).toBe('undefined');
  });
});
