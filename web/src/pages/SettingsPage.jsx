import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { bytes } from '../lib/format.js'
import { getCaptionSettings, setCaptionSettings } from '../lib/captions.js'

function Bar({ used, total, color = 'bg-brand-500' }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function fmtUptime(s) {
  if (!s) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

function Slider({ label, min, max, step, value, onChange }) {
  return (
    <div>
      <div className="mb-1 text-sm text-slate-300">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-red w-full"
      />
    </div>
  )
}

function Card({ title, desc, children }) {
  return (
    <div className="anim-up rounded-2xl border border-white/10 bg-ink-850/70 p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Action({ label, running, done, onClick, disabled, variant = 'ghost' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || running}
      className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}
    >
      {running ? 'Working…' : done || label}
    </button>
  )
}

export default function SettingsPage({ user }) {
  const admin = user?.is_admin
  const [version, setVersion] = useState(null)
  const [info, setInfo] = useState(null)
  const [stats, setStats] = useState(null)
  const [server, setServer] = useState(null)
  const [caps, setCaps] = useState(getCaptionSettings())
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const loadStats = () => api.stats().then(setStats).catch(() => {})
  useEffect(() => {
    api.version().then(setVersion).catch(() => {})
    api.info().then(setInfo).catch(() => {})
    api.server().then(setServer).catch(() => {})
    loadStats()
  }, [])

  const updateCap = (key, val) => {
    const next = { ...caps, [key]: val }
    setCaps(next)
    setCaptionSettings(next)
  }

  async function run(key, fn, after) {
    setBusy(key)
    setMsg('')
    try {
      const r = await fn()
      setMsg(after ? after(r) : 'Done.')
      loadStats()
      window.dispatchEvent(new Event('library:refresh'))
    } catch (e) {
      setMsg('Error: ' + e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="anim-fade mx-auto max-w-3xl px-4 pb-24 pt-24 sm:px-6 sm:pb-10">
      <h1 className="mb-5 text-2xl font-bold">Settings</h1>

      {msg && (
        <div className="mb-4 rounded-xl border border-white/10 bg-ink-800/70 px-4 py-2.5 text-sm text-slate-200">
          {msg}
        </div>
      )}

      <div className="space-y-4">
        {/* Application / update */}
        <Card title="Application" desc="Version and updates.">
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip">v{version?.current || '—'}</span>
            {version?.updateAvailable ? (
              <>
                <span className="text-sm text-amber-300">New version available: v{version.latest}</span>
                {admin && (
                  <Action
                    label="Update now"
                    variant="primary"
                    running={busy === 'update'}
                    onClick={() =>
                      run('update', api.update, (r) => r.message || 'Update started — the app will restart shortly.')
                    }
                  />
                )}
              </>
            ) : (
              <span className="text-sm text-slate-400">You're on the latest version.</span>
            )}
          </div>
          {!admin && version?.updateAvailable && (
            <p className="mt-2 text-xs text-slate-500">Ask an admin to run the update.</p>
          )}
        </Card>

        {/* Library maintenance */}
        <Card title="Library" desc="Import new files, rebuild thumbnails, and clear junk.">
          {admin ? (
            <div className="flex flex-wrap gap-2">
              <Action
                label="Rescan library"
                running={busy === 'scan'}
                onClick={() => run('scan', api.scan, (r) => `Scan complete — ${r.added ?? 0} new file(s).`)}
              />
              <Action
                label="Fix thumbnails"
                running={busy === 'thumbs'}
                onClick={() =>
                  run('thumbs', () => api.fixThumbnails(false), (r) => `Regenerated ${r.fixed} thumbnail(s).`)
                }
              />
              <Action
                label="Rebuild all thumbnails"
                running={busy === 'thumbs2'}
                onClick={() =>
                  run('thumbs2', () => api.fixThumbnails(true), (r) => `Rebuilt ${r.fixed} thumbnail(s).`)
                }
              />
              <Action
                label="Remove junk files"
                running={busy === 'clean'}
                onClick={() =>
                  run('clean', api.cleanJunk, (r) => `Removed ${r.files} leftover file(s) and ${r.thumbs} orphan thumbnail(s).`)
                }
              />
            </div>
          ) : (
            <p className="text-sm text-slate-400">Library maintenance is available to admins only.</p>
          )}
        </Card>

        {/* Info */}
        <Card title="Storage & metadata">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-400">Titles</dt>
            <dd className="text-right font-medium">{stats?.titles ?? '—'}</dd>
            <dt className="text-slate-400">Total size</dt>
            <dd className="text-right font-medium">{stats ? bytes(stats.totalSize) : '—'}</dd>
            <dt className="text-slate-400">Thumbnails</dt>
            <dd className="text-right font-medium">
              {stats ? `${stats.withThumb} ok · ${stats.missingThumb} missing` : '—'}
            </dd>
            <dt className="text-slate-400">Media folder</dt>
            <dd className="truncate text-right font-mono text-xs" title={info?.mediaDir}>{info?.mediaDir || '—'}</dd>
            <dt className="text-slate-400">TMDB metadata</dt>
            <dd className="text-right font-medium">{info?.tmdb ? 'Configured' : 'Not set'}</dd>
            <dt className="text-slate-400">IMDB (OMDb)</dt>
            <dd className="text-right font-medium">{info?.omdb ? 'Configured' : 'Not set'}</dd>
          </dl>
        </Card>

        {/* Server */}
        <Card title="Server">
          {server ? (
            <div className="space-y-4 text-sm">
              {server.disk && (
                <div>
                  <div className="mb-1 flex justify-between">
                    <span className="text-slate-400">Disk</span>
                    <span>
                      {bytes(server.disk.used)} / {bytes(server.disk.total)} · {bytes(server.disk.free)} free
                    </span>
                  </div>
                  <Bar used={server.disk.used} total={server.disk.total} />
                </div>
              )}
              <div>
                <div className="mb-1 flex justify-between">
                  <span className="text-slate-400">Memory</span>
                  <span>{bytes(server.mem.used)} / {bytes(server.mem.total)}</span>
                </div>
                <Bar used={server.mem.used} total={server.mem.total} color="bg-emerald-500" />
              </div>
              <dl className="grid grid-cols-2 gap-y-1.5">
                <dt className="text-slate-400">CPU</dt>
                <dd className="text-right">{server.cpu.cores} cores · load {server.cpu.load.map((l) => l.toFixed(2)).join('  ')}</dd>
                <dt className="text-slate-400">Uptime</dt>
                <dd className="text-right">{fmtUptime(server.uptime)} · app {fmtUptime(server.appUptime)}</dd>
                <dt className="text-slate-400">Host</dt>
                <dd className="truncate text-right">{server.host}</dd>
                <dt className="text-slate-400">Platform</dt>
                <dd className="text-right">{server.platform}/{server.arch} · Node {server.node}</dd>
              </dl>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading…</p>
          )}
        </Card>

        {/* Captions */}
        <Card title="Captions" desc="Subtitle appearance (saved on this device).">
          <div className="space-y-4">
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={caps.enabled} onChange={(e) => updateCap('enabled', e.target.checked)} />
              Show captions by default when a title has them
            </label>
            <Slider label={`Text size — ${caps.size}%`} min={50} max={200} step={5} value={caps.size} onChange={(v) => updateCap('size', v)} />
            <Slider label={`Position from bottom — ${caps.position}%`} min={2} max={40} step={1} value={caps.position} onChange={(v) => updateCap('position', v)} />
            <Slider label={`Background opacity — ${caps.bg}%`} min={0} max={100} step={5} value={caps.bg} onChange={(v) => updateCap('bg', v)} />
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-400">Text color</span>
              <input type="color" value={caps.color} onChange={(e) => updateCap('color', e.target.value)} className="h-8 w-12 rounded bg-transparent" />
            </div>
            <div className="grid h-20 place-items-center overflow-hidden rounded-xl bg-black">
              <span style={{ fontSize: `calc(${caps.size / 100} * 1.2rem)`, color: caps.color, background: `rgba(0,0,0,${caps.bg / 100})`, padding: '0.1em 0.5em', borderRadius: 6 }}>
                The quick brown fox
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
