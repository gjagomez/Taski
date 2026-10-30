import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@apollo/client/react'
import { Check, CircleUserRound, Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/common'
import { useAssignRestriction } from '@/lib/auth'
import { USERS } from '@/lib/graphql'
import { fmtDate } from '@/lib/format'
import type { SubitemStatus, User, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SUBITEM_STATUS, SUBITEM_STATUS_ORDER } from './meta'
import { ReopenDialog } from './ReopenDialog'

/** Texto editable en línea: clic para editar, Enter/blur guarda, Esc cancela. */
export function EditableText({
  value,
  onSave,
  placeholder = '',
  required = false,
  type = 'text',
  className,
}: {
  value: string | null
  onSave: (value: string) => void
  placeholder?: string
  required?: boolean
  type?: 'text' | 'number'
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (required && !next) return setDraft(value ?? '')
    if (next !== (value ?? '').trim()) onSave(next)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type={type}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 0.5 : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value ?? '')
            setEditing(false)
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className={cn('h-8 w-full rounded-md border border-primary bg-white px-2 text-sm outline-none ring-3 ring-primary/15', className)}
      />
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className={cn('h-8 w-full truncate rounded-md border border-transparent px-2 text-left text-sm hover:border-border', className)}
      title={value ?? undefined}
    >
      {value || <span className="text-muted-foreground/50">{placeholder}</span>}
    </button>
  )
}

function useUsers() {
  const { data } = useQuery<{ users: User[] }>(USERS)
  return (data?.users ?? []).filter((u) => u.active)
}

/**
 * Asignación múltiple (columna "Asignación" del elemento). Un programador solo puede agregarse a sí mismo
 * (no agrega ni quita a otros, ni se quita); la regla la valida el servidor en wsWorkflow.js.
 */
export function PeopleCell({ people, onChange }: { people: User[]; onChange: (ids: string[]) => void }) {
  const restrictTo = useAssignRestriction()
  const users = useUsers().filter((u) => !restrictTo || u.id === restrictTo)
  const ids = new Set(people.map((p) => p.id))
  const toggle = (id: string) => {
    const next = new Set(ids)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group/people flex h-full w-full items-center justify-center hover:bg-muted/60" aria-label="Asignar personas">
        <PeopleStack people={people} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel>Asignar personas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <DropdownMenuCheckboxItem
            key={u.id}
            checked={ids.has(u.id)}
            disabled={!!restrictTo && ids.has(u.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => toggle(u.id)}
          >
            <UserAvatar user={u} className="size-6" />
            {u.name}
          </DropdownMenuCheckboxItem>
        ))}
        {restrictTo && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Solo puedes asignarte a ti mismo. Un administrador asigna a otras personas.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function PeopleStack({ people }: { people: User[] }) {
  if (!people.length) {
    return (
      <span className="relative text-muted-foreground/40">
        <CircleUserRound className="size-7 stroke-[1.4]" />
        <Plus className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-primary text-white opacity-0 group-hover/people:opacity-100" />
      </span>
    )
  }
  return (
    <span className="flex -space-x-2">
      {people.slice(0, 2).map((p) => (
        <UserAvatar key={p.id} user={p} className="size-7" />
      ))}
      {people.length > 2 && (
        <span className="grid size-7 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background ring-2 ring-white">
          +{people.length - 2}
        </span>
      )}
    </span>
  )
}

/** Asignación única (subelementos). */
export function PersonCell({
  person,
  onChange,
  showName = false,
}: {
  person: User | null
  onChange: (id: string | null) => void
  showName?: boolean
}) {
  const users = useUsers()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn('group/people flex h-full w-full items-center gap-2 hover:bg-muted/60', showName ? 'justify-start px-2' : 'justify-center')}
        aria-label="Asignar responsable"
      >
        <PeopleStack people={person ? [person] : []} />
        {showName && (
          <span className={cn('truncate text-xs', person ? 'text-foreground' : 'text-muted-foreground/60')}>
            {person ? person.name.split(' ')[0] : 'Asignar'}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Responsable</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => onChange(u.id)}>
            <UserAvatar user={u} className="size-6" />
            <span className="flex-1">{u.name}</span>
            {person?.id === u.id && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
        {person && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(null)}>Quitar responsable</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Celda de estado a color completo (Etapa / Estado), con selector de opciones. */
export function StatusCell<T extends string>({
  label,
  color,
  options,
  onChange,
}: {
  label: string
  color: string
  options: { value: T; label: string; color: string }[]
  onChange: (value: T) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-full w-full items-center justify-center px-2 text-[13px] font-medium text-white transition hover:brightness-95"
        style={{ background: color }}
      >
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52 space-y-1 p-2">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={() => onChange(o.value)}
            className="justify-center rounded-md py-2 font-medium text-white focus:text-white focus:brightness-95"
            style={{ background: o.color }}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Estado de una tarea: solo ofrece los movimientos permitidos por el flujo (los calcula el servidor).
 * Reabrir una subtarea Finalizada (solo administrador) pide un motivo opcional antes de guardar.
 */
export function SubitemStatusCell({
  status,
  allowed,
  taskName,
  onChange,
}: {
  status: SubitemStatus
  allowed: SubitemStatus[]
  taskName: string
  onChange: (s: SubitemStatus, reason?: string) => Promise<unknown> | void
}) {
  const [reopening, setReopening] = useState(false)
  const meta = SUBITEM_STATUS[status]
  if (!allowed.length) {
    return (
      <div
        className="flex h-full w-full items-center justify-center gap-1 px-2 text-[13px] font-medium text-white"
        style={{ background: meta.color }}
        title={status === 'DONE' ? 'Finalizada: solo un administrador puede reabrirla' : status === 'PENDING' ? 'Asigna un programador para iniciarla' : 'Sin movimientos disponibles'}
      >
        {status === 'DONE' && <Check className="size-3.5" />}
        <span className="truncate">{meta.label}</span>
      </div>
    )
  }
  return (
    <>
      <StatusCell
        label={meta.label}
        color={meta.color}
        options={SUBITEM_STATUS_ORDER.filter((s) => allowed.includes(s)).map((s) => ({ value: s, ...SUBITEM_STATUS[s] }))}
        onChange={(to) => (status === 'DONE' ? setReopening(true) : onChange(to))}
      />
      <ReopenDialog taskName={taskName} open={reopening} onOpenChange={setReopening} onConfirm={(reason) => onChange('IN_PROGRESS', reason)} />
    </>
  )
}

/** Fecha en forma de "píldora": verde ✓ si está finalizado, roja ! si está vencida. */
export function DateCell({
  value,
  done = false,
  overdue = false,
  min,
  max,
  onChange,
}: {
  value: string | null
  done?: boolean
  overdue?: boolean
  min?: string | null
  max?: string | null
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="relative flex h-full w-full items-center justify-center px-2">
      <button
        type="button"
        onClick={() => ref.current?.showPicker?.()}
        className={cn(
          'flex h-6 min-w-24 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition',
          !value && 'text-muted-foreground/50 hover:bg-muted',
          value && done && 'bg-emerald-500 text-white',
          value && !done && overdue && 'bg-rose-500 text-white',
          value && !done && !overdue && 'bg-slate-100 text-foreground hover:bg-slate-200'
        )}
      >
        {value && done && <Check className="size-3.5" />}
        {value && !done && overdue && <span className="font-bold">!</span>}
        {value ? fmtDate(value, 'd MMM') : 'Fecha'}
      </button>
      <input
        ref={ref}
        type="date"
        value={value ?? ''}
        min={min ?? undefined}
        max={max ?? undefined}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
        aria-label="Fecha"
      />
    </div>
  )
}

/** Barra de progreso por estado de subelementos (estilo "battery" de Monday). */
export function Battery({ subitems, className }: { subitems: Pick<WsSubitem, 'status'>[]; className?: string }) {
  const total = subitems.length
  const done = subitems.filter((s) => s.status === 'DONE').length
  return (
    <div className={cn('flex w-full items-center gap-2 px-3', className)}>
      <div className="flex h-4 flex-1 overflow-hidden rounded-sm bg-slate-200">
        {total > 0 &&
          SUBITEM_STATUS_ORDER.map((s) => {
            const n = subitems.filter((x) => x.status === s).length
            return n ? (
              <div key={s} title={`${SUBITEM_STATUS[s].label}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: SUBITEM_STATUS[s].color }} />
            ) : null
          })}
      </div>
      <span className="w-9 text-right text-xs font-medium text-muted-foreground">{total ? Math.round((done / total) * 100) : 0}%</span>
    </div>
  )
}
