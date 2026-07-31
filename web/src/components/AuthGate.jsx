import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const Word = () => (
  <div className="text-3xl font-extrabold uppercase tracking-tight text-brand-500">
    Streamer<span className="text-white">Bro</span>
  </div>
)

function Shell({ title, subtitle, children }) {
  return (
    <div className="relative grid min-h-screen place-items-center bg-ink-950 px-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-600/10 via-transparent to-black" />
      <div className="anim-up relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Word />
        </div>
        <div className="anim-scale rounded-2xl border border-white/10 bg-black/60 p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mb-5 mt-1 text-sm text-slate-400">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

function Setup({ onDone }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await api.setup(u.trim(), p)
      onDone(r.user)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell title="Create the admin account" subtitle="First run — set an admin username and password. No email required.">
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input className="input" placeholder="Admin username" value={u} onChange={(e) => setU(e.target.value)} autoFocus />
        <input className="input" type="password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <button disabled={busy || !u || !p} className="btn-primary w-full">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </Shell>
  )
}

function Avatar({ name, color, onClick }) {
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-2 transition">
      <div
        className="grid h-24 w-24 place-items-center rounded-lg text-4xl font-bold text-white ring-4 ring-transparent transition group-hover:ring-white"
        style={{ background: color || '#e50914' }}
      >
        {name?.[0]?.toUpperCase()}
      </div>
      <span className="text-slate-400 transition group-hover:text-white">{name}</span>
    </button>
  )
}

function Login({ onDone }) {
  const [profiles, setProfiles] = useState([])
  const [sel, setSel] = useState(null)
  const [p, setP] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.profiles().then(setProfiles).catch(() => setProfiles([]))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await api.login(sel, p)
      onDone(r.user)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!sel) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-6">
        <div className="anim-up text-center">
          <div className="mb-10">
            <Word />
          </div>
          <h1 className="mb-10 text-4xl font-semibold text-slate-200">Who's watching?</h1>
          <div className="flex flex-wrap justify-center gap-8">
            {profiles.map((pr) => (
              <Avatar key={pr.username} name={pr.username} color={pr.color} onClick={() => { setSel(pr.username); setErr('') }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const cur = profiles.find((x) => x.username === sel)
  return (
    <Shell title="">
      <div className="-mt-2 mb-4 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-md text-lg font-bold text-white" style={{ background: cur?.color || '#e50914' }}>
          {sel[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{sel}</div>
          <button className="text-xs text-slate-400 hover:text-white" onClick={() => { setSel(null); setP('') }}>
            ← switch profile
          </button>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} autoFocus />
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <button disabled={busy || !p} className="btn-primary w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </Shell>
  )
}

export default function AuthGate({ state, onAuthed }) {
  if (state.needsSetup) return <Setup onDone={onAuthed} />
  return <Login onDone={onAuthed} />
}
