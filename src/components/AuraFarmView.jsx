import { useCallback, useState } from 'react'
import { bumpSignupAura } from '../lib/signupApi.js'
import { getRsvpImagePublicUrl } from '../lib/rsvpImages.js'

function SparkleIcon() {
  return (
    <svg className="aura-farm-sparkle" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
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

/**
 * @param {{
 *   items: Array<{
 *     id: string
 *     full_name: string
 *     profile_message?: string | null
 *     image_object_path?: string | null
 *     aura_count?: number | null
 *   }>
 *   onAuraUpdated?: (id: string, newAuraCount: number) => void
 * }} props
 */
export function AuraFarmView({ items, onAuraUpdated }) {
  const [localAuras, setLocalAuras] = useState({})

  const handleBump = useCallback(
    async (row) => {
      try {
        const next = await bumpSignupAura(row.id)
        setLocalAuras((prev) => ({ ...prev, [row.id]: next }))
        onAuraUpdated?.(row.id, next)
      } catch (err) {
        console.error(err)
      }
    },
    [onAuraUpdated],
  )

  if (!items?.length) {
    return <p className="rsvp-body muted">No one has RSVPed for this episode yet — be the first!</p>
  }

  return (
    <div className="aura-farm-scroll" role="region" aria-label="Who is going">
      <div className="aura-farm-canvas">
        {items.map((row, index) => {
          const left = 6 + (index % 5) * 18 + hashUnit(row.id, 'x') * 10
          const top = 6 + Math.floor(index / 5) * 24 + hashUnit(row.id, 'y') * 8
          const imgUrl = row.image_object_path ? getRsvpImagePublicUrl(row.image_object_path) : null
          const floatDelay = `${hashUnit(row.id, 'd') * 4}s`
          const rawAura = localAuras[row.id] ?? Number(row.aura_count ?? 0)
          const auraShown = Number.isFinite(rawAura) ? rawAura * 10 : 0

          return (
            <div
              key={row.id}
              className="aura-farm-node"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: floatDelay,
              }}
            >
              <div className="aura-farm-avatar-wrap">
                {imgUrl ? (
                  <img src={imgUrl} alt="" className="aura-farm-avatar" loading="lazy" />
                ) : (
                  <div className="aura-farm-avatar aura-farm-avatar--empty" aria-hidden="true">
                    {row.full_name?.charAt(0) ?? '?'}
                  </div>
                )}
              </div>
              <p className="aura-farm-name">{row.full_name}</p>
              {row.profile_message ? (
                <p className="aura-farm-message">{row.profile_message}</p>
              ) : null}
              <p className="aura-farm-aura-count" aria-live="polite">
                {auraShown.toLocaleString()} aura
              </p>
              <button
                type="button"
                className="aura-farm-bump"
                onClick={() => void handleBump(row)}
                aria-label={`Give ${row.full_name} ten more aura`}
              >
                <SparkleIcon />
                <span>+10 aura</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
