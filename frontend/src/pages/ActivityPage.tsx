import { Link } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { History } from 'lucide-react'
import { Panel } from '@/components/AppLayout'
import { EmptyState, Loading, PageHeader, UserAvatar } from '@/components/common'
import { WS_ACTIVITY } from '@/lib/graphql'
import { fmtDateTime, toDate } from '@/lib/format'
import type { User } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityEntry {
  id: string
  detail: string
  createdAt: string
  itemId: string
  itemName: string
  boardId: string
  boardName: string
  user: User
}

// El registro guarda frases; la categoría se deduce del verbo con que empieza
const KINDS: { test: RegExp; label: string; tone: string }[] = [
  { test: /^Creó/, label: 'Creación', tone: 'bg-violet-100 text-violet-700' },
  { test: /^Cambió la etapa/, label: 'Etapa', tone: 'bg-amber-100 text-amber-700' },
  { test: /^Aprobó la revisión|pasó a Finalizado/, label: 'Completada', tone: 'bg-emerald-100 text-emerald-700' },
  { test: /^QA rechazó/, label: 'Rechazo QA', tone: 'bg-rose-100 text-rose-700' },
  { test: /envió a revisión/, label: 'Revisión', tone: 'bg-sky-100 text-sky-700' },
  { test: /^Movió|pasó a/, label: 'Estado', tone: 'bg-sky-100 text-sky-700' },
  { test: /^Asignó/, label: 'Asignación', tone: 'bg-sky-100 text-sky-700' },
  { test: /archivo/, label: 'Archivo', tone: 'bg-rose-100 text-rose-700' },
  { test: /subelemento/, label: 'Subtarea', tone: 'bg-indigo-100 text-indigo-700' },
  { test: /^Actualizó/, label: 'Edición', tone: 'bg-slate-100 text-slate-700' },
]
const kindOf = (detail: string) => KINDS.find((k) => k.test.test(detail)) ?? { label: 'Actividad', tone: 'bg-muted text-muted-foreground' }

export default function ActivityPage() {
  const { data, loading } = useQuery<{ wsActivity: ActivityEntry[] }>(WS_ACTIVITY, { variables: { limit: 200 }, fetchPolicy: 'cache-and-network' })

  const groups = new Map<string, ActivityEntry[]>()
  for (const a of data?.wsActivity ?? []) {
    const key = format(toDate(a.createdAt), "EEEE d 'de' MMMM", { locale: es })
    groups.set(key, [...(groups.get(key) ?? []), a])
  }

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <PageHeader title="Actividad" subtitle="Registro de trazabilidad de los proyectos: quién creó, asignó, cambió de etapa o estado y subió evidencias, y cuándo." />
      {loading && !data ? (
        <Loading />
      ) : groups.size === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<History />} title="Sin actividad todavía">Los cambios en los proyectos aparecerán aquí.</EmptyState>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-bold text-muted-foreground first-letter:uppercase">{day}</h2>
              <ul className="divide-y rounded-3xl border">
                {items.map((a) => {
                  const kind = kindOf(a.detail)
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                      <UserAvatar user={a.user} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <b>{a.user.name}</b> · {a.detail}
                        </p>
                        <Link to={`/proyectos/${a.boardId}`} className="text-xs font-medium text-primary hover:underline">
                          {a.itemName} <span className="text-muted-foreground">— {a.boardName}</span>
                        </Link>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${kind.tone}`}>{kind.label}</span>
                      <span className="w-36 text-right text-xs text-muted-foreground">{fmtDateTime(a.createdAt)}</span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  )
}
