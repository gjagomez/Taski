import { addDays, differenceInCalendarDays, format, isWeekend } from 'date-fns'
import { es as esDates } from 'date-fns/locale'
import { UserX } from 'lucide-react'
import { formatRange } from './DateRangeCell'
import { SUBITEM_STATUS, SUBITEM_STATUS_ORDER } from './meta'
import { BugTag, QaTag } from './SubitemKanban'
import { UserBadge } from './UserPicker'
import type { User, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'

export type GanttLane = { key: string; user: User | null; tasks: WsSubitem[]; label?: string }

const DAY = 30
const LABEL = 220

const parse = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/** Inicio y fin de la barra: con una sola fecha, la tarea ocupa ese día. */
function span(t: WsSubitem) {
  const a = t.startDate ?? t.dueDate
  const b = t.dueDate ?? t.startDate
  return a && b ? { start: parse(a), end: parse(b) } : null
}

/**
 * Diagrama de Gantt de las subtareas de un proyecto: un bloque por persona (programador o QA) y una barra
 * por tarea según sus fechas, coloreada por estado. Las pruebas de QA llevan la marca "QA".
 */
export function SubitemGantt({ lanes, onOpen, emptyText }: { lanes: GanttLane[]; onOpen: (t: WsSubitem) => void; emptyText: string }) {
  const spans = lanes.flatMap((l) => l.tasks.map(span)).filter((s) => s !== null)
  if (!lanes.some((l) => l.tasks.length)) return <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyText}</p>

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Rango visible: todas las tareas con fechas y hoy, con un margen a cada lado
  const first = addDays(new Date(Math.min(today.getTime(), ...spans.map((s) => s.start.getTime()))), -2)
  const last = addDays(new Date(Math.max(today.getTime(), ...spans.map((s) => s.end.getTime()))), 3)
  const days = Array.from({ length: differenceInCalendarDays(last, first) + 1 }, (_, i) => addDays(first, i))
  const offset = (d: Date) => differenceInCalendarDays(d, first) * DAY
  const width = days.length * DAY
  const months = days.reduce<{ label: string; days: number }[]>((acc, d) => {
    const label = format(d, 'MMMM yyyy', { locale: esDates })
    if (acc.at(-1)?.label === label) acc.at(-1)!.days++
    else acc.push({ label, days: 1 })
    return acc
  }, [])

  return (
    <div className="rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <div style={{ width: LABEL + width }} className="relative text-xs">
          {/* Encabezado: meses y días */}
          <div className="sticky top-0 z-20 flex border-b bg-white">
            <div style={{ width: LABEL }} className="sticky left-0 z-10 flex shrink-0 items-end border-r bg-white px-3 pb-1.5 font-semibold text-muted-foreground">
              Tarea
            </div>
            <div>
              <div className="flex">
                {months.map((m) => (
                  <div key={m.label} style={{ width: m.days * DAY }} className="truncate border-l px-2 pt-1.5 font-semibold capitalize">
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="flex">
                {days.map((d) => (
                  <div
                    key={d.getTime()}
                    style={{ width: DAY }}
                    className={cn(
                      'py-1 text-center text-[10px] text-muted-foreground',
                      isWeekend(d) && 'bg-slate-50',
                      d.getTime() === today.getTime() && 'font-bold text-primary'
                    )}
                  >
                    {format(d, 'd')}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fondo: fines de semana y línea de hoy */}
          <div className="pointer-events-none absolute inset-y-0 flex" style={{ left: LABEL }}>
            {days.map((d) => (
              <div key={d.getTime()} style={{ width: DAY }} className={cn('h-full', isWeekend(d) && 'bg-slate-50/70')} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-primary/60" style={{ left: LABEL + offset(today) + DAY / 2 }} />

          {lanes.map((lane) => (
            <div key={lane.key}>
              <div className="relative flex border-t bg-secondary/40">
                <div style={{ width: LABEL }} className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-secondary px-3 py-1.5">
                  {lane.user ? (
                    <UserBadge user={lane.user} className="size-6 ring-0" />
                  ) : (
                    <span className="grid size-6 place-items-center rounded-full border border-dashed text-muted-foreground">
                      <UserX className="size-3" />
                    </span>
                  )}
                  <span className="truncate font-semibold">{lane.user?.name ?? 'Sin programador'}</span>
                  {lane.label && <span className="ml-auto shrink-0 text-[10px] font-semibold text-muted-foreground">{lane.label}</span>}
                </div>
              </div>
              {lane.tasks.map((t) => {
                const s = span(t)
                return (
                  <div key={t.id} className="relative flex border-t border-dashed border-slate-100">
                    <button
                      onClick={() => onOpen(t)}
                      style={{ width: LABEL }}
                      className="sticky left-0 z-10 flex shrink-0 items-center gap-1 truncate border-r bg-white px-3 py-2 text-left hover:text-primary"
                    >
                      {t.kind === 'QA' && <QaTag />}
                      {t.kind === 'BUG' && <BugTag severity={t.severity} />}
                      <span className={cn('truncate', t.status === 'DONE' && 'text-muted-foreground line-through')}>{t.name}</span>
                    </button>
                    <div className="relative h-9" style={{ width }}>
                      {s ? (
                        <button
                          onClick={() => onOpen(t)}
                          title={`${t.name} · ${formatRange(t.startDate, t.dueDate)} · ${SUBITEM_STATUS[t.status].label}`}
                          className={cn(
                            'absolute top-1.5 flex h-6 items-center gap-1 overflow-hidden rounded-md px-1.5 text-[11px] font-medium text-white shadow-sm transition hover:brightness-105',
                            t.kind === 'QA' && 'ring-2 ring-sky-500 ring-offset-1',
                            t.kind === 'BUG' && 'ring-2 ring-rose-500 ring-offset-1',
                            t.isOverdue && 'ring-2 ring-rose-500 ring-offset-1'
                          )}
                          style={{ left: offset(s.start) + 2, width: (differenceInCalendarDays(s.end, s.start) + 1) * DAY - 4, background: SUBITEM_STATUS[t.status].color }}
                        >
                          <span className="truncate">{t.name}</span>
                        </button>
                      ) : (
                        <span className="absolute top-2.5 left-2 text-[11px] text-muted-foreground">Sin fechas</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
        {SUBITEM_STATUS_ORDER.map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: SUBITEM_STATUS[st].color }} /> {SUBITEM_STATUS[st].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <QaTag /> Prueba de QA
        </span>
        <span className="flex items-center gap-1.5">
          <BugTag severity={null} /> Bug reportado por QA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-primary/60" /> Hoy
        </span>
      </div>
    </div>
  )
}
