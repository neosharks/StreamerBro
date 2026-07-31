import fs from 'node:fs'
import path from 'node:path'
import { getMedia } from '../db.js'
import { config } from '../config.js'
import { streamDirect, streamTranscode, canDirectPlay } from '../stream.js'

export default async function streamRoutes(fastify) {
  fastify.get('/api/stream/:id', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m || !fs.existsSync(m.path)) return reply.code(404).send({ error: 'not found' })
    const force = req.query.transcode === '1'
    if (!force && canDirectPlay(m)) return streamDirect(req, reply, m)
    return streamTranscode(req, reply, m)
  })

  fastify.get('/api/thumb/:id', async (req, reply) => {
    const p = path.join(config.thumbsDir, `${req.params.id}.jpg`)
    if (!fs.existsSync(p)) return reply.code(404).send()
    reply.header('Cache-Control', 'public, max-age=86400').type('image/jpeg')
    return reply.send(fs.createReadStream(p))
  })
}
