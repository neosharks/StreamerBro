import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import MobileNav from './components/MobileNav.jsx'
import AuthGate from './components/AuthGate.jsx'
import UsersModal from './components/UsersModal.jsx'
import Library from './pages/Library.jsx'
import Watch from './pages/Watch.jsx'
import DownloadsPage from './pages/DownloadsPage.jsx'
import FilesPage from './pages/FilesPage.jsx'
import { api } from './lib/api.js'

function Splash() {
  return (
    <div className="grid h-screen place-items-center bg-ink-950">
      <div className="animate-pulse text-3xl font-extrabold uppercase tracking-tight text-brand-500">
        Streamer<span className="text-white">Bro</span>
      </div>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState(undefined) // undefined=loading | { needsSetup, user }
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('added')
  const [showUsers, setShowUsers] = useState(false)
  const [downloads, setDownloads] = useState([])
  const [version, setVersion] = useState(null)
  const [scanning, setScanning] = useState(false)
  const isWatch = useLocation().pathname.startsWith('/watch/')

  useEffect(() => {
    api.authState().then(setAuth).catch(() => setAuth({ needsSetup: false, user: null }))
  }, [])

  const user = auth?.user
  const canDownload = !!(user && (user.is_admin || user.can_download))
  const canDelete = !!(user && (user.is_admin || user.can_delete))

  // live downloads stream (only once authed)
  useEffect(() => {
    if (!user) return
    const es = new EventSource('/api/downloads/events')
    es.onmessage = (e) => {
      try {
        setDownloads(JSON.parse(e.data))
      } catch {}
    }
    return () => es.close()
  }, [user])

  useEffect(() => {
    if (user) api.version().then(setVersion).catch(() => {})
  }, [user])

  const activeCount = downloads.filter((d) => d.status === 'active' || d.status === 'queued').length

  const onScan = useCallback(async () => {
    setScanning(true)
    try {
      await api.scan()
    } finally {
      setScanning(false)
    }
    window.dispatchEvent(new Event('library:refresh'))
  }, [])

  const onLogout = async () => {
    await api.logout().catch(() => {})
    setAuth({ needsSetup: false, user: null })
  }

  if (auth === undefined) return <Splash />
  if (!user) return <AuthGate state={auth} onAuthed={(u) => setAuth({ needsSetup: false, user: u })} />

  return (
    <div className="min-h-full bg-ink-950">
      {!isWatch && (
        <Navbar
          query={query}
          setQuery={setQuery}
          sort={sort}
          setSort={setSort}
          user={user}
          activeCount={activeCount}
          canDownload={canDownload}
          onScan={onScan}
          scanning={scanning}
          version={version}
          onUpdate={() => api.update().then((r) => alert(r.message || 'Update started'))}
          onManageUsers={() => setShowUsers(true)}
          onLogout={onLogout}
        />
      )}

      <Routes>
        <Route path="/" element={<Library query={query} sort={sort} />} />
        <Route path="/downloads" element={<DownloadsPage downloads={downloads} canDownload={canDownload} />} />
        <Route path="/files" element={<FilesPage canDelete={canDelete} />} />
        <Route path="/watch/:id" element={<Watch canDelete={canDelete} />} />
      </Routes>

      {!isWatch && <MobileNav activeCount={activeCount} />}
      {showUsers && <UsersModal onClose={() => setShowUsers(false)} />}
    </div>
  )
}
