import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { AlertTriangle, ChevronRight, KanbanSquare, Lock, Plus, Search, Table2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Panel } from '@/components/AppLayout'
import { AvatarStack, BugBadge, EmptyState, Loading, PriorityBadge, UserAvatar } from '@/components/common'
import { TaskCard } from '@/components/TaskCard'
import { TaskDialog } from '@/components/TaskDialog'
import { CreateTaskDialog } from '@/components/CreateTaskDialog'
import { BOARD, MOVE_TASK, SET_BOARD_MEMBERS, USERS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { fmtDate, STATUS_META, STATUS_ORDER } from '@/lib/format'
import type { Board, Status, Task, User } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function BoardPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const canManage = can('boards.manage')
  const [params, setParams] = useSearchParams()
  const { data, loading, error } = useQuery<{ board: Board | null }>(BOARD, { variables: { id } })
  const [moveTask] = useMutation(MOVE_TASK, { refetchQueries: ['Board', 'Dashboard'] })
  const [overrides, setOverrides] = useState<Record<string, Status>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const board = data?.board
  const openTaskId = params.get('tarea')
  const openTask = (taskId: string | null) => setParams(taskId ? { tarea: taskId } : {})

  const tasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (board?.tasks ?? [])
      .map((t) => (overrides[t.id] ? { ...t, status: overrides[t.id] } : t))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.labels.some((l) => l.toLowerCase().includes(q)) || t.assignee?.name.toLowerCase().includes(q))
  }, [board, overrides, search])

  if (loading && !board) return <Panel><Loading /></Panel>
  if (error || !board) {
    return (
      <Panel>
        <EmptyState icon={<Lock />} title="Tablero no disponible">
          {error ? errorMessage(error) : 'No existe o no tienes acceso a este tablero.'}
        </EmptyState>
      </Panel>
    )
  }

  const activeTask = tasks.find((t) => t.id === activeId) ?? null

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const task = tasks.find((t) => t.id === e.active.id)
    const to = e.over?.id as Status | undefined
    if (!task || !to || to === task.status) return
    if (!task.allowedTransitions.includes(to)) {
      toast.error(transitionHint(task, to))
      return
    }
    if (task.status === 'REVIEW' && to === 'IN_PROGRESS') {
      openTask(task.id)
      toast.info('Describe los defectos detectados para regresar la tarea a "En progreso".')
      return
    }
    setOverrides((o) => ({ ...o, [task.id]: to }))
    try {
      await moveTask({ variables: { id: task.id, status: to } })
      toast.success(`"${task.title}" → ${STATUS_META[to].label}`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setOverrides(({ [task.id]: _, ...rest }) => rest)
    }
  }

  return (
    <Panel className="min-h-[calc(100vh-2.5rem)]">
      <div className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/kanban" className="hover:text-foreground">Tableros Kanban</Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/kanban/${board.project.id}`} className="flex items-center gap-1.5 hover:text-foreground">
          <span className="size-2 rounded-full" style={{ background: board.project.color }} />
          {board.project.name}
        </Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{board.name}</h1>
          {board.description && <p className="mt-1 text-sm text-muted-foreground">{board.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <AvatarStack users={board.members} max={5} />
          {canManage && (
            <Button variant="outline" className="rounded-full" onClick={() => setMembersOpen(true)}>
              <UserCog /> Miembros
            </Button>
          )}
          <Button className="rounded-full shadow-lg shadow-primary/30" onClick={() => setCreating(true)}>
            <Plus /> Nueva tarea
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUS_ORDER.map((s) => (
          <span key={s} className={cn('rounded-full px-3 py-1 text-xs font-semibold', STATUS_META[s].soft)}>
            {STATUS_META[s].label}: {tasks.filter((t) => t.status === s).length}
          </span>
        ))}
        {board.stats.overdue > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
            <AlertTriangle className="size-3" /> Vencidas: {board.stats.overdue}
          </span>
        )}
      </div>

      <Tabs defaultValue="kanban" className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="kanban"><KanbanSquare /> Kanban</TabsTrigger>
            <TabsTrigger value="table"><Table2 /> Tabla</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarea, etiqueta o persona" className="rounded-full pl-9" />
          </div>
        </div>

        <TabsContent value="kanban" className="mt-4">
          <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            <div className="scrollbar-thin -mx-2 flex gap-4 overflow-x-auto px-2 pb-4">
              {STATUS_ORDER.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasks.filter((t) => t.status === status)}
                  activeTask={activeTask}
                  onOpen={openTask}
                />
              ))}
            </div>
            <DragOverlay>{activeTask && <TaskCard task={activeTask} dragging />}</DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="table" className="mt-4">
          <TaskTable tasks={tasks} onOpen={openTask} />
        </TabsContent>
      </Tabs>

      <CreateTaskDialog boardId={board.id} members={board.members} open={creating} onOpenChange={setCreating} />
      <TaskDialog taskId={openTaskId} onClose={() => openTask(null)} />
      {canManage && <MembersDialog board={board} open={membersOpen} onOpenChange={setMembersOpen} />}
    </Panel>
  )
}

// Prioriza la columna bajo el puntero; si no hay ninguna, usa la intersección.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

function transitionHint(task: Task, to: Status) {
  if (task.status === 'DONE') return 'La tarea está Completada: es un estado final.'
  if (task.status === 'BACKLOG' && to === 'IN_PROGRESS') return 'Asigna un responsable antes de iniciar la tarea.'
  if (task.status === 'IN_PROGRESS' && to === 'REVIEW') return 'Solo el responsable puede enviarla a revisión y todas las subtareas deben estar completas.'
  return `Transición no permitida: ${STATUS_META[task.status].label} → ${STATUS_META[to].label}`
}

function KanbanColumn({ status, tasks, activeTask, onOpen }: { status: Status; tasks: Task[]; activeTask: Task | null; onOpen: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const meta = STATUS_META[status]
  const dragging = !!activeTask && activeTask.status !== status
  const allowed = dragging && activeTask!.allowedTransitions.includes(status)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-[260px] flex-1 flex-col rounded-3xl bg-secondary/50 p-3 transition-all',
        dragging && allowed && 'bg-emerald-50 ring-2 ring-emerald-400',
        dragging && !allowed && 'opacity-50',
        isOver && allowed && 'ring-4'
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="h-5 w-1.5 rounded-full" style={{ background: meta.color }} />
        <h3 className="flex-1 text-sm font-semibold">{meta.label}</h3>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold">{tasks.length}</span>
      </div>
      {dragging && (
        <p className={cn('mb-2 px-1 text-[11px] font-medium', allowed ? 'text-emerald-700' : 'text-muted-foreground')}>
          {allowed ? 'Suelta aquí ✓' : 'Transición no permitida'}
        </p>
      )}
      <div className="flex min-h-24 flex-1 flex-col gap-3">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} onOpen={() => onOpen(t.id)} />
        ))}
        {tasks.length === 0 && <div className="grid h-24 place-items-center rounded-2xl border-2 border-dashed border-primary/15 text-xs text-muted-foreground">Sin tareas</div>}
      </div>
    </div>
  )
}

function DraggableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id, disabled: task.status === 'DONE' })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn('touch-none', isDragging && 'opacity-30')}>
      <TaskCard task={task} onClick={onOpen} />
    </div>
  )
}

function TaskTable({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-6">
      {STATUS_ORDER.map((status) => {
        const group = tasks.filter((t) => t.status === status)
        const meta = STATUS_META[status]
        return (
          <div key={status}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: meta.color }}>
              {meta.label} <span className="font-normal text-muted-foreground">· {group.length} tareas</span>
            </h3>
            <div className="overflow-hidden rounded-2xl border border-l-[6px]" style={{ borderLeftColor: meta.color }}>
              <Table className="min-w-[860px] table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Tarea</TableHead>
                    <TableHead className="w-48">Responsable</TableHead>
                    <TableHead className="w-36 text-center">Estado</TableHead>
                    <TableHead className="w-28">Prioridad</TableHead>
                    <TableHead className="w-36">Fecha límite</TableHead>
                    <TableHead className="w-44">Progreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpen(t.id)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.type === 'BUG' && <BugBadge />}
                          {t.title}
                        </div>
                      </TableCell>
                      <TableCell>{t.assignee ? <div className="flex items-center gap-2"><UserAvatar user={t.assignee} className="size-6" /><span className="text-sm">{t.assignee.name}</span></div> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="p-0">
                        <div className="mx-1 py-2.5 text-center text-xs font-semibold text-white" style={{ background: meta.color }}>{meta.label}</div>
                      </TableCell>
                      <TableCell><PriorityBadge priority={t.priority} /></TableCell>
                      <TableCell className={cn(t.isOverdue && 'font-semibold text-rose-600')}>
                        {t.isOverdue && <AlertTriangle className="mr-1 inline size-3.5" />}
                        {fmtDate(t.dueDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${t.progress}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs">{t.progress}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {group.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Sin tareas</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MembersDialog({ board, open, onOpenChange }: { board: Board; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data } = useQuery<{ users: User[] }>(USERS, { skip: !open })
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [save, { loading }] = useMutation(SET_BOARD_MEMBERS, { refetchQueries: ['Board'] })
  const current = selected ?? new Set(board.members.map((m) => m.id))

  const toggle = (id: string) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function submit() {
    try {
      await save({ variables: { boardId: board.id, userIds: [...current] } })
      toast.success('Miembros actualizados')
      onOpenChange(false)
      setSelected(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSelected(null) }}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Miembros del tablero</DialogTitle>
          <DialogDescription>Los colaboradores solo ven y editan los tableros a los que están asignados.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {data?.users.filter((u) => u.active).map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-muted">
              <Checkbox checked={current.has(u.id)} onCheckedChange={() => toggle(u.id)} />
              <UserAvatar user={u} />
              <div className="flex-1">
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className="text-[11px] text-muted-foreground">{u.role.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading} className="rounded-full">Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
