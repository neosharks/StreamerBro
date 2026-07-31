import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { resLabel } from '../lib/format.js'

const PH =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23151925'/%3E%3Cpath d='M148 78v24l20-12z' fill='%23e50914'/%3E%3C/svg%3E"

function Card({ m }) {
  const img = m.backdrop || api.thumb(m.id)
  const progress = m.progress > 0.01 && m.progress < 0.98 ? m.progress : 0
  const meta = [m.year, m.rating ? `★ ${m.rating.toFixed(1)}` : null, resLabel(m.height)]
    .filter(Boolean)
    .join('  ·  ')

  return (
    <Link
      to={`/watch/${m.id}`}
      className="group/card relative block w-[220px] shrink-0 sm:w-[260px]"
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-ink-800 ring-1 ring-white/5 transition duration-200 will-change-transform group-hover/card:scale-[1.08] group-hover/card:ring-white/40">
        <img
          src={img}
          alt={m.title}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget
            if (m.poster && !el.dataset.fb) {
              el.dataset.fb = '1'
              el.src = m.poster
            } else if (!el.dataset.ph) {
              el.dataset.ph = '1'
              el.src = PH
            }
          }}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 transition group-hover/card:opacity-100" />

        <div className="absolute inset-x-0 bottom-0 translate-y-1 p-2.5 opacity-0 transition group-hover/card:translate-y-0 group-hover/card:opacity-100">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-black">
              <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-px" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{m.title || m.filename}</div>
              <div className="truncate text-[11px] text-slate-300">{meta}</div>
            </div>
          </div>
        </div>

        {progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <div className="h-full bg-brand-500" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
    </Link>
  )
}

export default function Row({ title, items }) {
  const ref = useRef(null)
  if (!items?.length) return null
  const scroll = (dir) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: 'smooth' })

  return (
    <section className="group/row relative mb-6">
      <h2 className="mb-2 px-4 text-lg font-bold text-slate-200 sm:px-8">{title}</h2>
      <div className="relative">
        <button
          onClick={() => scroll(-1)}
          className="absolute left-0 top-0 z-20 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-ink-950/90 to-transparent text-3xl text-white opacity-0 transition group-hover/row:opacity-100 md:flex"
          aria-label="Scroll left"
        >
          ‹
        </button>
        <div
          ref={ref}
          className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-6 sm:px-8"
        >
          {items.map((m) => (
            <Card key={m.id} m={m} />
          ))}
        </div>
        <button
          onClick={() => scroll(1)}
          className="absolute right-0 top-0 z-20 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-ink-950/90 to-transparent text-3xl text-white opacity-0 transition group-hover/row:opacity-100 md:flex"
          aria-label="Scroll right"
        >
          ›
        </button>
      </div>
    </section>
  )
}
