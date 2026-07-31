import { spawn } from 'node:child_process'
import path from 'node:path'
import { config } from '../config.js'
import { createDownload, updateDownload } from '../db.js'

const active = new Map() // downloadId -> child process

function parseRate(s) {
  if (!s) return 0
  const m = s.match(/([\d.]+)\s*([KMG]?i?)B\/s/i)
  if (!m) return 0
  const n = Number(m[1])
  const u = (m[2] || '').toLowerCase()
  const mult = u.startsWith('g') ? 1e9 : u.startsWith('m') ? 1e6 : u.startsWith('k') ? 1e3 : 1
  return Math.round(n * mult)
}

function parseEta(s) {
  if (!s) return null
  const p = s.split(':').map(Number)
  if (p.some(Number.isNaN)) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]
}

// Download from YouTube (and 1000+ sites yt-dlp supports) at best available
// quality, merged into MP4, straight into the media library.
export function addYtdlp(url, onComplete) {
  const rec = createDownload({ kind: 'ytdlp', source: url, name: url })
  updateDownload(rec.id, { status: 'active' })

  const outTpl = path.join(config.mediaDir, '%(title)s [%(id)s].%(ext)s')
  const args = [
    '-f',
    'bv*+ba/b', // best video + best audio, fallback best combined
    '--merge-output-format',
    'mp4',
    '--no-playlist',
    '--newline',
    '--no-part',
    '--restrict-filenames',
    // grab rich info so the library shows title/description/thumbnail, not just the file
    '--write-info-json',
    '--write-thumbnail',
    '--convert-thumbnails',
    'jpg',
    '--embed-metadata',
    '-o',
    outTpl,
    url,
  ]

  const proc = spawn(config.ytdlp, args)
  active.set(rec.id, proc)
  let lastErr = ''

  proc.stdout.on('data', (buf) => {
    const s = buf.toString()
    const t = s.match(
      /\[download\]\s+([\d.]+)% of\s+~?\s*([\d.]+\s*\w+)(?:\s+at\s+([\d.]+\s*\w+B\/s))?(?:\s+ETA\s+([\d:]+))?/,
    )
    if (t) {
      updateDownload(rec.id, {
        progress: Number(t[1]) / 100,
        speed: parseRate(t[3]),
        eta: parseEta(t[4]),
      })
    }
    const dest = s.match(/\[download\] Destination:\s+(.+)/)
    if (dest) updateDownload(rec.id, { name: path.basename(dest[1].trim()), dest: dest[1].trim() })
    const merge = s.match(/\[Merger\] Merging formats into "(.+)"/)
    if (merge) updateDownload(rec.id, { name: path.basename(merge[1]), dest: merge[1] })
  })

  proc.stderr.on('data', (b) => {
    lastErr = b.toString().trim()
  })

  proc.on('close', (code) => {
    active.delete(rec.id)
    if (code === 0) {
      updateDownload(rec.id, { status: 'done', progress: 1, speed: 0 })
      Promise.resolve(onComplete?.(rec.id)).catch(() => {})
    } else {
      updateDownload(rec.id, { status: 'error', error: lastErr || `yt-dlp exited ${code}` })
    }
  })
  proc.on('error', (e) =>
    updateDownload(rec.id, { status: 'error', error: String((e && e.message) || e) }),
  )

  return rec
}

export function cancelYtdlp(id) {
  const p = active.get(id)
  if (p) {
    p.kill('SIGKILL')
    active.delete(id)
  }
}
