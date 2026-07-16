import { getSupabase } from './supabaseClient.js'

export const EPISODE_PHOTO_BUCKET = 'photos'
export const EPISODE_PHOTO_FILENAME = 'flyer.png'

/** @param {number} episodeNumber */
export function getEpisodePhotoUrl(episodeNumber) {
  const supabase = getSupabase()
  const path = `${episodeNumber}/${EPISODE_PHOTO_FILENAME}`
  const { data } = supabase.storage.from(EPISODE_PHOTO_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}
