import { useState, type ReactNode } from 'react'
import { useQuery } from '@apollo/client/react'
import { Check, ChevronDown, Search, UserX } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { USERS } from '@/lib/graphql'
import { initials } from '@/lib/format'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Avatar con iniciales y color del usuario (sin tooltip, para usar dentro de menús). */
export function UserBadge({ user, className }: { user: Pick<User, 'name' | 'avatarColor'>; className?: string }) {
  return (
    <Avatar className={cn('size-7 ring-2 ring-white', className)}>
      <AvatarFallback className="text-[10px] font-semibold text-white" style={{ background: user.avatarColor }}>
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

/**
 * Selector de programador: lista con avatar, nombre y correo, con buscador.
 * `trigger` permite personalizar el botón (celda de tabla o campo de formulario).
 */
export function UserPicker({
  value,
  onChange,
  trigger,
  align = 'start',
  restrictTo,
}: {
  value: User | null
  onChange: (user: User | null) => void
  trigger?: ReactNode
  align?: 'start' | 'center' | 'end'
  /** Si se indica, solo se puede elegir a ese usuario (un programador solo se asigna a sí mismo) */
  restrictTo?: string
}) {
  const { data } = useQuery<{ users: User[] }>(USERS)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const users = (data?.users ?? [])
    .filter((u) => u.active)
    .filter((u) => !restrictTo || u.id === restrictTo)
    .filter((u) => !q.trim() || `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))

  const pick = (u: User | null) => {
    onChange(u)
    setOpen(false)
    setQ('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              'flex h-8 w-full items-center gap-2 rounded-md border border-border bg-white px-1.5 text-left text-xs outline-none hover:border-primary/50',
              open && 'border-primary ring-3 ring-primary/15'
            )}
            aria-label="Programador"
          >
            {value ? (
              <>
                <UserBadge user={value} className="size-6 ring-0" />
                <span className="flex-1 truncate font-medium">{value.name}</span>
              </>
            ) : (
              <>
                <span className="grid size-6 place-items-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/60">
                  <Search className="size-3" />
                </span>
                <span className="flex-1 truncate text-muted-foreground">Programador</span>
              </>
            )}
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-72 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar programador…"
            className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="scrollbar-thin max-h-72 overflow-y-auto p-1.5">
          {users.map((u) => {
            const selected = value?.id === u.id
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => pick(u)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted',
                  selected && 'bg-primary/8'
                )}
              >
                <UserBadge user={u} className="size-8 ring-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                </span>
                {selected && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
          {users.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Sin resultados</p>}
        </div>
        {value && (
          <div className="border-t p-1.5">
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <UserX className="size-4" /> Quitar programador
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
