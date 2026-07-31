import { listDownloads, getDownload, removeDownload, purgeDownload } from '../db.js'
import { addTorrent, cancelTorrent } from '../downloads/torrents.js'
import { addYtdlp, cancelYtdlp } from '../downloads/ytdlp.js'
import { cancelOptimize } from '../optimize.js'
import { scanLibrary, runMetaWorker } from '../library.js'

export default async function downloadsRoutes(fastify) {
  // When a download finishes: import the file into the library, fetch metadata,
  // then remove the download entry (the file lives in the library from now on).
  const onComplete = async (id) => {
    await scanLibrary()
    runMetaWorker()
    if (id) purgeDownload(id)
  }

  fastify.get('/api/downloads', async () => listDownloads())

  fastify.post('/api/downloads/torrent', async (req, reply) => {
    const { magnet } = req.body || {}
    if (!magnet) return reply.code(400).send({ error: 'magnet required' })
    return addTorrent(magnet, onComplete)
  })

  fastify.post('/api/downloads/ytdlp', async (req, reply) => {
    const { url } = req.body || {}
    if (!url) return reply.code(400).send({ error: 'url required' })
    return addYtdlp(url, onComplete)
  })

  fastify.delete('/api/downloads/:id', async (req) => {
    const d = getDownload(req.params.id)
    if (d) {
      if (d.kind === 'torrent') cancelTorrent(req.params.id, req.query.deleteData === '1')
      else if (d.kind === 'optimize') cancelOptimize(d.source) // source = media id
      else cancelYtdlp(req.params.id)
      removeDownload(req.params.id)
    }
    return { ok: true }
  })

  // Server-Sent Events: push the full download list every second.
  fastify.get('/api/downloads/events', (req, reply) => {
    reply.hijack()
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    const send = () => reply.raw.write(`data: ${JSON.stringify(listDownloads())}\n\n`)
    send()
    const iv = setInterval(send, 1000)
    req.raw.on('close', () => clearInterval(iv))
  })
}
