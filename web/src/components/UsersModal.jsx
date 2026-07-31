import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 text-sm">
      <span className={`relative h-5 w-9 rounded-full transition ${on ? 'bg-brand-600' : 'bg-ink-600'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-4' : 'left-0.5'}`} />
      </span>
      <span className="text-slate-300">{label}</span>
    </button>
  )
}

export default function UsersModal({ onClose }) {
  const [users, setUsers] = useState([])
  const [nu, setNu] = useState('')
  const [np, setNp] = useState('')
  const [ncd, setNcd] = useState(true)
  const [ndel, setNdel] = useState(false)
  const [err, setErr] = useState('')

  const load = () => api.users().then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.createUser({ username: nu.trim(), password: np, can_download: ncd, can_delete: ndel })
      setNu(''); setNp(''); setNcd(true); setNdel(false)
      load()
    } catch (e) {
      setErr(e.message)
    }
  }
  const patch = async (u, p) => { await api.updateUser(u.id, p); load() }
  const del = async (u) => { if (confirm(`Delete profile “${u.username}”?`)) { await api.deleteUser(u.id); load() } }

  return (
    <div className="anim-fade fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="anim-scale max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Manage profiles</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white">✕</button>
        </div>

        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-ink-800/60 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-md font-bold text-white" style={{ background: u.color }}>
                {u.username[0]?.toUpperCase()}
              </div>
              <div className="min-w-[120px] flex-1">
                <div className="font-semibold">
                  {u.username} {u.is_admin && <span className="chip ml-1">admin</span>}
                </div>
              </div>
              {u.is_admin ? (
                <span className="text-xs text-slate-500">full access</span>
              ) : (
                <>
                  <Toggle on={u.can_download} onChange={(v) => patch(u, { can_download: v })} label="Download" />
                  <Toggle on={u.can_delete} onChange={(v) => patch(u, { can_delete: v })} label="Delete" />
                  <button onClick={() => del(u)} className="rounded-lg p-1 text-slate-500 hover:text-rose-400" title="Delete profile">✕</button>
                </>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={add} className="mt-6 rounded-xl border border-white/5 bg-ink-800/40 p-4">
          <h3 className="mb-3 font-semibold">Add a profile</h3>
          <div className="flex flex-wrap gap-2">
            <input className="input min-w-[140px] flex-1" placeholder="Username" value={nu} onChange={(e) => setNu(e.target.value)} />
            <input className="input min-w-[140px] flex-1" type="password" placeholder="Password" value={np} onChange={(e) => setNp(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <Toggle on={ncd} onChange={setNcd} label="Can download" />
            <Toggle on={ndel} onChange={setNdel} label="Can delete" />
            <button disabled={!nu || !np} className="btn-primary ml-auto">Add profile</button>
          </div>
          {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
        </form>
      </div>
    </div>
  )
}
