import { getSupabase } from './supabaseClient.js'

export const RSVP_IMAGE_BUCKET = 'rsvp-images'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** @param {File} file */
export function validateRsvpImageFile(file) {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Please use a JPEG, PNG, WebP, or GIF image.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Image must be ${MAX_BYTES / (1024 * 1024)}MB or smaller.`)
  }
}

/** @param {string} mime */
function extFromMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

/**
 * @param {File} file
 * @param {string} sessionId uuid-like folder key for this upload session
 * @returns {Promise<string>} object path inside bucket
 */
export async function uploadRsvpImageFile(file, sessionId) {
  validateRsvpImageFile(file)
  const ext = extFromMime(file.type)
  const path = `${sessionId}.${ext}`
  const supabase = getSupabase()
  const { error } = await supabase.storage.from(RSVP_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
    cacheControl: '3600',
  })
  if (error) throw error
  return path
}

/** @param {string | null | undefined} objectPath */
export function getRsvpImagePublicUrl(objectPath) {
  if (!objectPath) return null
  try {
    const supabase = getSupabase()
    const { data } = supabase.storage.from(RSVP_IMAGE_BUCKET).getPublicUrl(objectPath)
    return data?.publicUrl ?? null
  } catch {
    return null
  }
}
