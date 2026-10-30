import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { AlertTriangle, CheckCircle2, KanbanSquare, LayoutList, ListTodo, Timer } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Panel } from '@/components/AppLayout'
import { EmptyState, Loading, PageHeader } from '@/components/common'
import { SubitemStatusCell } from '@/components/workspace/cells'
import { DateRangeCell } from '@/components/workspace/DateRangeCell'
import { SUBITEM_STATUS } from '@/components/workspace/meta'
import { SubitemKanban, moveHint, useSubitemMoves, type KanbanLane } from '@/components/workspace/SubitemKanban'
import { useWsActions } from '@/components/workspace/useWsActions'
import { WS_MY_SUBITEMS } from '@/lib/graphql'
import type { SubitemStatus, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MySubitem {
  itemId: string
  itemName: string
  boardId: string
  boardName: string
  stageName: string
  stageColor: string
  subitem: WsSubitem
}

type Filter = 'OPEN' | 'OVERDUE' | SubitemStatus | 'ALL'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'OVERDUE', label: 'Vencidas' },
  { value: 'PENDING', label: 'Por hacer' },
  { value: 'IN_PROGRESS', label: 'En progreso' },
  { value: 'DONE', label: 'Finalizadas' },
  { value: 'ALL', label: 'Todas' },
]

const matches = (f: Filter, s: WsSubitem) =>
  f === 'ALL' ? true : f === 'OPEN' ? s.status !== 'DONE' : f === 'OVERDUE' ? s.isOverdue : s.status === f

const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`

type View = 'kanban' | 'list'
const VIEW_KEY = 'mis-tareas-vista'
const savedView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'kanban'
  } catch {
    return 'kanban'
  }
}

/** Subtareas de los tableros de Proyectos asignadas al usuario. */
export default function MyTasksPage() {
  const { data, loading } = useQuery<{ wsMySubitems: MySubitem[] }>(WS_MY_SUBITEMS, { fetchPolicy: 'cache-and-network' })
  const actions = useWsActions()
  const moves = useSubitemMoves()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('OPEN')
  const [view, setView] = useState<View>(savedView)
  const rows = data?.wsMySubitems ?? []

  function changeView(v: View) {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* sin almacenamiento: la vista no se recuerda */
    }
  }
  const visible = rows.filter((r) => matches(filter, r.subitem))

  const open = rows.filter((r) => r.subitem.status !== 'DONE')
  const tiles = [
    { label: 'Abiertas', value: open.length, icon: ListTodo, tone: 'bg-violet-100 text-violet-600' },
    { label: 'Vencidas', value: rows.filter((r) => r.subitem.isOverdue).length, icon: AlertTriangle, tone: 'bg-rose-100 text-rose-600' },
    { label: 'Horas por hacer', value: fmtHours(open.reduce((t, r) => t + (r.subitem.hours ?? 0), 0)), icon: Timer, tone: 'bg-sky-100 text-sky-600' },
    { label: 'Finalizadas', value: rows.length - open.length, icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-600' },
  ]

  // Agrupadas por proyecto, en el orden en que llegan (abiertas y más urgentes primero)
  const groups = new Map<string, MySubitem[]>()
  for (const r of visible) groups.set(r.itemId, [...(groups.get(r.itemId) ?? []), r])

  // Kanban: todas mis subtareas, un carril por proyecto (las columnas ya separan los estados)
  const byProject = new Map<string, MySubitem[]>()
  for (const r of rows) byProject.set(r.itemId, [...(byProject.get(r.itemId) ?? []), r])
  const projectOf = new Map(rows.map((r) => [r.subitem.id, r]))
  const lanes: KanbanLane[] = [...byProject.values()].map((list) => {
    const first = list[0]!
    const tasks = list.map((r) => moves.apply(r.subitem))
    return {
      key: first.itemId,
      tasks,
      header: (
        <div>
          <Link to={`/proyectos/${first.boardId}/p/${first.itemId}`} className="line-clamp-2 text-sm leading-snug font-semibold hover:text-primary">
            {first.itemName}
          </Link>
          <span className="mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: first.stageColor }}>
            {first.stageName}
          </span>
          <p className="mt-1 text-[11px] text-muted-foreground">Tablero {first.boardName}</p>
        </div>
      ),
    }
  })

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <PageHeader title="Mis tareas" subtitle="Subtareas de los proyectos en las que eres el programador asignado." />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-3xl border bg-white p-4">
            <div className={cn('grid size-10 place-items-center rounded-2xl', tone)}>
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-2xl leading-tight font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted p-1 text-sm">
          {([
            ['kanban', 'Kanban', KanbanSquare],
            ['list', 'Lista', LayoutList],
          ] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              className={cn('flex items-center gap-1.5 rounded-full px-4 py-1.5 font-medium transition', view === v ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        {view === 'list' && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="flex-wrap">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label} ({rows.filter((r) => matches(f.value, r.subitem)).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      {loading && !data ? (
        <Loading />
      ) : view === 'kanban' && rows.length > 0 ? (
        <div className="mt-6">
          <SubitemKanban
            lanes={lanes}
            laneLabel="Proyecto"
            emptyText="No tienes subtareas asignadas."
            onOpen={(t) => {
              const r = projectOf.get(t.id)
              if (r) navigate(`/proyectos/${r.boardId}/p/${r.itemId}`)
            }}
            onMove={moves.request}
            hint={moveHint}
          />
          {moves.dialog}
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<ListTodo />} title={rows.length ? 'Nada por aquí' : 'No tienes subtareas asignadas'}>
            {rows.length ? 'No hay subtareas para este filtro.' : 'Cuando te asignen subtareas en los tableros de Proyectos aparecerán aquí.'}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {[...groups.values()].map((list) => {
            const first = list[0]!
            return (
              <section key={first.itemId} className="overflow-hidden rounded-3xl border bg-white">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-l-[6px] px-4 py-3" style={{ borderLeftColor: first.stageColor }}>
                  <Link to={`/proyectos/${first.boardId}`} className="font-semibold hover:text-primary">
                    {first.itemName}
                  </Link>
                  <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: first.stageColor }}>
                    {first.stageName}
                  </span>
                  <span className="text-xs text-muted-foreground">Tablero {first.boardName}</span>
                  <Link to={`/proyectos/${first.boardId}/p/${first.itemId}`} className="ml-auto flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <KanbanSquare className="size-3.5" /> Kanban
                  </Link>
                </div>
                <div className="divide-y">
                  {list.map(({ subitem: s }) => (
                    <div key={s.id} className="grid grid-cols-[1fr_150px_190px_70px] items-center">
                      <div className="flex min-w-0 items-center gap-2 px-4 py-2.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: SUBITEM_STATUS[s.status].color }} />
                        <span className={cn('truncate text-sm', s.status === 'DONE' && 'text-muted-foreground line-through')}>{s.name}</span>
                      </div>
                      <div className="h-10">
                        <SubitemStatusCell
                          status={s.status}
                          allowed={s.allowedStatuses}
                          taskName={s.name}
                          onChange={(status, reason) =>
                            s.kind === 'BUG' && status === 'DONE' ? moves.request(s, status) : actions.patchSubitem(s.id, { status, reason })
                          }
                        />
                      </div>
                      <div className="h-10">
                        <DateRangeCell
                          start={s.startDate}
                          end={s.dueDate}
                          done={s.status === 'DONE'}
                          overdue={s.isOverdue}
                          onChange={(startDate, dueDate) => actions.patchSubitem(s.id, { startDate, dueDate })}
                        />
                      </div>
                      <div className="pr-4 text-right text-sm font-semibold tabular-nums">{s.hours !== null ? fmtHours(s.hours) : '—'}</div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
