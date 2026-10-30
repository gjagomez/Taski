import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@apollo/client/react'
import { ArrowRight, BadgeCheck, Check, ChevronRight, Clock, GanttChart, Info, Kanban, LayoutList, Loader2, Plus, RotateCcw, Send, ShieldCheck, Trash2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/AppLayout'
import { EmptyState, Loading } from '@/components/common'
import { Battery, PeopleStack } from '@/components/workspace/cells'
import { DateRangeCell } from '@/components/workspace/DateRangeCell'
import { BUG_SEVERITY, BUG_SEVERITY_ORDER, SUBITEM_STATUS, isDevelopmentStage, isQaStage, workingHours } from '@/components/workspace/meta'
import { RejectQaDialog, SendToQaDialog } from '@/components/workspace/QaDialogs'
import { BugEvidence, ReportBugSheet, canReportBug } from '@/components/workspace/ReportBugSheet'
import { StatusPicker } from '@/components/workspace/StatusPicker'
import { SubitemGantt } from '@/components/workspace/SubitemGantt'
import { BugState, BugTag, QaTag, SubitemKanban, fmtHours, moveHint, useSubitemMoves, type KanbanLane } from '@/components/workspace/SubitemKanban'
import { TaskComments } from '@/components/workspace/TaskComments'
import { UserBadge, UserPicker } from '@/components/workspace/UserPicker'
import { useWsActions } from '@/components/workspace/useWsActions'
import { WS_ITEM_DETAIL } from '@/lib/graphql'
import { useAssignRestriction, useAuth } from '@/lib/auth'
import { fmtDateTime, fromNow, lowerFirst } from '@/lib/format'
import type { SubitemStatus, User, WsItem, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'

type ItemDetail = WsItem & {
  board: { id: string; name: string; folder: string | null }
  activity: { id: string; detail: string; createdAt: string; user: User }[]
}

const UNASSIGNED = 'sin-programador'

/** Kanban de las subtareas de un proyecto: un carril por programador y las columnas del flujo. */
export default function ProjectKanbanPage() {
  const { boardId, itemId } = useParams()
  const { user: me, can } = useAuth()
  const { data, loading } = useQuery<{ wsItem: ItemDetail | null }>(WS_ITEM_DETAIL, { variables: { id: itemId }, fetchPolicy: 'cache-and-network' })
  const moves = useSubitemMoves()
  const [editing, setEditing] = useState<string | null>(null)
  // Prueba de QA desde la que se está reportando un bug
  const [reporting, setReporting] = useState<WsSubitem | null>(null)
  const [creating, setCreating] = useState(false)
  const [onlyMine, setOnlyMine] = useState(false)
  const [showRules, setShowRules] = useState(true)
  const [view, setView] = useState<'kanban' | 'gantt'>('kanban')
  const actions = useWsActions()
  const [qaDialog, setQaDialog] = useState<'send' | 'assign' | 'reject' | null>(null)

  const item = data?.wsItem
  const tasks = (item?.subitems ?? []).map(moves.apply)

  // Un carril por persona (programadores y el QA): el usuario actual primero, luego por nombre; al final las subtareas sin programador
  const people = (() => {
    const map = new Map<string, { key: string; user: User | null; tasks: WsSubitem[] }>()
    for (const t of tasks) {
      const key = t.assignee?.id ?? UNASSIGNED
      if (!map.has(key)) map.set(key, { key, user: t.assignee, tasks: [] })
      map.get(key)!.tasks.push(t)
    }
    return [...map.values()]
      .filter((l) => !onlyMine || l.key === me?.id)
      .sort((a, b) => {
        if (a.key === me?.id) return -1
        if (b.key === me?.id) return 1
        if (a.key === UNASSIGNED) return 1
        if (b.key === UNASSIGNED) return -1
        return a.user!.name.localeCompare(b.user!.name, 'es')
      })
  })()
  const isQaLane = (key: string) => !!item?.qa && key === item.qa.id
  const lanes: KanbanLane[] = people.map((l) => ({
    key: l.key,
    tasks: l.tasks,
    highlight: l.key === me?.id,
    header: <ProgrammerHeader user={l.user} tasks={l.tasks} isMe={l.key === me?.id} isQa={isQaLane(l.key)} />,
  }))

  if (loading && !item) return <Panel><Loading /></Panel>
  if (!item) {
    return (
      <Panel>
        <EmptyState icon={<LayoutList />} title="Proyecto no encontrado">Puede que haya sido eliminado o que no lo tengas asignado.</EmptyState>
      </Panel>
    )
  }

  const done = tasks.filter((t) => t.status === 'DONE').length
  // "Enviar a QA": el proyecto debe estar En Desarrollo y, para el programador, con sus subtareas y bugs Finalizados
  const open = tasks.filter((t) => t.kind !== 'QA' && t.status !== 'DONE').length
  const bugs = tasks.filter((t) => t.kind === 'BUG')
  const toVerify = bugs.filter((b) => b.status === 'DONE' && !b.verifiedAt).length
  const reopenedOpen = bugs.filter((b) => b.status !== 'DONE').length
  const canOfferQa = isDevelopmentStage(item.group.name) && !!item.qaGroup
  const qaBlocked = !can('projects.changeStage') && open > 0
  // En QA: el QA del proyecto (o un administrador) lo devuelve a desarrollo o lo aprueba; finalizar sus pruebas no lo aprueba solo
  const inQa = isQaStage(item.group.name)
  const openQa = tasks.filter((t) => t.kind === 'QA' && t.status !== 'DONE').length
  // Bugs abiertos con el proyecto en QA: los reportó el QA en esta revisión y aún no se devuelven al programador
  const qaPending = [
    openQa > 0 && `${openQa} prueba(s) abierta(s)`,
    inQa && reopenedOpen > 0 && `${reopenedOpen} bug(s) reportado(s) sin devolver`,
    toVerify > 0 && `${toVerify} bug(s) por verificar`,
  ]
    .filter(Boolean)
    .join(', ')
  const canReject = inQa && (item.qa?.id === me?.id || can('projects.changeStage'))
  const canApprove = canReject && !!item.qa && openQa === 0 && toVerify === 0 && reopenedOpen === 0
  async function approve() {
    if (!window.confirm(`¿Aprobar "${item!.name}" y pasarlo a Producción?\n\nSi alguna prueba encontró defectos, usa "Devolver a desarrollo" para registrarlos como bugs.`)) return
    await actions.approveQa(item!.id)
  }
  const canVerify = inQa && (item.qa?.id === me?.id || can('subitems.manageAll'))
  // El programador del proyecto lo regresa a desarrollo mientras el QA no esté probando (si no, lo devuelve el QA)
  const qaTesting = tasks.some((t) => t.kind === 'QA' && t.status === 'IN_PROGRESS')
  const isMember = item.assignees.some((u) => u.id === me?.id)
  const canWithdraw = inQa && !!item.devGroup && isMember && !canReject && !qaTesting
  async function withdraw() {
    if (await actions.patchItem(item!.id, { groupId: item!.devGroup!.id })) toast.success(`"${item!.name}" regresó a ${item!.devGroup!.name}`)
  }
  const hours = tasks.reduce((n, t) => n + (t.hours ?? 0), 0)
  const editingTask = tasks.find((t) => t.id === editing) ?? null

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)] p-4 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link to="/proyectos" className="hover:text-foreground">Proyectos</Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/proyectos/${boardId}`} className="hover:text-foreground">
          {item.board.name}
          {item.board.folder && ` · ${item.board.folder}`}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{item.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: item.group.color }}>
              {item.group.name}
            </span>
            <span className="group/people"><PeopleStack people={item.assignees} /></span>
            <span>
              {done}/{tasks.length} subtareas finalizadas · {fmtHours(hours)}
            </span>
          </div>
          <Battery subitems={tasks} className="mt-3 max-w-md px-0" />
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
            <input type="checkbox" className="accent-primary" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
            Solo mis subtareas
          </label>
          <Button asChild variant="outline" className="rounded-full">
            <Link to={`/proyectos/${boardId}`}>
              <LayoutList /> Ver tablero
            </Link>
          </Button>
          <Button className="rounded-full shadow-lg shadow-primary/30" onClick={() => setCreating(true)}>
            <Plus /> Nueva subtarea
          </Button>
        </div>
      </div>

      {canOfferQa && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <ShieldCheck className="size-5 shrink-0 text-sky-600" />
          <p className="flex-1">
            {qaBlocked ? (
              <>Para enviar el proyecto a <b>{item.qaGroup!.name}</b> todas sus subtareas y bugs deben estar Finalizados (faltan <b>{open}</b>).</>
            ) : (
              <>¿Terminaste el desarrollo? Envía el proyecto a <b>{item.qaGroup!.name}</b> para su revisión.</>
            )}
          </p>
          <Button className="rounded-full" disabled={qaBlocked} onClick={() => setQaDialog('send')}>
            <Send /> Enviar a QA
          </Button>
        </div>
      )}

      {inQa && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <ShieldCheck className="size-5 shrink-0 text-sky-600" />
          <p className="flex-1">
            {item.qa ? (
              <>
                <b>{item.qa.id === me?.id ? 'Estás revisando' : `${item.qa.name} está revisando`}</b> este proyecto
                {qaPending && ` (${qaPending})`}.{' '}
                {canApprove
                  ? <>Pruebas finalizadas: <b>aprueba</b> el proyecto si todo pasó, o <b>devuélvelo</b> registrando los bugs encontrados.</>
                  : <>Pasa a <b>En Producción</b> solo cuando el QA lo aprueba, con todas las pruebas finalizadas y los bugs verificados.</>}
              </>
            ) : (
              <>Este proyecto está en QA sin un QA asignado. Elige quién lo revisará.</>
            )}
          </p>
          {!item.qa && (
            <Button className="rounded-full" onClick={() => setQaDialog('assign')}>
              <ShieldCheck /> Asignar QA
            </Button>
          )}
          {canWithdraw && (
            <Button variant="outline" className="rounded-full bg-white" onClick={withdraw}>
              <RotateCcw /> Regresar a desarrollo
            </Button>
          )}
          {inQa && isMember && !canReject && qaTesting && <span className="text-xs text-sky-800">El QA ya está probando: si hay que corregir algo, pídele que lo devuelva.</span>}
          {canReject && (
            <Button variant="outline" className="rounded-full border-rose-200 bg-white text-rose-700 hover:bg-rose-50" onClick={() => setQaDialog('reject')}>
              <RotateCcw /> Devolver a desarrollo
            </Button>
          )}
          {canReject && item.qa && (
            <Button
              className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!canApprove}
              title={canApprove ? undefined : `Antes de aprobar: ${qaPending}`}
              onClick={approve}
            >
              <BadgeCheck /> Aprobar y pasar a Producción
            </Button>
          )}
        </div>
      )}

      {/* Reglas del flujo (visibles para la demostración del ciclo de vida) */}
      <div className="mt-5 rounded-2xl border border-primary/15 bg-secondary/40 px-4 py-3">
        <button onClick={() => setShowRules((v) => !v)} className="flex w-full items-center gap-2 text-left text-sm font-semibold">
          <Info className="size-4 text-primary" /> Reglas del flujo
          <ChevronRight className={cn('ml-auto size-4 transition', showRules && 'rotate-90')} />
        </button>
        {showRules && (
          <div className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground md:grid-cols-2">
            <p><b className="text-foreground">Programadores del proyecto:</b> ven solo sus proyectos asignados y mueven todas sus subtareas.</p>
            <p><b className="text-foreground">Por hacer → En progreso:</b> requiere programador asignado.</p>
            <p><b className="text-foreground">En progreso → Finalizado:</b> el programador cierra la subtarea al terminarla.</p>
            <p><b className="text-foreground">Finalizado:</b> solo un administrador puede reabrirla (regresa a En progreso, con motivo opcional).</p>
            <p><b className="text-foreground">Enviar a QA:</b> el programador envía el proyecto de En Desarrollo a QA cuando todas sus subtareas están Finalizadas y elige al QA que lo revisará.</p>
            <p><b className="text-foreground">Pruebas de QA:</b> el QA registra sus pruebas en el mismo proyecto; solo él las mueve.</p>
            <p><b className="text-foreground">Bugs:</b> el QA devuelve el proyecto registrando cada bug (gravedad y pasos); cada uno queda asignado al mismo programador. El programador puede regresarlo él mismo mientras el QA no empiece a probar.</p>
            <p><b className="text-foreground">Cerrar un bug:</b> exige un comentario de resolución (causa y qué se corrigió). Para resolverlo se pueden crear tareas vinculadas al bug.</p>
            <p><b className="text-foreground">Verificación:</b> el QA verifica cada bug cerrado o lo reabre con un comentario (cuenta como reincidencia).</p>
            <p><b className="text-foreground">Producción:</b> el QA aprueba el proyecto de forma explícita, con todas sus pruebas finalizadas y los bugs verificados. Finalizar una prueba no la aprueba: si encontró defectos, se registran con "Devolver a desarrollo".</p>
          </div>
        )}
      </div>

      {bugs.length > 0 && <BugSummary bugs={bugs} onOpen={(t) => setEditing(t.id)} />}

      <div className="mt-5 flex w-fit rounded-full border bg-white p-1 text-sm">
        {(
          [
            ['kanban', <Kanban key="k" className="size-4" />, 'Kanban'],
            ['gantt', <GanttChart key="g" className="size-4" />, 'Gantt'],
          ] as const
        ).map(([value, icon, label]) => (
          <button
            key={value}
            onClick={() => setView(value)}
            className={cn('flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition', view === value ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-foreground')}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {view === 'kanban' ? (
          <SubitemKanban
            lanes={lanes}
            laneLabel="Programador"
            emptyText={onlyMine ? 'No tienes subtareas en este proyecto.' : 'Este proyecto aún no tiene subtareas.'}
            onOpen={(t) => setEditing(t.id)}
            onMove={moves.request}
            hint={moveHint}
          />
        ) : (
          <SubitemGantt
            lanes={people.map((l) => ({ ...l, label: isQaLane(l.key) ? 'QA' : 'Programador' }))}
            onOpen={(t) => setEditing(t.id)}
            emptyText={onlyMine ? 'No tienes subtareas en este proyecto.' : 'Este proyecto aún no tiene subtareas.'}
          />
        )}
      </div>

      {/* Bitácora del proyecto */}
      <section className="mt-6 max-h-96 overflow-y-auto rounded-3xl border bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Clock className="size-4 text-primary" /> Bitácora
        </h3>
        <ol className="relative space-y-3 border-l-2 border-secondary pl-4">
          {item.activity.slice(0, 30).map((a) => (
            <li key={a.id} className="relative text-xs">
              <span className="absolute top-1 -left-[21px] size-2.5 rounded-full bg-primary ring-4 ring-white" />
              <p>
                <b>{a.user.name.split(' ')[0]}</b> {lowerFirst(a.detail)}
              </p>
              <p className="text-muted-foreground" title={fmtDateTime(a.createdAt)}>{fromNow(a.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>

      {moves.dialog}
      <TaskEditor
        task={editingTask}
        parent={tasks.find((t) => t.id === editingTask?.parentId) ?? null}
        test={tasks.find((t) => t.id === editingTask?.testId) ?? null}
        canVerify={canVerify}
        onReportBug={
          editingTask && canReportBug(item, editingTask, me, can('subitems.manageAll'))
            ? () => {
                setReporting(editingTask)
                setEditing(null)
              }
            : undefined
        }
        onClose={() => setEditing(null)}
        onMove={moves.request}
        onReopen={moves.reopen}
      />
      <NewTaskDialog
        itemId={item.id}
        asQa={item.qa?.id === me?.id}
        openBugs={bugs.filter((b) => b.status !== 'DONE')}
        open={creating}
        onOpenChange={setCreating}
      />
      {item.qaGroup && <SendToQaDialog item={item} open={qaDialog === 'send'} onOpenChange={(o) => setQaDialog(o ? 'send' : null)} />}
      {item.qaGroup && <SendToQaDialog item={item} assignOnly open={qaDialog === 'assign'} onOpenChange={(o) => setQaDialog(o ? 'assign' : null)} />}
      <RejectQaDialog item={item} developer={item.developer} reopenedBugs={reopenedOpen} open={qaDialog === 'reject'} onOpenChange={(o) => setQaDialog(o ? 'reject' : null)} />
      <ReportBugSheet item={item} test={reporting} onClose={() => setReporting(null)} />
    </Panel>
  )
}

/** Encabezado del carril de un programador (o del QA): su avance en el proyecto. */
function ProgrammerHeader({ user, tasks, isMe, isQa }: { user: User | null; tasks: WsSubitem[]; isMe: boolean; isQa: boolean }) {
  const hours = tasks.reduce((n, t) => n + (t.hours ?? 0), 0)
  const done = tasks.filter((t) => t.status === 'DONE').length
  return (
    <div className="flex items-start gap-2.5">
      {user ? (
        <UserBadge user={user} className="size-9 ring-0" />
      ) : (
        <span className="grid size-9 place-items-center rounded-full border border-dashed text-muted-foreground">
          <UserX className="size-4" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {user?.name ?? 'Sin programador'}
          {isQa && <QaTag className="ml-1.5" />}
          {isMe && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">Tú</span>}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {done}/{tasks.length} finalizadas · {fmtHours(hours)}
        </p>
      </div>
    </div>
  )
}

const ACTION_LABEL: Partial<Record<SubitemStatus, string>> = {
  PENDING: 'Regresar a Por hacer',
  IN_PROGRESS: 'Iniciar',
  DONE: 'Finalizar',
}

/**
 * Detalle de la subtarea: datos editables, botones con las transiciones permitidas y comentarios.
 * En un bug muestra lo que reportó el QA y, con el proyecto en QA, los botones de verificación.
 */
function TaskEditor({
  task,
  parent,
  test,
  canVerify,
  onReportBug,
  onClose,
  onMove,
  onReopen,
}: {
  task: WsSubitem | null
  /** Bug al que pertenece la tarea, si se creó para resolverlo */
  parent: WsSubitem | null
  /** Prueba de QA en la que se encontró el bug */
  test: WsSubitem | null
  canVerify: boolean
  /** Solo pruebas de QA: abre el registro de un bug encontrado en ella */
  onReportBug?: () => void
  onClose: () => void
  onMove: (t: WsSubitem, to: SubitemStatus) => void
  onReopen: (t: WsSubitem) => void
}) {
  const { user: me, can } = useAuth()
  const restrictTo = useAssignRestriction()
  const actions = useWsActions()
  const [name, setName] = useState('')
  const locked = task?.status === 'DONE'
  // Un colaborador solo edita sus subtareas (o toma una sin programador)
  // Finalizada: solo el administrador corrige sus datos
  const canEdit = !!task && (can('subitems.manageAll') || (!locked && (!task.assignee || task.assignee.id === me?.id)))

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent key={task?.id} className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        {task && (
          <>
            <DialogHeader>
              <span className="w-fit rounded-md px-2.5 py-1 text-xs font-semibold text-white" style={{ background: SUBITEM_STATUS[task.status].color }}>
                {SUBITEM_STATUS[task.status].label}
              </span>
              <DialogTitle className="text-xl">
                {task.kind === 'QA' && <QaTag className="mr-2 align-middle" />}
                {task.kind === 'BUG' && <BugTag severity={task.severity} className="mr-2 align-middle" />}
                {task.name}
              </DialogTitle>
              <DialogDescription>
                {locked && !canEdit
                  ? 'Subtarea finalizada: es de solo lectura (un administrador puede reabrirla).'
                  : locked
                    ? 'Subtarea finalizada: como administrador puedes corregir sus datos o reabrirla.'
                    : canEdit
                      ? 'Edita los datos o mueve la subtarea según el flujo.'
                      : `Asignada a ${task.assignee?.name}: solo ese programador (o un administrador) puede modificarla.`}
              </DialogDescription>
            </DialogHeader>

            {task.kind === 'BUG' && <BugDetails bug={task} canVerify={canVerify} onDone={onClose} />}
            {parent && (
              <p className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900">
                Tarea para resolver el bug <b>{parent.name}</b>
              </p>
            )}
            {test && (
              <p className="flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">
                <QaTag className="shrink-0" /> Encontrado en la prueba <b>{test.name}</b>
              </p>
            )}
            {onReportBug && (
              <Button variant="outline" className="w-fit rounded-full border-rose-200 text-rose-700 hover:bg-rose-50" onClick={onReportBug}>
                Reportar bug de esta prueba
              </Button>
            )}

            {canEdit && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input
                    defaultValue={task.name}
                    disabled={task.kind === 'BUG' && !can('subitems.manageAll')}
                    title={task.kind === 'BUG' ? 'El título del bug lo define el QA que lo reportó' : undefined}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => name.trim() && name.trim() !== task.name && actions.patchSubitem(task.id, { name: name.trim() })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Programador</Label>
                    <UserPicker value={task.assignee} restrictTo={restrictTo} onChange={(u) => actions.patchSubitem(task.id, { assigneeId: u?.id ?? null })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fechas</Label>
                    <DateRangeCell variant="field" start={task.startDate} end={task.dueDate} onChange={(startDate, dueDate) => actions.patchSubitem(task.id, { startDate, dueDate })} />
                  </div>
                </div>
              </div>
            )}

            {(!locked || task.allowedStatuses.length > 0) && (
              <div className="space-y-2 rounded-2xl bg-secondary/50 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Mover a</p>
                <div className="flex flex-wrap gap-2">
                  {task.allowedStatuses.map((to) =>
                    task.status === 'DONE' ? (
                      <Button
                        key={to}
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => {
                          onClose()
                          onReopen(task)
                        }}
                      >
                        <RotateCcw /> Reabrir
                      </Button>
                    ) : (
                      <Button
                        key={to}
                        size="sm"
                        className="rounded-full"
                        style={{ background: SUBITEM_STATUS[to].color }}
                        onClick={() => {
                          onClose()
                          onMove(task, to)
                        }}
                      >
                        {to === 'DONE' && <Check />} {ACTION_LABEL[to] ?? SUBITEM_STATUS[to].label} <ArrowRight />
                      </Button>
                    )
                  )}
                </div>
                {task.allowedStatuses.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {task.status === 'PENDING' && !task.assignee
                        ? 'Asígnate la subtarea para poder iniciarla.'
                        : 'No tienes movimientos disponibles para esta subtarea.'}
                  </p>
                )}
              </div>
            )}

            <TaskComments subitemId={task.id} />

            <DialogFooter className="sm:justify-between">
              {canEdit && (task.kind !== 'BUG' || can('subitems.manageAll')) ? (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    if (confirm(`¿Eliminar "${task.name}"?`) && (await actions.removeSubitem(task.id))) onClose()
                  }}
                >
                  <Trash2 /> Eliminar
                </Button>
              ) : (
                <span />
              )}
              <Button variant="outline" className="rounded-full" onClick={onClose}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * `asQa`: la crea el QA del proyecto, así que es una prueba de QA (el servidor la marca y se la asigna).
 * `openBugs`: el programador puede crear la tarea para resolver uno de ellos (queda vinculada al bug).
 */
function NewTaskDialog({
  itemId,
  asQa,
  openBugs,
  open,
  onOpenChange,
}: {
  itemId: string
  asQa: boolean
  openBugs: WsSubitem[]
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { user: me } = useAuth()
  const restrictTo = useAssignRestriction()
  const actions = useWsActions()
  const [name, setName] = useState('')
  // Un colaborador crea subtareas para sí mismo
  const [assignee, setAssignee] = useState<User | null>(restrictTo ? me : null)
  const [status, setStatus] = useState<SubitemStatus>('PENDING')
  const [range, setRange] = useState({ start: '', end: '' })
  const [parentId, setParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const hours = workingHours(range.start || null, range.end || null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Escribe el nombre de la subtarea')
    if (status === 'IN_PROGRESS' && !assignee) return toast.error('Para iniciarla en "En progreso" asigna un programador')
    setSaving(true)
    const ok = await actions.addSubitem(itemId, name.trim(), {
      assigneeId: assignee?.id ?? null,
      status,
      startDate: range.start || undefined,
      dueDate: range.end || undefined,
      parentId: parentId || undefined,
    })
    setSaving(false)
    if (ok) {
      setName('')
      setParentId('')
      setRange({ start: '', end: '' })
      setStatus('PENDING')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{asQa ? 'Nueva prueba de QA' : 'Nueva subtarea'}</DialogTitle>
          <DialogDescription>
            {asQa
              ? 'Queda asignada a ti y aparece en el Kanban y el Gantt del proyecto. Al finalizar todas tus pruebas, el proyecto pasa a Producción.'
              : 'Inicia en "Por hacer" (o en "En progreso" si ya tiene programador).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{asQa ? 'QA' : 'Programador'}</Label>
              <UserPicker value={assignee} onChange={setAssignee} restrictTo={restrictTo} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado inicial</Label>
              <StatusPicker value={status} onChange={setStatus} options={['PENDING', 'IN_PROGRESS']} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fechas {hours !== null && <span className="font-normal text-muted-foreground">· {hours} h laborales</span>}</Label>
            <DateRangeCell variant="field" start={range.start || null} end={range.end || null} onChange={(start, end) => setRange({ start, end })} />
          </div>
          {!asQa && openBugs.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="parent-bug">Para resolver el bug</Label>
              <select id="parent-bug" className="h-9 w-full rounded-md border bg-white px-2 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">— Ninguno (tarea independiente) —</option>
                {openBugs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.severity ? `[${BUG_SEVERITY[b.severity].label}] ` : ''}
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} Crear subtarea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Resumen de los bugs del proyecto: estado de cada uno, gravedad y reincidencias (trazabilidad de calidad). */
function BugSummary({ bugs, onOpen }: { bugs: WsSubitem[]; onOpen: (t: WsSubitem) => void }) {
  const stats = [
    { label: 'Abiertos', value: bugs.filter((b) => b.status !== 'DONE').length, className: 'text-rose-700' },
    { label: 'Por verificar', value: bugs.filter((b) => b.status === 'DONE' && !b.verifiedAt).length, className: 'text-sky-700' },
    { label: 'Verificados', value: bugs.filter((b) => b.verifiedAt).length, className: 'text-emerald-700' },
    { label: 'Reaperturas', value: bugs.reduce((n, b) => n + b.reopenCount, 0), className: 'text-amber-700' },
  ]
  return (
    <section className="mt-5 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          Bugs del proyecto ({bugs.length})
        </h3>
        {stats.map((s) => (
          <span key={s.label} className="text-xs text-muted-foreground">
            <b className={cn('text-base', s.className)}>{s.value}</b> {s.label}
          </span>
        ))}
        <span className="flex flex-wrap gap-1.5">
          {BUG_SEVERITY_ORDER.map((sev) => {
            const n = bugs.filter((b) => b.severity === sev).length
            return n ? (
              <span key={sev} className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: BUG_SEVERITY[sev].color }}>
                {BUG_SEVERITY[sev].label} {n}
              </span>
            ) : null
          })}
        </span>
      </div>
      <ul className="mt-3 divide-y text-sm">
        {bugs.map((b) => (
          <li key={b.id}>
            <button onClick={() => onOpen(b)} className="flex w-full flex-wrap items-center gap-2 py-2 text-left hover:text-primary">
              <BugTag severity={b.severity} />
              <span className={cn('min-w-0 flex-1 truncate', b.verifiedAt && 'text-muted-foreground')}>{b.name}</span>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: SUBITEM_STATUS[b.status].color }}>
                {SUBITEM_STATUS[b.status].label}
              </span>
              <BugState task={b} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Lo que reportó el QA y, para el QA con el proyecto en revisión, verificar o reabrir el bug. */
function BugDetails({ bug, canVerify, onDone }: { bug: WsSubitem; canVerify: boolean; onDone: () => void }) {
  const { itemId } = useParams()
  const actions = useWsActions()
  const [reopening, setReopening] = useState(false)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = bug.status === 'DONE' && !bug.verifiedAt

  async function verify(ok: boolean) {
    setSaving(true)
    const done = await actions.verifyBug(bug.id, ok, comment.trim() || undefined)
    setSaving(false)
    if (done) onDone()
  }

  return (
    <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {bug.reportedBy && (
          <span>
            Reportado por <b className="text-foreground">{bug.reportedBy.name}</b>
          </span>
        )}
        <BugState task={bug} />
      </div>
      {bug.steps && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Descripción y pasos para reproducir</p>
          <p className="break-words whitespace-pre-wrap">{bug.steps}</p>
        </div>
      )}
      {itemId && <BugEvidence itemId={itemId} files={bug.evidence} />}
      {canVerify && pending && (
        <div className="space-y-2 border-t border-rose-200 pt-2">
          <p className="text-xs font-semibold text-sky-800">Verificación del QA</p>
          {reopening && (
            <Textarea autoFocus rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Qué sigue fallando (obligatorio para reabrir)" />
          )}
          <div className="flex flex-wrap gap-2">
            {reopening ? (
              <>
                <Button size="sm" variant="destructive" className="rounded-full" disabled={saving || !comment.trim()} onClick={() => verify(false)}>
                  {saving ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reabrir bug
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReopening(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={() => verify(true)}>
                  {saving ? <Loader2 className="animate-spin" /> : <BadgeCheck />} Verificado, ya no falla
                </Button>
                <Button size="sm" variant="outline" className="rounded-full border-rose-200 text-rose-700" onClick={() => setReopening(true)}>
                  <RotateCcw /> Sigue fallando
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
