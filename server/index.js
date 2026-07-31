import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fs from 'node:fs'
import { config } from './config.js'
import { scanLibrary, runMetaWorker } from './library.js'
import { getSessionUser } from './db.js'
import authRoutes from './routes/auth.routes.js'
import libraryRoutes from './routes/library.routes.js'
import streamRoutes from './routes/stream.routes.js'
import downloadsRoutes from './routes/downloads.routes.js'
import foldersRoutes from './routes/folders.routes.js'
import systemRoutes from './routes/system.routes.js'

const app = Fastify({ logger: false, bodyLimit: 16 * 1024 * 1024 })

await app.register(cors, { origin: true, credentials: true })
await app.register(cookie)

const PUBLIC = ['/api/auth/state', '/api/auth/profiles', '/api/auth/login', '/api/auth/setup']

// ---- authentication + permission gate for every /api route ----
app.addHook('preHandler', async (req, reply) => {
  const url = (req.raw.url || '').split('?')[0]
  if (!url.startsWith('/api/')) return
  if (PUBLIC.some((p) => url === p)) return

  const user = getSessionUser(req.cookies?.sb_session)
  if (!user) return reply.code(401).send({ error: 'unauthorized' })
  req.user = user

  const admin = user.is_admin
  const m = req.method

  // user management + all system mutations are admin-only (GET version/info/stats are open)
  const adminOnly =
    url.startsWith('/api/users') ||
    (m === 'POST' && url.startsWith('/api/system/'))
  if (adminOnly && !admin) return reply.code(403).send({ error: 'admin only' })
  // starting downloads requires download permission
  if (m === 'POST' && url.startsWith('/api/downloads/') && !admin && !user.can_download) {
    return reply.code(403).send({ error: 'you do not have download permission' })
  }
  // deleting media / folders requires delete permission
  const isDelete = m === 'DELETE' && (url.startsWith('/api/media/') || url === '/api/fs/folder')
  if (isDelete && !admin && !user.can_delete) {
    return reply.code(403).send({ error: 'you do not have delete permission' })
  }
})

await app.register(authRoutes)
await app.register(libraryRoutes)
await app.register(streamRoutes)
await app.register(downloadsRoutes)
await app.register(foldersRoutes)
await app.register(systemRoutes)

// Serve the built React app; unknown non-API routes fall back to index.html (SPA).
if (fs.existsSync(config.webRoot)) {
  await app.register(fastifyStatic, { root: config.webRoot })
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.url?.startsWith('/api')) return reply.code(404).send({ error: 'not found' })
    return reply.sendFile('index.html')
  })
} else {
  app.get('/', async () => ({
    ok: true,
    msg: `Streamer Bro API v${config.version}. Build the UI with: npm run build:web`,
  }))
}

try {
  const addr = await app.listen({ port: config.port, host: config.host })
  console.log(`\n  ▶ Streamer Bro v${config.version}`)
  console.log(`    ${addr}`)
  console.log(`    media:  ${config.mediaDir}`)
  console.log(`    tmdb:   ${config.tmdbKey ? 'configured' : 'not set (metadata disabled)'}\n`)
  scanLibrary()
    .then(() => runMetaWorker())
    .catch(() => {})
} catch (err) {
  console.error('Failed to start:', err)
  process.exit(1)
}
