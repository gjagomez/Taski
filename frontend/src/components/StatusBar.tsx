import { STATUS_META } from '@/lib/format'
import type { Stats, Status } from '@/lib/types'

const SEGMENTS: [Status, keyof Stats][] = [
  ['DONE', 'done'],
  ['REVIEW', 'review'],
  ['IN_PROGRESS', 'inProgress'],
  ['BACKLOG', 'backlog'],
]

/** Barra apilada por estado, estilo "battery" de Monday. */
export function StatusBar({ stats, className = 'h-2.5' }: { stats: Stats; className?: string }) {
  return (
    <div className={`flex gap-0.5 overflow-hidden rounded-full bg-secondary ${className}`}>
      {stats.total > 0 &&
        SEGMENTS.map(([status, key]) =>
          stats[key] ? (
            <div
              key={status}
              title={`${STATUS_META[status].label}: ${stats[key]}`}
              className="h-full transition-all"
              style={{ width: `${((stats[key] as number) / stats.total) * 100}%`, background: STATUS_META[status].color }}
            />
          ) : null
        )}
    </div>
  )
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {SEGMENTS.map(([status]) => (
        <span key={status} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: STATUS_META[status].color }} />
          {STATUS_META[status].label}
        </span>
      ))}
    </div>
  )
}
