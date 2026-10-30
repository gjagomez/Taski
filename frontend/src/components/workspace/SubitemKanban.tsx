import { useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { BadgeCheck, Lock, MessageSquare, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { fmtDateTime } from '@/lib/format'
import type { BugSeverity, SubitemStatus, WsSubitem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatRange } from './DateRangeCell'
import { BUG_SEVERITY, KANBAN_COLUMNS, SUBITEM_STATUS } from './meta'
import { ReopenDialog } from './ReopenDialog'
import { ResolveBugDialog } from './ResolveBugDialog'
import { useWsActions } from './useWsActions'

export type KanbanLane = { key: string; header: ReactNode; tasks: WsSubitem[]; highlight?: boolean }

const COLS = `220px repeat(${KANBAN_COLUMNS.length}, minmax(190px, 1fr))`
export const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`

/** Motivo de un movimiento no permitido (el servidor tiene la última palabra). */
export function moveHint(task: WsSubitem, to: SubitemStatus) {
  if (task.status === 'DONE') return 'La subtarea está Finalizada: solo un administrador puede reabrirla.'
  if (task.status === 'PENDING' && to === 'IN_PROGRESS' && !task.assignee) return 'Asigna un programador antes de iniciar la tarea.'
  return `No se puede pasar de "${SUBITEM_STATUS[task.status].label}" a "${SUBITEM_STATUS[to].label}".`
}

/**
 * Movimientos de subtareas con actualización optimista. Reabrir una subtarea Finalizada (solo administrador)
 * pasa por el diálogo de motivo, y cerrar un bug por el del comentario de resolución: renderiza `dialog` en la página.
 */
export function useSubitemMoves() {
  const actions = useWsActions()
  const [overrides, setOverrides] = useState<Record<string, SubitemStatus>>({})
  const [reopening, setReopening] = useState<WsSubitem | null>(null)
  const [resolving, setResolving] = useState<WsSubitem | null>(null)

  const apply = (t: WsSubitem): WsSubitem => (overrides[t.id] ? { ...t, status: overrides[t.id]! } : t)

  async function move(task: WsSubitem, to: SubitemStatus, reason?: string, comment?: string) {
    setOverrides((o) => ({ ...o, [task.id]: to }))
    const ok = await actions.patchSubitem(task.id, { status: to, reason, comment })
    if (ok) toast.success(`"${task.name}" → ${SUBITEM_STATUS[to].label}`)
    setOverrides(({ [task.id]: _, ...rest }) => rest)
  }

  const request = (task: WsSubitem, to: SubitemStatus) => {
    if (task.status === 'DONE') setReopening(task)
    else if (task.kind === 'BUG' && to === 'DONE') setResolving(task)
    else move(task, to)
  }

  const dialog = (
    <>
      {reopening && (
        <ReopenDialog taskName={reopening.name} open onOpenChange={(o) => !o && setReopening(null)} onConfirm={(reason) => move(reopening, 'IN_PROGRESS', reason)} />
      )}
      {resolving && (
        <ResolveBugDialog
          bugName={resolving.name}
          open
          onOpenChange={(o) => !o && setResolving(null)}
          onConfirm={(comment) => move(resolving, 'DONE', undefined, comment)}
        />
      )}
    </>
  )
  return { apply, move, request, reopen: setReopening, dialog }
}

/** Tablero Kanban de subtareas: un carril por fila (programador o proyecto) y una columna por estado. */
export function SubitemKanban({
  lanes,
  laneLabel,
  emptyText,
  onOpen,
  onMove,
  hint,
  showAssignee = false,
}: {
  lanes: KanbanLane[]
  laneLabel: string
  emptyText: string
  onOpen: (task: WsSubitem) => void
  onMove: (task: WsSubitem, to: SubitemStatus) => void
  hint: (task: WsSubitem, to: SubitemStatus) => string
  /** Muestra el programador en cada tarjeta (cuando los carriles no son por programador) */
  showAssignee?: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const all = lanes.flatMap((l) => l.tasks.map((t) => ({ lane: l.key, task: t })))
  const active = all.find((e) => e.task.id === activeId) ?? null

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const entry = all.find((x) => x.task.id === e.active.id)
    if (!entry || !e.over) return
    const [laneKey, to] = String(e.over.id).split('|') as [string, SubitemStatus]
    if (laneKey !== entry.lane) return void toast.info('Las subtareas solo se mueven dentro de su propio carril.')
    if (to === entry.task.status) return
    if (!entry.task.allowedStatuses.includes(to)) return void toast.error(hint(entry.task, to))
    onMove(entry.task, to)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="scrollbar-thin overflow-x-auto pb-2">
        <div className="min-w-[900px]">
          {/* Encabezado de columnas */}
          <div className="sticky top-0 z-10 grid gap-2 bg-white/95 pb-2" style={{ gridTemplateColumns: COLS }}>
            <div className="px-2 text-xs font-semibold text-muted-foreground">{laneLabel}</div>
            {KANBAN_COLUMNS.map((status) => (
              <div key={status} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <span className="h-4 w-1.5 rounded-full" style={{ background: SUBITEM_STATUS[status].color }} />
                <span className="flex-1 text-sm font-semibold">{SUBITEM_STATUS[status].label}</span>
                <span className="rounded-full bg-white px-2 text-xs font-semibold">{all.filter((e) => e.task.status === status).length}</span>
              </div>
            ))}
          </div>

          {lanes.length === 0 && (
            <div className="grid h-32 place-items-center rounded-2xl border-2 border-dashed text-sm text-muted-foreground">{emptyText}</div>
          )}

          <div className="space-y-2">
            {lanes.map((lane) => (
              <div
                key={lane.key}
                className={cn('grid gap-2 rounded-2xl p-1.5', lane.highlight ? 'bg-primary/[0.06] ring-1 ring-primary/20' : 'bg-slate-50/60')}
                style={{ gridTemplateColumns: COLS }}
              >
                <div className="min-w-0 px-2 py-2">{lane.header}</div>
                {KANBAN_COLUMNS.map((status) => (
                  <Cell
                    key={status}
                    laneKey={lane.key}
                    status={status}
                    tasks={lane.tasks.filter((t) => t.status === status)}
                    active={active && active.lane === lane.key ? active.task : null}
                    dimmed={!!active && active.lane !== lane.key}
                    onOpen={onOpen}
                    showAssignee={showAssignee}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <DragOverlay>{active && <TaskCard task={active.task} dragging showAssignee={showAssignee} />}</DragOverlay>
    </DndContext>
  )
}

function Cell({
  laneKey,
  status,
  tasks,
  active,
  dimmed,
  onOpen,
  showAssignee,
}: {
  laneKey: string
  status: SubitemStatus
  tasks: WsSubitem[]
  active: WsSubitem | null
  dimmed: boolean
  onOpen: (task: WsSubitem) => void
  showAssignee: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${laneKey}|${status}` })
  const dragging = !!active && active.status !== status
  const allowed = dragging && active!.allowedStatuses.includes(status)
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-24 flex-col gap-2 rounded-xl p-1.5 transition-all',
        dragging && allowed && 'bg-emerald-50 ring-2 ring-emerald-400',
        dragging && !allowed && 'opacity-40',
        dimmed && 'opacity-40',
        isOver && allowed && 'ring-4'
      )}
    >
      {tasks.map((t) => (
        <DraggableCard key={t.id} task={t} onOpen={() => onOpen(t)} showAssignee={showAssignee} />
      ))}
      {dragging && allowed && tasks.length === 0 && (
        <div className="grid flex-1 place-items-center rounded-lg border-2 border-dashed border-emerald-300 text-[11px] font-medium text-emerald-700">Suelta aquí ✓</div>
      )}
    </div>
  )
}

function DraggableCard({ task, onOpen, showAssignee }: { task: WsSubitem; onOpen: () => void; showAssignee: boolean }) {
  // Solo se arrastra si el usuario tiene algún movimiento permitido
  const movable = task.allowedStatuses.length > 0
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id, disabled: !movable })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn('touch-none', isDragging && 'opacity-30')} onClick={onOpen}>
      <TaskCard task={task} locked={!movable} showAssignee={showAssignee} />
    </div>
  )
}

function TaskCard({ task, dragging, locked, showAssignee }: { task: WsSubitem; dragging?: boolean; locked?: boolean; showAssignee?: boolean }) {
  const range = formatRange(task.startDate, task.dueDate)
  const isDone = task.status === 'DONE'
  return (
    <div
      className={cn(
        'relative cursor-pointer rounded-xl border bg-white p-2.5 shadow-sm transition select-none hover:shadow-md',
        !locked && 'hover:-translate-y-0.5 hover:shadow-primary/10',
        task.isOverdue && 'border-rose-300 bg-rose-50/60',
        isDone && 'bg-emerald-50/50',
        dragging && 'rotate-2 shadow-2xl shadow-primary/25'
      )}
    >
      {locked && !isDone && <Lock className="absolute top-2 right-2 size-3 text-muted-foreground/60" />}
      <p className={cn('pr-4 text-[13px] leading-snug font-semibold', isDone && 'text-muted-foreground')}>
        {task.kind === 'QA' && <QaTag className="mr-1.5" />}
        {task.kind === 'BUG' && <BugTag severity={task.severity} className="mr-1.5" />}
        {task.name}
      </p>
      {task.kind === 'BUG' && <BugState task={task} className="mt-1.5" />}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        {range ? (
          <span className={cn('rounded-full px-2 py-0.5 font-medium', task.isOverdue ? 'bg-rose-500 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100')}>
            {task.isOverdue && '! '}
            {range}
          </span>
        ) : (
          <span className="text-muted-foreground">Sin fechas</span>
        )}
        <span className="flex items-center gap-2">
          {task.commentCount > 0 && (
            <span className="flex items-center gap-0.5 text-muted-foreground" title="Comentarios">
              <MessageSquare className="size-3" /> {task.commentCount}
            </span>
          )}
          {task.hours !== null && <span className="font-semibold">{fmtHours(task.hours)}</span>}
        </span>
      </div>
      {showAssignee && (
        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{task.assignee?.name ?? 'Sin programador'}</p>
      )}
      {isDone && task.completedAt && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-700">
          <Lock className="size-3" /> Cerrada el {fmtDateTime(task.completedAt)}
        </p>
      )}
    </div>
  )
}

/** Marca de las pruebas del QA (subtareas kind = 'QA'). */
export function QaTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block rounded bg-sky-500 px-1 py-px align-[1px] text-[9px] font-bold tracking-wide text-white', className)}>QA</span>
  )
}

/** Marca de los bugs que reporta el QA, con su gravedad. */
export function BugTag({ severity, className }: { severity: BugSeverity | null; className?: string }) {
  const sev = severity ? BUG_SEVERITY[severity] : null
  return (
    <span
      className={cn('inline-block rounded px-1 py-px align-[1px] text-[9px] font-bold tracking-wide text-white', className)}
      style={{ background: sev?.color ?? '#e11d48' }}
      title={sev ? `Bug · gravedad ${sev.label}` : 'Bug'}
    >
      BUG{sev && ` · ${sev.label.toUpperCase()}`}
    </span>
  )
}

/** Estado de verificación de un bug: por verificar (cerrado por el programador), verificado por el QA o reabierto. */
export function BugState({ task, className }: { task: WsSubitem; className?: string }) {
  if (!task.verifiedAt && task.status !== 'DONE' && !task.reopenCount) return null
  return (
    <span className={cn('flex flex-wrap gap-1 text-[10px] font-semibold', className)}>
      {task.verifiedAt ? (
        <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">
          <BadgeCheck className="size-3" /> Verificado por QA
        </span>
      ) : (
        task.status === 'DONE' && <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">Por verificar</span>
      )}
      {task.reopenCount > 0 && (
        <span className="flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-rose-700">
          <RotateCcw className="size-3" /> Reabierto {task.reopenCount}×
        </span>
      )}
    </span>
  )
}
