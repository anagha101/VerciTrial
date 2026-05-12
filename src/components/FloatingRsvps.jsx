import { useCallback } from 'react'
import { bumpSignupAura } from '../lib/signupApi.js'
import { getRsvpImagePublicUrl } from '../lib/rsvpImages.js'

function SparkleIcon() {
  return (
    <svg
      className="float-aura-sparkle"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
    >
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
  if (n < 10) return 'medium'
  return 'dense'
}

/**
 * Sparse: organic scatter, keep away from top-right (edit) and bottom-right (logo).
 * @param {string} id
 */
function layoutSparse(id) {
  const left = 4 + hashUnit(id, 'x') * 72
  const top = 12 + hashUnit(id, 'y') * 58
  const dur = 16 + hashUnit(id, 'd') * 14
  const delay = hashUnit(id, 't') * -8
  const scale = 0.92 + hashUnit(id, 's') * 0.18
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
  const cols = tier === 'dense' ? 4 : Math.min(3, Math.max(2, Math.ceil(Math.sqrt(n))))
  const rows = Math.ceil(n / cols)
  const padL = 2.5
  const padR = 30
  const padT = 12
  const padB = 24
  const uw = 100 - padL - padR
  const uh = 100 - padT - padB
  const col = index % cols
  const row = Math.floor(index / cols)
  const jx = (hashUnit(id, 'jx') - 0.5) * (tier === 'dense' ? 2.5 : 3.5)
  const jy = (hashUnit(id, 'jy') - 0.5) * (tier === 'dense' ? 2 : 3)
  const cellW = uw / cols
  const cellH = uh / rows
  const left = padL + col * cellW + 0.04 * cellW + jx
  const top = padT + row * cellH + 0.05 * cellH + jy
  const dur = 18 + hashUnit(id, 'd') * 12
  const delay = hashUnit(id, 't') * -10
  const scale =
    tier === 'dense' ? 0.88 + hashUnit(id, 's') * 0.1 : 0.9 + hashUnit(id, 's') * 0.12
  return {
    left: Math.min(Math.max(left, 1), 86),
    top: Math.min(Math.max(top, 8), 82),
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
 *   onAuraUpdated?: (id: string, newAuraCount: number) => void
 * }} props
 */
export function FloatingRsvps({ items, onAuraUpdated }) {
  const handleBump = useCallback(
    async (e, row) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        const next = await bumpSignupAura(row.id)
        onAuraUpdated?.(row.id, next)
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
        const layout =
          tier === 'sparse' ? layoutSparse(row.id) : layoutGrid(index, n, row.id, tier)
        const { left, top, dur, delay, scale } = layout
        const imgUrl = row.image_object_path ? getRsvpImagePublicUrl(row.image_object_path) : null
        const rawAura = Number(row.aura_count ?? 0)
        const auraShown = Number.isFinite(rawAura) ? rawAura * 10 : 0
        return (
          <div
            key={row.id}
            className="float-wrap"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
          >
            <div className="float-card" style={{ transform: `scale(${scale})` }}>
              {imgUrl ? (
                <img src={imgUrl} alt="" className="float-card-thumb" loading="lazy" decoding="async" />
              ) : null}
              <p className="float-card-text">
                <span className="float-card-name">{row.full_name}</span>
                <span className="float-bringing"> is bringing…</span>
              </p>
              <span className="float-card-item">{row.symbolic_item}</span>
              <div className="float-aura-row">
                <span className="float-aura-total" aria-live="polite">
                  {auraShown.toLocaleString()} aura
                </span>
                <button
                  type="button"
                  className="float-aura-btn"
                  onClick={(e) => void handleBump(e, row)}
                  aria-label={`Give ${row.full_name} ten more aura`}
                >
                  <SparkleIcon />
                  <span>+10 aura?</span>
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
