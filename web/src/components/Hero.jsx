import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { resLabel } from '../lib/format.js'

export default function Hero({ items }) {
  const list = useMemo(() => (items || []).slice(0, 15), [items])
  const [idx, setIdx] = useState(0)

  // auto-rotate through all titles every 10 seconds
  useEffect(() => {
    setIdx(0)
    if (list.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 10000)
    return () => clearInterval(t)
  }, [list])

  const m = list[idx % list.length]
  if (!m) return null
  const bg = m.backdrop || api.thumb(m.id)

  return (
    <div className="relative -mt-[68px] h-[58vw] max-h-[760px] min-h-[440px] w-full">
      {/* keyed so each title cross-fades in */}
      <div key={m.id} className="anim-fade absolute inset-0">
        <img
          src={bg}
          alt=""
          className="kenburns absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1800px] flex-col justify-end px-4 pb-[9%] sm:px-8">
        <div key={m.id} className="anim-up max-w-2xl">
          <h1 className="line-clamp-2 break-words text-3xl font-extrabold leading-tight drop-shadow-xl sm:text-5xl">
            {m.title || m.filename}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-slate-200">
            {m.rating ? <span className="font-bold text-emerald-400">★ {m.rating.toFixed(1)}</span> : null}
            {m.year && <span>{m.year}</span>}
            {m.height ? <span className="chip">{resLabel(m.height)}</span> : null}
            {m.genres?.length ? <span className="text-slate-300">{m.genres.slice(0, 3).join(' · ')}</span> : null}
          </div>
          {m.overview && (
            <p className="mt-3 line-clamp-3 max-w-xl text-sm text-slate-300 drop-shadow sm:text-base">
              {m.overview}
            </p>
          )}
          <div className="mt-5 flex gap-3">
            <Link to={`/watch/${m.id}`} className="btn bg-white px-7 py-2.5 text-base font-bold text-black hover:bg-white/85">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </Link>
            <Link to={`/watch/${m.id}?info=1`} className="btn bg-white/20 px-6 py-2.5 text-base font-semibold text-white backdrop-blur hover:bg-white/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
              </svg>
              More Info
            </Link>
          </div>
        </div>
      </div>

      {/* rotation indicators */}
      {list.length > 1 && (
        <div className="absolute bottom-5 right-4 z-10 hidden gap-1.5 sm:flex sm:right-8">
          {list.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setIdx(i)}
              aria-label={`Show ${it.title || 'title'}`}
              className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
