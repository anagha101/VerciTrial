/**
 * Summer line-art — waves, palms, surfboard, sun (stroke = --palette-yellow in CSS).
 */
export function SummerPalmDeco() {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315]

  return (
    <div className="event-hero-deco" aria-hidden="true">
      {/* Back wave band */}
      <svg
        className="event-deco-waves event-deco-waves--back"
        viewBox="0 0 200 56"
        preserveAspectRatio="xMidYMax meet"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round">
          <path d="M-8 38 Q48 24 100 38 T208 38" />
          <path d="M-8 46 Q52 32 104 46 T208 46" />
          <path d="M-8 54 Q44 48 96 54 T208 54" />
          <path d="M-8 30 Q56 18 104 30 T208 30" />
        </g>
      </svg>

      {/* Mid-ground waves */}
      <svg
        className="event-deco-waves event-deco-waves--mid"
        viewBox="0 0 160 48"
        preserveAspectRatio="xMidYMax meet"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M-4 28 Q40 18 80 28 T164 28" />
          <path d="M-4 36 Q44 24 84 36 T164 36" />
          <path d="M-4 44 Q38 38 78 44 T164 44" />
        </g>
      </svg>

      {/* Top ribbon waves */}
      <svg
        className="event-deco-waves event-deco-waves--crest"
        viewBox="0 0 120 28"
        preserveAspectRatio="xMidYMid meet"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
          <path d="M-4 14 Q30 8 60 14 T124 14" />
          <path d="M-4 22 Q34 14 62 22 T124 22" />
        </g>
      </svg>

      {/* Coconut palm — left */}
      <svg
        className="event-deco-palm event-deco-palm--left"
        viewBox="0 0 76 108"
        preserveAspectRatio="xMidYMax meet"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 104 Q36 72 42 50" />
          <circle cx="34" cy="54" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="46" cy="55" r="2.4" fill="currentColor" stroke="none" />
          <path d="M42 48 Q28 20 10 26" />
          <path d="M42 48 Q38 14 40 6" />
          <path d="M42 48 Q52 18 68 30" />
          <path d="M42 48 Q58 12 70 8" />
          <path d="M42 48 Q48 22 72 44" />
          <path d="M42 48 Q32 28 14 48" />
        </g>
      </svg>

      {/* Coconut palm — right (mirrored in CSS) */}
      <svg
        className="event-deco-palm event-deco-palm--right"
        viewBox="0 0 76 108"
        preserveAspectRatio="xMidYMax meet"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
          <path d="M40 104 Q36 72 42 50" />
          <circle cx="34" cy="54" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="46" cy="55" r="2.4" fill="currentColor" stroke="none" />
          <path d="M42 48 Q28 20 10 26" />
          <path d="M42 48 Q38 14 40 6" />
          <path d="M42 48 Q52 18 68 30" />
          <path d="M42 48 Q58 12 70 8" />
          <path d="M42 48 Q48 22 72 44" />
          <path d="M42 48 Q32 28 14 48" />
        </g>
      </svg>

      {/* Surfboard */}
      <svg
        className="event-deco-surf"
        viewBox="0 0 44 120"
        preserveAspectRatio="xMidYMid meet"
      >
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 3 Q36 14 38 60 Q36 106 22 117 Q8 106 6 60 Q8 14 22 3 Z" />
          <path d="M22 16 L22 104" strokeOpacity="0.45" />
          <path d="M14 52 Q22 48 30 52" strokeOpacity="0.55" />
          <path d="M14 68 Q22 64 30 68" strokeOpacity="0.55" />
        </g>
      </svg>

      <svg className="event-deco-sun" viewBox="0 0 64 64" preserveAspectRatio="xMidYMid meet">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          transform="translate(32 32)"
        >
          <circle r="10.5" />
          {rays.map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-13"
              x2="0"
              y2="-21"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
