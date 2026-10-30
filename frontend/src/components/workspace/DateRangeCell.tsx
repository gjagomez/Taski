import { useState } from 'react'
import { format } from 'date-fns'
import { es as esDates } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { HOURS_PER_DAY, workingDays } from './meta'

const parse = (v: string | null) => {
  if (!v) return undefined
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
const iso = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : '')

/** "19 – 23 oct", "28 oct – 3 nov" o una sola fecha. */
export function formatRange(start: string | null, end: string | null) {
  const a = parse(start)
  const b = parse(end)
  if (a && b) {
    if (iso(a) === iso(b)) return format(a, 'd MMM', { locale: esDates })
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
      return `${format(a, 'd')} – ${format(b, 'd MMM', { locale: esDates })}`
    return `${format(a, 'd MMM', { locale: esDates })} – ${format(b, 'd MMM', { locale: esDates })}`
  }
  if (a) return `Desde ${format(a, 'd MMM', { locale: esDates })}`
  if (b) return `Hasta ${format(b, 'd MMM', { locale: esDates })}`
  return null
}

/**
 * Selector de rango (fecha inicio + fecha final) en un solo calendario.
 * `variant="cell"` se usa dentro de la tabla; `variant="field"` en la fila de alta.
 */
export function DateRangeCell({
  start,
  end,
  onChange,
  done = false,
  overdue = false,
  variant = 'cell',
}: {
  start: string | null
  end: string | null
  onChange: (start: string, end: string) => void
  done?: boolean
  overdue?: boolean
  variant?: 'cell' | 'field'
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const label = formatRange(start, end)

  const draftDays = workingDays(iso(draft?.from) || null, iso(draft?.to) || null)

  function openChange(next: boolean) {
    if (next) setDraft(start || end ? { from: parse(start), to: parse(end) } : undefined)
    setOpen(next)
  }

  function apply() {
    if (!draft?.from) return
    onChange(iso(draft.from), iso(draft.to ?? draft.from))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        {variant === 'cell' ? (
          <button type="button" className="flex h-full w-full items-center justify-center px-2" aria-label="Elegir fechas">
            <span
              className={cn(
                'flex h-6 min-w-28 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition',
                !label && 'text-muted-foreground/50 hover:bg-muted',
                label && done && 'bg-emerald-500 text-white',
                label && !done && overdue && 'bg-rose-500 text-white',
                label && !done && !overdue && 'bg-slate-100 text-foreground hover:bg-slate-200'
              )}
            >
              {label && done && <Check className="size-3.5" />}
              {label && !done && overdue && <span className="font-bold">!</span>}
              {label ?? 'Fechas'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              'flex h-8 w-full items-center gap-2 rounded-md border border-border bg-white px-2 text-xs outline-none hover:border-primary/50',
              open && 'border-primary'
            )}
            aria-label="Elegir fecha de inicio y final"
          >
            <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
            <span className={cn('truncate', !label && 'text-muted-foreground')}>{label ?? 'Inicio – fin'}</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <div className="flex items-center justify-between gap-6 border-b px-4 py-3 text-sm">
          <div>
            <p className="text-[11px] text-muted-foreground">Fecha inicio</p>
            <p className="font-semibold">{draft?.from ? format(draft.from, "d 'de' MMM yyyy", { locale: esDates }) : '—'}</p>
          </div>
          <span className="text-muted-foreground">→</span>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Fecha final</p>
            <p className="font-semibold">{draft?.to ? format(draft.to, "d 'de' MMM yyyy", { locale: esDates }) : '—'}</p>
          </div>
        </div>
        <Calendar
          mode="range"
          locale={es}
          numberOfMonths={2}
          showOutsideDays={false}
          defaultMonth={draft?.from ?? new Date()}
          selected={draft}
          onSelect={setDraft}
          resetOnSelect
        />
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {draftDays !== null ? (
              <>
                <b className="text-primary">{draftDays * HOURS_PER_DAY} h</b> · {draftDays} día(s) hábil(es)
              </>
            ) : (
              'Elige el día de inicio y el día final'
            )}
          </p>
          <div className="flex gap-2">
            {(start || end) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange('', '')
                  setOpen(false)
                }}
              >
                Limpiar
              </Button>
            )}
            <Button size="sm" className="rounded-full" disabled={!draft?.from} onClick={apply}>
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
