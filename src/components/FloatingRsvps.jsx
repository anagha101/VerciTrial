import { useCallback } from 'react'
import { bumpSignupAura } from '../lib/signupApi.js'
import { getRsvpImagePublicUrl } from '../lib/rsvpImages.js'

function SparkleIcon() {
  return (
    <svg className="float-aura-sparkle" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0l1.3 4.4L14 8l-4.7 3.6L8 16l-1.3-4.4L2 8l4.7-3.6L8 0z"
      />
    </svg>
  )
}

function hashUnit(str, salt) {
  const s = `${str}:${salt}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return (Math.abs(h) % 1000) / 1000
}

/** @param {number} n */
function densityTier(n) {
  if (n < 5) return 'sparse'
  if (n < 9) return 'medium'
  return 'dense'
}

/** Central hero card band (% of viewport) — keep float cards out of the panel footprint */
const HERO_BAND = { l: 18, r: 82, t: 8, b: 80 }

function inHeroBand(left, top) {
  return left >= HERO_BAND.l && left <= HERO_BAND.r && top >= HERO_BAND.t && top <= HERO_BAND.b
}

/**
 * Nudge a position outside the hero band (deterministic per id + salt).
 */
function nudgeAwayFromHero(left, top, id, salt) {
  if (!inHeroBand(left, top)) return { left, top }
  const q = hashUnit(id, salt)
  if (q < 0.26) return { left: Math.max(1, left - 52), top }
  if (q < 0.52) return { left: Math.min(86, left + 52), top }
  if (q < 0.76) return { left, top: Math.max(4, top - 40) }
  return { left, top: Math.min(72, top + 36) }
}

function nudgeAwayFromHeroBand(left, top, id, saltBase) {
  let p = { left, top }
  for (let i = 0; i < 3; i++) {
    if (!inHeroBand(p.left, p.top)) break
    p = nudgeAwayFromHero(p.left, p.top, id, `${saltBase}${i}`)
  }
  return p
}

/**
 * Sparse: organic scatter, keep away from top-right (edit) and bottom-right (logo).
 * @param {string} id
 */
function layoutSparse(id) {
  let left = 4 + hashUnit(id, 'x') * 72
  let top = 12 + hashUnit(id, 'y') * 58
  ;({ left, top } = nudgeAwayFromHeroBand(left, top, id, 'ev'))
  const dur = 16 + hashUnit(id, 'd') * 14
  const delay = hashUnit(id, 't') * -8
  const scale = 0.88 + hashUnit(id, 's') * 0.12
  return { left, top, dur, delay, scale }
}

/**
 * Medium / dense: grid slots in a safe rectangle so 5–12 cards stay on screen.
 * @param {number} index
 * @param {number} n
 * @param {string} id
 * @param {'medium' | 'dense'} tier
 */
function layoutGrid(index, n, id, tier) {
  const cols =
    tier === 'dense' ? 4 : n >= 8 ? 4 : Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n))))
  const rows = Math.ceil(n / cols)
  const padL = 2.5
  const padR = 22
  const padT = 8.5
  const padB = 24
  const uw = 100 - padL - padR
  const uh = 100 - padT - padB
  const col = index % cols
  const row = Math.floor(index / cols)
  const jx = (hashUnit(id, 'jx') - 0.5) * (tier === 'dense' ? 1.6 : 2.2)
  const jy = (hashUnit(id, 'jy') - 0.5) * (tier === 'dense' ? 1.4 : 2.2)
  const cellW = uw / cols
  const cellH = uh / rows
  const leftRaw = padL + col * cellW + 0.03 * cellW + jx
  const topRaw = padT + row * cellH + 0.04 * cellH + jy
  let { left, top } = nudgeAwayFromHeroBand(leftRaw, topRaw, id, 'grid')
  const dur = 18 + hashUnit(id, 'd') * 12
  const delay = hashUnit(id, 't') * -10
  const scale =
    tier === 'dense' ? 0.82 + hashUnit(id, 's') * 0.08 : 0.86 + hashUnit(id, 's') * 0.1
  return {
    left: Math.min(Math.max(left, 0.5), 88),
    top: Math.min(Math.max(top, 7), 74),
    dur,
    delay,
    scale,
  }
}

/**
 * @param {{
 *   items: Array<{
 *     id: string
 *     full_name: string
 *     symbolic_item: string
 *     image_object_path?: string | null
 *     aura_count?: number | null
 *   }>
 *   onAuraUpdated?: () => void | Promise<void>
 * }} props
 */
export function FloatingRsvps({ items, onAuraUpdated }) {
  const handleBump = useCallback(
    async (e, row) => {
      e.preventDefault()
      e.stopPropagation()
      if (row?.id == null) return
      try {
        await bumpSignupAura(String(row.id))
        onAuraUpdated?.()
      } catch (err) {
        console.error(err)
      }
    },
    [onAuraUpdated],
  )

  if (!items?.length) return null

  const n = items.length
  const tier = densityTier(n)

  return (
    <div
      className={`floating-layer floating-density--${tier}`}
      role="region"
      aria-label="RSVP attendees"
    >
      {items.map((row, index) => {
        const rowId = row?.id != null ? String(row.id) : `idx-${index}`
        const layout =
          tier === 'sparse' ? layoutSparse(rowId) : layoutGrid(index, n, rowId, tier)
        const { left, top, dur, delay, scale } = layout
        const imgUrl = row.image_object_path ? getRsvpImagePublicUrl(row.image_object_path) : null
        const rawAura = Number(row.aura_count ?? 0)
        const auraShown = Number.isFinite(rawAura) ? rawAura * 10 : 0
        const displayName = row.full_name?.trim() || 'Guest'
        const displayItem = row.symbolic_item?.trim() || '—'
        const initial = displayName.charAt(0) || '?'
        return (
          <div
            key={rowId}
            className="float-wrap"
            style={{
              left: `${left}%`,
              '--float-top': `${top}%`,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
          >
            <div className="float-person" style={{ transform: `scale(${scale})` }}>
              <div className="float-avatar" aria-hidden="true">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt=""
                    className="float-avatar-img"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="float-avatar-letter">{initial}</span>
                )}
              </div>
              <div className="float-card">
                <p className="float-card-intro" title={`${displayName} is bringing…`}>
                  <span className="float-card-name">{displayName}</span>
                  <span className="float-bringing"> is bringing…</span>
                </p>
                <p className="float-card-item" title={displayItem}>
                  {displayItem}
                </p>
                <div className="float-aura-row">
                  <span className="float-aura-total" aria-live="polite">
                    {auraShown.toLocaleString()} aura
                  </span>
                  <button
                    type="button"
                    className="float-aura-btn"
                    onClick={(e) => void handleBump(e, row)}
                    aria-label={`Give ${displayName} ten more aura`}
                  >
                    <SparkleIcon />
                    <span className="float-aura-btn-label">+10</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
