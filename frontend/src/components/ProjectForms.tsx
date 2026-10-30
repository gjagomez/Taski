import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/common'
import { CREATE_BOARD, CREATE_PROJECT, UPDATE_PROJECT, USERS } from '@/lib/graphql'
import { errorMessage } from '@/lib/apollo'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'

const COLORS = ['#6d5df6', '#f45b69', '#00c875', '#fdab3d', '#579bfc', '#a25ddc', '#ff7575', '#037f4c']

type ProjectValue = { id?: string; name: string; description: string | null; color: string }

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project?: ProjectValue
  onSaved?: (id: string) => void
}) {
  const [form, setForm] = useState({ name: project?.name ?? '', description: project?.description ?? '', color: project?.color ?? COLORS[0] })
  const [error, setError] = useState<string | null>(null)
  const [create, { loading: creating }] = useMutation<{ createProject: { id: string } }>(CREATE_PROJECT, { refetchQueries: ['Projects', 'Dashboard'] })
  const [update, { loading: updating }] = useMutation(UPDATE_PROJECT, { refetchQueries: ['Project', 'Projects'] })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    try {
      if (project?.id) {
        await update({ variables: { id: project.id, input: form } })
        toast.success('Proyecto actualizado')
      } else {
        const { data } = await create({ variables: { input: form } })
        toast.success('Proyecto creado')
        onSaved?.(data!.createProject.id)
        setForm({ name: '', description: '', color: COLORS[0] })
      }
      setError(null)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{project?.id ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
          <DialogDescription>Un proyecto (espacio de trabajo) agrupa varios tableros.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!error} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={cn('grid size-8 place-items-center rounded-full ring-offset-2 transition', form.color === c && 'ring-2 ring-foreground')}
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                >
                  {form.color === c && <Check className="size-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="rounded-full" disabled={creating || updating}>
              {(creating || updating) && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BoardDialog({ projectId, open, onOpenChange, onSaved }: { projectId: string; open: boolean; onOpenChange: (o: boolean) => void; onSaved?: (id: string) => void }) {
  const { data } = useQuery<{ users: User[] }>(USERS, { skip: !open })
  const [form, setForm] = useState({ name: '', description: '' })
  const [members, setMembers] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [create, { loading }] = useMutation<{ createBoard: { id: string } }>(CREATE_BOARD, { refetchQueries: ['Project', 'Projects', 'Dashboard'] })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre es obligatorio')
    try {
      const { data } = await create({ variables: { input: { projectId, ...form, memberIds: [...members] } } })
      toast.success('Tablero creado con las columnas de estado por defecto')
      setForm({ name: '', description: '' })
      setMembers(new Set())
      setError(null)
      onOpenChange(false)
      onSaved?.(data!.createBoard.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Nuevo tablero</DialogTitle>
          <DialogDescription>Se crearán las columnas: Por hacer, En progreso, En revisión / QA y Completado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!error} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Miembros</Label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
              {data?.users.filter((u) => u.active && !u.permissions.includes('projects.viewAll')).map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-1.5 hover:bg-muted">
                  <Checkbox
                    checked={members.has(u.id)}
                    onCheckedChange={() => {
                      const next = new Set(members)
                      if (next.has(u.id)) next.delete(u.id)
                      else next.add(u.id)
                      setMembers(next)
                    }}
                  />
                  <UserAvatar user={u} className="size-7" />
                  <span className="text-sm">{u.name}</span>
                </label>
              ))}
            </div>
          </div>
          {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="rounded-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Crear tablero
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
