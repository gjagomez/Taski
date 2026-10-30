import { useState, type FormEvent } from 'react'
import { useMutation } from '@apollo/client/react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CREATE_TASK } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import type { User } from '@/lib/types'

const EMPTY = {
  title: '',
  description: '',
  acceptanceCriteria: '',
  type: 'TASK',
  priority: 'MEDIUM',
  assigneeId: 'none',
  labels: '',
  startDate: '',
  dueDate: '',
}

export function CreateTaskDialog({
  boardId,
  members,
  open,
  onOpenChange,
}: {
  boardId: string
  members: User[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [createTask, { loading }] = useMutation(CREATE_TASK, { refetchQueries: ['Board', 'Dashboard', 'MyTasks'] })
  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return setError('El título es obligatorio')
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      return setError('La fecha límite no puede ser anterior a la fecha de inicio')
    }
    setError(null)
    try {
      await createTask({
        variables: {
          input: {
            ...form,
            boardId,
            assigneeId: form.assigneeId === 'none' ? null : form.assigneeId,
            labels: form.labels.split(',').map((l) => l.trim()).filter(Boolean),
          },
        },
      })
      toast.success('Tarea creada en "Por hacer"')
      setForm(EMPTY)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nueva tarea</DialogTitle>
          <DialogDescription>Toda tarea nueva inicia en "Por hacer" (Backlog).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Título *</Label>
            <Input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} aria-invalid={!!error && !form.title.trim()} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Criterio de aceptación</Label>
            <Textarea rows={2} value={form.acceptanceCriteria} onChange={(e) => set('acceptanceCriteria', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TASK">Tarea</SelectItem>
                <SelectItem value="BUG">Bug</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Prioridad</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Media</SelectItem>
                <SelectItem value="LOW">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Responsable</Label>
            <Select value={form.assigneeId} onValueChange={(v) => set('assigneeId', v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            <Input value={form.labels} onChange={(e) => set('labels', e.target.value)} placeholder="frontend, qa" />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de inicio</Label>
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha límite</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="rounded-full">
              {loading ? <Loader2 className="animate-spin" /> : <Plus />} Crear tarea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
