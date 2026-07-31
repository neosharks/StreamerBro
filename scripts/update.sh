#!/usr/bin/env bash
# Streamer Bro self-update: pull the latest code, reinstall, rebuild the UI, restart.
# Triggered by the in-app "Update" button (POST /api/system/update) or run by hand.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${UPDATE_BRANCH:-main}"
cd "$APP_DIR"

# log everything so a failed update is diagnosable
mkdir -p "$APP_DIR/data"
exec >>"$APP_DIR/data/update.log" 2>&1
echo "=========== update start: $(date) ($APP_DIR) ==========="

if [ ! -d .git ]; then
  echo "ERROR: not a git checkout — self-update needs a git-based install."
  exit 1
fi

# hard-align to the remote branch (appliance: local edits are not expected)
git fetch --all --quiet
git reset --hard "origin/$BRANCH"

npm install --omit=dev
( cd web && npm install && npm run build )

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files 2>/dev/null | grep -q '^streamer-bro.service'; then
  echo "restarting streamer-bro service"
  systemctl restart streamer-bro
fi

echo "=========== update complete: $(date) ==========="
