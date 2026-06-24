import { getSupabase } from './supabaseClient.js'

export const TIMELAPSE_BUCKET = 'videos'
export const TIMELAPSE_OBJECT_PATH = '1/SSSE1.mp4'

export function getTimelapseVideoUrl() {
  const supabase = getSupabase()
  const { data } = supabase.storage.from(TIMELAPSE_BUCKET).getPublicUrl(TIMELAPSE_OBJECT_PATH)
  return data?.publicUrl ?? null
}
