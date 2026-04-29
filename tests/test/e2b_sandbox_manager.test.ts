import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { E2BSandboxManager, ExecutionResult } from '@packages/core-logic/e2b_sandbox_manager.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * E2B Sandbox Manager Tests
 *
 * NOTE: These tests require E2B_API_KEY in .env
 * Skip if E2B_API_KEY is not configured (tests will be marked as skipped, not failed)
 */

describe('E2B Sandbox Manager', () => {
  let manager: E2BSandboxManager;
  const testDataDir = path.resolve('data/test_e2b_sandbox');
  const hasE2BKey = !!process.env.E2B_API_KEY &&
                    process.env.E2B_API_KEY !== 'your-e2b-api-key-here';

  beforeEach(() => {
    manager = new E2BSandboxManager();
  });

  afterEach(async () => {
    // Cleanup all active sandboxes
    await manager.cleanupAll();

    // Clean test directory
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Basic Code Execution', () => {
    it.skipIf(!hasE2BKey)('should execute simple Python code', async () => {
      const code = 'print("Hello from E2B sandbox!")';

      const result = await manager.executeCode(code, {
        timeout_ms: 10000,
        export_artifacts: false
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello from E2B sandbox!');
      expect(result.duration_ms).toBeDefined();
      expect(result.metadata?.sandbox_id).toBeDefined();
    }, 20000);

    it.skipIf(!hasE2BKey)('should execute math calculations', async () => {
      const code = `
import math
result = math.sqrt(16) + math.pi
print(f"Result: {result:.2f}")
`;

      const result = await manager.executeCode(code, {
        timeout_ms: 10000,
        export_artifacts: false
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Result:');
      expect(result.output).toMatch(/\d+\.\d+/);
    }, 20000);

    it.skipIf(!hasE2BKey)('should handle syntax errors', async () => {
      const code = 'print("Missing closing quote';

      const result = await manager.executeCode(code, {
        timeout_ms: 10000,
        export_artifacts: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('SyntaxError');
    }, 20000);

    it.skipIf(!hasE2BKey)('should handle runtime errors', async () => {
      const code = `
x = 10
y = 0
result = x / y  # Division by zero
`;

      const result = await manager.executeCode(code, {
        timeout_ms: 10000,
        export_artifacts: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ZeroDivisionError');
    }, 20000);

    it('should return error if E2B_API_KEY not configured', async () => {
      // Override env temporarily
      const originalKey = process.env.E2B_API_KEY;
      process.env.E2B_API_KEY = '';

      const tempManager = new E2BSandboxManager();
      const result = await tempManager.executeCode('print("test")', {
        apiKey: '',
        export_artifacts: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('E2B_API_KEY not configured');

      // Restore env
      process.env.E2B_API_KEY = originalKey;
    });
  });

  describe('Package Installation', () => {
    it.skipIf(!hasE2BKey)('should install and use numpy', async () => {
      const code = `
import numpy as np
arr = np.array([1, 2, 3, 4, 5])
print(f"Sum: {arr.sum()}")
print(f"Mean: {arr.mean()}")
`;

      const result = await manager.executeCode(code, {
        packages: ['numpy'],
        timeout_ms: 30000,
        export_artifacts: false
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Sum: 15');
      expect(result.output).toContain('Mean: 3.0');
      expect(result.metadata?.packages_installed).toContain('numpy');
    }, 40000);

    it.skip('should install and use pandas', async () => {
      const result = await manager.executeCode(
        `import pandas as pd
df = pd.DataFrame({'A': [1, 2], 'B': [3, 4]})
print(df.to_string())`,
        { packages: ['pandas'], timeout_ms: 60000 }
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('A  B');
      expect(result.metadata?.packages_installed).toContain('pandas');
    }, 120000); // Higher timeout for package install


    it.skipIf(!hasE2BKey)('should handle invalid package names', async () => {
      const code = 'print("test")';

      const result = await manager.executeCode(code, {
        packages: ['this-package-does-not-exist-12345'],
        timeout_ms: 15000,
        export_artifacts: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Package installation failed');
    }, 25000);
  });

  describe('Timeout Handling', () => {
    it.skipIf(!hasE2BKey)('should timeout on infinite loop', async () => {
      const code = `
import time
while True:
    time.sleep(0.1)
`;

      const result = await manager.executeCode(code, {
        timeout_ms: 3000,  // 3 second timeout
        export_artifacts: false
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 15000);

    it.skip('should complete before timeout', async () => {
      const result = await manager.executeCode(
        `import time
print("Starting...")
time.sleep(1)
print("Completed")`,
        { timeout_ms: 10000 }
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Completed');
    }, 15000);
  });

  describe('Artifact Export', () => {
    it.skipIf(!hasE2BKey)('should export JSON artifacts', async () => {
      const code = `
import json
data = {"name": "test", "value": 42, "tags": ["ai", "sandbox"]}
print(json.dumps(data, indent=2))
`;

      const result = await manager.executeCode(code, {
        timeout_ms: 10000,
        export_artifacts: true,
        safe_zone_path: testDataDir
      });

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts!.length).toBeGreaterThan(0);

      // Verify JSON file exists
      const jsonFile = result.artifacts!.find(f => f.endsWith('.json'));
      expect(jsonFile).toBeDefined();

      const content = await fs.readFile(jsonFile!, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe('test');
      expect(parsed.value).toBe(42);
    }, 20000);

    it.skipIf(!hasE2BKey)('should not export when export_artifacts is false', async () => {
      const code = `
import json
print(json.dumps({"test": "data"}))
`;

      const result = await manager.executeCode(code, {
        timeout_ms: 10000,
        export_artifacts: false
      });

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts!.length).toBe(0);
    }, 20000);
  });

  describe('Statistics', () => {
    it('should track execution statistics', async () => {
      const stats1 = manager.getStats();
      expect(stats1.total_executions).toBe(0);
      expect(stats1.active_sandboxes).toBe(0);
      expect(stats1.avg_duration_ms).toBe(0);

      if (hasE2BKey) {
        await manager.executeCode('print("test")', { export_artifacts: false });
        await manager.executeCode('print("test2")', { export_artifacts: false });

        const stats2 = manager.getStats();
        expect(stats2.total_executions).toBe(2);
        expect(stats2.avg_duration_ms).toBeGreaterThan(0);
      }
    }, 30000);
  });

  describe('Cleanup', () => {
    it.skipIf(!hasE2BKey)('should cleanup sandbox after execution', async () => {
      const statsBefore = manager.getStats();

      await manager.executeCode('print("test")', { export_artifacts: false });

      const statsAfter = manager.getStats();
      expect(statsAfter.active_sandboxes).toBe(0);  // Cleaned up
    }, 20000);

    it.skipIf(!hasE2BKey)('should cleanup all sandboxes on cleanupAll()', async () => {
      // Execute multiple sandboxes (in parallel)
      const promises = [
        manager.executeCode('print("1")', { export_artifacts: false }),
        manager.executeCode('print("2")', { export_artifacts: false })
      ];

      await Promise.all(promises);

      const stats = manager.getStats();
      expect(stats.active_sandboxes).toBe(0);
    }, 30000);
  });
});
