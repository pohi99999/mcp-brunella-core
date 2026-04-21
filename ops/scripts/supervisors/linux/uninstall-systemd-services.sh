#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo or as root." >&2
  exit 1
fi

SYSTEMD_DIR="/etc/systemd/system"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is not available on this host." >&2
  exit 1
fi

for service_name in brunella-core.service brunella-python.service; do
  systemctl disable --now "$service_name" >/dev/null 2>&1 || true
  rm -f "${SYSTEMD_DIR}/${service_name}"
  echo "Removed service: ${service_name}"
done

systemctl daemon-reload
systemctl reset-failed
