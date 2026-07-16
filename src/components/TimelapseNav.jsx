import { NAV_STREAM_LIVE_URL } from '../lib/navLinks.js'
import { getYoutubePlaylistWatchUrl } from '../lib/youtubePlaylist.js'

/**
 * @param {{
 *   href?: string
 *   className: string
 *   children: import('react').ReactNode
 * }} props
 */
function NavItem({ href, className, children }) {
  if (href) {
    return (
      <a className={className} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={className}>
      {children}
    </button>
  )
}

export function TimelapseNav() {
  const pastEpisodesUrl = getYoutubePlaylistWatchUrl()

  return (
    <nav className="timelapse-nav" aria-label="Site">
      <NavItem
        href={NAV_STREAM_LIVE_URL || undefined}
        className="glass-btn timelapse-nav-btn"
      >
        Stream Live
      </NavItem>

      {pastEpisodesUrl ? (
        <NavItem href={pastEpisodesUrl} className="glass-btn timelapse-nav-btn">
          Past Episodes
        </NavItem>
      ) : (
        <button
          type="button"
          className="glass-btn timelapse-nav-btn timelapse-nav-btn--soon timelapse-nav-btn--soon-only"
          disabled
        >
          <span className="timelapse-nav-btn-label">Past Episodes</span>
          <span className="timelapse-nav-btn-sub">(Coming Soon)</span>
        </button>
      )}
    </nav>
  )
}
