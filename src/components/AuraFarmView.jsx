import { useCallback, useState } from 'react'
import { bumpSignupAura } from '../lib/signupApi.js'
import { getRsvpImagePublicUrl } from '../lib/rsvpImages.js'

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
    return <p className="rsvp-body muted">No one in the aura farm yet — be the first!</p>
  }

  return (
    <div className="aura-farm-scroll" role="region" aria-label="Aura farm">
      <div className="aura-farm-canvas">
        {items.map((row, index) => {
          const left = 8 + (index % 4) * 22 + hashUnit(row.id, 'x') * 8
          const top = 8 + Math.floor(index / 4) * 28 + hashUnit(row.id, 'y') * 6
          const imgUrl = row.image_object_path ? getRsvpImagePublicUrl(row.image_object_path) : null
          const rawAura = localAuras[row.id] ?? Number(row.aura_count ?? 0)
          const auraShown = Number.isFinite(rawAura) ? rawAura * 10 : 0

          return (
            <div
              key={row.id}
              className="aura-farm-node"
              style={{ left: `${left}%`, top: `${top}%` }}
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
              <p className="aura-farm-aura-count">{auraShown.toLocaleString()} aura</p>
              <button type="button" className="aura-farm-bump" onClick={() => void handleBump(row)}>
                +10 aura
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
