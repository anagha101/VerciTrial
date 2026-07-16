import { fetchCurrentEpisodeNumber } from './episodeApi.js'
import { getSupabase } from './supabaseClient.js'

/** Digits only, max 4 */
export function sanitizeEditCodeInput(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 4)
}

/** @returns {string} */
export function generateEditCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10_000
  return String(n).padStart(4, '0')
}

const SIGNUP_SELECT =
  'id, edit_code, full_name, email, phone, heard_about, primary_contact, profile_message, image_object_path, aura_count, last_rsvp'

/** @returns {Promise<object | null>} */
export async function fetchSignupByEditCode(editCode) {
  const supabase = getSupabase()
  const c = sanitizeEditCodeInput(editCode)
  if (c.length !== 4) return null
  const { data, error } = await supabase
    .from('signup')
    .select(SIGNUP_SELECT)
    .eq('edit_code', c)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/**
 * @param {object} fields
 * @param {string} fields.full_name
 * @param {string} fields.email
 * @param {string} fields.phone
 * @param {string} fields.heard_about
 * @param {'email' | 'phone'} fields.primary_contact
 */
export async function createSunsetSignup(fields) {
  const supabase = getSupabase()
  const lastRsvp = await fetchCurrentEpisodeNumber()
  let lastErr = null
  for (let i = 0; i < 24; i++) {
    const edit_code = generateEditCode()
    const { data, error } = await supabase
      .from('signup')
      .insert({
        edit_code,
        full_name: fields.full_name,
        email: fields.email,
        phone: fields.phone || null,
        heard_about: fields.heard_about,
        primary_contact: fields.primary_contact,
        last_rsvp: lastRsvp,
      })
      .select('id, edit_code')
      .single()
    if (!error && data) return data
    if (error?.code === '23505') {
      lastErr = error
      continue
    }
    throw error
  }
  throw lastErr ?? new Error('Could not allocate a unique edit code')
}

/** @param {unknown} error */
export function describeSignupError(error) {
  const code = /** @type {{ code?: string, message?: string, details?: string }} */ (error)?.code
  const msg = String(/** @type {{ message?: string }} */ (error)?.message ?? error ?? '')
  const details = String(/** @type {{ details?: string }} */ (error)?.details ?? '')

  if (code === '42501' || /permission denied/i.test(msg) || /permission denied/i.test(details)) {
    return 'Could not save your RSVP. Permission denied — check Supabase policies.'
  }
  if (code === '401' || /jwt/i.test(msg) || /Invalid API key/i.test(msg)) {
    return 'Supabase rejected the API key. Check VITE_SUPABASE_ANON_KEY in .env.'
  }
  if (/fetch|network|failed to fetch/i.test(msg)) {
    return 'Network error. Check your connection and try again.'
  }
  if (code === '23505') {
    return 'Something went wrong creating your RSVP. Please try again.'
  }
  if (/No current episode/i.test(msg)) {
    return 'This event is not open for RSVPs yet. Please try again later.'
  }
  return msg || 'Something went wrong. Please try again.'
}

/** @param {string} editCode @param {number} episode */
export async function touchSignupLastRsvp(editCode, episode) {
  const supabase = getSupabase()
  const c = sanitizeEditCodeInput(editCode)
  const { error } = await supabase
    .from('signup')
    .update({ last_rsvp: episode, updated_at: new Date().toISOString() })
    .eq('edit_code', c)
  if (error) throw error
}

/**
 * @param {string} editCode
 * @param {{
 *   full_name: string
 *   email: string
 *   phone: string
 *   primary_contact: 'email' | 'phone'
 *   profile_message?: string
 *   image_object_path?: string | null
 * }} fields
 */
export async function updateSignupProfileByEditCode(editCode, fields) {
  const supabase = getSupabase()
  const c = sanitizeEditCodeInput(editCode)
  const message = fields.profile_message?.trim() ?? ''
  const imagePath = fields.image_object_path?.trim() ?? ''
  const { error } = await supabase
    .from('signup')
    .update({
      full_name: fields.full_name.trim(),
      email: fields.email.trim(),
      phone: fields.phone.trim() || null,
      primary_contact: fields.primary_contact,
      profile_message: message || null,
      image_object_path: imagePath || null,
      updated_at: new Date().toISOString(),
    })
    .eq('edit_code', c)
  if (error) throw error
}

/** @param {number} episode */
export async function listEpisodeSignups(episode) {
  const supabase = getSupabase()
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('public_episode_attendees')
    .select('id, full_name, profile_message, image_object_path, aura_count')
    .eq('episode_number', episode)
    .order('full_name')
  if (!attendanceError) return attendanceData ?? []

  const missingNewView =
    attendanceError.code === '42P01' ||
    attendanceError.code === 'PGRST205' ||
    /public_episode_attendees/i.test(attendanceError.message ?? '')
  if (!missingNewView) throw attendanceError

  // Temporary compatibility with the original one-row-per-person schema.
  const { data, error } = await supabase
    .from('signup')
    .select('id, full_name, profile_message, image_object_path, aura_count')
    .eq('last_rsvp', episode)
    .order('full_name')
  if (error) throw error
  return data ?? []
}

export async function bumpSignupAura(signupId) {
  const supabase = getSupabase()
  const { data: rpcData, error: rpcError } = await supabase.rpc('bump_signup_aura', {
    signup_id_input: signupId,
  })
  if (!rpcError) return Number(rpcData ?? 0)

  const missingRpc =
    rpcError.code === 'PGRST202' || /bump_signup_aura/i.test(rpcError.message ?? '')
  if (!missingRpc) throw rpcError

  // Temporary compatibility until the atomic backend function is added.
  const { data: existing, error: readErr } = await supabase
    .from('signup')
    .select('aura_count')
    .eq('id', signupId)
    .single()
  if (readErr) throw readErr
  const next = Number(existing?.aura_count ?? 0) + 1
  const { data, error } = await supabase
    .from('signup')
    .update({ aura_count: next, updated_at: new Date().toISOString() })
    .eq('id', signupId)
    .select('aura_count')
    .single()
  if (error) throw error
  return Number(data?.aura_count ?? next)
}

/**
 * Saves a reusable phone-based profile and this episode's attendance.
 * The database function validates the episode code again before writing.
 * @param {{
 *   phone: string
 *   code: string
 *   fullName: string
 *   profileMessage?: string
 *   imageObjectPath?: string | null
 * }} fields
 */
export async function saveCodeBasedRsvp(fields) {
  const { data, error } = await getSupabase().rpc('save_episode_rsvp', {
    phone_input: fields.phone,
    code_input: fields.code,
    full_name_input: fields.fullName.trim(),
    profile_message_input: fields.profileMessage?.trim() || null,
    image_object_path_input: fields.imageObjectPath || null,
  })
  if (error) throw error
  return data
}
