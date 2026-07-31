import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { config, PLAYABLE_ACODECS } from './config.js'
import {
  getMedia,
  setOptimized,
  createDownload,
  updateDownload,
  purgeDownload,
} from './db.js'

const queue = []
let running = false
const active = new Map() // mediaId -> { proc, dlId }

export const isOptimizing = (id) => active.has(id) || queue.includes(id)

// Convert an incompatible file (e.g. HEVC/x265) to a browser-friendly H.264 MP4.
// Resolution is KEPT (4K stays 4K) — only the codec changes, so it direct-plays
// everywhere with zero live transcoding. Uses the GPU when FFMPEG_HWACCEL is set.
export function enqueueOptimize(id) {
  const m = getMedia(id)
  if (!m) throw new Error('media not found')
  if (isOptimizing(id)) return { queued: true, already: true }
  queue.push(id)
  processNext()
  return { queued: true }
}

function processNext() {
  if (running) return
  const id = queue.shift()
  if (!id) return
  running = true
  convert(id).finally(() => {
    running = false
    processNext()
  })
}

function convert(id) {
  return new Promise((resolve) => {
    const m = getMedia(id)
    if (!m || !fs.existsSync(m.path)) return resolve()

    fs.mkdirSync(config.optimizedDir, { recursive: true })
    const out = path.join(config.optimizedDir, `${id}.mp4`)
    const tmp = out + '.part'

    const dl = createDownload({ kind: 'optimize', source: id, name: `Converting: ${m.title || m.filename}` })
    updateDownload(dl.id, { status: 'active' })

    const hw = config.hwaccel === 'vaapi'
    const aCopy = PLAYABLE_ACODECS.has((m.acodec || '').toLowerCase())
    const args = [
      '-hide_banner', '-loglevel', 'error', '-stats', '-y',
      ...(hw ? ['-hwaccel', 'vaapi', '-hwaccel_device', config.vaapiDevice] : []),
      '-i', m.path,
      '-map', '0:v:0', '-map', '0:a:0?',
      ...(hw
        ? ['-vf', 'format=nv12,hwupload', '-c:v', 'h264_vaapi', '-qp', config.optimizeQp]
        : ['-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', config.transcodePreset, '-crf', config.transcodeCrf, '-pix_fmt', 'yuv420p']),
      ...(aCopy ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k', '-ac', '2']),
      '-movflags', '+faststart',
      '-f', 'mp4', // .part extension can't be auto-detected
      tmp,
    ]

    const proc = spawn(config.ffmpeg, args)
    active.set(id, { proc, dlId: dl.id })
    const dur = m.duration || 0
    let lastErr = ''

    proc.stderr.on('data', (b) => {
      const s = b.toString()
      const t = s.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
      if (t && dur) {
        const sec = +t[1] * 3600 + +t[2] * 60 + +t[3]
        updateDownload(dl.id, { progress: Math.min(0.999, sec / dur) })
      } else if (/error|failed|invalid|no such/i.test(s)) {
        lastErr = s.trim().slice(0, 300)
      }
    })

    proc.on('close', (code) => {
      active.delete(id)
      if (code === 0 && fs.existsSync(tmp)) {
        try {
          fs.renameSync(tmp, out)
        } catch {}
        setOptimized(id, out)
        updateDownload(dl.id, { status: 'done', progress: 1 })
        purgeDownload(dl.id)
      } else {
        try {
          fs.rmSync(tmp)
        } catch {}
        updateDownload(dl.id, { status: 'error', error: lastErr || `ffmpeg exited ${code}` })
      }
      resolve()
    })
    proc.on('error', (e) => {
      active.delete(id)
      updateDownload(dl.id, { status: 'error', error: String((e && e.message) || e) })
      resolve()
    })
  })
}

export function cancelOptimize(id) {
  const a = active.get(id)
  if (a) {
    a.proc.kill('SIGKILL')
    active.delete(id)
  }
  const i = queue.indexOf(id)
  if (i >= 0) queue.splice(i, 1)
}
