import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { bytes, resLabel } from '../lib/format.js'

export default function FilesPage({ canDelete }) {
  const nav = useNavigate()
  const [cwd, setCwd] = useState('')
  const [data, setData] = useState({ folders: [], files: [] })
  const [clip, setClip] = useState(null) // { type:'media'|'folder', id/path, name }
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.fs(cwd).then(setData).catch((e) => setErr(e.message))
  }, [cwd])
  useEffect(() => { load() }, [load])

  const crumbs = cwd ? cwd.split('/') : []

  async function run(p) {
    setErr('')
    try {
      await p
      load()
    } catch (e) {
      setErr(e.message)
    }
  }

  const newFolder = () => {
    const name = prompt('New folder name:')
    if (name) run(api.mkdir(cwd, name))
  }
  const paste = () => {
    if (!clip) return
    const p = clip.type === 'media' ? api.moveMedia(clip.id, cwd) : api.moveFolder(clip.path, cwd)
    run(p).then(() => setClip(null))
  }
  const renameFolder = (f) => {
    const name = prompt('Rename folder:', f.name)
    if (name && name !== f.name) run(api.renameFolder(f.path, name))
  }
  const delFolder = (f) => {
    if (confirm(`Delete folder “${f.name}” and everything in it?`)) run(api.rmdir(f.path))
  }
  const delFile = (m) => {
    if (confirm(`Delete “${m.title || m.filename}”?\n\nThis removes the video file from disk.`))
      run(api.del(m.id, true))
  }

  return (
    <div className="anim-fade mx-auto max-w-[1400px] px-4 pb-24 pt-24 sm:px-6 sm:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">File Manager</h1>
        <div className="flex gap-2">
          <button onClick={newFolder} className="btn-ghost">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M12 11v4m-2-2h4" strokeLinecap="round" />
            </svg>
            New folder
          </button>
          {clip && (
            <button onClick={paste} className="btn-primary">
              Paste “{clip.name}” here
            </button>
          )}
        </div>
      </div>

      {/* breadcrumb */}
      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-400">
        <button onClick={() => setCwd('')} className="rounded px-2 py-1 hover:bg-white/5 hover:text-white">
          🏠 Home
        </button>
        {crumbs.map((c, i) => {
          const p = crumbs.slice(0, i + 1).join('/')
          return (
            <span key={p} className="flex items-center gap-1">
              <span className="text-slate-600">/</span>
              <button onClick={() => setCwd(p)} className="rounded px-2 py-1 hover:bg-white/5 hover:text-white">
                {c}
              </button>
            </span>
          )
        })}
      </div>

      {err && <p className="mb-3 text-sm text-rose-400">{err}</p>}

      {data.folders.length === 0 && data.files.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-20 text-slate-500">
          This folder is empty.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {data.folders.map((f) => (
            <div
              key={f.path}
              className="group anim-up relative overflow-hidden rounded-xl border border-white/5 bg-ink-850/70 p-4 transition hover:border-brand-500/40"
            >
              <button onDoubleClick={() => setCwd(f.path)} onClick={() => setCwd(f.path)} className="flex w-full items-center gap-3 text-left">
                <svg viewBox="0 0 24 24" className="h-10 w-10 shrink-0 text-amber-400" fill="currentColor">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                <div className="min-w-0">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-slate-500">{f.count} item{f.count === 1 ? '' : 's'}</div>
                </div>
              </button>
              <div className="mt-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <MiniBtn onClick={() => setClip({ type: 'folder', path: f.path, name: f.name })}>Cut</MiniBtn>
                <MiniBtn onClick={() => renameFolder(f)}>Rename</MiniBtn>
                {canDelete && <MiniBtn danger onClick={() => delFolder(f)}>Delete</MiniBtn>}
              </div>
            </div>
          ))}

          {data.files.map((m) => (
            <div
              key={m.id}
              className="group anim-up overflow-hidden rounded-xl border border-white/5 bg-ink-850/70 transition hover:border-brand-500/40"
            >
              <button onClick={() => nav(`/watch/${m.id}`)} className="block w-full">
                <div className="relative aspect-video bg-ink-800">
                  <img src={m.backdrop || api.thumb(m.id)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {m.height ? (
                    <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">{resLabel(m.height)}</span>
                  ) : null}
                </div>
              </button>
              <div className="p-2">
                <div className="truncate text-sm font-medium" title={m.filename}>{m.title || m.filename}</div>
                <div className="text-xs text-slate-500">{bytes(m.size)}</div>
                <div className="mt-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <MiniBtn onClick={() => setClip({ type: 'media', id: m.id, name: m.title || m.filename })}>Cut</MiniBtn>
                  <MiniBtn onClick={() => nav(`/watch/${m.id}`)}>Play</MiniBtn>
                  {canDelete && <MiniBtn danger onClick={() => delFile(m)}>Delete</MiniBtn>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
        danger ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}
