import { useCallback, useMemo } from 'react'
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

/**
 * Margin-only placement with explicit vertical slots so stacks never share one anchor.
 * Right column uses inset-inline-end (CSS) so we never hit the old `min(left, …)` clamp
 * that forced every right card to the same pixel.
 *
 * When ⌈n/2⌉ vertical slots get too short, switch to 4 lanes (2 on each side).
 *
 * @param {number} index
 * @param {number} n
 * @param {string} id
 * @param {'sparse' | 'medium' | 'dense'} tier
 */
function layoutWingSlots(index, n, id, tier) {
  const padT = 11.5
  const padB = 25
  const uh = 100 - padT - padB
  const minSlotH = tier === 'dense' ? 12 : 10.8
  const dualStacks = Math.ceil(n / 2)
  const dualH = uh / Math.max(dualStacks, 1)
  const useQuad = dualH < minSlotH && n > 6

  let laneIndex
  let slot
  let slots
  if (!useQuad) {
    laneIndex = index % 2
    slot = Math.floor(index / 2)
    slots = Math.ceil(n / 2)
  } else {
    laneIndex = index % 4
    slot = Math.floor(index / 4)
    slots = Math.ceil(n / 4)
  }

  const slotH = uh / Math.max(slots, 1)
  const topMid = padT + slot * slotH + slotH * 0.5
  const jyMax = Math.min(1.85, slotH * 0.17)
  const jy = (hashUnit(id, 'jy') - 0.5) * jyMax
  let top = topMid + jy
  top = Math.min(Math.max(top, padT + 1.5), padT + uh - 1.5)

  const jx = (hashUnit(id, 'jx') - 0.5) * (useQuad ? 2.6 : tier === 'dense' ? 3.4 : 4)

  let anchorInlineEnd = false
  let left = 5
  /** % inset from inline-end (right in LTR) */
  let inlineEnd = 6

  if (!useQuad) {
    if (laneIndex === 0) {
      left = 5 + jx + (hashUnit(id, 'lx') - 0.5) * 2.2
      left = Math.min(Math.max(left, 2), 23)
    } else {
      anchorInlineEnd = true
      inlineEnd =
        4.2 +
        hashUnit(id, 'ie') * 7.5 +
        (slot % 6) * 1.95 +
        (hashUnit(id, 'ie2') - 0.5) * 1.4 +
        jx * 0.35
      inlineEnd = Math.min(Math.max(inlineEnd, 2.4), 17)
    }
  } else if (laneIndex === 0) {
    left = Math.min(Math.max(3.5 + jx, 2), 12)
  } else if (laneIndex === 1) {
    left = Math.min(Math.max(14.5 + jx, 12.5), 24)
  } else if (laneIndex === 2) {
    anchorInlineEnd = true
    inlineEnd = 6.5 + hashUnit(id, 'q2') * 5.5 + (slot % 5) * 2.05 + jx * 0.25
    inlineEnd = Math.min(Math.max(inlineEnd, 4.5), 16)
  } else {
    anchorInlineEnd = true
    inlineEnd = 2.6 + hashUnit(id, 'q3') * 4.8 + (slot % 5) * 1.75 + jx * 0.25
    inlineEnd = Math.min(Math.max(inlineEnd, 2), 11.5)
  }

  const dur =
    tier === 'sparse' ? 16 + hashUnit(id, 'd') * 14 : 18 + hashUnit(id, 'd') * 12
  const delay = tier === 'sparse' ? hashUnit(id, 't') * -8 : hashUnit(id, 't') * -10
  const scale =
    tier === 'dense'
      ? 0.82 + hashUnit(id, 's') * 0.08
      : tier === 'medium'
        ? 0.86 + hashUnit(id, 's') * 0.1
        : 0.88 + hashUnit(id, 's') * 0.12

  return { anchorInlineEnd, left, inlineEnd, top, dur, delay, scale }
}

function buildLayouts(items, tier) {
  const n = items.length
  return items.map((row, index) => {
    const rowId = row?.id != null ? String(row.id) : `idx-${index}`
    return {
      row,
      rowId,
      index,
      ...layoutWingSlots(index, n, rowId, tier),
    }
  })
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

  const n = items?.length ?? 0
  const tier = n ? densityTier(n) : 'sparse'

  const layouts = useMemo(() => {
    if (!items?.length) return []
    return buildLayouts(items, tier)
  }, [items, tier])

  if (!items?.length) return null

  return (
    <div
      className={`floating-layer floating-density--${tier}`}
      role="region"
      aria-label="RSVP attendees"
    >
      {layouts.map(
        ({ row, rowId, anchorInlineEnd, left, inlineEnd, top, dur, delay, scale }) => {
          const imgUrl = row.image_object_path ? getRsvpImagePublicUrl(row.image_object_path) : null
          const rawAura = Number(row.aura_count ?? 0)
          const auraShown = Number.isFinite(rawAura) ? rawAura * 10 : 0
          const displayName = row.full_name?.trim() || 'Guest'
          const displayItem = row.symbolic_item?.trim() || '—'
          const initial = displayName.charAt(0) || '?'
          const posStyle = anchorInlineEnd
            ? { '--float-inline-end': `${inlineEnd}%` }
            : { '--float-left': `${left}%` }
          return (
            <div
              key={rowId}
              className={
                anchorInlineEnd ? 'float-wrap float-wrap--anchor-inline-end' : 'float-wrap'
              }
              style={{
                ...posStyle,
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
        },
      )}
    </div>
  )
}
