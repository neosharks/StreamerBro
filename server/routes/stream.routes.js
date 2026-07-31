import fs from 'node:fs'
import path from 'node:path'
import { getMedia } from '../db.js'
import { config, PLAYABLE_VCODECS } from '../config.js'
import { streamDirect, streamTranscode, canDirectPlay } from '../stream.js'

export default async function streamRoutes(fastify) {
  fastify.get('/api/stream/:id', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m || !fs.existsSync(m.path)) return reply.code(404).send({ error: 'not found' })
    if (canDirectPlay(m)) return streamDirect(req, reply, m)
    // remux (fast, lossless) only when the video codec is browser-decodable but the
    // container isn't (e.g. H.264 inside MKV). For codecs the browser can't decode at
    // all (HEVC/x265) we DON'T spawn a doomed transcode — the client downloads instead.
    if (PLAYABLE_VCODECS.has((m.vcodec || '').toLowerCase())) return streamTranscode(req, reply, m)
    return reply.code(415).send({ error: 'incompatible' })
  })

  // download the original file to the user's device
  fastify.get('/api/download/:id', async (req, reply) => {
    const m = getMedia(req.params.id)
    if (!m || !fs.existsSync(m.path)) return reply.code(404).send()
    reply.header('Content-Disposition', `attachment; filename="${path.basename(m.path)}"`)
    return streamDirect(req, reply, m)
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
