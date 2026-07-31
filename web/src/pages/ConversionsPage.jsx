import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { resLabel } from '../lib/format.js'

export default function ConversionsPage({ downloads }) {
  const jobs = downloads.filter((d) => d.kind === 'optimize')
  const [optimized, setOptimized] = useState([])

  // reload the optimized list whenever a job finishes (jobs count changes)
  useEffect(() => {
    api
      .media('', 'added')
      .then((list) => setOptimized(list.filter((m) => m.optimized)))
      .catch(() => {})
  }, [jobs.length])

  return (
    <div className="anim-fade mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pb-10">
      <h1 className="mb-1 text-2xl font-bold">Conversions</h1>
      <p className="mb-5 text-sm text-slate-400">
        Convert browser-incompatible videos (HEVC/x265) to H.264 — full resolution kept, so they
        stream smoothly everywhere.
      </p>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">In progress</h2>
      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
          No conversions running. Start one from a video's ⋯ menu in the File Manager.
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((d) => {
            const pct = Math.round((d.progress || 0) * 100)
            return (
              <div key={d.id} className="anim-up rounded-2xl border border-white/5 bg-ink-850/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.name}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {d.status === 'error' ? <span className="text-rose-400">Error: {d.error}</span> : `${pct}%`}
                    </div>
                  </div>
                  <button onClick={() => api.cancelDownload(d.id)} className="rounded-lg p-1 text-slate-500 hover:text-rose-400" title="Cancel">
                    ✕
                  </button>
                </div>
                {d.status !== 'error' && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Optimized ({optimized.length})
      </h2>
      {optimized.length === 0 ? (
        <div className="text-sm text-slate-500">Nothing converted yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {optimized.map((m) => (
            <Link key={m.id} to={`/watch/${m.id}`} className="group overflow-hidden rounded-xl border border-white/5 bg-ink-850/70 transition hover:border-emerald-500/40">
              <div className="relative aspect-video bg-ink-800">
                <img src={m.backdrop || api.thumb(m.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-bold text-white">H.264 ✓</span>
                {m.height ? <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">{resLabel(m.height)}</span> : null}
              </div>
              <div className="p-2">
                <div className="truncate text-sm font-medium">{m.title || m.filename}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
