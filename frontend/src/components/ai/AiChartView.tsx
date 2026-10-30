import { useMemo, useRef, useState } from 'react'
import { BarChart3, Download, Maximize2, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

export interface AiChart {
  title: string
  chartType: string
  metricLabel: string
  xLabel: string
  stackLabel: string | null
  filters: string[]
  categories: string[]
  series: { name: string; color: string; values: number[] }[]
  insight: string
  spec: string
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** Texto legible sobre el color del segmento (blanco u oscuro según luminancia). */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  return lum > 0.45 ? '#1f2937' : '#ffffff'
}

/** Escala "bonita" para el eje Y (0, 2, 4, …). */
function niceMax(max: number) {
  if (max <= 0) return { top: 1, step: 1 }
  const raw = max / 5
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!
  return { top: Math.ceil(max / step) * step, step }
}

export function AiChartCard({ chart, compact = false }: { chart: AiChart; compact?: boolean }) {
  const [showTable, setShowTable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const empty = !chart.categories.length || !chart.series.length

  function downloadPng() {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    const { width, height } = svg.viewBox.baseVal
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `${chart.title.replace(/[^\w\- áéíóúñ]/gi, '').trim() || 'grafica'}.png`
      a.click()
    }
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  }

  return (
    <div className="rounded-2xl border bg-white">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight font-semibold">{chart.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {chart.metricLabel} por {chart.xLabel.toLowerCase()}
            {chart.stackLabel && ` y ${chart.stackLabel.toLowerCase()}`}
            {chart.filters.length > 0 && ` · ${chart.filters.join(' · ')}`}
          </p>
        </div>
        {!empty && (
          <div className="flex shrink-0 gap-0.5">
            <Button variant="ghost" size="icon-xs" onClick={() => setShowTable((t) => !t)} aria-label={showTable ? 'Ver gráfica' : 'Ver tabla'} title={showTable ? 'Ver gráfica' : 'Ver tabla'}>
              {showTable ? <BarChart3 /> : <Table2 />}
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={downloadPng} aria-label="Descargar PNG" title="Descargar PNG">
              <Download />
            </Button>
            {compact && (
              <Button variant="ghost" size="icon-xs" onClick={() => setExpanded(true)} aria-label="Ampliar" title="Ampliar">
                <Maximize2 />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="p-3">
        {empty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay datos para esa consulta.</p>
        ) : showTable ? (
          <ChartTable chart={chart} />
        ) : chart.chartType === 'line' ? (
          <LineChart chart={chart} svgRef={svgRef} minW={compact ? 480 : 920} />
        ) : chart.chartType === 'horizontal_bar' ? (
          <HorizontalBars chart={chart} svgRef={svgRef} minW={compact ? 560 : 920} />
        ) : (
          <ColumnChart chart={chart} svgRef={svgRef} minW={compact ? 480 : 920} />
        )}
        {!empty && chart.series.length > 1 && !showTable && <Legend chart={chart} />}
      </div>

      {compact && (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="rounded-3xl p-4 sm:max-w-5xl">
            <DialogTitle className="sr-only">{chart.title}</DialogTitle>
            <DialogDescription className="sr-only">Gráfica ampliada</DialogDescription>
            <AiChartCard chart={chart} />
            {chart.insight && <p className="px-1 text-sm text-muted-foreground">{chart.insight}</p>}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function Legend({ chart }: { chart: AiChart }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {chart.series.map((s) => (
        <span key={s.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}

function ChartTable({ chart }: { chart: AiChart }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white text-muted-foreground">
          <tr className="border-b">
            <th className="py-1.5 pr-3 text-left font-medium">{chart.xLabel}</th>
            {chart.series.map((s) => (
              <th key={s.name} className="px-2 py-1.5 text-right font-medium">{s.name}</th>
            ))}
            {chart.series.length > 1 && <th className="py-1.5 pl-2 text-right font-semibold">Total</th>}
          </tr>
        </thead>
        <tbody>
          {chart.categories.map((c, i) => (
            <tr key={c} className="border-b last:border-0">
              <td className="py-1.5 pr-3">{c}</td>
              {chart.series.map((s) => (
                <td key={s.name} className="px-2 py-1.5 text-right tabular-nums">{fmt(s.values[i]!)}</td>
              ))}
              {chart.series.length > 1 && (
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{fmt(chart.series.reduce((t, s) => t + s.values[i]!, 0))}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type Tip = { x: number; y: number; title: string; lines: { name: string; color: string; value: number }[] } | null

function Tooltip({ tip, width, height }: { tip: Tip; width: number; height: number }) {
  if (!tip) return null
  const left = Math.min(Math.max(tip.x, 70), width - 70)
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-white px-2.5 py-1.5 text-xs shadow-lg"
      style={{ left: `${(left / width) * 100}%`, top: `calc(${(tip.y / height) * 100}% - 6px)` }}
    >
      <p className="mb-0.5 font-semibold whitespace-nowrap">{tip.title}</p>
      {tip.lines.map((l) => (
        <p key={l.name} className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
          <span className="size-2 rounded-sm" style={{ background: l.color }} />
          {l.name}: <span className="font-semibold text-foreground">{fmt(l.value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Columnas (apiladas si hay varias series): total arriba, valor dentro de cada segmento. */
function ColumnChart({ chart, svgRef, minW }: { chart: AiChart; svgRef: React.RefObject<SVGSVGElement | null>; minW: number }) {
  const [tip, setTip] = useState<Tip>(null)
  const n = chart.categories.length
  const longest = Math.max(...chart.categories.map((c) => c.length))
  const rotate = n > 4 || longest > 12
  const W = Math.max(minW, n * 72 + 70)
  const bottom = rotate ? Math.min(120, 24 + longest * 5.2) : 34
  const top = 26
  const left = 42
  const H = 230 + bottom
  const plotH = H - top - bottom
  const totals = chart.categories.map((_, i) => chart.series.reduce((t, s) => t + s.values[i]!, 0))
  const { top: yMax, step } = niceMax(Math.max(...totals))
  const y = (v: number) => top + plotH - (v / yMax) * plotH
  const band = (W - left - 12) / n
  const barW = Math.min(46, band * 0.6)
  const ticks = useMemo(() => Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step), [yMax, step])

  return (
    <div className="relative overflow-x-auto">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label={chart.title} onMouseLeave={() => setTip(null)}>
        <rect width={W} height={H} fill="#ffffff" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#eef0f3" />
            <text x={left - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="#6b7280" fontFamily="system-ui, sans-serif">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text transform={`translate(11 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize="10.5" fill="#9ca3af" fontFamily="system-ui, sans-serif">
          {chart.metricLabel}
        </text>

        {chart.categories.map((cat, i) => {
          const cx = left + band * i + band / 2
          let acc = 0
          const segs = chart.series.map((s) => {
            const v = s.values[i]!
            const y0 = y(acc)
            acc += v
            return { s, v, y1: y(acc), h: y0 - y(acc) }
          })
          const visible = segs.filter((sg) => sg.v > 0)
          return (
            <g
              key={cat}
              onMouseMove={() => setTip({ x: cx, y: y(totals[i]!), title: `${cat} · ${fmt(totals[i]!)}`, lines: visible.map(({ s, v }) => ({ name: s.name, color: s.color, value: v })) })}
            >
              <rect x={cx - band / 2} y={top} width={band} height={plotH} fill="transparent" />
              {visible.map(({ s, v, y1, h }, k) => {
                const isTop = k === visible.length - 1
                const gap = isTop ? 0 : 1.5
                return (
                  <g key={s.name}>
                    <path
                      d={
                        isTop
                          ? `M${cx - barW / 2},${y1 + h} V${y1 + 4} Q${cx - barW / 2},${y1} ${cx - barW / 2 + 4},${y1} H${cx + barW / 2 - 4} Q${cx + barW / 2},${y1} ${cx + barW / 2},${y1 + 4} V${y1 + h} Z`
                          : `M${cx - barW / 2},${y1 + h} V${y1 + gap} H${cx + barW / 2} V${y1 + h} Z`
                      }
                      fill={s.color}
                    />
                    {chart.series.length > 1 && h >= 15 && (
                      <text x={cx} y={y1 + h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={inkOn(s.color)} fontFamily="system-ui, sans-serif">
                        {fmt(v)}
                      </text>
                    )}
                  </g>
                )
              })}
              <text x={cx} y={y(totals[i]!) - 7} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1f2937" fontFamily="system-ui, sans-serif">
                {fmt(totals[i]!)}
              </text>
              <text
                x={cx}
                y={top + plotH + 14}
                textAnchor={rotate ? 'end' : 'middle'}
                transform={rotate ? `rotate(-38 ${cx} ${top + plotH + 14})` : undefined}
                fontSize="10.5"
                fill="#374151"
                fontFamily="system-ui, sans-serif"
              >
                {cat}
              </text>
            </g>
          )
        })}
        <line x1={left} x2={W - 8} y1={y(0)} y2={y(0)} stroke="#d1d5db" />
      </svg>
      <Tooltip tip={tip} width={W} height={H} />
    </div>
  )
}

/** Barras horizontales (útiles con muchas categorías o nombres largos). */
function HorizontalBars({ chart, svgRef, minW }: { chart: AiChart; svgRef: React.RefObject<SVGSVGElement | null>; minW: number }) {
  const [tip, setTip] = useState<Tip>(null)
  const cats = [...chart.categories].reverse()
  const idx = (c: string) => chart.categories.indexOf(c)
  const totals = chart.categories.map((_, i) => chart.series.reduce((t, s) => t + s.values[i]!, 0))
  const labelW = Math.min(170, 14 + Math.max(...chart.categories.map((c) => c.length)) * 6.2)
  const W = minW
  const rowH = 30
  const H = cats.length * rowH + 16
  const max = Math.max(...totals) || 1
  const x = (v: number) => labelW + (v / max) * (W - labelW - 44)
  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chart.title} onMouseLeave={() => setTip(null)}>
        <rect width={W} height={H} fill="#ffffff" />
        {cats.map((c, r) => {
          const i = idx(c)
          const cy = 8 + r * rowH + rowH / 2
          let acc = 0
          const visible = chart.series.filter((s) => s.values[i]! > 0)
          return (
            <g key={c} onMouseMove={() => setTip({ x: x(totals[i]!), y: cy - 8, title: `${c} · ${fmt(totals[i]!)}`, lines: visible.map((s) => ({ name: s.name, color: s.color, value: s.values[i]! })) })}>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill="transparent" />
              <text x={labelW - 8} y={cy + 4} textAnchor="end" fontSize="11" fill="#374151" fontFamily="system-ui, sans-serif">
                {c.length > 26 ? c.slice(0, 25) + '…' : c}
              </text>
              {visible.map((s, k) => {
                const x0 = x(acc)
                acc += s.values[i]!
                const w = x(acc) - x0 - (k < visible.length - 1 ? 1.5 : 0)
                return <rect key={s.name} x={x0} y={cy - 8} width={Math.max(w, 1)} height={16} rx={k === visible.length - 1 ? 4 : 0} fill={s.color} />
              })}
              <text x={x(totals[i]!) + 6} y={cy + 4} fontSize="11.5" fontWeight="700" fill="#1f2937" fontFamily="system-ui, sans-serif">
                {fmt(totals[i]!)}
              </text>
            </g>
          )
        })}
        <line x1={labelW} x2={labelW} y1={4} y2={H - 4} stroke="#d1d5db" />
      </svg>
      <Tooltip tip={tip} width={W} height={H} />
    </div>
  )
}

/** Líneas para evolución en el tiempo, con marcadores y guía al pasar el mouse. */
function LineChart({ chart, svgRef, minW }: { chart: AiChart; svgRef: React.RefObject<SVGSVGElement | null>; minW: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const n = chart.categories.length
  const W = Math.max(minW, n * 64 + 70)
  const H = 260
  const left = 42
  const top = 18
  const bottom = 34
  const plotH = H - top - bottom
  const all = chart.series.flatMap((s) => s.values)
  const { top: yMax, step } = niceMax(Math.max(...all))
  const xAt = (i: number) => left + (n === 1 ? (W - left) / 2 : ((W - left - 24) * i) / (n - 1) + 12)
  const y = (v: number) => top + plotH - (v / yMax) * plotH
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  const tip: Tip =
    hover === null
      ? null
      : { x: xAt(hover), y: Math.min(...chart.series.map((s) => y(s.values[hover]!))), title: chart.categories[hover]!, lines: chart.series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover]! })) }
  return (
    <div className="relative overflow-x-auto">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" role="img" aria-label={chart.title} onMouseLeave={() => setHover(null)}>
        <rect width={W} height={H} fill="#ffffff" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - 8} y1={y(t)} y2={y(t)} stroke="#eef0f3" />
            <text x={left - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="#6b7280" fontFamily="system-ui, sans-serif">{fmt(t)}</text>
          </g>
        ))}
        {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={top} y2={top + plotH} stroke="#c7c9d1" strokeDasharray="3 3" />}
        {chart.series.map((s) => (
          <g key={s.name}>
            <polyline points={s.values.map((v, i) => `${xAt(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={xAt(i)} cy={y(v)} r={hover === i ? 5 : 4} fill={s.color} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        ))}
        {chart.categories.map((c, i) => (
          <g key={c} onMouseMove={() => setHover(i)}>
            <rect x={xAt(i) - (W - left) / n / 2} y={top} width={(W - left) / n} height={plotH + bottom} fill="transparent" />
            <text x={xAt(i)} y={H - 12} textAnchor="middle" fontSize="10.5" fill="#374151" fontFamily="system-ui, sans-serif">{c}</text>
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} width={W} height={H} />
    </div>
  )
}

