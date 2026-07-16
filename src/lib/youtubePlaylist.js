/** YouTube playlist for episodes. Set VITE_YOUTUBE_PLAYLIST in .env (full URL or raw playlist ID). */
export const YOUTUBE_PLAYLIST_URL = import.meta.env.VITE_YOUTUBE_PLAYLIST ?? ''

/** @returns {string | null} playlist ID parsed from the env value */
export function getYoutubePlaylistId() {
  const raw = YOUTUBE_PLAYLIST_URL.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    const list = url.searchParams.get('list')
    if (list) return list
  } catch {
    // Not a URL — treat it as a raw playlist ID below.
  }
  return /^[\w-]+$/.test(raw) ? raw : null
}

/** External link to the playlist page on YouTube (used by the Past Episodes nav button). */
export function getYoutubePlaylistWatchUrl() {
  const raw = YOUTUBE_PLAYLIST_URL.trim()
  if (raw.startsWith('http')) return raw
  const id = getYoutubePlaylistId()
  if (!id) return null
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`
}