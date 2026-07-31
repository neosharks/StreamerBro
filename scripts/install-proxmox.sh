#!/usr/bin/env bash
# Streamer Bro — Proxmox VE LXC installer. Run on the PVE HOST shell as root:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/StreamerBro/main/scripts/install-proxmox.sh)"
#
# Creates a Debian 12 LXC, installs everything, and starts Streamer Bro.
# Override any default via env vars, e.g.:  CT_RAM=8192 CT_DISK=500 bash install-proxmox.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/neosharks/StreamerBro.git}"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/neosharks/StreamerBro/main}"

CT_ID="${CT_ID:-$(pvesh get /cluster/nextid)}"
CT_HOSTNAME="${CT_HOSTNAME:-streamerbro}"
CT_CPU="${CT_CPU:-4}"
CT_RAM="${CT_RAM:-8192}"           # MB (8 GB)
CT_DISK="${CT_DISK:-400}"          # GB
CT_BRIDGE="${CT_BRIDGE:-vmbr0}"
CT_NET="${CT_NET:-dhcp}"           # dhcp or e.g. 192.168.1.50/24
CT_GW="${CT_GW:-}"
CT_STORAGE="${CT_STORAGE:-local-lvm}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
CT_UNPRIVILEGED="${CT_UNPRIVILEGED:-1}"
CT_PASSWORD="${CT_PASSWORD:-streamerbro}"

echo "== Streamer Bro Proxmox LXC installer =="

# Ensure a Debian 12 template is available
TEMPLATE="$(pveam available --section system | grep -o 'debian-12-standard[^ ]*' | sort | tail -1)"
if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE"; then
  echo "Downloading template $TEMPLATE ..."
  pveam update
  pveam download "$TEMPLATE_STORAGE" "$TEMPLATE"
fi

NET="name=eth0,bridge=$CT_BRIDGE,ip=$CT_NET"
[ -n "$CT_GW" ] && NET="$NET,gw=$CT_GW"

echo "Creating LXC $CT_ID ($CT_HOSTNAME): ${CT_CPU} vCPU, ${CT_RAM}MB RAM, ${CT_DISK}GB disk"
pct create "$CT_ID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
  --hostname "$CT_HOSTNAME" --cores "$CT_CPU" --memory "$CT_RAM" --swap 512 \
  --rootfs "$CT_STORAGE:$CT_DISK" --net0 "$NET" \
  --unprivileged "$CT_UNPRIVILEGED" --features nesting=1 --onboot 1 --password "$CT_PASSWORD"

pct start "$CT_ID"

echo "Waiting for the container network..."
for i in $(seq 1 30); do
  pct exec "$CT_ID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  sleep 2
done

# The stock Debian template has no curl — install it first, then download & run the
# installer from a file (so any failure aborts loudly instead of silently no-op'ing).
echo "Installing Streamer Bro inside the container..."
pct exec "$CT_ID" -- bash -c "apt-get update && apt-get install -y curl ca-certificates && curl -fsSL $REPO_RAW/scripts/install-lxc.sh -o /tmp/sb-install.sh && REPO_URL='$REPO_URL' bash /tmp/sb-install.sh"

IP=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')
echo
echo "==========================================================="
echo "  Streamer Bro ready:  http://${IP}:8080"
echo "  Container ID: $CT_ID   root password: $CT_PASSWORD"
echo "  Open the URL and create your admin account on first visit."
echo "==========================================================="
