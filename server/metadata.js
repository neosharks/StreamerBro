import { config } from './config.js'

const TMDB = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'
const YTS = 'https://yts.mx/api/v2'
const CINEMETA = 'https://v3-cinemeta.strem.io' // keyless, IMDB-based (Stremio)

async function getJson(url) {
  const r = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(9000),
  })
  if (!r.ok) throw new Error('http ' + r.status)
  return r.json()
}

// ---- Cinemeta: IMDB data with NO key (title, year, IMDB rating, plot, genres, cast) ----
async function fetchCinemeta(title, year, type) {
  const kind = type === 'tv' ? 'series' : 'movie'
  const search = await getJson(
    `${CINEMETA}/catalog/${kind}/top/search=${encodeURIComponent(title)}.json`,
  )
  const metas = search?.metas || []
  if (!metas.length) return null
  let pick = metas[0]
  if (year) {
    const y = metas.find((m) => String(m.releaseInfo || '').startsWith(String(year)))
    if (y) pick = y
  }
  const imdbId = pick.imdb_id || pick.id
  const det = await getJson(`${CINEMETA}/meta/${kind}/${imdbId}.json`)
  const m = det?.meta
  if (!m) return null
  return {
    meta_state: 'done',
    source: 'imdb',
    title: m.name || title,
    year: Number(String(m.year || m.releaseInfo || year || '').slice(0, 4)) || year || null,
    poster: m.poster || null,
    backdrop: m.background || null,
    overview: m.description || null,
    rating: m.imdbRating ? Number(m.imdbRating) : null, // IMDB rating
    imdb_id: m.imdb_id || m.id || imdbId,
    tmdb_id: null,
    runtime: m.runtime ? parseInt(m.runtime, 10) : null,
    genres: m.genres || [],
    cast: (m.cast || []).slice(0, 12).map((n) => ({ name: n, character: '', photo: null })),
  }
}

// ---- TMDB: richest images + cast photos (needs a free key) ----
async function fetchTmdb({ title, year, type }) {
  const kind = type === 'tv' ? 'tv' : 'movie'
  const search = await getJson(
    `${TMDB}/search/${kind}?api_key=${config.tmdbKey}` +
      `&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`,
  )
  const hit = search?.results?.[0]
  if (!hit) return null
  const d = await getJson(
    `${TMDB}/${kind}/${hit.id}?api_key=${config.tmdbKey}&append_to_response=credits,external_ids`,
  )
  const dateStr = d.release_date || d.first_air_date || ''
  return {
    meta_state: 'done',
    source: 'tmdb',
    title: d.title || d.name || title,
    year: dateStr ? Number(dateStr.slice(0, 4)) : year,
    poster: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
    backdrop: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
    overview: d.overview || null,
    rating: d?.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    imdb_id: d?.external_ids?.imdb_id || d?.imdb_id || null,
    tmdb_id: d.id,
    runtime: d.runtime || d.episode_run_time?.[0] || null,
    genres: (d.genres || []).map((g) => g.name),
    cast: (d.credits?.cast || []).slice(0, 12).map((c) => ({
      name: c.name,
      character: c.character,
      photo: c.profile_path ? `${IMG}/w185${c.profile_path}` : null,
    })),
  }
}

// ---- YTS: keyless movie fallback ----
async function fetchYts(title, year) {
  const list = await getJson(`${YTS}/list_movies.json?limit=1&query_term=${encodeURIComponent(title)}`)
  const hit = list?.data?.movies?.[0]
  if (!hit) return null
  return {
    meta_state: 'done',
    source: 'yts',
    title: hit.title || title,
    year: hit.year || year || null,
    poster: hit.large_cover_image || hit.medium_cover_image || null,
    backdrop: hit.background_image_original || null,
    overview: hit.summary || null,
    rating: hit.rating || null,
    imdb_id: hit.imdb_code || null,
    tmdb_id: null,
    runtime: hit.runtime || null,
    genres: hit.genres || [],
    cast: [],
  }
}

/**
 * IMDB-first metadata. Cinemeta (keyless, IMDB) is the primary source; TMDB (if a
 * key is set) enriches with higher-res artwork + cast photos; OMDb (if a key is
 * set) supplies the authoritative IMDB rating; YTS is a last keyless movie fallback.
 */
export async function fetchMeta({ title, year, type = 'movie' }) {
  if (!title) return null
  let base = null

  try {
    base = await fetchCinemeta(title, year, type)
  } catch {}

  if (config.tmdbKey) {
    try {
      const t = await fetchTmdb({ title, year, type })
      if (t && !base) base = t
      else if (t && base) {
        // keep IMDB rating/plot/id; borrow TMDB's better artwork + cast photos
        base.poster = t.poster || base.poster
        base.backdrop = t.backdrop || base.backdrop
        base.tmdb_id = t.tmdb_id
        if (t.cast?.length) base.cast = t.cast
        if (!base.overview) base.overview = t.overview
        if (base.rating == null) base.rating = t.rating
        if (!base.runtime) base.runtime = t.runtime
      }
    } catch {}
  }

  if (!base && config.ytsEnabled && type !== 'tv') {
    try {
      base = await fetchYts(title, year)
    } catch {}
  }

  if (base && config.omdbKey && base.imdb_id) {
    try {
      const o = await getJson(`https://www.omdbapi.com/?apikey=${config.omdbKey}&i=${base.imdb_id}`)
      if (o?.imdbRating && o.imdbRating !== 'N/A') base.rating = Number(o.imdbRating)
    } catch {}
  }

  return base || { meta_state: 'none' }
}
