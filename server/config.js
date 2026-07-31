import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

let version = '1.0.0'
try {
  version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || version
} catch {}

export const config = {
  root,
  version,
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',

  // storage
  mediaDir: process.env.MEDIA_DIR || path.join(root, 'media'),
  dataDir: process.env.DATA_DIR || path.join(root, 'data'),
  thumbsDir: process.env.THUMBS_DIR || path.join(root, 'thumbnails'),
  webRoot: path.join(root, 'web', 'dist'),

  // external tools (overridable for weird installs)
  ffmpeg: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobe: process.env.FFPROBE_PATH || 'ffprobe',
  ytdlp: process.env.YTDLP_PATH || 'yt-dlp',

  // metadata providers (optional — app degrades gracefully without them)
  tmdbKey: process.env.TMDB_API_KEY || '',
  omdbKey: process.env.OMDB_API_KEY || '',

  // self-update
  updateScript: process.env.UPDATE_SCRIPT || path.join(root, 'scripts', 'update.sh'),
  versionUrl:
    process.env.VERSION_URL ||
    'https://raw.githubusercontent.com/neosharks/StreamerBro/main/VERSION',
}

// ensure dirs exist on boot
for (const d of [config.mediaDir, config.dataDir, config.thumbsDir]) {
  fs.mkdirSync(d, { recursive: true })
}

export const VIDEO_EXTS = new Set([
  '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.flv', '.wmv',
  '.mpg', '.mpeg', '.ts', '.m2ts', '.ogv', '.3gp',
])

// containers/codecs most browsers can direct-play without transcoding
export const PLAYABLE_CONTAINERS = new Set(['mp4', 'm4v', 'mov', 'webm'])
export const PLAYABLE_VCODECS = new Set(['h264', 'avc1', 'vp8', 'vp9', 'av1'])
export const PLAYABLE_ACODECS = new Set(['aac', 'mp3', 'opus', 'vorbis'])
