import { hashPassword, verifyPassword } from '../auth.js'
import {
  countUsers,
  createUser,
  getUser,
  getUserByName,
  listUsers,
  updateUser,
  deleteUser,
  deleteUserSessions,
  createSession,
  deleteSession,
  getSessionUser,
  sanitizeUser,
} from '../db.js'

const COOKIE = 'sb_session'
const cookieOpts = { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 }

export default async function authRoutes(fastify) {
  // public: is the app set up, and who (if anyone) am I
  fastify.get('/api/auth/state', async (req) => {
    return { needsSetup: countUsers() === 0, user: getSessionUser(req.cookies?.[COOKIE]) }
  })

  // public: profile avatars for the "who's watching" login screen (name + color only)
  fastify.get('/api/auth/profiles', async () =>
    listUsers().map((u) => ({ username: u.username, color: u.color })),
  )

  // public: first-run admin creation (only when there are no users)
  fastify.post('/api/auth/setup', async (req, reply) => {
    if (countUsers() > 0) return reply.code(403).send({ error: 'already set up' })
    const { username, password } = req.body || {}
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' })
    const u = createUser({
      username: username.trim(),
      pass: hashPassword(password),
      is_admin: 1,
      can_download: 1,
      can_delete: 1,
    })
    reply.setCookie(COOKIE, createSession(u.id), cookieOpts)
    return { user: sanitizeUser(u) }
  })

  // public: login
  fastify.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body || {}
    const u = getUserByName((username || '').trim())
    if (!u || !verifyPassword(password || '', u.pass)) {
      return reply.code(401).send({ error: 'invalid username or password' })
    }
    reply.setCookie(COOKIE, createSession(u.id), cookieOpts)
    return { user: sanitizeUser(u) }
  })

  fastify.post('/api/auth/logout', async (req, reply) => {
    if (req.cookies?.[COOKIE]) deleteSession(req.cookies[COOKIE])
    reply.clearCookie(COOKIE, { path: '/' })
    return { ok: true }
  })

  fastify.get('/api/auth/me', async (req) => ({ user: req.user }))

  // ---- user management (admin only, enforced in the global preHandler) ----
  fastify.get('/api/users', async () => listUsers())

  fastify.post('/api/users', async (req, reply) => {
    const { username, password, can_download, can_delete, color } = req.body || {}
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' })
    if (getUserByName(username.trim())) return reply.code(409).send({ error: 'username already taken' })
    return sanitizeUser(
      createUser({ username: username.trim(), pass: hashPassword(password), can_download, can_delete, color }),
    )
  })

  fastify.patch('/api/users/:id', async (req, reply) => {
    const { can_download, can_delete, password, color } = req.body || {}
    const patch = { can_download, can_delete, color }
    if (password) patch.pass = hashPassword(password)
    const u = updateUser(req.params.id, patch)
    if (!u) return reply.code(404).send({ error: 'not found' })
    return sanitizeUser(u)
  })

  fastify.delete('/api/users/:id', async (req, reply) => {
    const u = getUser(req.params.id)
    if (!u) return reply.code(404).send({ error: 'not found' })
    if (u.is_admin) return reply.code(400).send({ error: 'cannot delete the admin account' })
    deleteUserSessions(req.params.id)
    deleteUser(req.params.id)
    return { ok: true }
  })
}
