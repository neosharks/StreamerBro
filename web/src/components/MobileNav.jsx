import { NavLink } from 'react-router-dom'

const item = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
    isActive ? 'text-white' : 'text-slate-500'
  }`

export default function MobileNav({ activeCount }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-ink-950/95 backdrop-blur-xl sm:hidden">
      <NavLink to="/" end className={item}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11l9-8 9 8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Home
      </NavLink>
      <NavLink to="/files" className={item}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
        Files
      </NavLink>
      <NavLink to="/downloads" className={item}>
        <span className="relative">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
          </svg>
          {activeCount > 0 && (
            <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </span>
        Downloads
      </NavLink>
    </nav>
  )
}
