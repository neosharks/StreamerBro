export function bytes(n) {
  if (!n || n < 1) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(n) / Math.log(1024))
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}

export const speed = (n) => `${bytes(n)}/s`

export function duration(sec) {
  if (!sec) return ''
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h) return `${h}h ${m}m`
  return `${m}m`
}

export function clock(sec) {
  if (sec == null || !isFinite(sec)) return '—'
  sec = Math.max(0, Math.round(sec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (x) => String(x).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function eta(sec) {
  if (sec == null || !isFinite(sec) || sec <= 0) return ''
  if (sec < 60) return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`
}

export function resLabel(h) {
  if (!h) return ''
  if (h >= 2000) return '4K'
  if (h >= 1060) return '1080p'
  if (h >= 700) return '720p'
  if (h >= 570) return '576p'
  return `${h}p`
}
