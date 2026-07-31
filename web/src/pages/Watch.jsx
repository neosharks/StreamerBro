import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import NetflixPlayer from '../components/NetflixPlayer.jsx'
import { api } from '../lib/api.js'
import { bytes, duration, resLabel } from '../lib/format.js'

export default function Watch({ canDelete }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const infoMode = sp.get('info') === '1'
  const detailsRef = useRef(null)

  const [m, setM] = useState(null)
  const [err, setErr] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [neighbors, setNeighbors] = useState({ prev: null, next: null })

  // find previous/next titles in the library order (for N/P + next button)
  useEffect(() => {
    api
      .media('', 'added')
      .then((list) => {
        const i = list.findIndex((x) => x.id === id)
        setNeighbors({
          prev: i > 0 ? list[i - 1].id : null,
          next: i >= 0 && i < list.length - 1 ? list[i + 1].id : null,
        })
      })
      .catch(() => setNeighbors({ prev: null, next: null }))
  }, [id])

  useEffect(() => {
    setM(null)
    setErr(false)
    api.get(id).then(setM).catch(() => setErr(true))
  }, [id])

  // arriving via "More Info": don't autoplay, jump to the details
  useEffect(() => {
    if (infoMode && m && detailsRef.current) {
      detailsRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [infoMode, m])

  async function refreshMeta() {
    setRefreshing(true)
    try {
      setM(await api.refreshMeta(id))
    } finally {
      setRefreshing(false)
    }
  }

  async function onSubUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const content = await file.text()
      const lang = (file.name.match(/\.([a-z]{2,3})\.(srt|vtt)$/i)?.[1] || 'en').toLowerCase()
      await api.addSubtitle(id, content, lang)
      setM(await api.get(id))
    } catch (err) {
      alert('Could not add subtitles: ' + err.message)
    }
    e.target.value = ''
  }

  async function remove() {
    if (!confirm('Remove this title from your library?')) return
    const deleteFile = confirm(
      'Also permanently delete the video file from disk?\n\nOK = delete file\nCancel = keep file on disk',
    )
    await api.del(id, deleteFile)
    navigate('/')
  }

  if (err) return <div className="grid h-screen place-items-center bg-black text-slate-400">Not found.</div>
  if (!m) return <div className="grid h-screen place-items-center bg-black text-slate-400">Loading…</div>

  const src = api.streamUrl(id)
  const PLAYABLE_V = ['h264', 'avc1', 'vp8', 'vp9', 'av1']
  const incompatible = m.vcodec && !PLAYABLE_V.includes(m.vcodec.toLowerCase())

  return (
    <div className="bg-ink-950">
      {incompatible ? (
        // codecs the browser can't decode (e.g. HEVC/x265) — offer a download instead
        <div className="relative grid h-[70vh] place-items-center overflow-hidden bg-black">
          <img src={m.backdrop || m.poster || api.thumb(m.id)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-sm" />
          <button onClick={() => navigate('/')} className="btn-ghost absolute left-4 top-20 z-10">← Library</button>
          <div className="relative z-10 max-w-md px-6 text-center">
            <div className="mb-3 text-4xl">🎞️</div>
            <h2 className="text-xl font-bold">Not playable in the browser</h2>
            <p className="mt-2 text-sm text-slate-300">
              “{m.title || m.filename}” is <b>{(m.vcodec || '').toUpperCase()}</b>
              {m.height >= 1400 ? ' 4K' : ''}, which browsers can't decode in-page. Download it to
              watch on your device (VLC, a TV, etc.).
            </p>
            <a href={api.downloadUrl(id)} download className="btn-primary mt-5 inline-flex">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
              </svg>
              Download to watch
            </a>
          </div>
        </div>
      ) : (
        <NetflixPlayer
          src={src}
          poster={m.backdrop || m.poster || api.thumb(m.id)}
          title={m.title || m.filename}
          media={m}
          mediaId={id}
          subtitles={m.subs || []}
          autoPlay={!infoMode}
          onProgressSave={(f, w) => api.setProgress(id, f, w).catch(() => {})}
          onBack={() => navigate('/')}
          onNext={neighbors.next ? () => navigate(`/watch/${neighbors.next}`) : undefined}
          onPrev={neighbors.prev ? () => navigate(`/watch/${neighbors.prev}`) : undefined}
        />
      )}

      {/* details below (scroll down) */}
      <div className="relative" ref={detailsRef}>
        {m.backdrop && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden">
            <img src={m.backdrop} alt="" className="h-full w-full object-cover opacity-20 blur-sm" />
            <div className="absolute inset-0 bg-gradient-to-b from-ink-950/60 to-ink-950" />
          </div>
        )}

        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <img
              src={m.poster || api.thumb(m.id)}
              alt={m.title}
              className="hidden h-64 w-44 shrink-0 rounded-xl object-cover ring-1 ring-white/10 sm:block"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold sm:text-4xl">{m.title || m.filename}</h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
                {m.year && <span>{m.year}</span>}
                {m.rating ? (
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    ★ {m.rating.toFixed(1)}
                    {m.imdb_id && <span className="text-xs font-normal text-slate-500">IMDb</span>}
                  </span>
                ) : null}
                {m.runtime ? <span>{m.runtime}m</span> : m.duration ? <span>{duration(m.duration)}</span> : null}
                {m.height ? <span className="chip">{resLabel(m.height)}</span> : null}
                {m.vcodec ? <span className="chip uppercase">{m.vcodec}</span> : null}
                {m.size ? <span className="chip">{bytes(m.size)}</span> : null}
              </div>

              {m.genres?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.genres.map((g) => (
                    <span key={g} className="chip">{g}</span>
                  ))}
                </div>
              ) : null}

              {m.overview && (
                <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">{m.overview}</p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="btn-primary">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Play
                </button>
                <a href={api.downloadUrl(id)} className="btn-ghost" download>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
                  </svg>
                  Download
                </a>
                {m.imdb_id && (
                  <a href={`https://www.imdb.com/title/${m.imdb_id}`} target="_blank" rel="noreferrer" className="btn-ghost">
                    IMDb ↗
                  </a>
                )}
                <button onClick={refreshMeta} disabled={refreshing} className="btn-ghost">
                  {refreshing ? 'Refreshing…' : 'Refresh metadata'}
                </button>
                <label className="btn-ghost cursor-pointer">
                  {m.subs?.length ? `Subtitles (${m.subs.length})` : 'Add subtitles'}
                  <input type="file" accept=".srt,.vtt" className="hidden" onChange={onSubUpload} />
                </label>
                {canDelete && (
                  <button onClick={remove} className="btn-ghost !text-rose-300 hover:!bg-rose-500/10">
                    Delete
                  </button>
                )}
              </div>

              {m.cast?.length ? (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Cast</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {m.cast.map((c) => (
                      <div key={c.name} className="w-20 shrink-0 text-center">
                        <div className="mb-1 h-20 w-20 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
                          {c.photo ? (
                            <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xl text-slate-600">{c.name?.[0]}</div>
                          )}
                        </div>
                        <div className="truncate text-xs font-medium text-slate-200" title={c.name}>{c.name}</div>
                        <div className="truncate text-[11px] text-slate-500" title={c.character}>{c.character}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
