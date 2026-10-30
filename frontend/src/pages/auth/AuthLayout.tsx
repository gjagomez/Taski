import type { ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/common'
import heroImg from '@/img/TaskiTask.svg'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2.5rem] bg-white/90 shadow-2xl shadow-primary/15 backdrop-blur lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#7b6cf6] via-[#6d5df6] to-[#5a47e8] p-10 text-white lg:flex">
          <Logo light />
          <img src={heroImg} alt="" className="mx-auto w-full max-w-sm drop-shadow-2xl" />
          <div>
            <h2 className="text-3xl leading-tight font-bold">Gestiona proyectos con calidad.</h2>
            <ul className="mt-4 space-y-2 text-sm text-violet-100">
              {['Tableros Kanban con flujo controlado', 'Subtareas, checklist y trazabilidad', 'Dashboard basado en evidencia'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-12">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

export function FieldError({ children }: { children?: string | null }) {
  if (!children) return null
  return <p className="text-xs font-medium text-destructive">{children}</p>
}
