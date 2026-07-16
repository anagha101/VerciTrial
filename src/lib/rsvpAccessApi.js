import { getSupabase } from './supabaseClient.js'

/** Formats common US inputs as E.164; international numbers should include +. */
export function normalizePhoneNumber(value) {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function sanitizeEpisodeCode(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
}

export async function unlockEpisodeRsvp(phone, code) {
  const normalizedPhone = normalizePhoneNumber(phone)
  if (!normalizedPhone) {
    throw new Error('Enter a valid phone number, including country code if outside the US.')
  }
  const normalizedCode = sanitizeEpisodeCode(code)
  if (!normalizedCode) throw new Error('Enter this session’s RSVP code.')

  const { data, error } = await getSupabase().rpc('verify_episode_rsvp', {
    phone_input: normalizedPhone,
    code_input: normalizedCode,
  })
  if (error) throw error
  return { phone: normalizedPhone, ...(data ?? {}) }
}

export function describeRsvpAccessError(error) {
  const message = String(error?.message ?? error ?? '')
  if (/invalid_rsvp_code/i.test(message)) return 'That RSVP code is not correct for this session.'
  if (/not configured|no current episode/i.test(message)) {
    return 'This session is not open for RSVPs yet.'
  }
  if (/fetch|network/i.test(message)) return 'Network error. Check your connection and try again.'
  return message || 'Could not unlock this RSVP. Please try again.'
}
