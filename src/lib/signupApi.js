import { getSupabase } from './supabaseClient.js'

/** @returns {string} */
export function generateEditCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000
  return String(n).padStart(5, '0')
}

/** Digits only, max 5 — caller validates length === 5 before lookup/save. */
export function sanitizeEditCodeInput(raw) {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 5)
}

/**
 * @param {object} row
 * @param {string} row.edit_code
 * @param {string} row.full_name
 * @param {string} row.email
 * @param {string | null} [row.phone]
 * @param {string} row.symbolic_item
 * @param {string | null} [row.tenure_response]
 * @param {string | null} [row.favorite_snack]
 * @param {string | null} [row.image_object_path]
 * @param {number} [maxAttempts]
 */
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

/**
 * Human-readable hint when list_signup_backdrop fails (common: SQL not run yet).
 * @param {unknown} error
 */
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
    return 'The list_signup_backdrop function is missing or PostgREST has not reloaded. In Supabase SQL Editor, run the entire supabase/event_signup.sql file (not only the CREATE TABLE). Then run: NOTIFY pgrst, \'reload schema\'; — or wait a minute and refresh.'
  }
  if (
    code === '42501' ||
    /permission denied/i.test(msg) ||
    /permission denied for function/i.test(details)
  ) {
    return 'Permission denied calling list_signup_backdrop. Re-run the GRANT EXECUTE lines at the bottom of supabase/event_signup.sql as a superuser (SQL Editor), then refresh.'
  }
  if (
    code === '401' ||
    /jwt/i.test(msg) ||
    /Invalid API key/i.test(msg) ||
    /invalid value for/i.test(msg)
  ) {
    return 'Supabase rejected the API key (invalid or truncated JWT). In Dashboard → Settings → API, copy the full anon public key (three dot-separated parts), update VITE_SUPABASE_ANON_KEY in .env, restart npm run dev.'
  }
  if (/fetch|network|failed to fetch/i.test(msg)) {
    return 'Network error talking to Supabase. Check your connection and that VITE_SUPABASE_URL is correct, then refresh.'
  }
  return `Could not load RSVPs (${code || 'no code'}). Check .env and that the full event_signup.sql (table + functions + grants) ran. In dev, see the browser console for the full error.`
}

/**
 * @returns {Promise<Array<{ id: string, full_name: string, symbolic_item: string, image_object_path?: string | null, aura_count?: number }>>}
 */
export async function listBackdropSignups() {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('list_signup_backdrop', {})
  if (error) throw error
  return data ?? []
}

/**
 * @param {string} editCode
 * @returns {Promise<object | null>}
 */
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

/**
 * @param {string} editCode
 * @param {object} fields
 */
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

/**
 * @param {string} signupId uuid
 * @returns {Promise<number>} new aura_count (raw clicks; multiply by 10 for display)
 */
export async function bumpSignupAura(signupId) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('bump_signup_aura', { p_id: signupId })
  if (error) throw error
  const n =
    typeof data === 'bigint'
      ? Number(data)
      : typeof data === 'number'
        ? data
        : Number(data)
  if (Number.isNaN(n)) throw new Error('Unexpected response from bump_signup_aura')
  return n
}
