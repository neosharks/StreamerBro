import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { config } from '../config.js'

export default async function systemRoutes(fastify) {
  fastify.get('/api/system/version', async () => {
    let latest = null
    try {
      const r = await fetch(config.versionUrl, { signal: AbortSignal.timeout(5000) })
      if (r.ok) latest = (await r.text()).trim()
    } catch {}
    return {
      current: config.version,
      latest,
      updateAvailable: !!latest && latest !== config.version,
    }
  })

  fastify.get('/api/system/info', async () => ({
    version: config.version,
    mediaDir: config.mediaDir,
    tmdb: !!config.tmdbKey,
    omdb: !!config.omdbKey,
  }))

  // Trigger the self-update script (git pull + rebuild + restart service).
  fastify.post('/api/system/update', async (req, reply) => {
    if (!fs.existsSync(config.updateScript)) {
      return reply.code(400).send({ ok: false, error: 'update script not found on this install' })
    }
    const p = spawn('bash', [config.updateScript], { detached: true, stdio: 'ignore' })
    p.unref()
    return { ok: true, message: 'Update started — the app will rebuild and restart shortly.' }
  })
}
