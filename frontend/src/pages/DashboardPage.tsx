import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  KanbanSquare,
  LayoutList,
  Paperclip,
  Search,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Panel } from '@/components/AppLayout'
import { Loading, UserAvatar } from '@/components/common'
import heroImg from '@/img/TaskiTask.svg'
import { formatRange } from '@/components/workspace/DateRangeCell'
import { BUG_SEVERITY, SUBITEM_STATUS } from '@/components/workspace/meta'
import { DASHBOARD, WS_DASHBOARD } from '@/lib/graphql'
import { useAuth } from '@/lib/auth'
import { FEATURES } from '@/lib/features'
import { fmtDate, fromNow, toDate, lowerFirst } from '@/lib/format'
import type { BugSeverity, Stats, SubitemStatus, User, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface AgendaEntry {
  itemId: string
  itemName: string
  boardId: string
  boardName: string
  subitem: Pick<WsSubitem, 'id' | 'name' | 'status' | 'startDate' | 'dueDate' | 'hours' | 'assignee'>
}

interface WsDashboardData {
  wsDashboard: {
    totals: {
      boards: number
      items: number
      subitems: number
      subitemsDone: number
      hoursPlanned: number
      hoursDone: number
      overdue: number
      files: number
      completionRate: number
    }
    bugs: {
      total: number
      open: number
      toVerify: number
      verified: number
      reopens: number
      reopenRate: number
      bySeverity: { severity: BugSeverity; count: number }[]
      byDeveloper: { user: User; total: number; open: number; reopens: number }[]
    }
    byStage: { name: string; color: string; items: number }[]
    byStatus: { status: SubitemStatus; count: number; hours: number }[]
    workload: {
      user: User
      tasks: number
      overdue: number
      hoursPending: number
      hoursInProgress: number
      hoursDone: number
    }[]
    boards: {
      board: { id: string; name: string; folder: string | null }
      items: number
      subitems: number
      subitemsDone: number
      hours: number
      overdue: number
      progress: number
    }[]
    upcoming: AgendaEntry[]
    overdue: AgendaEntry[]
    recentActivity: { id: string; detail: string; createdAt: string; itemId: string; itemName: string; boardId: string; user: User }[]
  }
}

const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useQuery<WsDashboardData>(WS_DASHBOARD)
  const { data: kanban } = useQuery<{ dashboard: { stats: Stats } }>(DASHBOARD, { skip: !FEATURES.kanban })
  const [search, setSearch] = useState('')

  if (loading && !data) return <Panel><Loading /></Panel>
  if (!data) return null
  const { totals, bugs, byStage, byStatus, workload, boards, upcoming, overdue, recentActivity } = data.wsDashboard

  const tiles = [
    {
      label: 'Proyectos',
      value: totals.items,
      hint: `en ${totals.boards} tablero(s)`,
      icon: FolderKanban,
      tone: 'bg-violet-100 text-violet-600',
    },
    {
      label: 'Subtareas finalizadas',
      value: `${totals.subitemsDone}/${totals.subitems}`,
      hint: `${totals.completionRate}% de avance`,
      icon: CheckCircle2,
      tone: 'bg-emerald-100 text-emerald-600',
      progress: totals.completionRate,
    },
    {
      label: 'Horas laborales',
      value: fmtHours(totals.hoursPlanned),
      hint: `${fmtHours(totals.hoursDone)} completadas`,
      icon: Timer,
      tone: 'bg-sky-100 text-sky-600',
      progress: totals.hoursPlanned ? Math.round((totals.hoursDone / totals.hoursPlanned) * 100) : 0,
    },
    {
      label: 'Subtareas vencidas',
      value: totals.overdue,
      hint: totals.overdue ? 'requieren atención' : 'todo al día',
      icon: AlertTriangle,
      tone: totals.overdue ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500',
    },
  ]

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel>
        {/* Hero */}
        <section className="relative grid items-center gap-4 overflow-hidden md:grid-cols-[1fr_260px]">
          <div className="relative z-10">
            <p className="text-sm font-medium text-muted-foreground">Hola, {user?.name.split(' ')[0]}</p>
            <h1 className="mt-2 text-4xl leading-[1.1] font-extrabold tracking-tight">Tu portafolio de proyectos.</h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              {totals.items} proyectos en {totals.boards} tableros · {totals.completionRate}% de las subtareas finalizadas
              {totals.files > 0 && ` · ${totals.files} archivos de evidencia`}.
            </p>
            <Button size="lg" className="mt-5 h-12 rounded-2xl px-6 shadow-xl shadow-primary/30" onClick={() => navigate('/proyectos')}>
              Ver proyectos <ArrowRight />
            </Button>
          </div>
          <img src={heroImg} alt="" className="mx-auto hidden w-full max-w-[260px] drop-shadow-2xl md:block" />
        </section>

        {/* Indicadores */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map(({ label, value, hint, icon: Icon, tone, progress }) => (
            <div key={label} className="rounded-3xl border bg-white p-4">
              <div className={cn('mb-3 grid size-10 place-items-center rounded-2xl', tone)}>
                <Icon className="size-5" />
              </div>
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
              {progress !== undefined && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Etapas y estados */}
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <Card title="Proyectos por etapa" subtitle="Todos los tableros">
            <StageBars stages={byStage} />
          </Card>
          <Card title="Subtareas por estado" subtitle={`${totals.subitems} subtareas · ${fmtHours(totals.hoursPlanned)}`}>
            <StatusBreakdown items={byStatus} />
          </Card>
        </section>

        {/* Carga por programador */}
        <section className="mt-5">
          <Card title="Carga por programador" subtitle="Horas laborales asignadas en subtareas" legend>
            <Workload rows={workload} />
          </Card>
        </section>

        {/* Calidad: bugs reportados por QA */}
        {bugs.total > 0 && (
          <section className="mt-5">
            <Card title="Calidad: bugs reportados por QA" subtitle={`${bugs.total} bug(s) · ${bugs.reopenRate}% tuvo que reabrirse al menos una vez`}>
              <BugQuality bugs={bugs} />
            </Card>
          </section>
        )}

        {/* Avance por tablero */}
        <section className="mt-5">
          <Card title="Avance por tablero" subtitle="Decisiones basadas en evidencia (ISO 9001)">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-5 py-2.5 font-medium">Tablero</th>
                    <th className="px-3 py-2.5 text-right font-medium">Proyectos</th>
                    <th className="px-3 py-2.5 text-right font-medium">Subtareas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Horas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Vencidas</th>
                    <th className="w-52 px-5 py-2.5 font-medium">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {boards.map((b) => (
                    <tr key={b.board.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Link to={`/proyectos/${b.board.id}`} className="flex items-center gap-2 font-semibold hover:text-primary">
                          <LayoutList className="size-4 text-primary" />
                          {b.board.name}
                          {b.board.folder && <span className="text-xs font-normal text-muted-foreground">· {b.board.folder}</span>}
                        </Link>
                      </td>
                      <td className="px-3 text-right tabular-nums">{b.items}</td>
                      <td className="px-3 text-right tabular-nums">
                        {b.subitemsDone}/{b.subitems}
                      </td>
                      <td className="px-3 text-right tabular-nums">{fmtHours(b.hours)}</td>
                      <td className="px-3 text-right">
                        {b.overdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            <AlertTriangle className="size-3" /> {b.overdue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${b.progress}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs font-semibold tabular-nums">{b.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Flujo de calidad (Kanban) */}
        {kanban && (
          <section className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-3xl bg-secondary/60 px-5 py-4">
            <div className="flex items-center gap-2">
              <KanbanSquare className="size-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Flujo de calidad (Kanban)</p>
                <p className="text-xs text-muted-foreground">Tareas con reglas de transición</p>
              </div>
            </div>
            {[
              ['Total', kanban.dashboard.stats.total],
              ['Completadas', kanban.dashboard.stats.done],
              ['En progreso', kanban.dashboard.stats.inProgress],
              ['En revisión', kanban.dashboard.stats.review],
              ['Vencidas', kanban.dashboard.stats.overdue],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-lg font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
            <Button asChild variant="outline" size="sm" className="ml-auto rounded-full">
              <Link to="/kanban">
                Ver tableros Kanban <ArrowRight />
              </Link>
            </Button>
          </section>
        )}
      </Panel>

      {/* Panel derecho */}
      <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <div className="flex items-center gap-3 px-1">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault()
              const q = search.trim().toLowerCase()
              const match = boards.find((b) => b.board.name.toLowerCase().includes(q))
              if (match) navigate(`/proyectos/${match.board.id}`)
            }}
          >
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tablero" className="h-11 rounded-2xl border-white/70 bg-white/60 pl-9 backdrop-blur" />
          </form>
          {user && <UserAvatar user={user} className="size-11" />}
        </div>

        <div className="rounded-[2rem] bg-white/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Próximas entregas</h3>
            <span className="text-xs text-muted-foreground">{format(new Date(), "EEEE d 'de' MMM", { locale: es })}</span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {upcoming.map((e) => (
              <AgendaRow key={e.subitem.id} entry={e} />
            ))}
            {upcoming.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Sin entregas próximas 🎉</p>}
          </ul>
        </div>

        {overdue.length > 0 && (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50/80 p-5">
            <h3 className="flex items-center gap-2 font-bold text-rose-700">
              <AlertTriangle className="size-4" /> Subtareas vencidas
            </h3>
            <ul className="mt-3 space-y-2">
              {overdue.slice(0, 5).map((e) => (
                <li key={e.subitem.id}>
                  <Link to={`/proyectos/${e.boardId}`} className="flex items-center gap-3 rounded-xl bg-white p-3 transition hover:shadow-md">
                    {e.subitem.assignee && <UserAvatar user={e.subitem.assignee} className="size-7" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.subitem.name}</p>
                      <p className="truncate text-xs text-rose-600">
                        Venció el {fmtDate(e.subitem.dueDate, 'd MMM')} · {e.itemName}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-[2rem] bg-white/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Actividad reciente</h3>
            {totals.files > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="size-3" /> {totals.files} archivos
              </span>
            )}
          </div>
          <ul className="mt-4 space-y-4">
            {recentActivity.slice(0, 5).map((a) => (
              <li key={a.id} className="flex gap-3">
                <UserAvatar user={a.user} className="size-8" />
                <div className="min-w-0 text-xs">
                  <p>
                    <b>{a.user.name.split(' ')[0]}</b> {lowerFirst(a.detail)}
                  </p>
                  <Link to={`/proyectos/${a.boardId}`} className="block truncate font-medium text-primary hover:underline">
                    {a.itemName}
                  </Link>
                  <p className="text-muted-foreground">{fromNow(a.createdAt)}</p>
                </div>
              </li>
            ))}
            {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>}
          </ul>
        </div>
      </aside>
    </div>
  )
}

function Card({ title, subtitle, legend, children }: { title: string; subtitle?: string; legend?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {legend && <StatusLegend />}
      </div>
      {children}
    </div>
  )
}

const STATUS_ORDER: SubitemStatus[] = ['DONE', 'IN_PROGRESS', 'PENDING']

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {STATUS_ORDER.map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SUBITEM_STATUS[s].color }} />
          {SUBITEM_STATUS[s].label}
        </span>
      ))}
    </div>
  )
}

/** Barras horizontales por etapa: nombre y valor siempre como texto (el color solo acompaña). */
function StageBars({ stages }: { stages: { name: string; color: string; items: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.items))
  return (
    <div className="space-y-2.5">
      {stages.map((s) => (
        <Tooltip key={s.name}>
          <TooltipTrigger asChild>
            <div className="grid cursor-default grid-cols-[150px_1fr_28px] items-center gap-3 rounded-lg py-0.5 text-sm hover:bg-muted/40">
              <span className="flex items-center gap-2 truncate">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="truncate">{s.name}</span>
              </span>
              <div className="h-3 rounded-r-full bg-secondary/60">
                {s.items > 0 && <div className="h-full rounded-r-full transition-all" style={{ width: `${(s.items / max) * 100}%`, background: s.color }} />}
              </div>
              <span className="text-right font-semibold tabular-nums">{s.items}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {s.name}: {s.items} proyecto(s)
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/** Bugs del QA: estado de verificación, gravedad y reincidencias por programador. */
function BugQuality({ bugs }: { bugs: WsDashboardData['wsDashboard']['bugs'] }) {
  const tiles = [
    { label: 'Abiertos', value: bugs.open, className: 'text-rose-600' },
    { label: 'Por verificar', value: bugs.toVerify, className: 'text-sky-600' },
    { label: 'Verificados', value: bugs.verified, className: 'text-emerald-600' },
    { label: 'Reaperturas', value: bugs.reopens, className: 'text-amber-600' },
  ]
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl bg-secondary/50 px-3 py-2.5">
              <p className={cn('text-2xl font-extrabold tabular-nums', t.className)}>{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>
        <StageBars stages={bugs.bySeverity.map((b) => ({ name: `Gravedad ${BUG_SEVERITY[b.severity].label.toLowerCase()}`, color: BUG_SEVERITY[b.severity].color, items: b.count }))} />
      </div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-1 pb-2 font-medium">Programador</th>
              <th className="px-1 pb-2 text-right font-medium">Bugs</th>
              <th className="px-1 pb-2 text-right font-medium">Abiertos</th>
              <th className="px-1 pb-2 text-right font-medium">Reaperturas</th>
            </tr>
          </thead>
          <tbody>
            {bugs.byDeveloper.map((d) => (
              <tr key={d.user.id} className="border-t">
                <td className="px-1 py-2">
                  <span className="flex items-center gap-2">
                    <UserAvatar user={d.user} className="size-6" />
                    <span className="truncate">{d.user.name}</span>
                  </span>
                </td>
                <td className="px-1 py-2 text-right font-semibold tabular-nums">{d.total}</td>
                <td className="px-1 py-2 text-right tabular-nums">{d.open}</td>
                <td className={cn('px-1 py-2 text-right tabular-nums', d.reopens > 0 && 'font-semibold text-amber-600')}>{d.reopens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Estado de las subtareas: una barra 100% apilada + filas con conteo y horas. */
function StatusBreakdown({ items }: { items: { status: SubitemStatus; count: number; hours: number }[] }) {
  const total = items.reduce((s, i) => s + i.count, 0)
  return (
    <div>
      <div className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-secondary">
        {total > 0 &&
          items.map((i) =>
            i.count ? (
              <Tooltip key={i.status}>
                <TooltipTrigger asChild>
                  <div className="h-full" style={{ width: `${(i.count / total) * 100}%`, background: SUBITEM_STATUS[i.status].color }} />
                </TooltipTrigger>
                <TooltipContent>
                  {SUBITEM_STATUS[i.status].label}: {i.count} ({Math.round((i.count / total) * 100)}%)
                </TooltipContent>
              </Tooltip>
            ) : null
          )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {items.map((i) => (
          <div key={i.status} className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2.5">
            <span className="h-8 w-1.5 rounded-full" style={{ background: SUBITEM_STATUS[i.status].color }} />
            <div>
              <p className="text-xs text-muted-foreground">{SUBITEM_STATUS[i.status].label}</p>
              <p className="text-lg leading-tight font-bold tabular-nums">
                {i.count} <span className="text-xs font-medium text-muted-foreground">· {fmtHours(i.hours)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Horas por programador apiladas por estado, en una escala común. */
function Workload({ rows }: { rows: WsDashboardData['wsDashboard']['workload'] }) {
  const totalOf = (r: (typeof rows)[number]) => r.hoursDone + r.hoursInProgress + r.hoursPending
  const max = Math.max(1, ...rows.map(totalOf))
  if (!rows.length) return <p className="text-sm text-muted-foreground">Aún no hay subtareas asignadas.</p>
  return (
    <div className="space-y-3.5">
      {rows.map((r) => {
        const segments: [SubitemStatus, number][] = [
          ['DONE', r.hoursDone],
          ['IN_PROGRESS', r.hoursInProgress],
          ['PENDING', r.hoursPending],
        ]
        const total = totalOf(r)
        return (
          <div key={r.user.id} className="grid grid-cols-[170px_1fr_120px] items-center gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <UserAvatar user={r.user} className="size-8" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.user.name}</p>
                <p className="text-xs text-muted-foreground">{r.tasks} subtareas</p>
              </div>
            </div>
            <div className="flex h-3.5 gap-0.5" style={{ width: `${(total / max) * 100}%` }}>
              {segments.map(([status, hours]) =>
                hours ? (
                  <Tooltip key={status}>
                    <TooltipTrigger asChild>
                      <div className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: hours, background: SUBITEM_STATUS[status].color }} />
                    </TooltipTrigger>
                    <TooltipContent>
                      {r.user.name.split(' ')[0]} · {SUBITEM_STATUS[status].label}: {fmtHours(hours)}
                    </TooltipContent>
                  </Tooltip>
                ) : null
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">{fmtHours(total)}</p>
              {r.overdue > 0 ? (
                <p className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                  <AlertTriangle className="size-3" /> {r.overdue} vencida(s)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{fmtHours(r.hoursPending + r.hoursInProgress)} por hacer</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgendaRow({ entry }: { entry: AgendaEntry }) {
  const due = entry.subitem.dueDate ? toDate(entry.subitem.dueDate) : null
  const status = SUBITEM_STATUS[entry.subitem.status]
  return (
    <li>
      <Link to={`/proyectos/${entry.boardId}`} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-secondary/60">
        <div className="grid w-11 shrink-0 place-items-center rounded-xl bg-secondary py-1.5 text-center leading-none">
          <span className="text-lg font-bold text-primary">{due ? format(due, 'd') : '—'}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{due ? format(due, 'MMM', { locale: es }) : ''}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{entry.subitem.name}</p>
          <p className="truncate text-xs text-muted-foreground">{entry.itemName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: status.color }} />
            {status.label}
            <Clock className="ml-1 size-3" /> {formatRange(entry.subitem.startDate, entry.subitem.dueDate)}
            {entry.subitem.hours ? ` · ${fmtHours(entry.subitem.hours)}` : ''}
          </p>
        </div>
        {entry.subitem.assignee && <UserAvatar user={entry.subitem.assignee} className="size-7" />}
      </Link>
    </li>
  )
}
