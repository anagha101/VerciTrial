import { getSupabase } from './supabaseClient.js'

/**
 * @typedef {{
 *   title: string
 *   subtitle: string
 *   description: string
 *   time: string
 * }} EpisodeInfo
 */

/**
 * Reads `episode_number` from `current_episode` and loads the matching
 * `episode_info` row by `id`.
 * @returns {Promise<EpisodeInfo>}
 */
export async function fetchActiveEpisodeInfo() {
  const supabase = getSupabase()

  const { data: current, error: currentError } = await supabase
    .from('current_episode')
    .select('episode_number')
    .limit(1)
    .maybeSingle()

  if (currentError) throw currentError
  if (current?.episode_number == null) {
    throw new Error('No current episode is configured yet.')
  }

  const episodeId = Number(current.episode_number)
  if (!Number.isFinite(episodeId)) {
    throw new Error('Current episode number is invalid.')
  }

  const { data: episode, error: episodeError } = await supabase
    .from('episode_info')
    .select('title, subtitle, description, time')
    .eq('id', episodeId)
    .maybeSingle()

  if (episodeError) throw episodeError
  if (!episode) {
    throw new Error(`No episode info found for id ${episodeId}.`)
  }

  return {
    title: episode.title ?? '',
    subtitle: episode.subtitle ?? '',
    description: episode.description ?? '',
    time: episode.time ?? '',
  }
}

/** @param {unknown} error */
export function describeEpisodeLoadError(error) {
  const code = /** @type {{ code?: string, message?: string }} */ (error)?.code
  const msg = String(/** @type {{ message?: string }} */ (error)?.message ?? error ?? '')

  if (code === '42501' || /permission denied/i.test(msg)) {
    return 'Cannot read episode tables. In Supabase, allow anon SELECT on current_episode and episode_info (see supabase/episode_info.sql).'
  }
  if (code === 'PGRST116' || /0 rows/i.test(msg)) {
    return 'Episode data is missing. Add a row to current_episode and a matching episode_info row.'
  }
  return msg || 'Could not load episode details.'
}

/** @returns {Promise<number>} */
export async function fetchCurrentEpisodeNumber() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('current_episode')
    .select('episode_number')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const n = Number(data?.episode_number)
  if (!Number.isFinite(n)) throw new Error('No current episode is configured yet.')
  return n
}
