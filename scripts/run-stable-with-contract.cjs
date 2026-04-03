const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadRuntimeThresholdContract } = require('./runtime-threshold-contract.cjs');

const contract = loadRuntimeThresholdContract();
const startStable = path.resolve(__dirname, 'start-stable.mjs');
const child = spawnSync(
  process.execPath,
  [`--max-old-space-size=${contract.nodeHeapMb}`, startStable],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: String(contract.nodeHeapMb),
      BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: String(contract.runtimeMemoryLimitMb),
      BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: String(contract.restartThresholdMb),
      BRUNELLA_PYTHON_MEMORY_LIMIT_MB: String(contract.pythonMemoryLimitMb),
    },
  },
);

if (child.error) {
  throw child.error;
}

process.exit(child.status ?? 1);
