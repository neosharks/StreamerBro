#!/usr/bin/env bash
# Streamer Bro self-update: pull latest code, reinstall, rebuild UI, restart.
# Triggered by the in-app "Update" button (POST /api/system/update) or by hand.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
echo "[Streamer Bro] updating in $APP_DIR"

if [ -d .git ]; then
  git fetch --all --quiet || true
  git pull --ff-only || echo "[Streamer Bro] git pull skipped (local changes?)"
fi

npm install --omit=dev
( cd web && npm install && npm run build )

# restart under systemd if that's how we're running
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^streamer-bro.service'; then
  echo "[Streamer Bro] restarting service"
  systemctl restart streamer-bro
fi

echo "[Streamer Bro] update complete."
