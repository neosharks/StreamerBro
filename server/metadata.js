import { config } from './config.js'

const TMDB = 'https://api.themoviedb.org/3'
const IMG = 'https://image.tmdb.org/t/p'

async function getJson(url) {
  const r = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) throw new Error('http ' + r.status)
  return r.json()
}

/**
 * Look up rich metadata for a title from TMDB (posters, plot, cast, genres,
 * IMDB id) and, if an OMDb key is set, the authoritative IMDB rating.
 * Returns null when no TMDB key is configured (app still works, just sparse).
 */
export async function fetchMeta({ title, year, type = 'movie' }) {
  if (!config.tmdbKey || !title) return null
  try {
    const kind = type === 'tv' ? 'tv' : 'movie'
    const search = await getJson(
      `${TMDB}/search/${kind}?api_key=${config.tmdbKey}` +
        `&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ''}`,
    )
    const hit = search?.results?.[0]
    if (!hit) return { meta_state: 'none' }

    const d = await getJson(
      `${TMDB}/${kind}/${hit.id}?api_key=${config.tmdbKey}` +
        `&append_to_response=credits,external_ids`,
    )

    let rating = d?.vote_average ? Math.round(d.vote_average * 10) / 10 : null
    const imdb_id = d?.external_ids?.imdb_id || d?.imdb_id || null

    if (config.omdbKey && imdb_id) {
      try {
        const o = await getJson(`https://www.omdbapi.com/?apikey=${config.omdbKey}&i=${imdb_id}`)
        if (o?.imdbRating && o.imdbRating !== 'N/A') rating = Number(o.imdbRating)
      } catch {}
    }

    const dateStr = d.release_date || d.first_air_date || ''
    return {
      meta_state: 'done',
      title: d.title || d.name || title,
      year: dateStr ? Number(dateStr.slice(0, 4)) : year,
      poster: d.poster_path ? `${IMG}/w500${d.poster_path}` : null,
      backdrop: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : null,
      overview: d.overview || null,
      rating,
      imdb_id,
      tmdb_id: d.id,
      runtime: d.runtime || d.episode_run_time?.[0] || null,
      genres: (d.genres || []).map((g) => g.name),
      cast: (d.credits?.cast || []).slice(0, 12).map((c) => ({
        name: c.name,
        character: c.character,
        photo: c.profile_path ? `${IMG}/w185${c.profile_path}` : null,
      })),
    }
  } catch {
    return { meta_state: 'error' }
  }
}
