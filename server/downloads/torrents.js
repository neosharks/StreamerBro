import path from 'node:path'
import WebTorrent from 'webtorrent'
import { config } from '../config.js'
import { createDownload, updateDownload } from '../db.js'

let client = null
const active = new Map() // downloadId -> torrent

function getClient() {
  if (!client) client = new WebTorrent({ maxConns: 200, dht: true })
  return client
}

function throttle(fn, ms) {
  let last = 0
  return (...a) => {
    const now = Date.now()
    if (now - last >= ms) {
      last = now
      fn(...a)
    }
  }
}

export function addTorrent(source, onComplete) {
  const c = getClient()
  const rec = createDownload({ kind: 'torrent', source, name: 'Fetching metadata…' })
  updateDownload(rec.id, { status: 'active' })

  const torrent = c.add(source, { path: config.mediaDir })
  active.set(rec.id, torrent)

  const tick = () =>
    updateDownload(rec.id, {
      name: torrent.name || undefined,
      progress: torrent.progress,
      speed: Math.round(torrent.downloadSpeed),
      peers: torrent.numPeers,
      eta: isFinite(torrent.timeRemaining) ? Math.round(torrent.timeRemaining / 1000) : null,
      downloaded: torrent.downloaded,
      total: torrent.length,
    })

  torrent.on('metadata', tick)
  torrent.on('download', throttle(tick, 1000))
  torrent.on('error', (e) =>
    updateDownload(rec.id, { status: 'error', error: String((e && e.message) || e) }),
  )
  torrent.on('done', () => {
    updateDownload(rec.id, {
      status: 'done',
      progress: 1,
      speed: 0,
      dest: path.join(config.mediaDir, torrent.name || ''),
    })
    active.delete(rec.id)
    torrent.destroy() // stop seeding; files stay in mediaDir
    Promise.resolve(onComplete?.(rec.id)).catch(() => {})
  })

  return rec
}

export function cancelTorrent(id, deleteData) {
  const t = active.get(id)
  if (t) {
    t.destroy({ destroyStore: !!deleteData })
    active.delete(id)
  }
}
