import { useEffect, useState, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'

function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center">
      <span className="text-2xl font-extrabold uppercase tracking-tight text-brand-500 drop-shadow">
        Streamer<span className="text-white">Bro</span>
      </span>
    </Link>
  )
}

const navClass = ({ isActive }) =>
  `hidden text-sm font-medium transition sm:inline ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`

export default function Navbar({
  query,
  setQuery,
  sort,
  setSort,
  user,
  activeCount,
  version,
  onManageUsers,
  onLogout,
}) {
  const [solid, setSolid] = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    const onDoc = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-colors duration-300 ${
        solid ? 'bg-ink-950/95 shadow-lg backdrop-blur-xl' : 'bg-gradient-to-b from-black/80 to-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-[1800px] items-center gap-4 px-4 py-3 sm:px-8">
        <Logo />

        <nav className="hidden items-center gap-4 sm:flex">
          <NavLink to="/" className={navClass} end>
            Home
          </NavLink>
          <NavLink to="/files" className={navClass}>
            File Manager
          </NavLink>
          <NavLink to="/conversions" className={navClass}>
            Conversions
          </NavLink>
        </nav>

        <div className="relative ml-auto block w-full max-w-xs flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search titles…" className="input pl-10" />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto hidden rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 md:ml-0 lg:block"
        >
          <option value="added">Recently added</option>
          <option value="title">Title A–Z</option>
          <option value="year">Year</option>
          <option value="rating">Rating</option>
          <option value="size">Size</option>
        </select>

        <div className="flex items-center gap-2">
          {version?.updateAvailable && (
            <NavLink to="/settings" className="btn-ghost !border-amber-400/30 !bg-amber-400/10 text-amber-300" title={`Update to v${version.latest}`}>
              Update ↑
            </NavLink>
          )}

          <NavLink to="/downloads" className="btn-ghost relative hidden sm:inline-flex" title="Downloads">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
            </svg>
            {activeCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </NavLink>

          {/* profile menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu((v) => !v)} className="grid h-9 w-9 place-items-center rounded-md font-bold text-white ring-1 ring-white/10 transition hover:ring-white/40" style={{ background: user?.color || '#e50914' }}>
              {user?.username?.[0]?.toUpperCase()}
            </button>
            {menu && (
              <div className="anim-scale absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-ink-850 py-1 shadow-2xl">
                <div className="border-b border-white/5 px-4 py-2">
                  <div className="text-sm font-semibold">{user?.username}</div>
                  <div className="text-xs text-slate-500">{user?.is_admin ? 'Admin' : 'Profile'}</div>
                </div>
                <Link to="/settings" onClick={() => setMenu(false)} className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5">
                  Settings
                </Link>
                {user?.is_admin && (
                  <button onClick={() => { setMenu(false); onManageUsers() }} className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5">
                    Manage profiles
                  </button>
                )}
                <button onClick={() => { setMenu(false); onLogout() }} className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-white/5">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
