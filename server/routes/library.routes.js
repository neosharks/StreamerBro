import fs from 'node:fs'
import { listMedia, getMedia, hydrateMedia, setProgress, deleteMedia } from '../db.js'
import { scanLibrary, refreshMeta, runMetaWorker, isScanning } from '../library.js'

function sortItems(items, sort) {
  const s = [...items]
  switch (sort) {
    case 'title':
      return s.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case 'year':
      return s.sort((a, b) => (b.year || 0) - (a.year || 0))
    case 'rating':
      return s.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    case 'size':
      return s.sort((a, b) => (b.size || 0) - (a.size || 0))
    default:
      return s.sort((a, b) => (b.added_at || 0) - (a.added_at || 0))
  }
}

export default async function libraryRoutes(fastify) {
  fastify.get('/api/media', async (req) => {
    let items = listMedia()
    const { q, sort } = req.query
    if (q) {
      const s = q.toLowerCase()
      items = items.filter((m) => (m.title || m.filename || '').toLowerCase().includes(s))
    }
    return sortItems(items, sort)
  })

  fastify.get('/api/media/:id', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m) return reply.code(404).send({ error: 'not found' })
    return hydrateMedia(m)
  })

  fastify.post('/api/media/scan', async () => {
    const r = await scanLibrary()
    runMetaWorker() // fire-and-forget metadata fill
    return r
  })

  fastify.get('/api/media/scan/status', async () => ({ scanning: isScanning() }))

  fastify.post('/api/media/:id/refresh-meta', async (req, reply) => {
    const m = await refreshMeta(req.params.id)
    if (!m) return reply.code(404).send({ error: 'not found' })
    return hydrateMedia(m)
  })

  fastify.post('/api/media/:id/progress', async (req) => {
    const { progress = 0, watched = false } = req.body || {}
    setProgress(req.params.id, progress, watched)
    return { ok: true }
  })

  fastify.delete('/api/media/:id', async (req) => {
    const m = getMedia(req.params.id)
    if (m && req.query.deleteFile === '1') {
      try {
        fs.rmSync(m.path)
      } catch {}
    }
    deleteMedia(req.params.id)
    return { ok: true }
  })
}
