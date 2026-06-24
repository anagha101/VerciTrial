/** @type {{ label: string, href: string }[]} */
export const SOCIAL_LINKS = [
  { label: 'Instagram', href: import.meta.env.VITE_SOCIAL_INSTAGRAM || '#' },
  { label: 'TikTok', href: import.meta.env.VITE_SOCIAL_TIKTOK || '#' },
  { label: 'YouTube', href: import.meta.env.VITE_SOCIAL_YOUTUBE || '#' },
  { label: 'SoundCloud', href: import.meta.env.VITE_SOCIAL_SOUNDCLOUD || '#' },
  { label: 'Linktree', href: import.meta.env.VITE_SOCIAL_LINKTREE || '#' },
]
