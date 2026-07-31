# 🎬 Streamer Bro

A self-hosted, Netflix-style media streamer for your homelab / Proxmox box. Organize and stream your videos at **full original quality**, pull new content straight in from **torrents or YouTube (and 1000+ sites)**, and browse it all in a fast, modern, mobile-friendly UI with IMDB/TMDB metadata.

Think "your own private Netflix" that also downloads for you.

---

## Features

- **Netflix-style UI** — billboard hero, horizontal category rows, hover previews, red/dark theme, smooth animations. Works great on desktop **and** mobile (bottom tab bar, just like the Netflix app).
- **Custom video player** — full original quality via HTTP range streaming (instant seeking, zero re-encode). Auto-transcodes only when the browser can't decode the codec (HEVC/MKV). Netflix-style controls: scrubber, ±10s skip, volume, playback speed, fullscreen, and keyboard shortcuts.
- **Continue Watching** — remembers where you left off and resumes automatically.
- **Metadata** — posters, backdrops, plot, cast, genres and **IMDB ratings**, working with **no API key** (IMDB data via Cinemeta). A free TMDB key adds higher-res artwork, cast photos and TV shows; OMDb adds authoritative IMDB ratings.
- **Download in** — paste a **torrent magnet** or a **video link (yt-dlp)**; it downloads at best quality straight into your library, then the download entry disappears and the file lives in your library.
- **File Manager** — a Windows-style file browser: create nested folders, move files/folders, rename, delete.
- **Users & permissions** — username/password login (no email), a Netflix "who's watching" profile picker, and an admin who creates profiles and toggles per-profile **Download** and **Delete** permissions. Everyone can watch everything.
- **One-click self-update** — checks for a new version and updates in place.

## Keyboard shortcuts (player)

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `Space` / `Enter` / `K` | Play / Pause | `M` | Mute |
| `←` / `→` (or `J` / `L`) | Skip 10s | `↑` / `↓` | Volume |
| `F` | Fullscreen | | |

---

## Install

### Proxmox VE — one command (recommended)

Run this in the **Proxmox VE host shell** (Datacenter → your node → Shell):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/StreamerBro/main/scripts/install-proxmox.sh)"
```

It creates a Debian 12 LXC, installs Node 22 + ffmpeg + yt-dlp, builds the app, and starts it as a `systemd` service. When it finishes it prints the URL: `http://<container-ip>:8080`.

**Defaults:** 4 vCPU · 8 GB RAM · 400 GB disk · unprivileged · DHCP. Override any of them:

```bash
CT_ID=210 CT_HOSTNAME=media CT_CPU=4 CT_RAM=8192 CT_DISK=500 \
CT_NET=192.168.1.50/24 CT_GW=192.168.1.1 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/neosharks/StreamerBro/main/scripts/install-proxmox.sh)"
```

All overrides: `CT_ID CT_HOSTNAME CT_CPU CT_RAM`(MB) `CT_DISK`(GB) `CT_BRIDGE CT_NET`(`dhcp` or CIDR) `CT_GW CT_STORAGE TEMPLATE_STORAGE CT_UNPRIVILEGED CT_PASSWORD`.

On first visit you set your **admin username + password** (no email). After that, add more profiles from the profile menu → **Manage profiles**.

### Docker

```bash
git clone https://github.com/neosharks/StreamerBro.git && cd StreamerBro
cp .env.example .env         # optional: add TMDB/OMDb keys for posters + IMDB ratings
docker compose up -d --build
```

### Existing Linux box / LXC

Run the installer inside any Debian/Ubuntu host (installs deps, builds, sets up the service):

```bash
git clone https://github.com/neosharks/StreamerBro.git && cd StreamerBro
sudo bash scripts/install-lxc.sh
```

### Bare metal / dev

Requires **Node 20+**, **ffmpeg/ffprobe**, **yt-dlp** on PATH.

```bash
npm run setup      # installs server + web deps and builds the UI
npm start          # http://localhost:8080
```

Dev mode (hot reload): `npm run dev` (backend) + `cd web && npm run dev` (Vite on :5173, proxies to :8080).

---

## Updating

Streamer Bro checks the repo's `VERSION` file and, **only when a newer version exists**, shows an **Update ↑** button in the top bar (admin only). Clicking it runs `scripts/update.sh` — `git pull`, reinstall, rebuild the UI, and restart the service — no shell needed.

You can also update by hand: `bash scripts/update.sh` (from the app directory).

> Publishing a new version (maintainer): bump the number in `VERSION`, commit, and push to `main`. Every install then sees the Update button.

---

## Configuration

All optional — see `.env.example`. Common ones:

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | HTTP port |
| `MEDIA_DIR` | `./media` | Your video library (downloads land here) |
| `DATA_DIR` | `./data` | SQLite DB + thumbnails |
| `TMDB_API_KEY` | – | Posters, plot, cast, IMDB id ([free key](https://www.themoviedb.org/settings/api)) |
| `OMDB_API_KEY` | – | Authoritative IMDB rating ([free key](https://www.omdbapi.com/apikey.aspx)) |

IMDB metadata (posters, ratings, cast) works out of the box with no key. A TMDB key just adds higher-res artwork, cast photos, and TV-show support.

---

## How it works

- **Backend** — Node + Fastify, `better-sqlite3` for the library index, `webtorrent` for torrents, `yt-dlp` for links, `ffmpeg`/`ffprobe` for probing, thumbnails and transcoding.
- **Frontend** — React + Vite + Tailwind (built to static files the server hosts).
- **Streaming** — the player requests byte ranges of the original file, so you stream the exact bits on disk (no quality loss) with instant seeking. Incompatible codecs are remuxed/transcoded on the fly.
- **Auth** — scrypt-hashed passwords, httpOnly session cookies; every API route is gated, with per-profile download/delete permissions.

## Tech

TypeScript-free ESM Node · Fastify · better-sqlite3 · WebTorrent · yt-dlp · ffmpeg · React 18 · Vite · Tailwind CSS

## Notes

Only download content you're legally allowed to. This is a personal tool for your own media.
