#!/usr/bin/env bash

LOADER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${LOADER_DIR}/../../.." && pwd)"
CONTRACT_HELPER="${REPO_ROOT}/scripts/runtime-threshold-contract.cjs"

print_runtime_threshold_exports() {
  local contract_file="$1"

  if ! command -v node >/dev/null 2>&1; then
    echo "node is required to resolve the Brunella runtime threshold contract." >&2
    return 1
  fi

  if [[ ! -f "$CONTRACT_HELPER" ]]; then
    echo "Runtime threshold helper is missing: $CONTRACT_HELPER" >&2
    return 1
  fi

  node -e "const { loadRuntimeThresholdContract } = require(process.argv[1]); const contract = loadRuntimeThresholdContract({ contractFile: process.argv[2] }); process.stdout.write([\
\`BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=\${contract.nodeHeapMb}\`,\
\`BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=\${contract.runtimeMemoryLimitMb}\`,\
\`BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=\${contract.restartThresholdMb}\`,\
\`BRUNELLA_PYTHON_MEMORY_LIMIT_MB=\${contract.pythonMemoryLimitMb}\`\
].join('\n'));" "$CONTRACT_HELPER" "$contract_file"
}

load_runtime_threshold_env() {
  local contract_file="$1"
  local exports_output=""
  local key=""
  local value=""

  exports_output="$(print_runtime_threshold_exports "$contract_file")" || return 1

  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    if [[ -z "$key" ]]; then
      continue
    fi

    printf -v "$key" '%s' "$value"
    export "$key"
  done <<< "$exports_output"
}
