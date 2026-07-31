import {
  listFolder,
  createFolder,
  moveMedia,
  moveFolder,
  renameFolder,
  deleteFolder,
  copyMedia,
  copyFolder,
} from '../folders.js'
import { scanLibrary, runMetaWorker } from '../library.js'

const wrap = (fn) => (req, reply) => {
  try {
    return fn(req)
  } catch (e) {
    return reply.code(400).send({ error: String((e && e.message) || e) })
  }
}

export default async function foldersRoutes(fastify) {
  fastify.get('/api/fs', wrap((req) => listFolder(req.query.path || '')))

  fastify.post('/api/fs/folder', wrap((req) => createFolder(req.body?.path || '', req.body?.name)))

  fastify.post('/api/fs/rename', wrap((req) => renameFolder(req.body?.path, req.body?.name)))

  fastify.post(
    '/api/fs/move',
    wrap((req) => {
      const { mediaId, folder, dest } = req.body || {}
      if (mediaId) return moveMedia(mediaId, dest || '')
      if (folder != null) return moveFolder(folder, dest || '')
      throw new Error('mediaId or folder required')
    }),
  )

  fastify.post('/api/fs/copy', async (req, reply) => {
    try {
      const { mediaId, folder, dest } = req.body || {}
      if (mediaId) copyMedia(mediaId, dest || '')
      else if (folder != null) copyFolder(folder, dest || '')
      else throw new Error('mediaId or folder required')
      await scanLibrary() // index the copied file(s)
      runMetaWorker()
      return { ok: true }
    } catch (e) {
      return reply.code(400).send({ error: String((e && e.message) || e) })
    }
  })

  // gated by can_delete in the global preHandler
  fastify.delete('/api/fs/folder', wrap((req) => deleteFolder(req.query.path || '')))
}
