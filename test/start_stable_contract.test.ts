import { describe, expect, it } from 'vitest';
import {
  resolveRuntimeContract,
  validateRuntimeContract,
} from '../scripts/start-stable.mjs';

describe('start-stable runtime contract', () => {
  it('resolves the default stable budget contract', () => {
    const contract = resolveRuntimeContract({});

    expect(contract).toEqual({
      configuredHeapMb: 1536,
      runtimeMemoryLimitMb: 2048,
      restartThresholdMb: 1792,
      source: 'default',
    });
  });

  it('accepts explicit environment overrides', () => {
    const contract = resolveRuntimeContract({
      BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: '2048',
      BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: '2560',
      BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: '2304',
    });

    expect(contract).toEqual({
      configuredHeapMb: 2048,
      runtimeMemoryLimitMb: 2560,
      restartThresholdMb: 2304,
      source: 'env',
    });
  });

  it('rejects invalid runtime envelopes', () => {
    const contract = resolveRuntimeContract({
      BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: '1536',
      BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: '1536',
      BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: '1792',
    });

    expect(() => validateRuntimeContract(contract, 1584)).toThrow(
      /runtime limit 1536MB must be greater than heap budget 1536MB/i,
    );
  });

  it('rejects runtime heap drift between launcher and process', () => {
    const contract = resolveRuntimeContract({
      BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: '1536',
      BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: '2048',
      BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: '1792',
    });

    expect(() => validateRuntimeContract(contract, 3072)).toThrow(
      /Runtime heap drift detected/i,
    );
  });
});
