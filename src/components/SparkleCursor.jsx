import { useEffect, useRef } from 'react'

const SPARKLE_COUNT = 14

/**
 * Hot pink sparkles that trail the pointer. Toggle with `active`.
 * @param {{ active: boolean }} props
 */
export function SparkleCursor({ active }) {
  const rootRef = useRef(null)
  const targetRef = useRef({ x: -120, y: -120 })
  const trailRef = useRef(
    Array.from({ length: SPARKLE_COUNT }, () => ({ x: -120, y: -120 })),
  )
  const sparkleRefs = useRef([])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    if (!active) {
      root.style.opacity = '0'
      return
    }

    root.style.opacity = '1'

    const onMove = (e) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
    }

    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0
    const tick = () => {
      const target = targetRef.current
      const trail = trailRef.current

      trail[0].x += (target.x - trail[0].x) * 0.42
      trail[0].y += (target.y - trail[0].y) * 0.42
      for (let i = 1; i < trail.length; i++) {
        trail[i].x += (trail[i - 1].x - trail[i].x) * 0.38
        trail[i].y += (trail[i - 1].y - trail[i].y) * 0.38
      }

      const t = performance.now()
      sparkleRefs.current.forEach((el, i) => {
        if (!el) return
        const p = trail[i]
        const wobble = Math.sin(t * 0.008 + i * 0.9) * 6
        const rot = (t * 0.12 + i * 28) % 360
        const scale = Math.max(0.35, 1 - i * 0.045)
        el.style.transform = `translate3d(${p.x + wobble}px, ${p.y - wobble * 0.5}px, 0) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [active])

  return (
    <div ref={rootRef} className="sparkle-cursor" aria-hidden="true">
      {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            sparkleRefs.current[i] = el
          }}
          className="sparkle-cursor-bit"
          style={{ '--sparkle-i': i }}
        />
      ))}
    </div>
  )
}
