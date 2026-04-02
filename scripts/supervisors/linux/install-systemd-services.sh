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

chmod +x \
  "${REPO_ROOT}/scripts/supervisors/linux/run-brunella-core.sh" \
  "${REPO_ROOT}/scripts/supervisors/linux/run-brunella-python.sh"

cat > "${SYSTEMD_DIR}/brunella-python.service" <<EOF
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

cat > "${SYSTEMD_DIR}/brunella-core.service" <<EOF
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
echo
echo "Canonical manual entrypoint remains: inditas.bat (Windows) or npm run start:stable + npm run start:python:stable"
