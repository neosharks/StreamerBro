import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { bytes, duration, resLabel } from '../lib/format.js'

const PLAYABLE_V = ['h264', 'avc1', 'vp8', 'vp9', 'av1']
const needsConvert = (m) => m.vcodec && !PLAYABLE_V.includes(m.vcodec.toLowerCase()) && !m.optimized

export default function FilesPage({ canDelete }) {
  const nav = useNavigate()
  const [cwd, setCwd] = useState('')
  const [data, setData] = useState({ folders: [], files: [] })
  const [clip, setClip] = useState(null) // { mode:'cut'|'copy', type, id/path, name }
  const [sel, setSel] = useState(null) // { type:'folder'|'media', ...item } for the details panel
  const [dragOver, setDragOver] = useState(null)
  const [menuId, setMenuId] = useState(null) // open ⋯ menu for this media id
  const [err, setErr] = useState('')
  const dragRef = useRef(null)

  const convert = (m) => {
    setMenuId(null)
    api
      .optimize(m.id)
      .then(() => nav('/conversions'))
      .catch((e) => setErr(e.message))
  }

  const load = useCallback(() => {
    api.fs(cwd).then((d) => { setData(d); setSel(null) }).catch((e) => setErr(e.message))
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
    const fn =
      clip.mode === 'copy'
        ? clip.type === 'media'
          ? api.copyMedia(clip.id, cwd)
          : api.copyFolder(clip.path, cwd)
        : clip.type === 'media'
          ? api.moveMedia(clip.id, cwd)
          : api.moveFolder(clip.path, cwd)
    run(fn).then(() => setClip(null))
  }
  const renameFolder = (f) => {
    const name = prompt('Rename folder:', f.name)
    if (name && name !== f.name) run(api.renameFolder(f.path, name))
  }
  const delFolder = (f) => confirm(`Delete folder “${f.name}” and everything in it?`) && run(api.rmdir(f.path))
  const delFile = (m) =>
    confirm(`Delete “${m.title || m.filename}”?\n\nThis removes the video file from disk.`) &&
    run(api.del(m.id, true))

  // ---- drag & drop ----
  const dropInto = (destPath) => (e) => {
    e.preventDefault()
    setDragOver(null)
    const it = dragRef.current
    dragRef.current = null
    if (!it) return
    if (it.type === 'media') run(api.moveMedia(it.id, destPath))
    else if (it.type === 'folder' && it.path !== destPath) run(api.moveFolder(it.path, destPath))
  }
  const allowDrop = (path) => (e) => {
    e.preventDefault()
    setDragOver(path)
  }

  return (
    <div className="anim-fade mx-auto max-w-[1400px] px-4 pb-24 pt-24 sm:px-6 sm:pb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">File Manager</h1>
        <div className="flex gap-2">
          <button onClick={newFolder} className="btn-ghost">＋ New folder</button>
          {clip && (
            <button onClick={paste} className="btn-primary">
              Paste ({clip.mode}) “{clip.name}”
            </button>
          )}
        </div>
      </div>

      {/* breadcrumb (also drop targets) */}
      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-400">
        <button
          onClick={() => setCwd('')}
          onDragOver={allowDrop('')}
          onDragLeave={() => setDragOver(null)}
          onDrop={dropInto('')}
          className={`rounded px-2 py-1 hover:bg-white/5 hover:text-white ${dragOver === '' ? 'bg-brand-500/20 text-white' : ''}`}
        >
          🏠 Home
        </button>
        {crumbs.map((c, i) => {
          const p = crumbs.slice(0, i + 1).join('/')
          return (
            <span key={p} className="flex items-center gap-1">
              <span className="text-slate-600">/</span>
              <button
                onClick={() => setCwd(p)}
                onDragOver={allowDrop(p)}
                onDragLeave={() => setDragOver(null)}
                onDrop={dropInto(p)}
                className={`rounded px-2 py-1 hover:bg-white/5 hover:text-white ${dragOver === p ? 'bg-brand-500/20 text-white' : ''}`}
              >
                {c}
              </button>
            </span>
          )
        })}
      </div>

      {err && <p className="mb-3 text-sm text-rose-400">{err}</p>}

      <div className="flex gap-5">
        {/* main grid */}
        <div className="min-w-0 flex-1">
          {data.folders.length === 0 && data.files.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-white/10 py-20 text-slate-500">
              This folder is empty.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {data.folders.map((f) => (
                <div
                  key={f.path}
                  draggable
                  onDragStart={() => (dragRef.current = { type: 'folder', path: f.path, name: f.name })}
                  onDragOver={allowDrop(f.path)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={dropInto(f.path)}
                  onClick={() => setSel({ type: 'folder', ...f })}
                  onDoubleClick={() => setCwd(f.path)}
                  className={`group cursor-pointer rounded-xl border bg-ink-850/70 p-4 transition ${
                    dragOver === f.path ? 'border-brand-500 bg-brand-500/10' : sel?.path === f.path ? 'border-brand-500/60' : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="h-10 w-10 shrink-0 text-amber-400" fill="currentColor">
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.name}</div>
                      <div className="text-xs text-slate-500">{f.count} item{f.count === 1 ? '' : 's'} · {bytes(f.size)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1 opacity-0 transition group-hover:opacity-100">
                    <Mini onClick={() => setClip({ mode: 'cut', type: 'folder', path: f.path, name: f.name })}>Cut</Mini>
                    <Mini onClick={() => setClip({ mode: 'copy', type: 'folder', path: f.path, name: f.name })}>Copy</Mini>
                    <Mini onClick={() => renameFolder(f)}>Rename</Mini>
                    {canDelete && <Mini danger onClick={() => delFolder(f)}>Delete</Mini>}
                  </div>
                </div>
              ))}

              {data.files.map((m) => (
                <div
                  key={m.id}
                  draggable
                  onDragStart={() => (dragRef.current = { type: 'media', id: m.id, name: m.title || m.filename })}
                  onClick={() => setSel({ type: 'media', ...m })}
                  onDoubleClick={() => nav(`/watch/${m.id}`)}
                  className={`group relative overflow-hidden rounded-xl border bg-ink-850/70 transition ${
                    sel?.id === m.id ? 'border-brand-500/60' : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="relative aspect-video bg-ink-800">
                    <img src={m.backdrop || api.thumb(m.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {m.height ? <span className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">{resLabel(m.height)}</span> : null}
                    <div className="absolute left-1 top-1 flex gap-1">
                      {m.subs?.length ? <span className="rounded bg-black/70 px-1 py-0.5 text-[9px] font-bold">CC</span> : null}
                      {m.optimized ? <span className="rounded bg-emerald-600/80 px-1 py-0.5 text-[9px] font-bold">H.264</span> : null}
                      {needsConvert(m) ? <span className="rounded bg-amber-500/80 px-1 py-0.5 text-[9px] font-bold">{(m.vcodec || '').toUpperCase()}</span> : null}
                    </div>
                    {/* three-dots menu */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === m.id ? null : m.id) }}
                      className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-md bg-black/60 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                    </button>
                  </div>
                  <div className="p-2">
                    <div className="truncate text-sm font-medium" title={m.filename}>{m.title || m.filename}</div>
                    <div className="text-xs text-slate-500">{bytes(m.size)}</div>
                  </div>

                  {menuId === m.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setMenuId(null) }} />
                      <div className="absolute bottom-10 right-1 z-30 w-44 overflow-hidden rounded-xl border border-white/10 bg-ink-800 py-1 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <MenuItem onClick={() => { setMenuId(null); nav(`/watch/${m.id}`) }}>▶ Play</MenuItem>
                        <a href={api.downloadUrl(m.id)} download onClick={() => setMenuId(null)} className="block px-3 py-2 text-sm text-slate-200 hover:bg-white/5">⬇ Download</a>
                        {needsConvert(m) && <MenuItem onClick={() => convert(m)}>✦ Convert to H.264</MenuItem>}
                        {m.optimized && <div className="px-3 py-2 text-sm text-emerald-300">✓ Optimized</div>}
                        <MenuItem onClick={() => { setClip({ mode: 'cut', type: 'media', id: m.id, name: m.title || m.filename }); setMenuId(null) }}>✂ Cut</MenuItem>
                        <MenuItem onClick={() => { setClip({ mode: 'copy', type: 'media', id: m.id, name: m.title || m.filename }); setMenuId(null) }}>⧉ Copy</MenuItem>
                        {canDelete && <MenuItem danger onClick={() => { setMenuId(null); delFile(m) }}>🗑 Delete</MenuItem>}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* details panel */}
        {sel && (
          <aside className="hidden w-72 shrink-0 rounded-2xl border border-white/10 bg-ink-850/70 p-4 lg:block">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Details</h3>
              <button onClick={() => setSel(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            {sel.type === 'folder' ? (
              <dl className="space-y-2 text-sm">
                <Row k="Name" v={sel.name} />
                <Row k="Type" v="Folder" />
                <Row k="Items" v={`${sel.count}`} />
                <Row k="Size" v={bytes(sel.size)} />
                <Row k="Path" v={sel.path} mono />
                <button onClick={() => setCwd(sel.path)} className="btn-ghost mt-2 w-full">Open</button>
              </dl>
            ) : (
              <>
                <img src={sel.backdrop || api.thumb(sel.id)} alt="" className="mb-3 aspect-video w-full rounded-lg object-cover" />
                <dl className="space-y-2 text-sm">
                  <Row k="Title" v={sel.title || sel.filename} />
                  <Row k="File" v={sel.filename} mono />
                  <Row k="Size" v={bytes(sel.size)} />
                  {sel.height ? <Row k="Resolution" v={`${resLabel(sel.height)} (${sel.width}×${sel.height})`} /> : null}
                  {sel.vcodec ? <Row k="Codec" v={`${sel.vcodec}${sel.acodec ? ' / ' + sel.acodec : ''}`} /> : null}
                  {sel.duration ? <Row k="Duration" v={duration(sel.duration)} /> : null}
                  <Row k="Subtitles" v={sel.subs?.length ? `${sel.subs.length} track(s)` : 'none'} />
                  {sel.folder ? <Row k="Folder" v={sel.folder} mono /> : null}
                </dl>
                <button onClick={() => nav(`/watch/${sel.id}`)} className="btn-primary mt-3 w-full">Play</button>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function Mini({ children, onClick, danger }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`rounded-md px-2 py-1 text-xs font-medium transition ${
        danger ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25' : 'bg-white/5 text-slate-300 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

function MenuItem({ children, onClick, danger }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/5 ${danger ? 'text-rose-300' : 'text-slate-200'}`}
    >
      {children}
    </button>
  )
}

function Row({ k, v, mono }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{k}</dt>
      <dd className={`truncate text-right ${mono ? 'font-mono text-xs' : ''}`} title={v}>{v}</dd>
    </div>
  )
}
