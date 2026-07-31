import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { config, VIDEO_EXTS } from './config.js'
import { listMedia } from './db.js'
import { makeThumb } from './library.js'

function walkAll(dir, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkAll(full, out)
    else out.push(full)
  }
  return out
}

// Regenerate any missing thumbnails (or all of them when force=true).
export async function fixThumbnails({ force = false } = {}) {
  const media = listMedia()
  let fixed = 0
  for (const m of media) {
    const thumb = path.join(config.thumbsDir, `${m.id}.jpg`)
    const missing = !fs.existsSync(thumb)
    if (force || missing) {
      if (force && !missing) {
        try {
          fs.rmSync(thumb)
        } catch {}
      }
      const ok = await makeThumb(m.id, m.path, m.duration)
      if (ok) fixed++
    }
  }
  return { fixed, total: media.length }
}

// Remove download leftovers (yt-dlp sidecars, partial files) + orphan thumbnails.
export function cleanJunk() {
  let files = 0
  let thumbs = 0

  for (const f of walkAll(config.mediaDir)) {
    const lower = f.toLowerCase()
    const ext = path.extname(lower)
    if (VIDEO_EXTS.has(ext)) continue // never touch actual videos
    const junk =
      lower.endsWith('.info.json') ||
      lower.endsWith('.description') ||
      lower.endsWith('.annotations.xml') ||
      ['.part', '.ytdl', '.temp', '.tmp', '.webp'].includes(ext)
    if (junk) {
      try {
        fs.rmSync(f)
        files++
      } catch {}
    }
  }

  // thumbnails with no matching media row
  const ids = new Set(listMedia().map((m) => m.id))
  try {
    for (const name of fs.readdirSync(config.thumbsDir)) {
      if (!name.endsWith('.jpg')) continue
      if (!ids.has(name.slice(0, -4))) {
        try {
          fs.rmSync(path.join(config.thumbsDir, name))
          thumbs++
        } catch {}
      }
    }
  } catch {}

  return { files, thumbs }
}

export function stats() {
  const media = listMedia()
  const totalSize = media.reduce((s, m) => s + (m.size || 0), 0)
  const withThumb = media.filter((m) =>
    fs.existsSync(path.join(config.thumbsDir, `${m.id}.jpg`)),
  ).length
  return {
    titles: media.length,
    totalSize,
    withThumb,
    missingThumb: media.length - withThumb,
  }
}

// Host/server metrics: disk (of the media volume), RAM, CPU, uptime.
export function serverStats() {
  let disk = null
  try {
    const s = fs.statfsSync(config.mediaDir)
    const total = s.blocks * s.bsize
    const free = s.bavail * s.bsize
    disk = { total, free, used: total - free }
  } catch {}
  const cpus = os.cpus() || []
  return {
    disk,
    mem: { total: os.totalmem(), free: os.freemem(), used: os.totalmem() - os.freemem() },
    cpu: { model: cpus[0]?.model || 'unknown', cores: cpus.length, load: os.loadavg() },
    uptime: os.uptime(),
    appUptime: process.uptime(),
    platform: os.platform(),
    arch: os.arch(),
    node: process.version,
    host: os.hostname(),
  }
}
