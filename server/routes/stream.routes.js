import fs from 'node:fs'
import path from 'node:path'
import { getMedia } from '../db.js'
import { config } from '../config.js'
import { streamDirect, streamTranscode, canDirectPlay } from '../stream.js'

export default async function streamRoutes(fastify) {
  fastify.get('/api/stream/:id', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m) return reply.code(404).send({ error: 'not found' })
    // prefer the browser-friendly H.264 copy when it exists (smooth, no live transcode)
    if (m.optimized && req.query.original !== '1' && fs.existsSync(m.optimized)) {
      return streamDirect(req, reply, { ...m, path: m.optimized })
    }
    if (!fs.existsSync(m.path)) return reply.code(404).send({ error: 'not found' })
    const force = req.query.transcode === '1'
    if (!force && canDirectPlay(m)) return streamDirect(req, reply, m)
    return streamTranscode(req, reply, m)
  })

  // download the original file (or the optimized copy) to the user's device
  fastify.get('/api/download/:id', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m) return reply.code(404).send()
    const useOpt = req.query.optimized === '1' && m.optimized && fs.existsSync(m.optimized)
    const file = useOpt ? m.optimized : m.path
    if (!fs.existsSync(file)) return reply.code(404).send()
    const name = useOpt
      ? `${(m.title || m.filename).replace(/[^\w.\- ]+/g, '_')}.mp4`
      : path.basename(file)
    reply.header('Content-Disposition', `attachment; filename="${name}"`)
    return streamDirect(req, reply, { ...m, path: file })
  })

  fastify.get('/api/thumb/:id', async (req, reply) => {
    const p = path.join(config.thumbsDir, `${req.params.id}.jpg`)
    if (!fs.existsSync(p)) return reply.code(404).send()
    reply.header('Cache-Control', 'public, max-age=86400').type('image/jpeg')
    return reply.send(fs.createReadStream(p))
  })

  // subtitles served as browser-native WebVTT (SRT is converted on the fly)
  fastify.get('/api/subs/:id/:idx', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m) return reply.code(404).send()
    const subs = m.subs ? JSON.parse(m.subs) : []
    const s = subs[Number(req.params.idx)]
    if (!s) return reply.code(404).send()
    const abs = path.resolve(config.mediaDir, s.file)
    if (!abs.startsWith(config.mediaDir) || !fs.existsSync(abs)) return reply.code(404).send()
    let txt = fs.readFileSync(abs, 'utf8')
    if (abs.toLowerCase().endsWith('.srt')) txt = srtToVtt(txt)
    else if (!/^WEBVTT/.test(txt)) txt = 'WEBVTT\n\n' + txt
    reply.header('Content-Type', 'text/vtt; charset=utf-8')
    return reply.send(txt)
  })
}

function srtToVtt(txt) {
  return (
    'WEBVTT\n\n' +
    txt.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  )
}
