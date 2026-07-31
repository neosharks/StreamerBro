import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { resLabel } from '../lib/format.js'

export default function Hero({ m }) {
  if (!m) return null
  const bg = m.backdrop || api.thumb(m.id)

  return (
    <div className="relative -mt-[68px] h-[58vw] max-h-[760px] min-h-[440px] w-full">
      <img
        src={bg}
        alt=""
        className="kenburns absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950 to-transparent" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1800px] flex-col justify-end px-4 pb-[9%] sm:px-8">
        <div className="anim-up max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-tight drop-shadow-xl sm:text-6xl">
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
            <Link
              to={`/watch/${m.id}`}
              className="btn bg-white px-7 py-2.5 text-base font-bold text-black hover:bg-white/85"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </Link>
            <Link
              to={`/watch/${m.id}?info=1`}
              className="btn bg-white/20 px-6 py-2.5 text-base font-semibold text-white backdrop-blur hover:bg-white/30"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
              </svg>
              More Info
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
