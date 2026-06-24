import { getSupabase } from './supabaseClient.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

/** Digits only, max 4 */
export function sanitizeRsvpCodeInput(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 4)
}

/** @returns {Promise<object | null>} */
export async function fetchSignupByRsvpCode(code) {
  const supabase = getSupabase()
  const c = sanitizeRsvpCodeInput(code)
  if (c.length !== 4) return null
  const { data, error } = await supabase
    .rpc('get_signup_by_rsvp_code', { p_code: c })
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
 * @param {number} fields.last_rsvp
 */
export async function createSunsetSignup(fields) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .rpc('create_sunset_signup', {
      p_full_name: fields.full_name,
      p_email: fields.email,
      p_phone: fields.phone,
      p_heard_about: fields.heard_about,
      p_primary_contact: fields.primary_contact,
      p_last_rsvp: fields.last_rsvp,
    })
    .single()
  if (error) throw error
  return data
}

/** @param {string} code @param {number} episode */
export async function touchSignupLastRsvp(code, episode) {
  const supabase = getSupabase()
  const c = sanitizeRsvpCodeInput(code)
  const { error } = await supabase.rpc('touch_signup_last_rsvp', {
    p_code: c,
    p_last_rsvp: episode,
  })
  if (error) throw error
}

/** @param {string} code @returns {Promise<'pending' | 'approved' | 'rejected' | null>} */
export async function fetchSignupApprovalStatus(code) {
  const supabase = getSupabase()
  const c = sanitizeRsvpCodeInput(code)
  if (c.length !== 4) return null
  const { data, error } = await supabase.rpc('get_signup_approval_status', { p_code: c })
  if (error) throw error
  return data ?? null
}

/**
 * @param {string} code
 * @param {{ profile_message?: string, image_object_path?: string | null }} fields
 */
export async function updateSignupProfileByCode(code, fields) {
  const supabase = getSupabase()
  const c = sanitizeRsvpCodeInput(code)
  const { error } = await supabase.rpc('update_signup_profile_by_code', {
    p_code: c,
    p_profile_message: fields.profile_message ?? '',
    p_image_object_path: fields.image_object_path ?? null,
  })
  if (error) throw error
}

/** @param {number} episode */
export async function listAuraFarmSignups(episode) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('list_signup_aura_farm', { p_episode: episode })
  if (error) throw error
  return data ?? []
}

/** Ask edge function to text admin about a new pending RSVP. */
export async function notifyAdminOfRsvp(signupId) {
  if (!supabaseUrl) return
  const supabase = getSupabase()
  const { error } = await supabase.functions.invoke('notify-rsvp', {
    body: { signup_id: signupId },
  })
  if (error) console.warn('notify-rsvp:', error.message)
}

// ─── Legacy helpers (AppEvent / aura bump) ───

/** @returns {string} */
export function generateEditCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000
  return String(n).padStart(5, '0')
}

export function sanitizeEditCodeInput(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 5)
}

export async function insertSignup(row, maxAttempts = 12) {
  const supabase = getSupabase()
  let lastErr = null
  for (let i = 0; i < maxAttempts; i++) {
    const edit_code = i === 0 ? row.edit_code : generateEditCode()
    const payload = { ...row, edit_code }
    const { data, error } = await supabase
      .from('signup')
      .insert(payload)
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

export function describeBackdropLoadError(error) {
  const code = /** @type {{ code?: string, message?: string, details?: string }} */ (error)?.code
  const msg = String(/** @type {{ message?: string }} */ (error)?.message ?? error ?? '')
  const details = String(/** @type {{ details?: string }} */ (error)?.details ?? '')

  if (
    code === 'PGRST202' ||
    code === 'PGRST301' ||
    /list_signup_backdrop/i.test(msg) ||
    /schema cache/i.test(msg) ||
    /42883/i.test(msg) ||
    /function .* does not exist/i.test(msg)
  ) {
    return 'Run supabase/event_signup.sql and supabase/signup_sunset_sessions.sql in the SQL Editor, then refresh.'
  }
  if (code === '42501' || /permission denied/i.test(msg) || /permission denied for function/i.test(details)) {
    return 'Permission denied. Re-run the GRANT lines in the SQL migration files.'
  }
  if (code === '401' || /jwt/i.test(msg) || /Invalid API key/i.test(msg)) {
    return 'Supabase rejected the API key. Check VITE_SUPABASE_ANON_KEY in .env.'
  }
  if (/fetch|network|failed to fetch/i.test(msg)) {
    return 'Network error talking to Supabase.'
  }
  return `Could not load RSVPs (${code || 'no code'}).`
}

export async function listBackdropSignups() {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('list_signup_backdrop', {})
  if (error) throw error
  return data ?? []
}

export async function loadSignupForEdit(code) {
  const c = sanitizeEditCodeInput(code)
  if (c.length !== 5) return { error: 'Enter all 5 digits.' }
  const row = await fetchSignupByEditCode(c)
  if (!row) return { error: 'No RSVP matches that code.' }
  return { row }
}

export async function fetchSignupByEditCode(editCode) {
  const supabase = getSupabase()
  const code = sanitizeEditCodeInput(editCode)
  if (code.length !== 5) return null
  const { data, error } = await supabase
    .rpc('get_signup_by_code', { p_edit_code: code })
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function updateSignupByCode(editCode, fields) {
  const supabase = getSupabase()
  const code = sanitizeEditCodeInput(editCode)
  if (code.length !== 5) throw new Error('Enter your full 5-digit code.')
  const { data, error } = await supabase.rpc('update_signup_by_code', {
    p_edit_code: code,
    p_full_name: fields.full_name,
    p_email: fields.email,
    p_phone: fields.phone,
    p_symbolic_item: fields.symbolic_item,
    p_tenure_response: fields.tenure_response,
    p_favorite_snack: fields.favorite_snack,
    p_image_object_path: fields.image_object_path ?? null,
  })
  if (error) throw error
  if (!data) throw new Error('No RSVP found for that code.')
  return true
}

export async function bumpSignupAura(signupId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('bump_signup_aura', { p_id: signupId })
  if (error) throw error
  const n =
    typeof data === 'bigint' ? Number(data) : typeof data === 'number' ? data : Number(data)
  if (Number.isNaN(n)) throw new Error('Unexpected response from bump_signup_aura')
  return n
}
