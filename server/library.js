import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { config, VIDEO_EXTS } from './config.js'
import {
  upsertMedia,
  listMedia,
  getMedia,
  updateMediaMeta,
  setMetaState,
  deleteMedia,
  pendingMeta,
} from './db.js'
import { fetchMeta } from './metadata.js'

const execFileP = promisify(execFile)

// Turn "The.Matrix.1999.1080p.BluRay.x264.mkv" -> { title: "The Matrix", year: 1999 }
export function parseName(filename) {
  let base = filename.replace(/\.[^.]+$/, '')
  const ym = base.match(/(?:19|20)\d{2}/)
  const year = ym ? Number(ym[0]) : null
  if (ym) base = base.slice(0, ym.index)
  base = base
    .replace(/[._]+/g, ' ')
    .replace(
      /\b(1080p|720p|480p|2160p|4k|uhd|x264|x265|h264|h265|hevc|web[- ]?dl|web[- ]?rip|bluray|brrip|bdrip|hdrip|dvdrip|aac\d?|ac3|dts|hdr|10bit|remux|proper|repack|extended|imax)\b/gi,
      '',
    )
    .replace(/[\[({].*?[\])}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { title: base || filename, year }
}

async function probe(file) {
  try {
    const { stdout } = await execFileP(
      config.ffprobe,
      ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file],
      { maxBuffer: 1024 * 1024 * 16 },
    )
    const j = JSON.parse(stdout)
    const v = (j.streams || []).find((s) => s.codec_type === 'video') || {}
    const a = (j.streams || []).find((s) => s.codec_type === 'audio') || {}
    return {
      duration: j.format?.duration ? Number(j.format.duration) : null,
      bitrate: j.format?.bit_rate ? Number(j.format.bit_rate) : null,
      width: v.width || null,
      height: v.height || null,
      vcodec: v.codec_name || null,
      acodec: a.codec_name || null,
    }
  } catch {
    return {}
  }
}

export async function makeThumb(id, file, duration) {
  const out = path.join(config.thumbsDir, `${id}.jpg`)
  if (fs.existsSync(out)) return out
  // seek to a representative frame; clamp so short clips don't seek past the end
  let ss = 3
  if (duration && duration > 0) {
    ss = duration > 40 ? duration * 0.15 : Math.min(duration * 0.25, Math.max(duration - 0.5, 0))
  }
  try {
    await execFileP(
      config.ffmpeg,
      ['-ss', String(ss), '-i', file, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', '-y', out],
      { timeout: 30000 },
    )
    return out
  } catch {
    return null
  }
}

// If a video came from yt-dlp, it has a sibling "<name>.info.json" (+ "<name>.jpg"
// thumbnail). Pull the real title, description, channel, date and thumbnail into
// the media row so YouTube etc. downloads get a rich UI instead of a raw filename.
// Returns true if it supplied a thumbnail (so the frame-grab step can be skipped).
function applyYtdlpSidecar(id, file) {
  const base = file.replace(/\.[^.]+$/, '')
  const infoPath = base + '.info.json'
  if (!fs.existsSync(infoPath)) return false

  let meta
  try {
    meta = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
  } catch {
    return false
  }

  const thumbSrc = base + '.jpg'
  const out = path.join(config.thumbsDir, `${id}.jpg`)
  let usedThumb = false
  try {
    if (fs.existsSync(thumbSrc)) {
      fs.copyFileSync(thumbSrc, out)
      usedThumb = true
    }
  } catch {}

  const year = meta.upload_date ? Number(String(meta.upload_date).slice(0, 4)) : null
  updateMediaMeta(id, {
    meta_state: 'done', // don't hit TMDB for a YouTube clip
    title: meta.title || null,
    year: Number.isFinite(year) ? year : null,
    overview: meta.description || null,
    backdrop: usedThumb ? `/api/thumb/${id}` : null,
    poster: null,
    rating: null,
    imdb_id: null,
    tmdb_id: null,
    runtime: meta.duration ? Math.round(meta.duration / 60) : null,
    genres: meta.categories?.length ? meta.categories : meta.tags ? meta.tags.slice(0, 4) : [],
    cast: meta.uploader || meta.channel
      ? [{ name: meta.uploader || meta.channel, character: 'Channel', photo: null }]
      : [],
  })

  // tidy up the sidecar files
  try {
    fs.rmSync(infoPath)
  } catch {}
  try {
    if (fs.existsSync(thumbSrc)) fs.rmSync(thumbSrc)
  } catch {}
  return usedThumb
}

function walk(dir, out = []) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (VIDEO_EXTS.has(path.extname(e.name).toLowerCase())) out.push(full)
  }
  return out
}

let scanning = false
export function isScanning() {
  return scanning
}

export async function scanLibrary({ onProgress } = {}) {
  if (scanning) return { scanning: true }
  scanning = true
  let added = 0
  try {
    const files = walk(config.mediaDir)
    const known = new Set(listMedia().map((m) => m.path))
    for (const file of files) {
      if (known.has(file)) continue
      let stat
      try {
        stat = fs.statSync(file)
      } catch {
        continue
      }
      const { title, year } = parseName(path.basename(file))
      const info = await probe(file)
      const container = path.extname(file).slice(1).toLowerCase()
      const folder = path.relative(config.mediaDir, path.dirname(file)).split(path.sep).join('/')
      const row = upsertMedia({
        path: file,
        filename: path.basename(file),
        title,
        year,
        size: stat.size,
        container,
        folder,
        ...info,
      })
      // yt-dlp downloads leave a sidecar .info.json + thumbnail — use them for rich metadata
      const usedSidecar = applyYtdlpSidecar(row.id, file)
      if (!usedSidecar) await makeThumb(row.id, file, info.duration)
      added++
      onProgress?.(row)
    }
    // prune rows whose files vanished
    for (const m of listMedia()) {
      if (!fs.existsSync(m.path)) deleteMedia(m.id)
    }
    return { files: files.length, added }
  } finally {
    scanning = false
  }
}

// Background worker: fill metadata for freshly scanned items.
let metaRunning = false
export async function runMetaWorker() {
  if (metaRunning || !config.tmdbKey) return
  metaRunning = true
  try {
    for (const m of pendingMeta()) {
      const meta = await fetchMeta({ title: m.title, year: m.year, type: m.type })
      if (!meta) {
        setMetaState(m.id, 'none')
        continue
      }
      updateMediaMeta(m.id, meta)
    }
  } finally {
    metaRunning = false
  }
}

export async function refreshMeta(id) {
  const m = getMedia(id)
  if (!m) return null
  const meta = await fetchMeta({ title: m.title, year: m.year, type: m.type })
  if (meta) updateMediaMeta(id, meta)
  return getMedia(id)
}
