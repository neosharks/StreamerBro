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

// Hardware DECODE args (before -i) — only used when we actually re-encode.
// Keeps 4K HEVC frames on the GPU so decode is hardware-accelerated too.
function hwInputArgs() {
  const dev = config.vaapiDevice
  switch (config.hwaccel) {
    case 'vaapi':
      return ['-hwaccel', 'vaapi', '-hwaccel_device', dev, '-hwaccel_output_format', 'vaapi']
    case 'qsv':
      return ['-hwaccel', 'qsv', '-qsv_device', dev, '-hwaccel_output_format', 'qsv']
    case 'nvenc':
      return ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']
    default:
      return []
  }
}

// Pick the H.264 ENCODER for the rare case a re-encode is unavoidable (HEVC/x265).
function videoEncodeArgs() {
  const { hwaccel, transcodePreset, transcodeCrf } = config
  switch (hwaccel) {
    case 'videotoolbox':
      return ['-c:v', 'h264_videotoolbox', '-q:v', '60']
    case 'nvenc':
      return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', transcodeCrf]
    case 'qsv':
      return ['-vf', 'scale_qsv=format=nv12', '-c:v', 'h264_qsv', '-global_quality', transcodeCrf]
    case 'vaapi':
      // downconvert 10-bit HEVC (p010) to nv12 on the GPU, then hardware H.264 encode
      return ['-vf', 'scale_vaapi=format=nv12', '-c:v', 'h264_vaapi', '-qp', transcodeCrf]
    default:
      return ['-c:v', 'libx264', '-preset', transcodePreset, '-crf', transcodeCrf, '-pix_fmt', 'yuv420p']
  }
}

// Used only when the browser can't direct-play the file (e.g. MKV container, or
// HEVC/x265 video). Streams are COPIED whenever they're already browser-decodable
// (zero quality loss, minimal CPU — this covers most 4K H.264/AV1/VP9 in MKV).
// A real re-encode happens only for codecs the browser truly can't play (HEVC…),
// where hardware acceleration (FFMPEG_HWACCEL) keeps 4K smooth.
export function streamTranscode(req, reply, m) {
  const vCopy = PLAYABLE_VCODECS.has((m.vcodec || '').toLowerCase())
  const aCopy = PLAYABLE_ACODECS.has((m.acodec || '').toLowerCase())
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    ...(vCopy ? [] : hwInputArgs()), // hardware decode only when re-encoding
    '-i',
    m.path,
    ...(vCopy ? ['-c:v', 'copy'] : videoEncodeArgs()),
    ...(aCopy ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k', '-ac', '2']),
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
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
