import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { SubitemStatus } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SUBITEM_STATUS, SUBITEM_STATUS_ORDER } from './meta'

const HINT: Record<SubitemStatus, string> = {
  PENDING: 'Aún no inicia',
  IN_PROGRESS: 'Se está trabajando (requiere programador)',
  DONE: 'Terminada',
}

/** Selector de estado con colores (mismo estilo que el selector de programador). */
export function StatusPicker({
  value,
  onChange,
  options = SUBITEM_STATUS_ORDER,
}: {
  value: SubitemStatus
  onChange: (s: SubitemStatus) => void
  options?: SubitemStatus[]
}) {
  const [open, setOpen] = useState(false)
  const current = SUBITEM_STATUS[value]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Estado"
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-xs font-semibold text-white shadow-sm transition outline-none hover:brightness-95',
            open && 'ring-3 ring-primary/20'
          )}
          style={{ background: current.color }}
        >
          <span className="size-2 rounded-full bg-white/80" />
          <span className="flex-1 truncate text-left">{current.label}</span>
          <ChevronDown className="size-3.5 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1.5">
        <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Estado de la tarea</p>
        {options.map((s) => {
          const meta = SUBITEM_STATUS[s]
          const selected = s === value
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
              className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted', selected && 'bg-muted/70')}
            >
              <span className="grid size-8 place-items-center rounded-lg text-white" style={{ background: meta.color }}>
                {selected ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-white/80" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{HINT[s]}</span>
              </span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
