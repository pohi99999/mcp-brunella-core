const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_RUNTIME_THRESHOLD_CONTRACT = Object.freeze({
  BRUNELLA_NODE_MAX_OLD_SPACE_SIZE: 1536,
  BRUNELLA_RUNTIME_MEMORY_LIMIT_MB: 2048,
  BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB: 1792,
  BRUNELLA_PYTHON_MEMORY_LIMIT_MB: 1024,
});

const DEFAULT_CONTRACT_FILE = path.resolve(
  __dirname,
  '..',
  'config',
  'runtime-threshold-contract.env',
);

function parseContractNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function parseEnvFile(content) {
  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    result[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return result;
}

function readContractEnvFile(contractFile = DEFAULT_CONTRACT_FILE) {
  if (!fs.existsSync(contractFile)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(contractFile, 'utf-8'));
}

function loadRuntimeThresholdContract(options = {}) {
  const env = options.env || process.env;
  const contractFile =
    options.contractFile ||
    env.BRUNELLA_RUNTIME_THRESHOLD_CONTRACT_FILE ||
    DEFAULT_CONTRACT_FILE;
  const fileValues = readContractEnvFile(contractFile);

  const contract = {
    nodeHeapMb: parseContractNumber(
      env.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE ?? fileValues.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE,
      DEFAULT_RUNTIME_THRESHOLD_CONTRACT.BRUNELLA_NODE_MAX_OLD_SPACE_SIZE,
    ),
    runtimeMemoryLimitMb: parseContractNumber(
      env.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB ?? fileValues.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB,
      DEFAULT_RUNTIME_THRESHOLD_CONTRACT.BRUNELLA_RUNTIME_MEMORY_LIMIT_MB,
    ),
    restartThresholdMb: parseContractNumber(
      env.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB ?? fileValues.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB,
      DEFAULT_RUNTIME_THRESHOLD_CONTRACT.BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB,
    ),
    pythonMemoryLimitMb: parseContractNumber(
      env.BRUNELLA_PYTHON_MEMORY_LIMIT_MB ?? fileValues.BRUNELLA_PYTHON_MEMORY_LIMIT_MB,
      DEFAULT_RUNTIME_THRESHOLD_CONTRACT.BRUNELLA_PYTHON_MEMORY_LIMIT_MB,
    ),
    contractFile,
  };

  if (contract.runtimeMemoryLimitMb <= contract.nodeHeapMb) {
    throw new Error('Runtime memory limit must be greater than the Node heap budget.');
  }
  if (contract.restartThresholdMb <= contract.nodeHeapMb) {
    throw new Error('Restart threshold must be greater than the Node heap budget.');
  }
  if (contract.restartThresholdMb >= contract.runtimeMemoryLimitMb) {
    throw new Error('Restart threshold must stay below the runtime memory limit.');
  }

  return contract;
}

function renderRuntimeThresholdContract(contract) {
  return [
    `BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=${contract.nodeHeapMb}`,
    `BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=${contract.runtimeMemoryLimitMb}`,
    `BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=${contract.restartThresholdMb}`,
    `BRUNELLA_PYTHON_MEMORY_LIMIT_MB=${contract.pythonMemoryLimitMb}`,
    '',
  ].join('\n');
}

function writeRuntimeThresholdContract(contractFile, contract) {
  fs.writeFileSync(contractFile, renderRuntimeThresholdContract(contract), 'utf-8');
}

module.exports = {
  DEFAULT_CONTRACT_FILE,
  DEFAULT_RUNTIME_THRESHOLD_CONTRACT,
  loadRuntimeThresholdContract,
  parseEnvFile,
  readContractEnvFile,
  renderRuntimeThresholdContract,
  writeRuntimeThresholdContract,
};
