import { SOCIAL_LINKS } from '../lib/socialLinks.js'

export function TimelapseFooter() {
  return (
    <footer className="timelapse-footer" aria-label="Social links">
      {SOCIAL_LINKS.map(({ label, href }) => (
        <a
          key={label}
          className="timelapse-footer-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
        >
          {label}
        </a>
      ))}
    </footer>
  )
}
