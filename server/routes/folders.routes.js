import {
  listFolder,
  createFolder,
  moveMedia,
  moveFolder,
  renameFolder,
  deleteFolder,
} from '../folders.js'

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

  // gated by can_delete in the global preHandler
  fastify.delete('/api/fs/folder', wrap((req) => deleteFolder(req.query.path || '')))
}
