import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

// Password hashing with scrypt — no external dependency, salted per password.
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const h = scryptSync(pw, salt, 64)
  const hb = Buffer.from(hash, 'hex')
  return h.length === hb.length && timingSafeEqual(h, hb)
}
