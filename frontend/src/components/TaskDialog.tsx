import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Lock,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { BugBadge, Loading, PriorityBadge, StatusBadge, UserAvatar } from '@/components/common'
import {
  ADD_CHECKLIST_ITEM,
  ADD_COMMENT,
  ADD_SUBTASK,
  DELETE_CHECKLIST_ITEM,
  DELETE_SUBTASK,
  DELETE_TASK,
  MOVE_TASK,
  TASK,
  TOGGLE_CHECKLIST_ITEM,
  UPDATE_SUBTASK,
  UPDATE_TASK,
} from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import { useAuth } from '@/lib/auth'
import { ACTION_LABEL, fmtDate, fmtDateTime, fromNow, STATUS_META } from '@/lib/format'
import type { Status, Task, User } from '@/lib/types'
import { cn } from '@/lib/utils'

const REFETCH = ['Task', 'Board', 'Dashboard', 'MyTasks', 'Project', 'Projects', 'Activity']

type FullTask = Task & { board: { id: string; name: string; members: User[]; project: { id: string; name: string; color: string } } }

const TRANSITION_UI: Record<Status, { to: Status; label: string; hint: string; icon: typeof ArrowRight; variant?: 'default' | 'outline' | 'destructive' }[]> = {
  BACKLOG: [{ to: 'IN_PROGRESS', label: 'Iniciar', hint: 'Requiere un responsable asignado', icon: ArrowRight }],
  IN_PROGRESS: [{ to: 'REVIEW', label: 'Enviar a revisión', hint: 'Solo el responsable, con todas las subtareas completas', icon: ArrowRight }],
  REVIEW: [
    { to: 'DONE', label: 'Aprobar y cerrar', hint: 'Cumple el criterio de aceptación', icon: CheckCircle2 },
    { to: 'IN_PROGRESS', label: 'Rechazar (defectos)', hint: 'Regresa a En progreso', icon: RotateCcw, variant: 'destructive' },
  ],
  DONE: [],
}

export function TaskDialog({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-3xl">
        {taskId && <TaskDetail taskId={taskId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { user, can } = useAuth()
  const { data, loading } = useQuery<{ task: FullTask }>(TASK, { variables: { id: taskId }, fetchPolicy: 'network-only' })
  const [moveTask, { loading: moving }] = useMutation(MOVE_TASK, { refetchQueries: REFETCH })
  const [deleteTask] = useMutation(DELETE_TASK, { refetchQueries: REFETCH })
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const task = data?.task

  if (loading && !task) {
    return (
      <>
        <DialogTitle className="sr-only">Cargando tarea</DialogTitle>
        <Loading />
      </>
    )
  }
  if (!task) return null
  const locked = task.status === 'DONE'

  async function move(to: Status, why?: string) {
    try {
      await moveTask({ variables: { id: task!.id, status: to, reason: why } })
      toast.success(`Tarea movida a "${STATUS_META[to].label}"`)
      setRejecting(false)
      setReason('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar esta tarea definitivamente?')) return
    try {
      await deleteTask({ variables: { id: task!.id } })
      toast.success('Tarea eliminada')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="flex max-h-[92vh] flex-col">
      <div className="border-b bg-gradient-to-br from-secondary/80 to-white px-6 pt-6 pb-5">
        <div className="mb-3 flex flex-wrap items-center gap-2 pr-8 text-xs text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: task.board.project.color }} />
          {task.board.project.name} / {task.board.name}
        </div>
        <DialogTitle className="pr-8 text-2xl leading-tight font-bold">{task.title}</DialogTitle>
        <DialogDescription className="sr-only">Detalle de la tarea</DialogDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          {task.type === 'BUG' && <BugBadge />}
          <PriorityBadge priority={task.priority} />
          {task.isOverdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
              <AlertTriangle className="size-3" /> Vencida
            </span>
          )}
          {locked && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <Lock className="size-3" /> Cerrada el {fmtDateTime(task.completedAt)}
            </span>
          )}
        </div>

        {!locked && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {TRANSITION_UI[task.status].map((t) => {
              const allowed = task.allowedTransitions.includes(t.to)
              const Icon = t.icon
              return (
                <Button
                  key={t.to}
                  size="sm"
                  variant={t.variant ?? 'default'}
                  disabled={moving}
                  title={t.hint}
                  className={cn('rounded-full', !allowed && 'opacity-60')}
                  onClick={() => (t.to === 'IN_PROGRESS' && task.status === 'REVIEW' ? setRejecting(true) : move(t.to))}
                >
                  {t.label} <Icon />
                </Button>
              )
            })}
            <span className="text-xs text-muted-foreground">
              {TRANSITION_UI[task.status].find((t) => !task.allowedTransitions.includes(t.to))?.hint}
            </span>
          </div>
        )}
        {rejecting && (
          <div className="mt-3 space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <Label className="text-rose-700">Describe los defectos detectados</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. El botón guardar no valida campos vacíos…" className="bg-white" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="destructive" disabled={!reason.trim() || moving} onClick={() => move('IN_PROGRESS', reason)}>
                Regresar a En progreso
              </Button>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-6 mt-4 w-fit">
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="subtasks">
            Subtareas {task.subtaskCount > 0 && `(${task.subtaskDone}/${task.subtaskCount})`}
          </TabsTrigger>
          <TabsTrigger value="comments">Comentarios ({task.comments?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <TabsContent value="details">
            <DetailsForm task={task} locked={locked} />
            <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>
                Creada por <b className="text-foreground">{task.createdBy.name}</b> el {fmtDateTime(task.createdAt)}
              </span>
              {(can('boards.manage') || user?.id === task.createdBy.id) && (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
                  <Trash2 /> Eliminar
                </Button>
              )}
            </div>
          </TabsContent>
          <TabsContent value="subtasks">
            <Subtasks task={task} locked={locked} />
          </TabsContent>
          <TabsContent value="comments">
            <Comments task={task} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTimeline task={task} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function DetailsForm({ task, locked }: { task: FullTask; locked: boolean }) {
  const initial = () => ({
    title: task.title,
    description: task.description ?? '',
    acceptanceCriteria: task.acceptanceCriteria ?? '',
    type: task.type,
    priority: task.priority,
    assigneeId: task.assignee?.id ?? 'none',
    labels: task.labels.join(', '),
    startDate: task.startDate ?? '',
    dueDate: task.dueDate ?? '',
  })
  const [form, setForm] = useState(initial)
  const [updateTask, { loading }] = useMutation(UPDATE_TASK, { refetchQueries: REFETCH })
  useEffect(() => setForm(initial()), [task]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const dateError = form.startDate && form.dueDate && form.dueDate < form.startDate ? 'La fecha límite no puede ser anterior al inicio' : null

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('El título es obligatorio')
    if (dateError) return toast.error(dateError)
    try {
      await updateTask({
        variables: {
          id: task.id,
          input: {
            ...form,
            assigneeId: form.assigneeId === 'none' ? null : form.assigneeId,
            labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
          },
        },
      })
      toast.success('Cambios guardados')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={locked} className="contents">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Título</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Descripción</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Criterio de aceptación</Label>
          <Textarea rows={2} value={form.acceptanceCriteria} onChange={(e) => set('acceptanceCriteria', e.target.value)} placeholder="¿Cómo sabrá QA que la tarea está correcta?" />
        </div>
        <div className="space-y-1.5">
          <Label>Responsable</Label>
          <Select value={form.assigneeId} onValueChange={(v) => set('assigneeId', v)} disabled={locked}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {task.board.members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v as Task['priority'])} disabled={locked}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Media</SelectItem>
                <SelectItem value="LOW">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v as Task['type'])} disabled={locked}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TASK">Tarea</SelectItem>
                <SelectItem value="BUG">Bug</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Fecha de inicio</Label>
          <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha límite</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} aria-invalid={!!dateError} className={cn(task.isOverdue && 'border-rose-400 text-rose-600')} />
          {dateError && <p className="text-xs text-destructive">{dateError}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Etiquetas / categoría</Label>
          <Input value={form.labels} onChange={(e) => set('labels', e.target.value)} placeholder="frontend, auth, qa" />
        </div>
      </fieldset>
      {!locked && (
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={loading} className="rounded-full">
            <Save /> Guardar cambios
          </Button>
        </div>
      )}
    </form>
  )
}

function Subtasks({ task, locked }: { task: FullTask; locked: boolean }) {
  const [title, setTitle] = useState('')
  const [itemText, setItemText] = useState<Record<string, string>>({})
  const opts = { refetchQueries: REFETCH }
  const [addSubtask] = useMutation(ADD_SUBTASK, opts)
  const [updateSubtask] = useMutation(UPDATE_SUBTASK, opts)
  const [deleteSubtask] = useMutation(DELETE_SUBTASK, opts)
  const [addItem] = useMutation(ADD_CHECKLIST_ITEM, opts)
  const [toggleItem] = useMutation(TOGGLE_CHECKLIST_ITEM, opts)
  const [deleteItem] = useMutation(DELETE_CHECKLIST_ITEM, opts)

  const run = async (p: Promise<unknown>) => {
    try {
      await p
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-secondary/60 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Progreso de la tarea</span>
          <span className="font-bold text-primary">{task.progress}%</span>
        </div>
        <Progress value={task.progress} className="h-2.5" />
        <p className="mt-2 text-xs text-muted-foreground">
          {task.subtaskDone} de {task.subtaskCount} subtareas completadas
        </p>
      </div>

      {task.subtasks?.map((s) => {
        const done = s.checklist.filter((i) => i.done).length
        return (
          <div key={s.id} className="rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={s.status === 'DONE'}
                disabled={locked}
                onCheckedChange={(c) => run(updateSubtask({ variables: { id: s.id, status: c ? 'DONE' : 'PENDING' } }))}
              />
              <span className={cn('flex-1 font-medium', s.status === 'DONE' && 'text-muted-foreground line-through')}>{s.title}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', s.status === 'DONE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                {s.status === 'DONE' ? 'Completada' : 'Pendiente'}
              </span>
              {!locked && (
                <Button variant="ghost" size="icon-xs" aria-label="Eliminar subtarea" onClick={() => run(deleteSubtask({ variables: { id: s.id } }))}>
                  <X />
                </Button>
              )}
            </div>
            {(s.checklist.length > 0 || !locked) && (
              <div className="mt-3 ml-7 space-y-1.5 border-l-2 border-secondary pl-4">
                {s.checklist.length > 0 && (
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Checklist {done}/{s.checklist.length}
                  </p>
                )}
                {s.checklist.map((i) => (
                  <div key={i.id} className="group flex items-center gap-2 text-sm">
                    <Checkbox checked={i.done} disabled={locked} onCheckedChange={() => run(toggleItem({ variables: { id: i.id } }))} className="size-3.5" />
                    <span className={cn('flex-1', i.done && 'text-muted-foreground line-through')}>{i.text}</span>
                    {!locked && (
                      <button className="opacity-0 group-hover:opacity-100" onClick={() => run(deleteItem({ variables: { id: i.id } }))} aria-label="Eliminar elemento">
                        <X className="size-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <form
                    className="flex gap-2 pt-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const text = itemText[s.id]?.trim()
                      if (!text) return
                      run(addItem({ variables: { subtaskId: s.id, text } }))
                      setItemText({ ...itemText, [s.id]: '' })
                    }}
                  >
                    <Input value={itemText[s.id] ?? ''} onChange={(e) => setItemText({ ...itemText, [s.id]: e.target.value })} placeholder="Agregar elemento al checklist" className="h-7 text-xs" />
                  </form>
                )}
              </div>
            )}
          </div>
        )
      })}

      {!locked && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            run(addSubtask({ variables: { taskId: task.id, title } }))
            setTitle('')
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nueva subtarea…" />
          <Button type="submit" className="rounded-full">
            <Plus /> Agregar
          </Button>
        </form>
      )}
    </div>
  )
}

function Comments({ task }: { task: FullTask }) {
  const [body, setBody] = useState('')
  const [addComment, { loading }] = useMutation(ADD_COMMENT, { refetchQueries: REFETCH })
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    try {
      await addComment({ variables: { taskId: task.id, body } })
      setBody('')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
  return (
    <div className="space-y-4">
      {task.comments?.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" /> Aún no hay comentarios.
        </p>
      )}
      {task.comments?.map((c) => (
        <div key={c.id} className="flex gap-3">
          <UserAvatar user={c.user} />
          <div className="flex-1 rounded-2xl rounded-tl-sm bg-secondary/60 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{c.user.name}</span>
              <span className="text-[11px] text-muted-foreground">{fromNow(c.createdAt)}</span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
          </div>
        </div>
      ))}
      <form onSubmit={submit} className="flex items-end gap-2 pt-2">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe una observación o retroalimentación…" />
        <Button type="submit" size="icon-lg" className="rounded-full" disabled={loading || !body.trim()} aria-label="Enviar">
          <Send />
        </Button>
      </form>
    </div>
  )
}

const ACTION_COLOR: Record<string, string> = {
  CREATED: 'bg-violet-500',
  ASSIGNED: 'bg-sky-500',
  MOVED: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  REJECTED: 'bg-rose-500',
  COMMENTED: 'bg-slate-400',
}

function ActivityTimeline({ task }: { task: FullTask }) {
  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
        <Meta icon={CalendarClock} label="Creada" value={fmtDate(task.createdAt)} />
        <Meta icon={ArrowRight} label="Inicio / límite" value={`${fmtDate(task.startDate, 'd MMM')} → ${fmtDate(task.dueDate, 'd MMM')}`} />
        <Meta icon={CheckCircle2} label="Cierre" value={task.completedAt ? fmtDate(task.completedAt) : 'Abierta'} />
      </div>
      <ol className="relative space-y-4 border-l-2 border-secondary pl-6">
        {task.activity?.map((a) => (
          <li key={a.id} className="relative">
            <span className={cn('absolute top-1.5 -left-[31px] size-3 rounded-full ring-4 ring-white', ACTION_COLOR[a.action] ?? 'bg-primary')} />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-semibold">{a.user.name}</span>
              <span className="text-sm">{a.detail}</span>
            </div>
            <div className="mt-0.5 flex gap-2 text-[11px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5">{ACTION_LABEL[a.action] ?? a.action}</span>
              {fmtDateTime(a.createdAt)}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Meta({ icon: Icon, label, value }: { icon: typeof ArrowRight; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <p className="flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3" /> {label}
      </p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  )
}
