import type { ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { initials, PRIORITY_META, STATUS_META } from '@/lib/format'
import type { Priority, Status, User } from '@/lib/types'

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  const accent = light ? '#ddd6fe' : 'var(--primary)'
  return (
    <div className={cn('flex items-center gap-2.5', light ? 'text-white' : 'text-foreground', className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <g fill="none" stroke="currentColor" strokeWidth="3.2">
          <circle cx="9" cy="9" r="5" />
          <circle cx="23" cy="9" r="5" />
          <circle cx="9" cy="23" r="5" />
          <circle cx="23" cy="23" r="5" stroke={accent} />
        </g>
      </svg>
      <span className="text-xl font-bold tracking-tight">
        taski<span style={{ color: accent }}>task</span>
      </span>
    </div>
  )
}

export function UserAvatar({ user, className }: { user: Pick<User, 'name' | 'avatarColor'>; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={cn('size-8 ring-2 ring-white', className)}>
          <AvatarFallback className="text-[11px] font-semibold text-white" style={{ background: user.avatarColor }}>
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{user.name}</TooltipContent>
    </Tooltip>
  )
}

export function AvatarStack({ users, max = 4, className }: { users: User[]; max?: number; className?: string }) {
  const rest = users.length - max
  return (
    <div className={cn('flex -space-x-2', className)}>
      {users.slice(0, max).map((u) => (
        <UserAvatar key={u.id} user={u} className="size-9" />
      ))}
      {rest > 0 && (
        <div className="grid size-9 place-items-center rounded-full bg-foreground text-xs font-semibold text-background ring-2 ring-white">
          {rest}+
        </div>
      )}
    </div>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', m.className)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const m = STATUS_META[status]
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold text-white', className)}
      style={{ background: m.color }}
    >
      {m.label}
    </span>
  )
}

export function BugBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
      Bug
    </span>
  )
}

export function ProgressRing({ value, size = 44, light = false }: { value: number; size?: number; light?: boolean }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill={light ? 'rgba(255,255,255,.15)' : '#fff'} stroke={light ? 'rgba(255,255,255,.3)' : '#ede9fe'} strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={light ? '#fff' : value >= 100 ? '#10b981' : '#f59e0b'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(value, 100)) / 100}
          className="transition-all duration-500"
        />
      </svg>
      <span className={cn('absolute text-xs font-bold', light ? 'text-white' : 'text-foreground')}>{value}</span>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-primary/25 bg-secondary/40 px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white text-primary shadow-sm">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="grid h-64 place-items-center">
      <div className="size-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  )
}
