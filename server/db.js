import Database from 'better-sqlite3'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { config } from './config.js'

const db = new Database(path.join(config.dataDir, 'streamerbro.db'))
db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

db.exec(`
CREATE TABLE IF NOT EXISTS media (
  id          TEXT PRIMARY KEY,
  path        TEXT UNIQUE NOT NULL,
  filename    TEXT,
  title       TEXT,
  year        INTEGER,
  type        TEXT DEFAULT 'movie',
  size        INTEGER,
  duration    REAL,
  width       INTEGER,
  height      INTEGER,
  vcodec      TEXT,
  acodec      TEXT,
  container   TEXT,
  bitrate     INTEGER,
  folder      TEXT DEFAULT '',            -- relative folder path inside the media dir
  subs        TEXT DEFAULT '[]',          -- JSON: [{lang, file}] subtitle sidecars
  poster      TEXT,
  backdrop    TEXT,
  overview    TEXT,
  rating      REAL,
  imdb_id     TEXT,
  tmdb_id     INTEGER,
  genres      TEXT,
  cast_json   TEXT,
  runtime     INTEGER,
  progress    REAL DEFAULT 0,
  watched     INTEGER DEFAULT 0,
  added_at    INTEGER,
  meta_state  TEXT DEFAULT 'pending'   -- pending | done | none | error
);

CREATE TABLE IF NOT EXISTS downloads (
  id          TEXT PRIMARY KEY,
  kind        TEXT,                     -- torrent | ytdlp
  source      TEXT,
  name        TEXT,
  status      TEXT,                     -- queued | active | done | error | removed
  progress    REAL DEFAULT 0,
  speed       INTEGER DEFAULT 0,
  peers       INTEGER DEFAULT 0,
  eta         INTEGER,
  downloaded  INTEGER DEFAULT 0,
  total       INTEGER DEFAULT 0,
  dest        TEXT,
  error       TEXT,
  created_at  INTEGER,
  updated_at  INTEGER
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  pass          TEXT NOT NULL,
  is_admin      INTEGER DEFAULT 0,
  can_download  INTEGER DEFAULT 1,
  can_delete    INTEGER DEFAULT 0,
  color         TEXT DEFAULT '#e50914',
  created_at    INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_media_added ON media(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_dl_created ON downloads(created_at DESC);
`)

// lightweight migrations for pre-existing installs
try {
  db.prepare('SELECT folder FROM media LIMIT 1').get()
} catch {
  db.exec("ALTER TABLE media ADD COLUMN folder TEXT DEFAULT ''")
}
try {
  db.prepare('SELECT subs FROM media LIMIT 1').get()
} catch {
  db.exec("ALTER TABLE media ADD COLUMN subs TEXT DEFAULT '[]'")
}

// ---------- media ----------
const insertMediaStmt = db.prepare(`
  INSERT INTO media (id, path, filename, title, year, type, size, duration, width, height,
                     vcodec, acodec, container, bitrate, folder, added_at, meta_state)
  VALUES (@id, @path, @filename, @title, @year, @type, @size, @duration, @width, @height,
          @vcodec, @acodec, @container, @bitrate, @folder, @added_at, 'pending')
  ON CONFLICT(path) DO UPDATE SET
    size=@size, duration=@duration, width=@width, height=@height,
    vcodec=@vcodec, acodec=@acodec, container=@container, bitrate=@bitrate, folder=@folder
`)

export function upsertMedia(row) {
  const id = row.id || randomUUID()
  insertMediaStmt.run({
    id,
    path: row.path,
    filename: row.filename ?? null,
    title: row.title ?? null,
    year: row.year ?? null,
    type: row.type ?? 'movie',
    size: row.size ?? null,
    duration: row.duration ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    vcodec: row.vcodec ?? null,
    acodec: row.acodec ?? null,
    container: row.container ?? null,
    bitrate: row.bitrate ?? null,
    folder: row.folder ?? '',
    added_at: row.added_at ?? Date.now(),
  })
  return getMediaByPath(row.path)
}

// update a media row's path/filename/folder after a filesystem move
const moveMediaStmt = db.prepare(`UPDATE media SET path=@path, filename=@filename, folder=@folder WHERE id=@id`)
export function relocateMedia(id, { path: p, filename, folder }) {
  moveMediaStmt.run({ id, path: p, filename, folder })
}

const updateMetaStmt = db.prepare(`
  UPDATE media SET poster=@poster, backdrop=@backdrop, overview=@overview, rating=@rating,
    imdb_id=@imdb_id, tmdb_id=@tmdb_id, genres=@genres, cast_json=@cast_json, runtime=@runtime,
    title=COALESCE(@title, title), year=COALESCE(@year, year), meta_state=@meta_state
  WHERE id=@id
`)

export function updateMediaMeta(id, m) {
  updateMetaStmt.run({
    id,
    poster: m.poster ?? null,
    backdrop: m.backdrop ?? null,
    overview: m.overview ?? null,
    rating: m.rating ?? null,
    imdb_id: m.imdb_id ?? null,
    tmdb_id: m.tmdb_id ?? null,
    genres: m.genres ? JSON.stringify(m.genres) : null,
    cast_json: m.cast ? JSON.stringify(m.cast) : null,
    runtime: m.runtime ?? null,
    title: m.title ?? null,
    year: m.year ?? null,
    meta_state: m.meta_state ?? 'done',
  })
}

const getByPathStmt = db.prepare(`SELECT * FROM media WHERE path=?`)
export const getMediaByPath = (p) => getByPathStmt.get(p)

const getMediaStmt = db.prepare(`SELECT * FROM media WHERE id=?`)
export const getMedia = (id) => getMediaStmt.get(id)

const allMediaStmt = db.prepare(`SELECT * FROM media`)
export function listMedia() {
  return allMediaStmt.all().map(hydrate)
}

export function pendingMeta() {
  return db.prepare(`SELECT * FROM media WHERE meta_state='pending'`).all()
}

const setProgressStmt = db.prepare(`UPDATE media SET progress=?, watched=? WHERE id=?`)
export function setProgress(id, progress, watched) {
  setProgressStmt.run(progress, watched ? 1 : 0, id)
}

const setMetaStateStmt = db.prepare(`UPDATE media SET meta_state=? WHERE id=?`)
export const setMetaState = (id, s) => setMetaStateStmt.run(s, id)

// re-queue metadata for everything that isn't already fetched (leaves YT/done items)
export function resetMeta() {
  return db.prepare(`UPDATE media SET meta_state='pending' WHERE meta_state != 'done'`).run().changes
}

const delMediaStmt = db.prepare(`DELETE FROM media WHERE id=?`)
export const deleteMedia = (id) => delMediaStmt.run(id)

function hydrate(r) {
  if (!r) return r
  return {
    ...r,
    watched: !!r.watched,
    genres: r.genres ? JSON.parse(r.genres) : [],
    cast: r.cast_json ? JSON.parse(r.cast_json) : [],
    subs: r.subs ? JSON.parse(r.subs) : [],
  }
}

const setSubsStmt = db.prepare(`UPDATE media SET subs=? WHERE id=?`)
export function setSubs(id, arr) {
  setSubsStmt.run(JSON.stringify(arr || []), id)
}
export const hydrateMedia = hydrate

// ---------- downloads ----------
const insertDlStmt = db.prepare(`
  INSERT INTO downloads (id, kind, source, name, status, created_at, updated_at)
  VALUES (@id, @kind, @source, @name, @status, @ts, @ts)
`)
export function createDownload({ kind, source, name }) {
  const id = randomUUID()
  const ts = Date.now()
  insertDlStmt.run({ id, kind, source, name: name ?? source, status: 'queued', ts })
  return getDownload(id)
}

const updDlStmt = db.prepare(`
  UPDATE downloads SET
    name=COALESCE(@name, name), status=COALESCE(@status, status),
    progress=COALESCE(@progress, progress), speed=COALESCE(@speed, speed),
    peers=COALESCE(@peers, peers), eta=COALESCE(@eta, eta),
    downloaded=COALESCE(@downloaded, downloaded), total=COALESCE(@total, total),
    dest=COALESCE(@dest, dest), error=COALESCE(@error, error),
    updated_at=@ts
  WHERE id=@id
`)
export function updateDownload(id, p = {}) {
  updDlStmt.run({
    id,
    name: p.name ?? null,
    status: p.status ?? null,
    progress: p.progress ?? null,
    speed: p.speed ?? null,
    peers: p.peers ?? null,
    eta: p.eta ?? null,
    downloaded: p.downloaded ?? null,
    total: p.total ?? null,
    dest: p.dest ?? null,
    error: p.error ?? null,
    ts: Date.now(),
  })
}

const getDlStmt = db.prepare(`SELECT * FROM downloads WHERE id=?`)
export const getDownload = (id) => getDlStmt.get(id)

export function listDownloads() {
  return db.prepare(`SELECT * FROM downloads WHERE status != 'removed' ORDER BY created_at DESC`).all()
}
const delDlStmt = db.prepare(`UPDATE downloads SET status='removed' WHERE id=?`)
export const removeDownload = (id) => delDlStmt.run(id)

// hard-delete a finished download row (so it disappears once the file is in the library)
const purgeDlStmt = db.prepare(`DELETE FROM downloads WHERE id=?`)
export const purgeDownload = (id) => purgeDlStmt.run(id)

// ---------- users ----------
const sanitize = (u) =>
  u && {
    id: u.id,
    username: u.username,
    is_admin: !!u.is_admin,
    can_download: !!u.can_download,
    can_delete: !!u.can_delete,
    color: u.color,
  }

export const countUsers = () => db.prepare(`SELECT COUNT(*) n FROM users`).get().n

const insertUserStmt = db.prepare(`
  INSERT INTO users (id, username, pass, is_admin, can_download, can_delete, color, created_at)
  VALUES (@id, @username, @pass, @is_admin, @can_download, @can_delete, @color, @created_at)
`)
export function createUser({ username, pass, is_admin = 0, can_download = 1, can_delete = 0, color }) {
  const id = randomUUID()
  insertUserStmt.run({
    id,
    username,
    pass,
    is_admin: is_admin ? 1 : 0,
    can_download: can_download ? 1 : 0,
    can_delete: can_delete ? 1 : 0,
    color: color || '#e50914',
    created_at: Date.now(),
  })
  return getUser(id)
}
const getUserStmt = db.prepare(`SELECT * FROM users WHERE id=?`)
export const getUser = (id) => getUserStmt.get(id)
export const getUserRaw = (id) => getUserStmt.get(id)
const getUserByNameStmt = db.prepare(`SELECT * FROM users WHERE username=? COLLATE NOCASE`)
export const getUserByName = (n) => getUserByNameStmt.get(n)
export const listUsers = () => db.prepare(`SELECT * FROM users ORDER BY created_at`).all().map(sanitize)
export const sanitizeUser = sanitize

const updUserStmt = db.prepare(`
  UPDATE users SET
    can_download=COALESCE(@can_download, can_download),
    can_delete=COALESCE(@can_delete, can_delete),
    pass=COALESCE(@pass, pass),
    color=COALESCE(@color, color)
  WHERE id=@id
`)
export function updateUser(id, p) {
  updUserStmt.run({
    id,
    can_download: p.can_download == null ? null : p.can_download ? 1 : 0,
    can_delete: p.can_delete == null ? null : p.can_delete ? 1 : 0,
    pass: p.pass ?? null,
    color: p.color ?? null,
  })
  return getUser(id)
}
export const deleteUser = (id) => db.prepare(`DELETE FROM users WHERE id=?`).run(id)

// ---------- sessions ----------
export function createSession(userId) {
  const token = randomUUID() + randomUUID().replace(/-/g, '')
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run(token, userId, Date.now())
  return token
}
export function getSessionUser(token) {
  if (!token) return null
  const s = db.prepare(`SELECT user_id FROM sessions WHERE token=?`).get(token)
  if (!s) return null
  return sanitize(getUser(s.user_id))
}
export const deleteSession = (token) => db.prepare(`DELETE FROM sessions WHERE token=?`).run(token)
export const deleteUserSessions = (userId) => db.prepare(`DELETE FROM sessions WHERE user_id=?`).run(userId)

export default db
