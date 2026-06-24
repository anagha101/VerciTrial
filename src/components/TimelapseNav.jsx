import { NAV_PAST_EPISODES_URL, NAV_STREAM_LIVE_URL } from '../lib/navLinks.js'

/**
 * @param {{
 *   href?: string
 *   className: string
 *   onClick?: () => void
 *   children: import('react').ReactNode
 * }} props
 */
function NavItem({ href, className, onClick, children }) {
  if (href) {
    return (
      <a
        className={className}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * @param {{ onRsvpClick: () => void }} props
 */
export function TimelapseNav({ onRsvpClick }) {
  return (
    <nav className="timelapse-nav" aria-label="Site">
      <NavItem
        href={NAV_STREAM_LIVE_URL || undefined}
        className="episode-rsvp-btn timelapse-nav-btn timelapse-nav-btn--left"
      >
        Stream Live
      </NavItem>

      <button type="button" className="episode-rsvp-btn timelapse-nav-btn" onClick={onRsvpClick}>
        RSVP
      </button>

      <NavItem
        href={NAV_PAST_EPISODES_URL || undefined}
        className="episode-rsvp-btn timelapse-nav-btn timelapse-nav-btn--right"
      >
        Past Episodes
      </NavItem>
    </nav>
  )
}
