/** Escena isométrica 3D en SVG, inspirada en la UI de referencia. */
type Block = { x: number; y: number; w: number; d: number; h: number; z?: number; top: string; left: string; right: string }

const S = 22
const COS = Math.cos(Math.PI / 6)
const SIN = Math.sin(Math.PI / 6)
const p = (x: number, y: number, z: number) => [(x - y) * COS * S, (x + y) * SIN * S - z * S] as const
const pts = (list: (readonly [number, number])[]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')

function IsoBox({ x, y, w, d, h, z = 0, top, left, right }: Block) {
  const zt = z + h
  return (
    <g>
      <polygon points={pts([p(x, y + d, zt), p(x + w, y + d, zt), p(x + w, y + d, z), p(x, y + d, z)])} fill={left} />
      <polygon points={pts([p(x + w, y, zt), p(x + w, y + d, zt), p(x + w, y + d, z), p(x + w, y, z)])} fill={right} />
      <polygon points={pts([p(x, y, zt), p(x + w, y, zt), p(x + w, y + d, zt), p(x, y + d, zt)])} fill={top} />
    </g>
  )
}

const PURPLE = { top: '#a99cff', left: '#7a68f0', right: '#6553e6' }
const PINK = { top: '#f7c6ec', left: '#e9a3d9', right: '#dc8ccc' }
const BLUE = { top: '#b8c3ff', left: '#8f9df5', right: '#7d8bec' }

export function StairsIllustration({ className }: { className?: string }) {
  const blocks: Block[] = [
    { x: 0, y: 2, w: 2, d: 2, h: 0.6, ...PINK },
    { x: 1, y: 1, w: 2, d: 2, h: 0.6, z: 0.6, ...BLUE },
    { x: 2, y: 0, w: 2, d: 2, h: 0.6, z: 1.2, ...PURPLE },
  ]
  return (
    <svg viewBox="-110 -80 200 130" className={className} aria-hidden>
      <defs>
        <radialGradient id="ball2" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#fff2d6" />
          <stop offset="100%" stopColor="#f5b252" />
        </radialGradient>
      </defs>
      {blocks.map((b, i) => (
        <IsoBox key={i} {...b} />
      ))}
      <circle cx={p(3, 1, 1.8)[0]} cy={p(3, 1, 1.8)[1] - 6} r="6" fill="url(#ball2)" />
      <circle cx={p(1, 3, 0.6)[0]} cy={p(1, 3, 0.6)[1] - 5} r="5" fill="#fff" />
    </svg>
  )
}
