import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { config, PLAYABLE_CONTAINERS, PLAYABLE_VCODECS, PLAYABLE_ACODECS } from './config.js'

const MIME = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
}

// Can the browser play this file byte-for-byte (no transcode, zero quality loss)?
export function canDirectPlay(m) {
  const c = (m.container || path.extname(m.path).slice(1)).toLowerCase()
  const v = (m.vcodec || '').toLowerCase()
  const a = (m.acodec || '').toLowerCase()
  return (
    PLAYABLE_CONTAINERS.has(c) &&
    (!v || PLAYABLE_VCODECS.has(v)) &&
    (!a || PLAYABLE_ACODECS.has(a))
  )
}

// Original file via HTTP range requests — supports instant seeking, full quality.
export function streamDirect(req, reply, m) {
  const stat = fs.statSync(m.path)
  const total = stat.size
  const ext = path.extname(m.path).slice(1).toLowerCase()
  const mime = MIME[ext] || 'application/octet-stream'
  const range = req.headers.range

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range)
    let start = match?.[1] ? parseInt(match[1], 10) : 0
    let end = match?.[2] ? parseInt(match[2], 10) : total - 1
    if (Number.isNaN(start)) start = 0
    if (Number.isNaN(end) || end >= total) end = total - 1
    if (start > end || start >= total) {
      return reply.code(416).header('Content-Range', `bytes */${total}`).send()
    }
    reply
      .code(206)
      .header('Content-Range', `bytes ${start}-${end}/${total}`)
      .header('Accept-Ranges', 'bytes')
      .header('Content-Length', end - start + 1)
      .header('Content-Type', mime)
    return reply.send(fs.createReadStream(m.path, { start, end }))
  }

  reply.header('Content-Length', total).header('Accept-Ranges', 'bytes').header('Content-Type', mime)
  return reply.send(fs.createReadStream(m.path))
}

// Fallback for codecs the browser can't decode (HEVC/x265, AC3, MKV, …).
// Copies the video stream untouched when it's already H.264 (no quality loss),
// otherwise transcodes at visually-lossless CRF 18. Audio -> AAC.
export function streamTranscode(req, reply, m) {
  const vCopy = PLAYABLE_VCODECS.has((m.vcodec || '').toLowerCase())
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    m.path,
    ...(vCopy ? ['-c:v', 'copy'] : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18']),
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-movflags',
    'frag_keyframe+empty_moov+faststart',
    '-f',
    'mp4',
    'pipe:1',
  ]
  reply.header('Content-Type', 'video/mp4')
  const ff = spawn(config.ffmpeg, args)
  ff.stderr.on('data', () => {})
  ff.on('error', () => {
    try {
      reply.raw.destroy()
    } catch {}
  })
  reply.raw.on('close', () => ff.kill('SIGKILL'))
  return reply.send(ff.stdout)
}
