import { Check, X } from 'lucide-react'
import { passwordChecks } from '@/lib/format'
import { cn } from '@/lib/utils'

export function PasswordStrength({ password }: { password: string }) {
  const checks = passwordChecks(password)
  const score = checks.filter((c) => c.ok).length
  const color = score <= 2 ? 'bg-rose-500' : score <= 4 ? 'bg-amber-500' : 'bg-emerald-500'
  const label = score <= 2 ? 'Débil' : score <= 4 ? 'Media' : 'Fuerte'
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {checks.map((_, i) => (
            <div key={i} className={cn('h-1.5 flex-1 rounded-full bg-muted', i < score && color)} />
          ))}
        </div>
        {password && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={cn('flex items-center gap-1 text-[11px]', c.ok ? 'text-emerald-600' : 'text-muted-foreground')}>
            {c.ok ? <Check className="size-3" /> : <X className="size-3" />} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export const isStrong = (password: string) => passwordChecks(password).every((c) => c.ok)
