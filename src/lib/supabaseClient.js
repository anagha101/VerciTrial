import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
let client = null

/** Supabase anon/service keys are JWTs: header.payload.signature */
export function isLikelyValidSupabaseAnonKey(key) {
  if (!key || typeof key !== 'string') return false
  const parts = key.trim().split('.')
  return parts.length === 3 && parts.every((p) => p.length >= 4)
}

export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

/** When vars exist but anon key is probably truncated or wrong. */
export function getSupabaseAnonKeyWarning() {
  if (!anonKey) return null
  if (!isLikelyValidSupabaseAnonKey(anonKey)) {
    return 'Your VITE_SUPABASE_ANON_KEY does not look like a full JWT (it should be one long string with exactly two dots, three segments — usually starts with eyJ). Re-copy the anon public key from Supabase → Project Settings → API.'
  }
  return null
}

export function getSupabase() {
  if (!url || !anonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and add your project values.',
    )
  }
  if (!client) client = createClient(url, anonKey)
  return client
}
