import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { config } from '../config.js'
import { fixThumbnails, cleanJunk, stats, serverStats } from '../maintenance.js'
import { resetMeta, listMedia } from '../db.js'
import { runMetaWorker } from '../library.js'
import { enqueueOptimize } from '../optimize.js'
import { PLAYABLE_VCODECS } from '../config.js'

export default async function systemRoutes(fastify) {
  fastify.get('/api/system/stats', async () => stats())
  fastify.get('/api/system/server', async () => serverStats())

  // maintenance (admin-only, enforced in the global preHandler)
  fastify.post('/api/system/fix-thumbnails', async (req) =>
    fixThumbnails({ force: req.body?.force }),
  )
  fastify.post('/api/system/clean', async () => cleanJunk())
  fastify.post('/api/system/refresh-metadata', async () => {
    const queued = resetMeta()
    runMetaWorker() // fire-and-forget
    return { queued }
  })

  // convert every browser-incompatible video (HEVC/x265…) to H.264, keeping resolution
  fastify.post('/api/system/optimize-all', async () => {
    const items = listMedia().filter(
      (m) => m.vcodec && !PLAYABLE_VCODECS.has(m.vcodec.toLowerCase()) && !m.optimized,
    )
    for (const m of items) {
      try {
        enqueueOptimize(m.id)
      } catch {}
    }
    return { queued: items.length }
  })

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
    // Run the updater OUTSIDE this service's cgroup via systemd-run, so the
    // `systemctl restart` at the end of the script doesn't kill the updater
    // itself. Fall back to a plain detached process where systemd-run is absent.
    const detached = { detached: true, stdio: 'ignore' }
    const p = spawn('systemd-run', ['--scope', '--collect', 'bash', config.updateScript], detached)
    p.on('error', () => {
      const f = spawn('bash', [config.updateScript], detached)
      f.unref()
    })
    p.unref()
    return { ok: true, message: 'Update started — the app will pull the latest version, rebuild, and restart.' }
  })
}
