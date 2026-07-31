import { useEffect, useRef, useState, useCallback } from 'react'
import { clock } from '../lib/format.js'
import { api } from '../lib/api.js'
import { getCaptionSettings } from '../lib/captions.js'

const I = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
}

function Icon({ d, className = 'h-6 w-6', stroke = false }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={stroke ? 'none' : 'currentColor'} stroke={stroke ? 'currentColor' : 'none'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  )
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export default function NetflixPlayer({ src, poster, title, media, subtitles = [], mediaId, autoPlay = true, onProgressSave, onNeedTranscode, onBack, onNext, onPrev }) {
  const videoRef = useRef(null)
  const wrapRef = useRef(null)
  const hideTimer = useRef(null)
  const saveTimer = useRef(0)

  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [full, setFull] = useState(false)
  const [show, setShow] = useState(true)
  const [seeking, setSeeking] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [subIdx, setSubIdx] = useState(-1)
  const [cueText, setCueText] = useState('')
  const [caps, setCaps] = useState(getCaptionSettings())

  // ---- controls auto-hide ----
  const poke = useCallback(() => {
    setShow(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShow(false)
    }, 3000)
  }, [])

  // ---- playback ----
  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const skip = useCallback((s) => {
    const v = videoRef.current
    if (v) v.currentTime = Math.min(Math.max(0, v.currentTime + s), v.duration || 0)
    poke()
  }, [poke])

  const seekTo = useCallback((frac) => {
    const v = videoRef.current
    if (v && v.duration) v.currentTime = frac * v.duration
  }, [])

  const onLoaded = useCallback(() => {
    const v = videoRef.current
    setDur(v.duration || 0)
    if (media?.progress > 0.01 && media.progress < 0.97) v.currentTime = media.progress * v.duration
  }, [media])

  const onTime = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setCur(v.currentTime)
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
    const now = Date.now()
    if (now - saveTimer.current > 5000 && v.duration) {
      saveTimer.current = now
      const f = v.currentTime / v.duration
      onProgressSave?.(f, f > 0.95)
    }
  }, [onProgressSave])

  const toggleFull = useCallback(() => {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen?.()
    else document.exitFullscreen?.()
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }, [])

  const changeVol = (val) => {
    const v = videoRef.current
    if (!v) return
    v.volume = val
    v.muted = val === 0
    setVol(val)
    setMuted(val === 0)
  }

  const applyRate = (r) => {
    if (videoRef.current) videoRef.current.playbackRate = r
    setRate(r)
  }
  const cycleRate = () => applyRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])
  const speedStep = (dir) => applyRate(RATES[Math.max(0, Math.min(RATES.length - 1, RATES.indexOf(rate) + dir))])

  const cycleSub = () => setSubIdx((i) => (i + 1 >= subtitles.length ? -1 : i + 1))

  // ---- events wiring ----
  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // caption preferences (live-updated from Settings)
  useEffect(() => {
    const h = () => setCaps(getCaptionSettings())
    window.addEventListener('captions:changed', h)
    return () => window.removeEventListener('captions:changed', h)
  }, [])

  // turn captions on by default when a title has them
  useEffect(() => {
    setSubIdx(subtitles.length && getCaptionSettings().enabled ? 0 : -1)
  }, [mediaId, subtitles.length])

  // render the active cue into our own styled overlay (native rendering hidden)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const tt = v.textTracks
    for (let i = 0; i < tt.length; i++) tt[i].mode = 'hidden'
    if (subIdx < 0) {
      setCueText('')
      return
    }
    const track = tt[0]
    if (!track) return
    track.mode = 'hidden'
    const onCue = () => {
      const c = track.activeCues && track.activeCues[0]
      setCueText(c ? c.text.replace(/<[^>]+>/g, '') : '')
    }
    track.addEventListener('cuechange', onCue)
    onCue()
    return () => track.removeEventListener('cuechange', onCue)
  }, [subIdx, src])

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      switch (e.key) {
        case ' ':
        case 'Enter':
        case 'k':
          e.preventDefault(); togglePlay(); break
        case 'ArrowLeft':
        case 'j': skip(-10); break
        case 'ArrowRight':
        case 'l': skip(10); break
        case 'f': toggleFull(); break
        case 'm': toggleMute(); break
        case 'ArrowUp': changeVol(Math.min(1, vol + 0.1)); break
        case 'ArrowDown': changeVol(Math.max(0, vol - 0.1)); break
        case 'c':
        case 'C': setSubIdx((i) => (i >= 0 ? -1 : subtitles.length ? 0 : -1)); break
        case 'n':
        case 'N': onNext?.(); break
        case 'p':
        case 'P': onPrev?.(); break
        case 'Home': seekTo(0); break
        case 'End': seekTo(0.999); break
        case ',':
        case '<': speedStep(-1); break
        case '.':
        case '>': speedStep(1); break
        case '?': setShowHelp((h) => !h); break
        case 'Escape': setShowHelp(false); break
        default:
          if (/^[0-9]$/.test(e.key)) { seekTo(Number(e.key) / 10); break }
          return
      }
      poke()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, skip, toggleFull, toggleMute, seekTo, vol, rate, poke, onNext, onPrev, subtitles.length])

  const pct = dur ? (cur / dur) * 100 : 0
  const bufPct = dur ? (buffered / dur) * 100 : 0

  const barRef = useRef(null)
  const handleBar = (clientX) => {
    const el = barRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    seekTo(Math.min(1, Math.max(0, (clientX - r.left) / r.width)))
  }

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden bg-black ${full ? 'h-screen' : 'h-[100dvh]'} ${
        show ? '' : 'cursor-none'
      }`}
      onMouseMove={poke}
      onTouchStart={poke}
      onMouseLeave={() => videoRef.current && !videoRef.current.paused && setShow(false)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        onClick={togglePlay}
        onPlay={() => { setPlaying(true); poke() }}
        onPause={() => { setPlaying(false); setShow(true) }}
        onLoadedMetadata={onLoaded}
        onTimeUpdate={onTime}
        onEnded={() => onProgressSave?.(1, true)}
        onError={onNeedTranscode}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      >
        {subIdx >= 0 && subtitles[subIdx] && (
          <track
            key={`${mediaId}-${subIdx}`}
            kind="subtitles"
            src={api.subsUrl(mediaId, subIdx)}
            srcLang={subtitles[subIdx].lang}
            default
          />
        )}
      </video>

      {/* captions overlay (our own styling from Settings) */}
      {subIdx >= 0 && cueText && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-6 text-center"
          style={{ bottom: show ? `calc(${caps.position}% + 76px)` : `${caps.position}%`, transition: 'bottom .2s' }}
        >
          <span
            style={{
              fontSize: `calc(${caps.size / 100} * 1.7rem)`,
              color: caps.color,
              background: `rgba(0,0,0,${caps.bg / 100})`,
              padding: '0.1em 0.5em',
              borderRadius: 6,
              lineHeight: 1.35,
              maxWidth: '85%',
              whiteSpace: 'pre-line',
              textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            }}
          >
            {cueText}
          </span>
        </div>
      )}

      {/* top gradient + title + back */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 sm:p-6 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-4">
          <button onClick={onBack} className="text-white/90 hover:text-white" title="Back (library)">
            <Icon d="M15 18l-6-6 6-6" className="h-8 w-8" stroke />
          </button>
          <div className="truncate text-lg font-semibold text-white drop-shadow sm:text-xl">{title}</div>
        </div>
      </div>

      {/* center play when paused */}
      {!playing && show && (
        <button
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-10 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:scale-105 hover:bg-black/70"
        >
          <Icon d={I.play} className="h-10 w-10 translate-x-0.5" />
        </button>
      )}

      {/* bottom control bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-4 pt-16 transition-opacity duration-300 sm:px-8 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* seek bar */}
        <div className="mb-3 flex items-center gap-3">
          <div
            ref={barRef}
            onMouseDown={(e) => { setSeeking(true); handleBar(e.clientX) }}
            onMouseMove={(e) => seeking && handleBar(e.clientX)}
            onMouseUp={() => setSeeking(false)}
            onMouseLeave={() => setSeeking(false)}
            className="group relative h-4 flex-1 cursor-pointer"
          >
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/25 transition-all group-hover:h-1.5">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500 opacity-0 shadow transition group-hover:opacity-100"
              style={{ left: `${pct}%` }}
            />
          </div>
          <span className="w-24 text-right text-xs tabular-nums text-white/80">
            {clock(cur)} / {clock(dur)}
          </span>
        </div>

        {/* buttons */}
        <div className="flex items-center gap-5 text-white">
          {onPrev && (
            <button onClick={onPrev} title="Previous (p)" className="hover:text-white/80">
              <Icon d={['M6 6v12', 'M20 6l-10 6 10 6z']} className="h-6 w-6" stroke />
            </button>
          )}
          <button onClick={togglePlay} title="Play / Pause (space)" className="hover:text-white/80">
            <Icon d={playing ? I.pause : I.play} className="h-8 w-8" />
          </button>
          <button onClick={() => skip(-10)} title="Back 10s (j / ←)" className="relative hover:text-white/80">
            <Icon d="M11 8a5 5 0 1 1-5 5" className="h-7 w-7" stroke />
            <span className="absolute inset-0 grid place-items-center text-[9px] font-bold">10</span>
          </button>
          <button onClick={() => skip(10)} title="Forward 10s (l / →)" className="relative hover:text-white/80">
            <Icon d="M13 8a5 5 0 1 0 5 5" className="h-7 w-7" stroke />
            <span className="absolute inset-0 grid place-items-center text-[9px] font-bold">10</span>
          </button>
          {onNext && (
            <button onClick={onNext} title="Next (n)" className="hover:text-white/80">
              <Icon d={['M18 6v12', 'M4 6l10 6-10 6z']} className="h-6 w-6" stroke />
            </button>
          )}

          <div className="group flex items-center gap-2">
            <button onClick={toggleMute} title="Mute (m)" className="hover:text-white/80">
              {muted || vol === 0 ? (
                <Icon d={['M11 5 6 9H3v6h3l5 4z', 'M16 9l5 5m0-5l-5 5']} className="h-7 w-7" stroke />
              ) : (
                <Icon d={['M11 5 6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 6a9 9 0 0 1 0 12']} className="h-7 w-7" stroke />
              )}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={muted ? 0 : vol}
              onChange={(e) => changeVol(Number(e.target.value))}
              className="range-red w-0 opacity-0 transition-all duration-200 group-hover:w-24 group-hover:opacity-100"
            />
          </div>

          <div className="ml-auto flex items-center gap-5">
            {subtitles.length > 0 && (
              <button
                onClick={cycleSub}
                title={`Subtitles (c)${subIdx >= 0 ? ` — ${subtitles[subIdx].lang}` : ' — off'}`}
                className={`rounded border px-1.5 py-0.5 text-xs font-bold transition ${subIdx >= 0 ? 'border-white bg-white/20 text-white' : 'border-white/40 text-white/70'} hover:bg-white/10`}
              >
                CC
              </button>
            )}
            <button onClick={cycleRate} title="Playback speed ( < / > )" className="text-sm font-bold hover:text-white/80">
              {rate}×
            </button>
            <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)" className="grid h-7 w-7 place-items-center rounded border border-white/40 text-sm font-bold hover:bg-white/10">
              ?
            </button>
            <button onClick={toggleFull} title="Fullscreen (f)" className="hover:text-white/80">
              {full ? (
                <Icon d={['M9 4H4v5', 'M20 9V4h-5', 'M15 20h5v-5', 'M4 15v5h5']} className="h-6 w-6" stroke />
              ) : (
                <Icon d={['M4 9V4h5', 'M20 9V4h-5', 'M15 20h5v-5', 'M9 20H4v-5']} className="h-6 w-6" stroke />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* keyboard shortcuts overlay */}
      {showHelp && (
        <div className="anim-fade absolute inset-0 z-20 grid place-items-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="anim-scale w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Keyboard shortcuts</h3>
              <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {[
                ['Space / Enter / K', 'Play / Pause'],
                ['← / J', 'Back 10 seconds'],
                ['→ / L', 'Forward 10 seconds'],
                ['0 – 9', 'Jump to 0% – 90%'],
                ['Home / End', 'Go to start / end'],
                ['↑ / ↓', 'Volume up / down'],
                ['M', 'Mute'],
                ['C', 'Captions on / off'],
                ['< / >', 'Slower / Faster'],
                ['N / P', 'Next / Previous video'],
                ['F', 'Fullscreen'],
                ['?', 'Toggle this help'],
              ].map(([k, d]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <kbd className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-white">{k}</kbd>
                  <span className="text-slate-300">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
