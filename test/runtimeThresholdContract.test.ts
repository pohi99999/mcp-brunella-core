import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  loadRuntimeThresholdContract,
  renderRuntimeThresholdContract,
  parseEnvFile,
} = require('../scripts/runtime-threshold-contract.cjs') as {
  loadRuntimeThresholdContract: (options?: {
    env?: NodeJS.ProcessEnv;
    contractFile?: string;
  }) => {
    nodeHeapMb: number;
    runtimeMemoryLimitMb: number;
    restartThresholdMb: number;
    pythonMemoryLimitMb: number;
    contractFile: string;
  };
  renderRuntimeThresholdContract: (contract: {
    nodeHeapMb: number;
    runtimeMemoryLimitMb: number;
    restartThresholdMb: number;
    pythonMemoryLimitMb: number;
  }) => string;
  parseEnvFile: (content: string) => Record<string, string>;
};

describe('runtime threshold contract helper', () => {
  it('parses env-style contract content', () => {
    expect(
      parseEnvFile([
        '# comment',
        'BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792',
        'BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2304',
        'BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2048',
        'BRUNELLA_PYTHON_MEMORY_LIMIT_MB=1152',
      ].join('\n')),
    ).toEqual({
      BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: '1792',
      BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: '2304',
      BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: '2048',
      BRUNELLA_PYTHON_MEMORY_LIMIT_MB: '1152',
    });
  });

  it('loads contract values from a managed contract file', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'brunella-threshold-contract-'));
    const contractFile = path.join(tmpDir, 'runtime-threshold-contract.env');
    writeFileSync(
      contractFile,
      [
        'BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792',
        'BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2304',
        'BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2048',
        'BRUNELLA_PYTHON_MEMORY_LIMIT_MB=1152',
      ].join('\n'),
      'utf-8',
    );

    expect(
      loadRuntimeThresholdContract({
        env: {},
        contractFile,
      }),
    ).toMatchObject({
      nodeHeapMb: 1792,
      runtimeMemoryLimitMb: 2304,
      restartThresholdMb: 2048,
      pythonMemoryLimitMb: 1152,
      contractFile,
    });
  });

  it('allows env overrides on top of the managed contract file', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'brunella-threshold-contract-'));
    const contractFile = path.join(tmpDir, 'runtime-threshold-contract.env');
    writeFileSync(
      contractFile,
      [
        'BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=1792',
        'BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2304',
        'BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2048',
        'BRUNELLA_PYTHON_MEMORY_LIMIT_MB=1152',
      ].join('\n'),
      'utf-8',
    );

    expect(
      loadRuntimeThresholdContract({
        env: {
          BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: '2560',
        },
        contractFile,
      }),
    ).toMatchObject({
      nodeHeapMb: 1792,
      runtimeMemoryLimitMb: 2560,
      restartThresholdMb: 2048,
      pythonMemoryLimitMb: 1152,
    });
  });

  it('renders managed contract content with all four budgets', () => {
    expect(
      renderRuntimeThresholdContract({
        nodeHeapMb: 1792,
        runtimeMemoryLimitMb: 2304,
        restartThresholdMb: 2048,
        pythonMemoryLimitMb: 1152,
      }),
    ).toContain('BRUNELLA_PYTHON_MEMORY_LIMIT_MB=1152');
  });

  it('rejects invalid managed contract envelopes', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'brunella-threshold-contract-'));
    const contractFile = path.join(tmpDir, 'runtime-threshold-contract.env');
    writeFileSync(
      contractFile,
      [
        'BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=2048',
        'BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=2048',
        'BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=2304',
        'BRUNELLA_PYTHON_MEMORY_LIMIT_MB=1152',
      ].join('\n'),
      'utf-8',
    );

    expect(() =>
      loadRuntimeThresholdContract({
        env: {},
        contractFile,
      }),
    ).toThrow(/runtime memory limit must be greater than the node heap budget/i);
  });
});
