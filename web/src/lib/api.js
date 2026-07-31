async function j(r) {
  if (!r.ok) {
    let err = { error: `HTTP ${r.status}` }
    try {
      err = await r.json()
    } catch {}
    const e = new Error(err.error || `HTTP ${r.status}`)
    e.status = r.status
    throw e
  }
  return r.json()
}

const opts = { credentials: 'include' }
const jsonPost = (url, body, method = 'POST') =>
  fetch(url, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  }).then(j)

export const api = {
  // auth
  authState: () => fetch('/api/auth/state', opts).then(j),
  profiles: () => fetch('/api/auth/profiles', opts).then(j),
  setup: (username, password) => jsonPost('/api/auth/setup', { username, password }),
  login: (username, password) => jsonPost('/api/auth/login', { username, password }),
  logout: () => jsonPost('/api/auth/logout'),

  // users (admin)
  users: () => fetch('/api/users', opts).then(j),
  createUser: (u) => jsonPost('/api/users', u),
  updateUser: (id, patch) => jsonPost(`/api/users/${id}`, patch, 'PATCH'),
  deleteUser: (id) => fetch(`/api/users/${id}`, { method: 'DELETE', ...opts }).then(j),

  // library
  media: (q = '', sort = 'added') =>
    fetch(`/api/media?q=${encodeURIComponent(q)}&sort=${sort}`, opts).then(j),
  get: (id) => fetch(`/api/media/${id}`, opts).then(j),
  scan: () => jsonPost('/api/media/scan'),
  refreshMeta: (id) => jsonPost(`/api/media/${id}/refresh-meta`),
  optimize: (id) => jsonPost(`/api/media/${id}/optimize`),
  downloadUrl: (id, optimized) => `/api/download/${id}${optimized ? '?optimized=1' : ''}`,
  setProgress: (id, progress, watched) =>
    jsonPost(`/api/media/${id}/progress`, { progress, watched }),
  del: (id, deleteFile) =>
    fetch(`/api/media/${id}?deleteFile=${deleteFile ? 1 : 0}`, { method: 'DELETE', ...opts }).then(j),

  // downloads
  downloads: () => fetch('/api/downloads', opts).then(j),
  addTorrent: (magnet) => jsonPost('/api/downloads/torrent', { magnet }),
  addYtdlp: (url) => jsonPost('/api/downloads/ytdlp', { url }),
  cancelDownload: (id) => fetch(`/api/downloads/${id}`, { method: 'DELETE', ...opts }).then(j),

  // file manager
  fs: (path = '') => fetch(`/api/fs?path=${encodeURIComponent(path)}`, opts).then(j),
  mkdir: (path, name) => jsonPost('/api/fs/folder', { path, name }),
  renameFolder: (path, name) => jsonPost('/api/fs/rename', { path, name }),
  moveMedia: (mediaId, dest) => jsonPost('/api/fs/move', { mediaId, dest }),
  moveFolder: (folder, dest) => jsonPost('/api/fs/move', { folder, dest }),
  copyMedia: (mediaId, dest) => jsonPost('/api/fs/copy', { mediaId, dest }),
  copyFolder: (folder, dest) => jsonPost('/api/fs/copy', { folder, dest }),
  rmdir: (path) => fetch(`/api/fs/folder?path=${encodeURIComponent(path)}`, { method: 'DELETE', ...opts }).then(j),

  // subtitles
  addSubtitle: (id, content, lang) => jsonPost(`/api/media/${id}/subtitle`, { content, lang }),
  subsUrl: (id, idx) => `/api/subs/${id}/${idx}`,

  // system
  version: () => fetch('/api/system/version', opts).then(j),
  info: () => fetch('/api/system/info', opts).then(j),
  stats: () => fetch('/api/system/stats', opts).then(j),
  server: () => fetch('/api/system/server', opts).then(j),
  update: () => jsonPost('/api/system/update'),
  fixThumbnails: (force) => jsonPost('/api/system/fix-thumbnails', { force }),
  cleanJunk: () => jsonPost('/api/system/clean'),
  refreshMetaAll: () => jsonPost('/api/system/refresh-metadata'),
  optimizeAll: () => jsonPost('/api/system/optimize-all'),

  streamUrl: (id, transcode) => `/api/stream/${id}${transcode ? '?transcode=1' : ''}`,
  thumb: (id) => `/api/thumb/${id}`,
}
