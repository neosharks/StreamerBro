#!/usr/bin/env bash
# Streamer Bro — installer that runs INSIDE a Debian/Ubuntu container (or any host).
# Installs Node 22, ffmpeg, yt-dlp, builds the app, and runs it as a systemd service.
#
# Run from a checked-out copy:   sudo bash scripts/install-lxc.sh
# Or standalone (clones the repo): curl -fsSL <raw>/scripts/install-lxc.sh | sudo bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/neosharks/StreamerBro.git}"
APP_DIR="${APP_DIR:-/opt/streamer-bro}"
PORT="${PORT:-8080}"

echo "== Streamer Bro installer =="
export DEBIAN_FRONTEND=noninteractive
apt-get update
# build-essential/python3 are a fallback in case better-sqlite3 has no prebuilt binary
apt-get install -y curl ca-certificates gnupg git ffmpeg python3 build-essential

# Node 22 (NodeSource)
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# yt-dlp (latest static build)
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp

# Get the app: use the local checkout if present, else clone.
SCRIPT_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || true)"
if [ -n "$SCRIPT_SRC" ] && [ -f "$SCRIPT_SRC/package.json" ] && [ "$SCRIPT_SRC" != "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
  # copy the checkout but NOT node_modules (host-arch binaries) — deps install fresh below
  ( cd "$SCRIPT_SRC" && tar --exclude=node_modules --exclude='./data' -cf - . ) | ( cd "$APP_DIR" && tar -xf - )
elif [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
npm install --omit=dev
( cd web && npm install && npm run build )
mkdir -p "$APP_DIR/media" "$APP_DIR/data/thumbnails"

# systemd service
install -m 644 "$APP_DIR/scripts/streamer-bro.service" /etc/systemd/system/streamer-bro.service
sed -i "s|__APP_DIR__|$APP_DIR|g; s|__PORT__|$PORT|g" /etc/systemd/system/streamer-bro.service
systemctl daemon-reload
systemctl enable --now streamer-bro

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "==========================================================="
echo "  Streamer Bro is running:  http://${IP:-localhost}:$PORT"
echo "  First visit shows a one-time admin signup screen."
echo "  Add a TMDB key in $APP_DIR/.env then: systemctl restart streamer-bro"
echo "==========================================================="
