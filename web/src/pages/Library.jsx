import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Hero from '../components/Hero.jsx'
import Row from '../components/Row.jsx'
import { api } from '../lib/api.js'
import { resLabel } from '../lib/format.js'
import { Link } from 'react-router-dom'

function buildRows(items) {
  const rows = []
  const cont = items
    .filter((m) => m.progress > 0.01 && m.progress < 0.95)
    .sort((a, b) => (b.added_at || 0) - (a.added_at || 0))
  if (cont.length) rows.push({ key: 'cont', title: 'Continue Watching', items: cont })

  const recent = [...items].sort((a, b) => (b.added_at || 0) - (a.added_at || 0))
  rows.push({ key: 'recent', title: 'Recently Added', items: recent })

  const rated = items.filter((m) => m.rating).sort((a, b) => b.rating - a.rating)
  if (rated.length >= 3) rows.push({ key: 'top', title: 'Top Rated', items: rated })

  const byGenre = {}
  for (const m of items) for (const g of m.genres || []) (byGenre[g] ||= []).push(m)
  Object.entries(byGenre)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([g, arr]) => {
      if (arr.length >= 2) rows.push({ key: 'g:' + g, title: g, items: arr })
    })

  return rows
}

function ResultsGrid({ items, query }) {
  return (
    <div className="mx-auto max-w-[1800px] px-4 pt-24 sm:px-8">
      <h1 className="mb-4 text-lg font-semibold text-slate-200">Results for “{query}”</h1>
      {items.length === 0 ? (
        <p className="text-slate-500">No titles match.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((m) => (
            <Link
              key={m.id}
              to={`/watch/${m.id}`}
              className="group block overflow-hidden rounded-md bg-ink-850 ring-1 ring-white/5 transition hover:ring-white/30"
            >
              <div className="relative aspect-video bg-ink-800">
                <img
                  src={m.backdrop || api.thumb(m.id)}
                  alt={m.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                {m.height ? (
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">
                    {resLabel(m.height)}
                  </span>
                ) : null}
              </div>
              <div className="p-2">
                <div className="truncate text-sm font-medium">{m.title || m.filename}</div>
                <div className="text-xs text-slate-500">{m.year || ''}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Library({ query, sort }) {
  const [items, setItems] = useState(null)
  const pollRef = useRef(null)

  const load = useCallback(() => {
    api
      .media(query, sort)
      .then((data) => {
        setItems(data)
        clearTimeout(pollRef.current)
        if (data.some((m) => m.meta_state === 'pending')) pollRef.current = setTimeout(load, 3500)
      })
      .catch(() => setItems([]))
  }, [query, sort])

  useEffect(() => {
    load()
    return () => clearTimeout(pollRef.current)
  }, [load])

  useEffect(() => {
    const h = () => load()
    window.addEventListener('library:refresh', h)
    return () => window.removeEventListener('library:refresh', h)
  }, [load])

  const rows = useMemo(() => (items ? buildRows(items) : []), [items])
  // rotate the hero through all titles (backdrops first for the nicest look)
  const heroItems = useMemo(() => {
    if (!items?.length) return []
    return [...items.filter((m) => m.backdrop), ...items.filter((m) => !m.backdrop)]
  }, [items])

  if (items === null) {
    return (
      <div className="grid h-screen place-items-center text-slate-500">
        <div className="animate-pulse text-2xl font-bold text-brand-500">Streamer Bro</div>
      </div>
    )
  }

  if (query) return <ResultsGrid items={items} query={query} />

  if (items.length === 0) {
    return (
      <div className="mx-auto grid min-h-screen max-w-lg place-items-center px-6 text-center">
        <div>
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-white" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Your library is empty</h2>
          <p className="mt-2 text-sm text-slate-400">
            Hit <b className="text-slate-200">Add</b> to pull a video from a link or torrent, or drop
            files into your media folder and press <b className="text-slate-200">Scan</b>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="anim-fade min-h-screen pb-24 sm:pb-16">
      <Hero items={heroItems} />
      <div className="relative z-10 mt-2">
        {rows.map((r) => (
          <Row key={r.key} title={r.title} items={r.items} />
        ))}
      </div>
    </div>
  )
}
