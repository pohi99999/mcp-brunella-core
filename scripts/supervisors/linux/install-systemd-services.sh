#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo or as root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
SERVICE_USER="${SUDO_USER:-${USER:-root}}"
SERVICE_GROUP="$(id -gn "${SERVICE_USER}")"
SYSTEMD_DIR="/etc/systemd/system"
CORE_NODE_HEAP_MB="${BRUNELLA_NODE_MAX_OLD_SPACE_SIZE:-1536}"
CORE_RUNTIME_LIMIT_MB="${BRUNELLA_RUNTIME_MEMORY_LIMIT_MB:-2048}"
CORE_RESTART_THRESHOLD_MB="${BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB:-1792}"

chmod +x \
  "${REPO_ROOT}/scripts/supervisors/linux/run-brunella-core.sh" \
  "${REPO_ROOT}/scripts/supervisors/linux/run-brunella-python.sh"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to run the Brunella service preflight." >&2
  exit 1
fi

node "${REPO_ROOT}/scripts/service-preflight.mjs" --platform linux

cat >"${SYSTEMD_DIR}/brunella-python.service" <<EOF
[Unit]
Description=Brunella Python Runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${REPO_ROOT}
Environment=BRUNELLA_WORKSPACE_ROOT=${REPO_ROOT}
ExecStart=${REPO_ROOT}/scripts/supervisors/linux/run-brunella-python.sh
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF

cat >"${SYSTEMD_DIR}/brunella-core.service" <<EOF
[Unit]
Description=Brunella Core Control Plane
After=network-online.target brunella-python.service
Wants=network-online.target
Requires=brunella-python.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${REPO_ROOT}
Environment=NODE_ENV=production
Environment=WEB_UI_ENABLED=true
Environment=BRUNELLA_WORKSPACE_ROOT=${REPO_ROOT}
Environment=BRUNELLA_NODE_MAX_OLD_SPACE_SIZE=${CORE_NODE_HEAP_MB}
Environment=BRUNELLA_RUNTIME_MEMORY_LIMIT_MB=${CORE_RUNTIME_LIMIT_MB}
Environment=BRUNELLA_RUNTIME_RESTART_THRESHOLD_MB=${CORE_RESTART_THRESHOLD_MB}
ExecStart=${REPO_ROOT}/scripts/supervisors/linux/run-brunella-core.sh
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=30
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now brunella-python.service brunella-core.service

echo "systemd services installed and started:"
echo "  brunella-python.service"
echo "  brunella-core.service"
echo "  runtime contract: heap=${CORE_NODE_HEAP_MB}MB limit=${CORE_RUNTIME_LIMIT_MB}MB restart=${CORE_RESTART_THRESHOLD_MB}MB"
echo "  install preflight: passed"
echo
echo "Canonical manual entrypoint remains: inditas.bat (Windows) or npm run start:stable + npm run start:python:stable"
