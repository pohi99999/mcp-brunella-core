#!/usr/bin/env bash
set -euo pipefail

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is not available on this host." >&2
  exit 1
fi

show_service() {
  local service_name="$1"
  local active_state="not-installed"
  local enabled_state="n/a"

  if systemctl list-unit-files "$service_name" >/dev/null 2>&1; then
    active_state="$(systemctl is-active "$service_name" 2>/dev/null || true)"
    enabled_state="$(systemctl is-enabled "$service_name" 2>/dev/null || true)"
  fi

  echo "  ${service_name}: active=${active_state} enabled=${enabled_state}"
}

show_endpoint() {
  local label="$1"
  local url="$2"

  if ! command -v curl >/dev/null 2>&1; then
    echo "  ${label}: curl-missing"
    return
  fi

  if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
    echo "  ${label}: ok"
  else
    echo "  ${label}: unavailable"
  fi
}

get_core_contract_value() {
  local key="$1"
  local fallback="$2"
  local env_values=""
  local extracted=""

  if systemctl list-unit-files "brunella-core.service" >/dev/null 2>&1; then
    env_values="$(systemctl show brunella-core.service --property=Environment --value 2>/dev/null || true)"
    extracted="$(printf '%s' "$env_values" | tr ' ' '\n' | grep "^${key}=" | tail -n 1 | cut -d= -f2- || true)"
  fi

  if [[ -n "$extracted" ]]; then
    printf '%s' "$extracted"
    return
  fi

  printf '%s' "$fallback"
}

echo "systemd service status:"
show_service "brunella-python.service"
show_service "brunella-core.service"

echo
echo "Runtime contract:"
echo "  BrunellaCore: heapMb=$(get_core_contract_value BRUNELLA_NODE_MAX_OLD_SPACE_SIZE 1536) runtimeLimitMb=$(get_core_contract_value BRUNELLA_RUNTIME_MEMORY_LIMIT_MB 2048) restartThresholdMb=$(get_core_contract_value BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB 1792)"

echo
echo "Runtime endpoints:"
show_endpoint "Brunella Ready" "http://localhost:3000/readyz"
show_endpoint "Brunella Live" "http://localhost:3000/livez"
show_endpoint "Python Health" "http://localhost:8000/health"
