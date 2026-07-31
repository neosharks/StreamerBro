import { useState } from 'react'
import { api } from '../lib/api.js'
import { bytes, speed, eta } from '../lib/format.js'

function AddBar() {
  const [tab, setTab] = useState('link')
  const [v, setV] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    const val = v.trim()
    if (!val) return
    setBusy(true)
    setErr('')
    try {
      if (tab === 'torrent') await api.addTorrent(val)
      else await api.addYtdlp(val)
      setV('')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="anim-up rounded-2xl border border-white/10 bg-ink-850/70 p-5">
      <div className="mb-3 flex gap-1 rounded-xl bg-ink-800 p-1">
        {[
          { id: 'link', label: 'Video / YouTube link' },
          { id: 'torrent', label: 'Torrent magnet' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          className="input min-w-[220px] flex-1"
          placeholder={tab === 'torrent' ? 'magnet:?xt=urn:btih:…' : 'https://youtube.com/watch?v=… (or any yt-dlp site)'}
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        <button disabled={busy || !v.trim()} className="btn-primary">{busy ? 'Adding…' : 'Download'}</button>
      </form>
      <p className="mt-2 text-xs text-slate-500">
        Best quality is fetched automatically. When a download finishes it moves into your library and disappears from here.
      </p>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
    </div>
  )
}

function Card({ d }) {
  const pct = Math.round((d.progress || 0) * 100)
  const active = d.status === 'active' || d.status === 'queued'
  return (
    <div className="anim-up rounded-2xl border border-white/5 bg-ink-850/70 p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${d.kind === 'torrent' ? 'bg-sky-500/15 text-sky-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {d.kind === 'torrent' ? 'Torrent' : 'yt-dlp'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-100" title={d.name}>{d.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-400">
            <span className={`font-semibold ${d.status === 'error' ? 'text-rose-400' : 'text-brand-400'}`}>
              {d.status === 'error' ? 'Error' : `${pct}%`}
            </span>
            {active && d.speed > 0 && <span>↓ {speed(d.speed)}</span>}
            {active && d.kind === 'torrent' && d.peers > 0 && <span>{d.peers} peers</span>}
            {active && d.eta > 0 && <span>ETA {eta(d.eta)}</span>}
            {d.total > 0 && <span>{bytes(d.downloaded)} / {bytes(d.total)}</span>}
          </div>
          {d.error && <div className="mt-1 truncate text-xs text-rose-400" title={d.error}>{d.error}</div>}
        </div>
        <button onClick={() => api.cancelDownload(d.id)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-rose-400" title="Cancel">✕</button>
      </div>
      {d.status !== 'error' && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export default function DownloadsPage({ downloads, canDownload }) {
  return (
    <div className="anim-fade mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pb-10">
      <h1 className="mb-5 text-2xl font-bold">Downloads</h1>
      {canDownload ? (
        <AddBar />
      ) : (
        <p className="rounded-xl border border-white/10 bg-ink-850/60 p-4 text-sm text-slate-400">
          You don't have permission to start downloads. Ask an admin to enable it for your profile.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {downloads.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-16 text-center text-slate-500">
            <div>
              <div className="mb-2 text-3xl">📥</div>
              Nothing downloading. Finished items live in your library.
            </div>
          </div>
        ) : (
          downloads.map((d) => <Card key={d.id} d={d} />)
        )}
      </div>
    </div>
  )
}
