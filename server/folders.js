import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { listMedia, getMedia, relocateMedia, deleteMedia } from './db.js'

// Resolve a user-supplied relative path safely inside the media dir (no traversal).
function safe(rel = '') {
  const clean = (rel || '').replace(/^[/\\]+/, '')
  const abs = path.resolve(config.mediaDir, clean)
  if (abs !== config.mediaDir && !abs.startsWith(config.mediaDir + path.sep)) {
    throw new Error('invalid path')
  }
  return abs
}

const toPosix = (p) => p.split(path.sep).join('/')

export function listFolder(rel = '') {
  const abs = safe(rel)
  let entries = []
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true })
  } catch {}
  const media = listMedia()
  const under = (p) => media.filter((m) => m.folder === p || m.folder.startsWith(p + '/'))
  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const p = rel ? `${rel}/${e.name}` : e.name
      const items = under(p)
      return { name: e.name, path: p, count: items.length, size: items.reduce((s, m) => s + (m.size || 0), 0) }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const files = media.filter((m) => (m.folder || '') === (rel || ''))
  return { path: rel || '', folders, files }
}

function dedupe(p) {
  if (!fs.existsSync(p)) return p
  const ext = path.extname(p)
  const base = ext ? p.slice(0, -ext.length) : p
  let i = 1
  let np
  do {
    np = `${base} (copy${i > 1 ? ' ' + i : ''})${ext}`
    i++
  } while (fs.existsSync(np))
  return np
}

export function copyMedia(id, destRel) {
  const m = getMedia(id)
  if (!m) throw new Error('media not found')
  const destDir = safe(destRel || '')
  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(m.path, dedupe(path.join(destDir, m.filename)))
  return { ok: true } // a rescan indexes the copy as a new title
}

export function copyFolder(srcRel, destRel) {
  if (!srcRel) throw new Error('cannot copy the root folder')
  const srcAbs = safe(srcRel)
  const name = path.basename(srcRel)
  let destAbs = path.join(safe(destRel || ''), name)
  if (destAbs === srcAbs || destAbs.startsWith(srcAbs + path.sep)) {
    throw new Error('cannot copy a folder into itself')
  }
  fs.cpSync(srcAbs, dedupe(destAbs), { recursive: true })
  return { ok: true }
}

export function createFolder(rel, name) {
  if (!name || /[\\/]/.test(name)) throw new Error('invalid folder name')
  fs.mkdirSync(safe(path.posix.join(rel || '', name)), { recursive: true })
  return { ok: true }
}

export function moveMedia(id, destRel) {
  const m = getMedia(id)
  if (!m) throw new Error('media not found')
  const destDir = safe(destRel || '')
  fs.mkdirSync(destDir, { recursive: true })
  const dest = path.join(destDir, m.filename)
  fs.renameSync(m.path, dest)
  relocateMedia(id, { path: dest, filename: m.filename, folder: destRel || '' })
  return { ok: true }
}

export function moveFolder(srcRel, destRel) {
  if (!srcRel) throw new Error('cannot move root')
  const srcAbs = safe(srcRel)
  const name = path.basename(srcRel)
  const destAbs = path.join(safe(destRel || ''), name)
  if (destAbs.startsWith(srcAbs + path.sep)) throw new Error('cannot move a folder into itself')
  fs.renameSync(srcAbs, destAbs)
  rewriteRows(srcAbs, destAbs)
  return { ok: true }
}

export function renameFolder(rel, newName) {
  if (!rel || !newName || /[\\/]/.test(newName)) throw new Error('invalid rename')
  const srcAbs = safe(rel)
  const destAbs = path.join(path.dirname(srcAbs), newName)
  fs.renameSync(srcAbs, destAbs)
  rewriteRows(srcAbs, destAbs)
  return { ok: true }
}

export function deleteFolder(rel) {
  const abs = safe(rel)
  if (abs === config.mediaDir) throw new Error('cannot delete the root folder')
  for (const m of listMedia()) {
    if (m.path === abs || m.path.startsWith(abs + path.sep)) deleteMedia(m.id)
  }
  fs.rmSync(abs, { recursive: true, force: true })
  return { ok: true }
}

// After a real fs rename, point every affected media row at its new path/folder.
function rewriteRows(srcAbs, destAbs) {
  for (const m of listMedia()) {
    if (m.path === srcAbs || m.path.startsWith(srcAbs + path.sep)) {
      const inside = m.path.slice(srcAbs.length)
      const np = destAbs + inside
      const folder = toPosix(path.relative(config.mediaDir, path.dirname(np)))
      relocateMedia(m.id, { path: np, filename: m.filename, folder })
    }
  }
}
